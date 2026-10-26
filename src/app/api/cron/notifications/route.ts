/**
 * Értesítési cron — emlékeztetők + visszajelzés-kérések + reggeli/esti összefoglalók.
 *
 * VPS cron hívja (percenként vagy óránként), CRON_SECRET-tel védve, pl.:
 *   * * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://booking.davelopment.hu/api/cron/notifications
 *
 * Öt feladat:
 *  1) Emlékeztető: közelgő, még ki nem küldött (reminder_sent=false) foglalások.
 *  2) Visszajelzés-kérés: lezajlott (múltbeli), feedback_sent=false foglalások.
 *  3) Digest összefoglaló: minden üzlet a SAJÁT nyitás/zárás idejéhez igazítva.
 *     - Szalon: nyitáskor → reggeli (in-app + email), záráskor → esti (in-app + email)
 *     - Étterem: nyitáskor → reggeli (in-app + push), záráskor → esti (in-app + push)
 *     - Idempotens: ha az adott típus ma már ment, nem küldi újra.
 *  4) Időszakos foglalási megnyitás: „hamarosan lejár” értesítés + automatikus megújítás
 *     (lib/bookingWindowNotices.ts).
 *  5) Takarítás: 90 napnál régebbi in-app értesítések + 30+ napja elhagyott (0 üzlet/sub/
 *     tagság) regisztrációk törlése — lásd lib/accountCleanup.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendReminderEmail as sendSalonReminder, sendFeedbackRequestEmail as sendSalonFeedback, sendSalonDigestEmail } from '@/lib/email'
import { sendReminderEmail as sendRestaurantReminder, sendFeedbackRequestEmail as sendRestaurantFeedback } from '@/lib/restaurantEmail'
import { sendPushToUsers } from '@/lib/webPush'
import { buildSalonAdvisor, buildRestaurantAdvisor, type SetupFlags } from '@/lib/tipsAdvisor'
import { getDashboardStats } from '@/lib/dashboardStats'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { purgeAbandonedAccounts } from '@/lib/accountCleanup'
import { processBookingWindows } from '@/lib/bookingWindowNotices'
import { reminderEnabled, reminderOffsets } from '@/lib/reminders'
import { ALL_CAPABILITIES } from '@/lib/permissions'
import type { Salon, Service, StaffMember, Booking, Restaurant, Reservation, User, Membership } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

const relId = (v: unknown): string | null =>
  v == null ? null : typeof v === 'object' ? String((v as { id: string | number }).id) : String(v)

function toMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}

/**
 * Melyik emlékeztető esedékes most? A legkisebb olyan időzítés, aminek az ablakába már
 * beléptünk, és ami közelebbi, mint a legutóbb kiküldött. `null` → most nincs teendő.
 */
function dueReminder(offsets: number[], start: number, now: number, lastOffset: number | null | undefined): number | null {
  if (now >= start) return null
  const inWindow = offsets.filter((h) => now >= start - h * 3600_000)
  if (inWindow.length === 0) return null
  const due = Math.min(...inWindow)
  if (lastOffset != null && due >= lastOffset) return null
  return due
}

/** Közvetlenül a kezdés előtti emlékeztető-ablakon BELÜL létrejött foglalásnak nem küldünk
 *  emlékeztetőt: a visszaigazolót épp most kapta meg, egy azonnal utána érkező emlékeztető
 *  felesleges (ez volt a „megerősítés után rögtön jön az emlékeztető is" hiba). */
function bookedInsideReminderWindow(createdAt: string | null | undefined, start: number, hours: number): boolean {
  const created = createdAt ? Date.parse(createdAt) : NaN
  return Number.isFinite(created) && created >= start - hours * 3600_000
}

/** YYYY-MM-DD (szerver-idő) — a jelölt-lekérdezés szűkítéséhez. */
function ymdOffset(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function feedbackEnabled(biz: Salon | Restaurant): boolean {
  // A Google-link már nem feltétel: a visszajelzés-email a saját /review/[token] oldalunkra
  // visz, a Google-átirányítás csak egy feltételes, utólagos lépés jó értékelésnél.
  return !!biz.feature_modules?.reviews_on
}

/** Budapest jelenlegi órája + mai dátuma (YYYY-MM-DD) + hét napja angolul. */
function getBudapestInfo(): { hour: number; dateStr: string; dow: string } {
  const now = new Date()
  const budapestStr = now.toLocaleString('sv-SE', { timeZone: 'Europe/Budapest' })
  const [dateStr, timeStr] = budapestStr.split(' ')
  const hour = parseInt(timeStr.split(':')[0], 10)
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dow = days[new Date(`${dateStr}T12:00:00`).getDay()]
  return { hour, dateStr, dow }
}

/** A tulaj bekapcsolva hagyta-e a "meg nem nyitott visszaigazoló email" riasztást (alapból igen). */
async function ownerWantsEmailOpenAlert(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  ownerId: string | null,
): Promise<boolean> {
  if (!ownerId) return false
  const ownerDoc = await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true })
  const prefs = (ownerDoc?.personal_notif_prefs as Record<string, boolean | null> | null) ?? {}
  return prefs.email_not_opened !== false
}

async function digestAlreadySent(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  digestType: 'digest_morning' | 'digest_evening',
  field: 'salon' | 'restaurant',
  placeId: string,
  dateStr: string,
): Promise<boolean> {
  const todayMidnight = new Date(`${dateStr}T00:00:00`)
  const existing = await payload.find({
    collection: 'notifications',
    where: {
      and: [
        { type: { equals: digestType } },
        { [field]: { equals: placeId } },
        { createdAt: { greater_than: todayMidnight.toISOString() } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return existing.totalDocs > 0
}

/** Ugyanaz a minta, mint `digestAlreadySent` — a heti tipp csak hétfőn 1x fut, de a cron
 *  percenként/óránként hívódik, ezért ugyanígy kell idempotensnek lennie aznapra. */
async function weeklyTipAlreadySent(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  field: 'salon' | 'restaurant',
  placeId: string,
  dateStr: string,
): Promise<boolean> {
  const todayMidnight = new Date(`${dateStr}T00:00:00`)
  const existing = await payload.find({
    collection: 'notifications',
    where: {
      and: [
        { type: { equals: 'weekly_tip' } },
        { [field]: { equals: placeId } },
        { createdAt: { greater_than: todayMidnight.toISOString() } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  return existing.totalDocs > 0
}

export async function GET(request: NextRequest) { return handle(request) }
export async function POST(request: NextRequest) { return handle(request) }

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided = request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Dev-only: ?force=morning|evening kihagyja a timing + idempotens ellenőrzést és rögtön létrehozza a digest értesítést.
  const forceDigest = process.env.NODE_ENV !== 'production'
    ? (request.nextUrl.searchParams.get('force') as 'morning' | 'evening' | null)
    : null
  // Dev-only: ?forceTip=1 kihagyja a hétfő-8-óra időzítés-ellenőrzést a heti tipp blokknál.
  const forceTip = process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('forceTip') === '1'

  const now = Date.now()
  const summary = { reminders: 0, feedback: 0, digest: 0, emailOpenAlerts: 0, weeklyTips: 0, bookingWindows: 0, notificationsCleaned: 0, accountsPurged: 0, errors: 0 }

  try {
    const payload = await getPayloadClient()

    // ── SALON: emlékeztetők ────────────────────────────────────────────────
    // Futásonkénti cache: a 15 napos ablakban sok foglalás tartozik ugyanahhoz az üzlethez.
    const salonCache = new Map<string, Salon>()
    const restaurantCache = new Map<string, Restaurant>()
    const salonReminderCandidates = await payload.find({
      collection: 'bookings',
      // Csak a következő napok foglalásai: korábban a múltbeli (sosem emlékeztetett) foglalások is
      // jelöltek voltak, és idővel kiszorították a jövőbelieket az 500-as limitből. 'pending'
      // (még jóvá nem hagyott) foglalásra nem megy emlékeztető.
      where: { reminder_sent: { not_equals: true }, status: { not_in: ['cancelled', 'completed', 'pending'] }, date: { greater_than_equal: ymdOffset(-1), less_than_equal: ymdOffset(15) } },
      depth: 0, limit: 2000, overrideAccess: true,
    })

    for (const doc of salonReminderCandidates.docs as Booking[]) {
      try {
        const salonId = relId(doc.salon)
        if (!salonId) continue
        const salonKey = `${salonId}:${doc.locale ?? 'hu'}`
        let salon = salonCache.get(salonKey)
        if (!salon) {
          salon = (await payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Salon
          salonCache.set(salonKey, salon)
        }
        if (!reminderEnabled(salon)) continue
        const offsets = reminderOffsets(salon.feature_modules)
        if (offsets.length === 0) continue
        const start = toMinutes(doc.date, doc.start_time)
        const hours = dueReminder(offsets, start, now, doc.reminder_last_offset)
        if (hours == null) continue
        // Az utolsó (legközelebbi) időzítés után a foglalás „kész" — többet nem jelölt.
        const reminderDone = { reminder_last_offset: hours, reminder_sent: hours === offsets[offsets.length - 1] }
        if (bookedInsideReminderWindow(doc.createdAt, start, hours)) {
          await payload.update({ collection: 'bookings', id: doc.id, data: reminderDone, overrideAccess: true })
          continue
        }

        const serviceId = relId(doc.service)
        const staffId = relId(doc.staff)
        if (!serviceId || !staffId) continue
        const [service, staff] = await Promise.all([
          payload.findByID({ collection: 'services', id: serviceId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' }) as Promise<Service>,
          payload.findByID({ collection: 'staff', id: staffId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' }) as Promise<StaffMember>,
        ])
        await sendSalonReminder({ booking: doc, salon, service, staff })
        await payload.update({ collection: 'bookings', id: doc.id, data: reminderDone, overrideAccess: true })
        summary.reminders++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Salon reminder failed for booking', doc.id, err)
      }
    }

    // ── SALON: visszajelzés-kérés ────────────────────────────────────────────
    const salonFeedbackCandidates = await payload.find({
      collection: 'bookings',
      // Csak az elmúlt napok foglalásai (a ciklus úgyis kihagyja a 2 napnál régebbit). Dátumszűrő nélkül
      // a régi / importált, feedback_sent=false foglalások kitöltenék az 500-as limitet, és a friss
      // foglalások sosem kapnának értékeléskérést.
      where: { feedback_sent: { not_equals: true }, status: { not_equals: 'cancelled' }, date: { greater_than_equal: ymdOffset(-3), less_than_equal: ymdOffset(0) } },
      depth: 0, limit: 500, overrideAccess: true,
    })

    for (const doc of salonFeedbackCandidates.docs as Booking[]) {
      try {
        const end = toMinutes(doc.date, doc.end_time)
        if (now - end > 2 * 24 * 3600_000) continue
        const salonId = relId(doc.salon)
        if (!salonId) continue
        const salon = (await payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Salon
        if (!feedbackEnabled(salon)) continue
        const delayMs = (salon.feature_modules?.review_delay_hours ?? 2) * 3600_000
        if (now - end < delayMs) continue
        const serviceId = relId(doc.service)
        const staffId = relId(doc.staff)
        if (!serviceId || !staffId) continue
        const [service, staff] = await Promise.all([
          payload.findByID({ collection: 'services', id: serviceId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' }) as Promise<Service>,
          payload.findByID({ collection: 'staff', id: staffId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' }) as Promise<StaffMember>,
        ])
        await sendSalonFeedback({ booking: doc, salon, service, staff })
        await payload.update({ collection: 'bookings', id: doc.id, data: { feedback_sent: true }, overrideAccess: true })
        summary.feedback++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Salon feedback failed for booking', doc.id, err)
      }
    }

    // ── RESTAURANT: emlékeztetők ───────────────────────────────────────────
    const resReminderCandidates = await payload.find({
      collection: 'reservations',
      where: { reminder_sent: { not_equals: true }, status: { not_in: ['cancelled', 'completed', 'no_show', 'pending'] }, date: { greater_than_equal: ymdOffset(-1), less_than_equal: ymdOffset(15) } },
      depth: 0, limit: 2000, overrideAccess: true,
    })

    for (const doc of resReminderCandidates.docs as Reservation[]) {
      try {
        if (!doc.customer_email) continue
        const restId = relId(doc.restaurant)
        if (!restId) continue
        const restKey = `${restId}:${doc.locale ?? 'hu'}`
        let restaurant = restaurantCache.get(restKey)
        if (!restaurant) {
          restaurant = (await payload.findByID({ collection: 'restaurants', id: restId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Restaurant
          restaurantCache.set(restKey, restaurant)
        }
        if (!reminderEnabled(restaurant)) continue
        const offsets = reminderOffsets(restaurant.feature_modules)
        if (offsets.length === 0) continue
        const start = toMinutes(doc.date, doc.start_time)
        const hours = dueReminder(offsets, start, now, doc.reminder_last_offset)
        if (hours == null) continue
        const reminderDone = { reminder_last_offset: hours, reminder_sent: hours === offsets[offsets.length - 1] }
        if (bookedInsideReminderWindow(doc.createdAt, start, hours)) {
          await payload.update({ collection: 'reservations', id: doc.id, data: reminderDone, overrideAccess: true })
          continue
        }

        await sendRestaurantReminder({ reservation: doc, restaurant })
        await payload.update({ collection: 'reservations', id: doc.id, data: reminderDone, overrideAccess: true })
        summary.reminders++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Restaurant reminder failed for reservation', doc.id, err)
      }
    }

    // ── RESTAURANT: visszajelzés-kérés ─────────────────────────────────────
    const resFeedbackCandidates = await payload.find({
      collection: 'reservations',
      // Csak az elmúlt napok foglalásai (a ciklus úgyis kihagyja a 2 napnál régebbit). Dátumszűrő nélkül
      // a régi / importált, feedback_sent=false foglalások kitöltenék az 500-as limitet, és a friss
      // foglalások sosem kapnának értékeléskérést.
      where: { feedback_sent: { not_equals: true }, status: { not_in: ['cancelled', 'no_show'] }, date: { greater_than_equal: ymdOffset(-3), less_than_equal: ymdOffset(0) } },
      depth: 0, limit: 500, overrideAccess: true,
    })

    for (const doc of resFeedbackCandidates.docs as Reservation[]) {
      try {
        if (!doc.customer_email) continue
        const end = toMinutes(doc.date, doc.end_time)
        if (now - end > 2 * 24 * 3600_000) continue
        const restId = relId(doc.restaurant)
        if (!restId) continue
        const restaurant = (await payload.findByID({ collection: 'restaurants', id: restId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Restaurant
        if (!feedbackEnabled(restaurant)) continue
        const delayMs = (restaurant.feature_modules?.review_delay_hours ?? 2) * 3600_000
        if (now - end < delayMs) continue
        await sendRestaurantFeedback({ reservation: doc, restaurant })
        await payload.update({ collection: 'reservations', id: doc.id, data: { feedback_sent: true }, overrideAccess: true })
        summary.feedback++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Restaurant feedback failed for reservation', doc.id, err)
      }
    }

    // ── SALON: meg nem nyitott visszaigazoló email riasztás (24h, majd 12h a foglalás előtt) ──
    for (const hours of [24, 12] as const) {
      const checkField = hours === 24 ? 'email_open_check_24h' : 'email_open_check_12h'
      const candidates = await payload.find({
        collection: 'bookings',
        where: { [checkField]: { not_equals: true }, status: { not_in: ['cancelled', 'completed'] } },
        depth: 0, limit: 500, overrideAccess: true,
      })

      for (const doc of candidates.docs as Booking[]) {
        try {
          const start = toMinutes(doc.date, doc.start_time)
          if (now < start - hours * 3600_000 || now >= start) continue

          const salonId = relId(doc.salon)
          if (!salonId) continue
          const salon = (await payload.findByID({ collection: 'salons', id: salonId, depth: 0, overrideAccess: true })) as Salon
          const ownerId = relId(salon.owner)

          const emailLogRes = await payload.find({
            collection: 'email-log',
            where: { and: [{ type: { equals: 'booking_confirmation' } }, { booking: { equals: doc.id } }] },
            sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true,
          })
          const log = emailLogRes.docs[0] as { ok?: boolean; status?: string } | undefined
          // Csak akkor riasztunk, ha az email tényleg elment (nem sikertelen — az más, már látható probléma) ÉS
          // még nem lett megnyitva/rákattintva.
          const stillUnopened = !!log?.ok && !['opened', 'clicked', 'failed', 'bounced', 'complained'].includes(log.status ?? '')

          if (stillUnopened && (await ownerWantsEmailOpenAlert(payload, ownerId))) {
            await payload.create({
              collection: 'notifications',
              overrideAccess: true,
              data: {
                salon: Number(salonId),
                audience: 'owner',
                type: 'email_not_opened',
                title: `Nem nyitotta meg a visszaigazolást – ${doc.customer_name}`,
                body: `${hours} órával a foglalás előtt (${doc.date} ${doc.start_time}) a vendég még nem nyitotta meg az emailt.`,
                read: false,
                booking: Number(doc.id),
                metadata: { hours, date: doc.date, start_time: doc.start_time },
              },
            })
            if (ownerId) {
              try {
                await sendPushToUsers(payload, [ownerId], {
                  title: `Nem nyitott email – ${salon.name}`,
                  body: `${doc.customer_name}: ${hours} órával a foglalás előtt még nem nyitotta meg a visszaigazolást.`,
                  url: '/dashboard/bookings',
                  tag: `email-open-${doc.id}-${hours}`,
                })
              } catch (pushErr) {
                console.error('[Cron] Salon email-open push failed', pushErr)
              }
            }
            summary.emailOpenAlerts++
          }

          await payload.update({ collection: 'bookings', id: doc.id, data: { [checkField]: true }, overrideAccess: true })
        } catch (err) {
          summary.errors++
          console.error('[Cron] Salon email-open check failed for booking', doc.id, err)
        }
      }
    }

    // ── RESTAURANT: meg nem nyitott visszaigazoló email riasztás (24h, majd 12h a foglalás előtt) ──
    for (const hours of [24, 12] as const) {
      const checkField = hours === 24 ? 'email_open_check_24h' : 'email_open_check_12h'
      const candidates = await payload.find({
        collection: 'reservations',
        where: { [checkField]: { not_equals: true }, status: { not_in: ['cancelled', 'completed', 'no_show'] } },
        depth: 0, limit: 500, overrideAccess: true,
      })

      for (const doc of candidates.docs as Reservation[]) {
        try {
          if (!doc.customer_email) { // nincs kinek — csak jelöljük ellenőrzöttnek, ne kérdezzük újra
            await payload.update({ collection: 'reservations', id: doc.id, data: { [checkField]: true }, overrideAccess: true })
            continue
          }
          const start = toMinutes(doc.date, doc.start_time)
          if (now < start - hours * 3600_000 || now >= start) continue

          const restId = relId(doc.restaurant)
          if (!restId) continue
          const restaurant = (await payload.findByID({ collection: 'restaurants', id: restId, depth: 0, overrideAccess: true })) as Restaurant
          const ownerId = relId(restaurant.owner)

          const emailLogRes = await payload.find({
            collection: 'email-log',
            where: { and: [{ type: { equals: 'booking_confirmation' } }, { reservation: { equals: doc.id } }] },
            sort: '-createdAt', limit: 1, depth: 0, overrideAccess: true,
          })
          const log = emailLogRes.docs[0] as { ok?: boolean; status?: string } | undefined
          const stillUnopened = !!log?.ok && !['opened', 'clicked', 'failed', 'bounced', 'complained'].includes(log.status ?? '')

          if (stillUnopened && (await ownerWantsEmailOpenAlert(payload, ownerId))) {
            await payload.create({
              collection: 'notifications',
              overrideAccess: true,
              data: {
                restaurant: Number(restId),
                audience: 'owner',
                type: 'email_not_opened',
                title: `Nem nyitotta meg a visszaigazolást – ${doc.customer_name}`,
                body: `${hours} órával a foglalás előtt (${doc.date} ${doc.start_time}) a vendég még nem nyitotta meg az emailt.`,
                read: false,
                reservation: Number(doc.id),
                metadata: { hours, date: doc.date, start_time: doc.start_time },
              },
            })
            if (ownerId) {
              try {
                await sendPushToUsers(payload, [ownerId], {
                  title: `Nem nyitott email – ${restaurant.name}`,
                  body: `${doc.customer_name}: ${hours} órával a foglalás előtt még nem nyitotta meg a visszaigazolást.`,
                  url: '/restaurant/bookings',
                  tag: `email-open-${doc.id}-${hours}`,
                })
              } catch (pushErr) {
                console.error('[Cron] Restaurant email-open push failed', pushErr)
              }
            }
            summary.emailOpenAlerts++
          }

          await payload.update({ collection: 'reservations', id: doc.id, data: { [checkField]: true }, overrideAccess: true })
        } catch (err) {
          summary.errors++
          console.error('[Cron] Restaurant email-open check failed for reservation', doc.id, err)
        }
      }
    }

    // ── DIGEST összefoglalók (üzletenként a saját nyitás/zárás idejéhez igazítva) ──
    const { hour, dateStr, dow } = getBudapestInfo()

    // ── SALON digest ──────────────────────────────────────────────────────────
    const allSalons = await payload.find({
      collection: 'salons',
      where: { is_active: { not_equals: false } },
      depth: 0, limit: 200, overrideAccess: true,
    })

    for (const salon of allSalons.docs as Salon[]) {
      try {
        const salonId = String(salon.id)

        let isMorning: boolean
        let isEvening: boolean

        if (forceDigest) {
          // Dev-force: kihagyjuk a timing + idempotens ellenőrzést.
          isMorning = forceDigest === 'morning'
          isEvening = forceDigest === 'evening'
        } else {
          // Szalon nyitvatartása: az adott nap ÖSSZES munkatárs availability-jéből a
          // legkorábbi start (nyitás) és legkésőbbi end (zárás) adja az üzlet "ablakát".
          const avails = await payload.find({
            collection: 'availability',
            where: {
              and: [
                { salon: { equals: salonId } },
                { day_of_week: { equals: dow } },
                { is_available: { equals: true } },
              ],
            },
            depth: 0, limit: 50, overrideAccess: true,
          })

          if (avails.totalDocs === 0) continue // zárva ma

          const startHours = avails.docs
            .map((a) => parseInt(((a as { start_time?: string }).start_time ?? '').split(':')[0], 10))
            .filter((h) => !isNaN(h))
          const endHours = avails.docs
            .map((a) => parseInt(((a as { end_time?: string }).end_time ?? '').split(':')[0], 10))
            .filter((h) => !isNaN(h))

          if (!startHours.length || !endHours.length) continue

          const openHour = Math.min(...startHours)
          const closeHour = Math.max(...endHours)

          isMorning = hour === openHour
          isEvening = hour === closeHour
          if (!isMorning && !isEvening) continue
        }

        // digestType CSAK isMorning/isEvening meghatározása UTÁN állítható — különben az esti
        // idempotens ellenőrzés a reggeli digest-et találja meg és blokkolja az estit.
        const digestType: 'digest_morning' | 'digest_evening' = isEvening ? 'digest_evening' : 'digest_morning'

        if (!forceDigest && await digestAlreadySent(payload, digestType, 'salon', salonId, dateStr)) continue

        const todayBookings = await payload.find({
          collection: 'bookings',
          where: {
            and: [
              { salon: { equals: salonId } },
              { date: { equals: dateStr } },
              { status: { not_equals: 'cancelled' } },
            ],
          },
          depth: 0, limit: 500, overrideAccess: true,
        })

        const bookingCount = todayBookings.totalDocs

        const todayShifts = await payload.find({
          collection: 'shifts',
          where: { and: [{ salon: { equals: salonId } }, { date: { equals: dateStr } }] },
          depth: 1, limit: 50, overrideAccess: true,
        })
        const firstShift = todayShifts.docs[0]
        const shiftStaff = firstShift?.staff && typeof firstShift.staff === 'object'
          ? (firstShift.staff as StaffMember)
          : null
        const shiftManager = shiftStaff ? { name: shiftStaff.name } : null
        const teamCount = todayShifts.totalDocs

        // Per-staff foglalás-bontás
        const staffCountMap = new Map<string, { name: string; count: number }>()
        for (const b of todayBookings.docs as Booking[]) {
          const sid = typeof b.staff === 'object' ? String((b.staff as StaffMember).id) : String(b.staff)
          if (!staffCountMap.has(sid)) staffCountMap.set(sid, { name: sid, count: 0 })
          staffCountMap.get(sid)!.count++
        }
        if (staffCountMap.size > 0) {
          const staffDocs = await payload.find({
            collection: 'staff',
            where: { id: { in: [...staffCountMap.keys()].map(Number) } },
            depth: 0, limit: 100, overrideAccess: true,
          })
          for (const s of staffDocs.docs as StaffMember[]) {
            const e = staffCountMap.get(String(s.id))
            if (e) e.name = s.name
          }
        }
        const staffBreakdown = [...staffCountMap.values()]
          .sort((a, b) => b.count - a.count)
          .map((e) => ({ name: e.name, bookings: e.count }))

        // Bevétel — ma beszedett előleg (a `deposit_paid` foglalásokból).
        const revenueHuf = (todayBookings.docs as Booking[]).reduce(
          (sum, b) => sum + (b.deposit_paid ? (b.deposit_amount_huf ?? 0) : 0),
          0,
        )

        // Top szolgáltatások — a mai foglalások szolgáltatás-bontása, ugyanaz a minta,
        // mint a fenti per-staff bontás.
        const serviceCountMap = new Map<string, { name: string; count: number }>()
        for (const b of todayBookings.docs as Booking[]) {
          const svcId = typeof b.service === 'object' ? String((b.service as Service).id) : String(b.service)
          if (!serviceCountMap.has(svcId)) serviceCountMap.set(svcId, { name: svcId, count: 0 })
          serviceCountMap.get(svcId)!.count++
        }
        if (serviceCountMap.size > 0) {
          const serviceDocs = await payload.find({
            collection: 'services',
            where: { id: { in: [...serviceCountMap.keys()].map(Number) } },
            depth: 0, limit: 100, overrideAccess: true,
          })
          for (const s of serviceDocs.docs as Service[]) {
            const e = serviceCountMap.get(String(s.id))
            if (e) e.name = s.name
          }
        }
        const topServices = [...serviceCountMap.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((e) => ({ name: e.name, bookings: e.count }))

        // Új vs visszatérő vendég — a mai egyedi vendégek közül hánynak volt a mai nap ELŐTT
        // bármilyen nem-lemondott foglalása ennél az üzletnél (telefon VAGY email alapján).
        const todayCustomers = new Map<string, { phone?: string | null; email?: string | null }>()
        for (const b of todayBookings.docs as Booking[]) {
          const key = b.customer_phone ? `p:${b.customer_phone}` : b.customer_email ? `e:${b.customer_email}` : `n:${b.customer_name}`
          if (!todayCustomers.has(key)) todayCustomers.set(key, { phone: b.customer_phone, email: b.customer_email })
        }
        const todayPhones = [...new Set([...todayCustomers.values()].map((c) => c.phone).filter(Boolean))] as string[]
        const todayEmails = [...new Set([...todayCustomers.values()].map((c) => c.email).filter(Boolean))] as string[]
        const returningKeys = new Set<string>()
        if (todayPhones.length || todayEmails.length) {
          const priorBookings = await payload.find({
            collection: 'bookings',
            where: {
              and: [
                { salon: { equals: salonId } },
                { date: { less_than: dateStr } },
                { status: { not_equals: 'cancelled' } },
                { or: [
                  ...(todayPhones.length ? [{ customer_phone: { in: todayPhones } }] : []),
                  ...(todayEmails.length ? [{ customer_email: { in: todayEmails } }] : []),
                ] },
              ],
            },
            depth: 0, limit: 500, overrideAccess: true,
          })
          for (const b of priorBookings.docs as Booking[]) {
            if (b.customer_phone) returningKeys.add(`p:${b.customer_phone}`)
            if (b.customer_email) returningKeys.add(`e:${b.customer_email}`)
          }
        }
        let newGuestCount = 0
        let returningGuestCount = 0
        for (const c of todayCustomers.values()) {
          const isReturning = (c.phone && returningKeys.has(`p:${c.phone}`)) || (c.email && returningKeys.has(`e:${c.email}`))
          if (isReturning) returningGuestCount++
          else newGuestCount++
        }

        const statusCounts = isEvening
          ? (todayBookings.docs as Booking[]).reduce(
              (acc, b) => {
                if (b.status === 'completed') acc.completed++
                else if (b.status === 'cancelled') acc.cancelled++
                return acc
              },
              { completed: 0, cancelled: 0 },
            )
          : undefined

        const ownerId = relId(salon.owner)

        // Digest app-pref: ha az owner kikapcsolta az app-értesítőt, az in-app notification sem jön.
        let ownerDigestAppOn = true
        if (ownerId) {
          const ownerDoc = await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true })
          const ownerPrefs = (ownerDoc?.personal_notif_prefs as Record<string, boolean | null> | null) ?? {}
          ownerDigestAppOn = ownerPrefs.digest !== false
        }

        // A rekord MINDIG létrejön — ez az idempotencia-jelző a következő cron-futásoknak
        // (lásd digestAlreadySent). Ha a tulaj kikapcsolta az appon belüli digest-értesítést,
        // a rekord `read: true`-val jön létre (nem jelenik meg olvasatlanul a haranggal), de
        // ATTÓL FÜGGETLENÜL LÉTEZIK, különben a push-küldés (lent) minden egyes cron-futásnál
        // (percenként) újra elsülne, mert nincs mihez képest ellenőrizni a "ma már elküldve" állapotot.
        await payload.create({
          collection: 'notifications',
          overrideAccess: true,
          data: {
            salon: Number(salonId),
            audience: 'owner',
            type: digestType,
            title: isEvening ? `Esti összefoglaló – ${dateStr}` : `Reggeli összefoglaló – ${dateStr}`,
            body: `${bookingCount} foglalás`,
            read: !ownerDigestAppOn,
            metadata: {
              bookings: bookingCount,
              guests: bookingCount,
              date: dateStr,
              team_count: teamCount,
              shift_manager: shiftManager,
              staff_breakdown: staffBreakdown,
              status: statusCounts,
              revenue_huf: revenueHuf > 0 ? revenueHuf : undefined,
              top_services: topServices.length > 0 ? topServices : undefined,
              new_guests: newGuestCount,
              returning_guests: returningGuestCount,
            },
          },
        })

        // Per-staff alkalmazotti digest — minden munkatársnak saját összefoglalója
        for (const [staffId, staffData] of staffCountMap.entries()) {
          try {
            const staffDoc = (await payload.findByID({ collection: 'staff', id: Number(staffId), depth: 0, overrideAccess: true })) as StaffMember & { email?: string | null }
            if (!staffDoc?.email) continue
            const userRes = await payload.find({ collection: 'users', where: { email: { equals: staffDoc.email } }, limit: 1, depth: 0, overrideAccess: true })
            const staffUser = userRes.docs[0]
            if (!staffUser) continue
            // a munkatárs saját „Napi összefoglaló” beállítása (Értesítések → Beállítások)
            if ((staffUser.personal_notif_prefs as Record<string, boolean | null> | null)?.digest === false) continue
            await payload.create({
              collection: 'notifications',
              overrideAccess: true,
              data: {
                user: staffUser.id,
                salon: Number(salonId),
                audience: 'member',
                type: digestType,
                title: isEvening ? `Esti összefoglalód – ${dateStr}` : `Reggeli összefoglalód – ${dateStr}`,
                body: `${staffData.count} foglalás ma`,
                read: false,
                metadata: {
                  bookings: staffData.count,
                  guests: staffData.count,
                  date: dateStr,
                  staff_name: staffData.name,
                },
              },
            })
          } catch (staffErr) {
            console.error('[Cron] Staff notification failed for staff', staffId, staffErr)
          }
        }

        const np = salon.notification_prefs as { digest_morning_email?: boolean | null; digest_evening_email?: boolean | null } | null
        // Explicit true kell — null/undefined = nincs bekapcsolva (korábban !==false volt, ami null-ra is küldött)
        const emailEnabled = isEvening ? np?.digest_evening_email === true : np?.digest_morning_email === true
        if (emailEnabled && ownerId) {
          const owner = (await payload.findByID({ collection: 'users', id: ownerId, overrideAccess: true })) as User
          if (owner?.email) {
            await sendSalonDigestEmail({
              salon,
              ownerEmail: owner.email,
              digestType: isEvening ? 'evening' : 'morning',
              date: dateStr,
              bookingCount,
              guestCount: bookingCount,
              shiftManager,
              status: statusCounts,
              revenueHuf: revenueHuf > 0 ? revenueHuf : undefined,
              topServices: topServices.length > 0 ? topServices : undefined,
              newGuests: newGuestCount,
              returningGuests: returningGuestCount,
            })
          }
        }
        // Push — szalon digest (ugyanúgy mint az étteremnél). Ugyanaz a preferencia
        // (`ownerDigestAppOn`) dönti el, mint az appon belüli értesítést — korábban ez a
        // push-ág teljesen figyelmen kívül hagyta a kapcsolót, kikapcsolt állapotban is ment.
        try {
          if (ownerDigestAppOn && ownerId) {
            await sendPushToUsers(
              payload,
              [ownerId],
              {
                title: `${isEvening ? 'Esti' : 'Reggeli'} összefoglaló · ${salon.name}`,
                body: `${bookingCount} foglalás ma`,
                url: '/dashboard/bookings',
                tag: `digest-${salonId}-${dateStr}-${digestType}`,
              },
            )
          }
        } catch (pushErr) {
          console.error('[Cron] Salon digest push failed', pushErr)
        }

        summary.digest++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Salon digest failed for', salon.id, err)
      }
    }

    // ── RESTAURANT digest ─────────────────────────────────────────────────────
    const allRestaurants = await payload.find({
      collection: 'restaurants',
      where: { is_active: { not_equals: false } },
      depth: 0, limit: 200, overrideAccess: true,
    })

    for (const restaurant of allRestaurants.docs as Restaurant[]) {
      try {
        const restId = String(restaurant.id)

        let isMorning: boolean
        let isEvening: boolean

        if (forceDigest) {
          isMorning = forceDigest === 'morning'
          isEvening = forceDigest === 'evening'
        } else {
          // Étterem nyitvatartása az opening-hours collectionből (adott nap).
          const ohResult = await payload.find({
            collection: 'opening-hours',
            where: {
              and: [
                { restaurant: { equals: restId } },
                { day_of_week: { equals: dow } },
                { is_open: { equals: true } },
              ],
            },
            depth: 0, limit: 1, overrideAccess: true,
          })

          if (ohResult.totalDocs === 0) continue // zárva ma

          const oh = ohResult.docs[0] as { open_time?: string; close_time?: string }
          const openHour = parseInt((oh.open_time ?? '').split(':')[0], 10)
          const closeHour = parseInt((oh.close_time ?? '').split(':')[0], 10)

          if (isNaN(openHour) || isNaN(closeHour)) continue

          isMorning = hour === openHour
          isEvening = hour === closeHour
          if (!isMorning && !isEvening) continue
        }

        // digestType CSAK isMorning/isEvening után — ld. szalon-rész magyarázata.
        const digestType: 'digest_morning' | 'digest_evening' = isEvening ? 'digest_evening' : 'digest_morning'

        if (!forceDigest && await digestAlreadySent(payload, digestType, 'restaurant', restId, dateStr)) continue

        const todayReservations = await payload.find({
          collection: 'reservations',
          where: {
            and: [
              { restaurant: { equals: restId } },
              { date: { equals: dateStr } },
              { status: { not_equals: 'cancelled' } },
            ],
          },
          depth: 0, limit: 500, overrideAccess: true,
        })

        const bookingCount = todayReservations.totalDocs
        if (bookingCount === 0 && isMorning && !forceDigest) continue

        const docs = todayReservations.docs as Reservation[]
        const guestCount = docs.reduce((s, r) => s + (r.pax ?? 1), 0)

        // Az ikon-kulcsot is megőrizzük (`occasion_icon` — a foglaló saját esemény-típus
        // választójából jön, ld. `EVENT_TYPE_ICONS`), hogy a digestben ikonnal jelenhessen meg.
        const occasions: Record<string, { count: number; icon?: string | null }> = {}
        for (const r of docs) {
          if (r.occasion) {
            const entry = occasions[r.occasion] ?? { count: 0, icon: r.occasion_icon }
            entry.count++
            occasions[r.occasion] = entry
          }
        }

        // Bevétel — ma beszedett előleg (a `deposit_paid` foglalásokból).
        const revenueHuf = docs.reduce((sum, r) => sum + (r.deposit_paid ? (r.deposit_amount_huf ?? 0) : 0), 0)

        // Ország-bontás — a `country` mező (ISO kód, a telefon-előhívóból) MÁR MEGLÉVŐ adat,
        // eddig sehol nem volt összesítve.
        const countries: Record<string, number> = {}
        for (const r of docs) {
          const c = (r as { country?: string | null }).country
          if (c) countries[c] = (countries[c] ?? 0) + 1
        }

        // Új vs visszatérő vendég — ugyanaz a minta, mint a szalon-digestnél.
        const todayCustomers = new Map<string, { phone?: string | null; email?: string | null }>()
        for (const r of docs) {
          const key = r.customer_phone ? `p:${r.customer_phone}` : r.customer_email ? `e:${r.customer_email}` : `n:${r.customer_name}`
          if (!todayCustomers.has(key)) todayCustomers.set(key, { phone: r.customer_phone, email: r.customer_email })
        }
        const todayPhones = [...new Set([...todayCustomers.values()].map((c) => c.phone).filter(Boolean))] as string[]
        const todayEmails = [...new Set([...todayCustomers.values()].map((c) => c.email).filter(Boolean))] as string[]
        const returningKeys = new Set<string>()
        if (todayPhones.length || todayEmails.length) {
          const priorReservations = await payload.find({
            collection: 'reservations',
            where: {
              and: [
                { restaurant: { equals: restId } },
                { date: { less_than: dateStr } },
                { status: { not_equals: 'cancelled' } },
                { or: [
                  ...(todayPhones.length ? [{ customer_phone: { in: todayPhones } }] : []),
                  ...(todayEmails.length ? [{ customer_email: { in: todayEmails } }] : []),
                ] },
              ],
            },
            depth: 0, limit: 500, overrideAccess: true,
          })
          for (const r of priorReservations.docs as Reservation[]) {
            if (r.customer_phone) returningKeys.add(`p:${r.customer_phone}`)
            if (r.customer_email) returningKeys.add(`e:${r.customer_email}`)
          }
        }
        let newGuestCount = 0
        let returningGuestCount = 0
        for (const c of todayCustomers.values()) {
          const isReturning = (c.phone && returningKeys.has(`p:${c.phone}`)) || (c.email && returningKeys.has(`e:${c.email}`))
          if (isReturning) returningGuestCount++
          else newGuestCount++
        }

        const source = isEvening
          ? docs.reduce(
              (acc, r) => {
                const s = (r as { source?: string }).source ?? 'online'
                if (s === 'walk_in') acc.walk_in++
                else if (s === 'phone') acc.phone++
                else acc.online++
                return acc
              },
              { walk_in: 0, phone: 0, online: 0 },
            )
          : undefined

        const status = isEvening
          ? docs.reduce(
              (acc, r) => {
                if (r.status === 'completed') acc.completed++
                else if (r.status === 'cancelled') acc.cancelled++
                else if (r.status === 'no_show') acc.no_show++
                return acc
              },
              { completed: 0, cancelled: 0, no_show: 0 },
            )
          : undefined

        // Műszak vezető
        const todayShifts = await payload.find({
          collection: 'shifts',
          where: { and: [{ restaurant: { equals: restId } }, { date: { equals: dateStr } }] },
          depth: 2, limit: 10, overrideAccess: true,
        })
        const firstShift = todayShifts.docs[0]
        let shiftManager: { name: string } | null = null
        if (firstShift?.member && typeof firstShift.member === 'object') {
          const membership = firstShift.member as Membership & { user?: User | null }
          const memberUser = membership.user && typeof membership.user === 'object' ? (membership.user as User) : null
          if (memberUser?.name) shiftManager = { name: memberUser.name }
        } else if (firstShift?.owner_shift) {
          const ownerId = relId(restaurant.owner)
          if (ownerId) {
            const owner = (await payload.findByID({ collection: 'users', id: ownerId, overrideAccess: true })) as User
            if (owner?.name) shiftManager = { name: owner.name }
          }
        }

        const restOwnerId = relId(restaurant.owner)
        let restOwnerDigestAppOn = true
        if (restOwnerId) {
          const restOwnerDoc = await payload.findByID({ collection: 'users', id: restOwnerId, depth: 0, overrideAccess: true })
          const restOwnerPrefs = (restOwnerDoc?.personal_notif_prefs as Record<string, boolean | null> | null) ?? {}
          restOwnerDigestAppOn = restOwnerPrefs.digest !== false
        }

        // Lásd a szalon-ágban lévő magyarázatot: a rekord MINDIG létrejön (idempotencia-jelző
        // a push-küldésnek), a tulaj preferenciája csak azt dönti el, olvasatlanul jelenjen-e meg.
        await payload.create({
          collection: 'notifications',
          overrideAccess: true,
          data: {
            restaurant: Number(restId),
            audience: 'owner',
            type: digestType,
            title: isEvening ? `Esti összefoglaló – ${dateStr}` : `Reggeli összefoglaló – ${dateStr}`,
            body: `${bookingCount} foglalás, ${guestCount} fő`,
            read: !restOwnerDigestAppOn,
            metadata: {
              bookings: bookingCount,
              guests: guestCount,
              date: dateStr,
              team_count: todayShifts.totalDocs,
              occasions: Object.keys(occasions).length > 0 ? occasions : undefined,
              shift_manager: shiftManager,
              source,
              status,
              revenue_huf: revenueHuf > 0 ? revenueHuf : undefined,
              countries: Object.keys(countries).length > 0 ? countries : undefined,
              new_guests: newGuestCount,
              returning_guests: returningGuestCount,
            },
          },
        })

        // Push — étteremnél nincs email digest. A tulajnál `restOwnerDigestAppOn` dönt (mint
        // az appon belüli értesítésnél), a csapattagoknál a SAJÁT `personal_notif_prefs.digest`
        // preferenciájuk — korábban ez a push-ág egyik kapcsolót sem nézte, mindenkinek ment.
        try {
          const members = await payload.find({
            collection: 'memberships',
            where: { and: [{ restaurant: { equals: restId } }, { status: { equals: 'active' } }] },
            limit: 200, depth: 0, overrideAccess: true,
          })
          const memberUserIds = members.docs.map((m) => m.user).filter(Boolean) as (string | number)[]
          let eligibleMemberIds: (string | number)[] = []
          if (memberUserIds.length > 0) {
            const memberUsers = await payload.find({
              collection: 'users',
              where: { id: { in: memberUserIds } },
              limit: 200, depth: 0, overrideAccess: true,
            })
            eligibleMemberIds = memberUsers.docs
              .filter((u) => (u.personal_notif_prefs as Record<string, boolean | null> | null)?.digest !== false)
              .map((u) => u.id)
          }
          const recipients = [
            ...(restOwnerDigestAppOn && restOwnerId ? [restOwnerId] : []),
            ...eligibleMemberIds,
          ]
          if (recipients.length > 0) {
            await sendPushToUsers(
              payload,
              recipients,
              {
                title: `${isEvening ? 'Esti' : 'Reggeli'} összefoglaló · ${restaurant.name}`,
                body: `${bookingCount} foglalás, ${guestCount} fő`,
                url: '/restaurant/bookings',
                tag: `digest-${restId}-${dateStr}-${digestType}`,
              },
            )
          }
        } catch (pushErr) {
          console.error('[Cron] Restaurant digest push failed', pushErr)
        }

        summary.digest++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Restaurant digest failed for', restaurant.id, err)
      }
    }

    // ── Heti tipp (proaktív segítségnyújtás) ────────────────────────────────────
    // A tipsAdvisor motor MÁR felismeri owner-oldalon a hasznos, kontextusfüggő tanácsokat
    // (`weeklyTip`) — eddig csak akkor látta a tulaj, ha épp benyitott a Tippek oldalra. Itt
    // a platform megy oda hozzá: hétfő reggelente, ha van aktuális tipp, egy in-app értesítés
    // + push megy ki róla. Csak hétfőn 8-kor fut, napi idempotencia-védelemmel (mint a digest).
    if (forceTip || (dow === 'monday' && hour === 8)) {
      const in14 = new Date(`${dateStr}T00:00:00`)
      in14.setDate(in14.getDate() + 14)
      const in14Str = in14.toISOString().slice(0, 10)

      const tipSalons = await payload.find({
        collection: 'salons',
        where: { is_active: { not_equals: false } },
        depth: 0, limit: 200, overrideAccess: true,
      })
      for (const salon of tipSalons.docs as Salon[]) {
        try {
          const salonId = String(salon.id)
          const ownerId = relId(salon.owner)
          if (!ownerId) continue
          if (!forceTip && await weeklyTipAlreadySent(payload, 'salon', salonId, dateStr)) continue

          const ownerDoc = await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true })
          const ownerPrefs = (ownerDoc?.personal_notif_prefs as Record<string, boolean | null> | null) ?? {}
          // Külön "tipp" preferencia helyett a napi-összefoglaló kapcsolót osztja meg vele —
          // mindkettő periodikus, nem kritikus, informatív app-értesítés.
          if (ownerPrefs.digest === false) continue

          const [stats, availRes, servicesRes, shiftsAheadRes, pendingBookRes, campaignRes] = await Promise.all([
            getDashboardStats(salon.id, 30),
            payload.find({ collection: 'availability', where: { and: [{ salon: { equals: salonId } }, { staff: { exists: false } }, { exception_date: { exists: false } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'services', where: { salon: { equals: salonId } }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'shifts', where: { and: [{ salon: { equals: salonId } }, { date: { greater_than_equal: dateStr } }, { date: { less_than_equal: in14Str } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'bookings', where: { and: [{ salon: { equals: salonId } }, { status: { equals: 'pending' } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'marketing-campaigns', where: { salon: { equals: salonId } }, limit: 1, depth: 0, overrideAccess: true }),
          ])
          const setup: SetupFlags = {
            openingHours: availRes.totalDocs > 0,
            catalog: servicesRes.totalDocs > 0,
            scheduleFilledAhead: shiftsAheadRes.totalDocs > 0,
            hasPendingBookings: pendingBookRes.totalDocs > 0,
            hasSentCampaign: campaignRes.totalDocs > 0,
          }
          const tip = buildSalonAdvisor(salon, setup, stats, ALL_CAPABILITIES).weeklyTip
          if (!tip) continue

          await payload.create({
            collection: 'notifications',
            overrideAccess: true,
            data: { salon: Number(salonId), audience: 'owner', type: 'weekly_tip', title: tip.title, body: tip.body, read: false },
          })
          try {
            await sendPushToUsers(payload, [ownerId], { title: tip.title, body: tip.body, url: '/dashboard/tips', tag: `weekly-tip-${salonId}-${dateStr}` })
          } catch (pushErr) {
            console.error('[Cron] Salon weekly tip push failed', pushErr)
          }
          summary.weeklyTips++
        } catch (err) {
          summary.errors++
          console.error('[Cron] Salon weekly tip failed for', salon.id, err)
        }
      }

      const tipRestaurants = await payload.find({
        collection: 'restaurants',
        where: { is_active: { not_equals: false } },
        depth: 0, limit: 200, overrideAccess: true,
      })
      for (const restaurant of tipRestaurants.docs as Restaurant[]) {
        try {
          const restId = String(restaurant.id)
          const ownerId = relId(restaurant.owner)
          if (!ownerId) continue
          if (!forceTip && await weeklyTipAlreadySent(payload, 'restaurant', restId, dateStr)) continue

          const ownerDoc = await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true })
          const ownerPrefs = (ownerDoc?.personal_notif_prefs as Record<string, boolean | null> | null) ?? {}
          if (ownerPrefs.digest === false) continue

          const [stats, hoursRes, tablesRes, shiftsAheadRes, pendingReservRes, campaignRes] = await Promise.all([
            getRestaurantStats(restaurant.id, 30),
            payload.find({ collection: 'opening-hours', where: { and: [{ restaurant: { equals: restId } }, { is_open: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'tables', where: { and: [{ restaurant: { equals: restId } }, { is_active: { equals: true } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'shifts', where: { and: [{ restaurant: { equals: restId } }, { date: { greater_than_equal: dateStr } }, { date: { less_than_equal: in14Str } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'reservations', where: { and: [{ restaurant: { equals: restId } }, { status: { equals: 'pending' } }] }, limit: 1, depth: 0, overrideAccess: true }),
            payload.find({ collection: 'marketing-campaigns', where: { restaurant: { equals: restId } }, limit: 1, depth: 0, overrideAccess: true }),
          ])
          const setup: SetupFlags = {
            openingHours: hoursRes.totalDocs > 0,
            catalog: tablesRes.totalDocs > 0,
            scheduleFilledAhead: shiftsAheadRes.totalDocs > 0,
            hasPendingBookings: pendingReservRes.totalDocs > 0,
            hasSentCampaign: campaignRes.totalDocs > 0,
          }
          const tip = buildRestaurantAdvisor(restaurant, setup, stats, ALL_CAPABILITIES).weeklyTip
          if (!tip) continue

          await payload.create({
            collection: 'notifications',
            overrideAccess: true,
            data: { restaurant: Number(restId), audience: 'owner', type: 'weekly_tip', title: tip.title, body: tip.body, read: false },
          })
          try {
            await sendPushToUsers(payload, [ownerId], { title: tip.title, body: tip.body, url: '/restaurant/tips', tag: `weekly-tip-${restId}-${dateStr}` })
          } catch (pushErr) {
            console.error('[Cron] Restaurant weekly tip push failed', pushErr)
          }
          summary.weeklyTips++
        } catch (err) {
          summary.errors++
          console.error('[Cron] Restaurant weekly tip failed for', restaurant.id, err)
        }
      }
    }

    // ── Takarítás: az app-on belüli értesítések (harang-ikon) 90 napnál régebbi
    //    példányai törlődnek — ez CSAK a `notifications` kollekciót érinti, a foglalás/
    //    vendég-adatokat (bookings/reservations) és a számlázási bizonylatokat soha.
    //    Best-effort: nem szabad emiatt elszállnia a cronnak.
    try {
      const cutoff = new Date(now - 90 * 24 * 3600_000).toISOString()
      const deleted = await payload.delete({
        collection: 'notifications',
        where: { createdAt: { less_than: cutoff } },
        overrideAccess: true,
      })
      summary.notificationsCleaned = Array.isArray(deleted.docs) ? deleted.docs.length : 0
    } catch (err) {
      console.error('[Cron] Notifications cleanup failed', err)
    }

    // ── Időszakos foglalási megnyitás: lejárat előtti értesítés + automatikus megújítás ──
    // Idempotens (a „már értesítve” és az új időszak-vége elmentődik), ezért percenként is futhat.
    try {
      const bw = await processBookingWindows(payload)
      summary.bookingWindows = bw.renewed + bw.noticed
      summary.errors += bw.errors
    } catch (err) {
      console.error('[Cron] Booking window processing failed', err)
    }

    // ── Elhagyott regisztrációk törlése (0 üzlet, 0 sub, 0 tagság, 30+ napja regisztrált) ──
    // Ugyanaz a best-effort minta, mint a fenti notifications-takarítás — lásd lib/accountCleanup.ts.
    try {
      summary.accountsPurged = await purgeAbandonedAccounts(payload)
    } catch (err) {
      console.error('[Cron] Abandoned account purge failed', err)
    }

    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[Cron] Fatal error', err)
    return NextResponse.json({ error: 'Szerver hiba', ...summary }, { status: 500 })
  }
}
