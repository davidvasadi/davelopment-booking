/**
 * Értesítési cron — emlékeztetők + visszajelzés-kérések + reggeli/esti összefoglalók.
 *
 * VPS cron hívja (percenként vagy óránként), CRON_SECRET-tel védve, pl.:
 *   * * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://booking.davelopment.hu/api/cron/notifications
 *
 * Három feladat:
 *  1) Emlékeztető: közelgő, még ki nem küldött (reminder_sent=false) foglalások.
 *  2) Visszajelzés-kérés: lezajlott (múltbeli), feedback_sent=false foglalások.
 *  3) Digest összefoglaló: minden üzlet a SAJÁT nyitás/zárás idejéhez igazítva.
 *     - Szalon: nyitáskor → reggeli (in-app + email), záráskor → esti (in-app + email)
 *     - Étterem: nyitáskor → reggeli (in-app + push), záráskor → esti (in-app + push)
 *     - Idempotens: ha az adott típus ma már ment, nem küldi újra.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendReminderEmail as sendSalonReminder, sendFeedbackRequestEmail as sendSalonFeedback, sendSalonDigestEmail } from '@/lib/email'
import { sendReminderEmail as sendRestaurantReminder, sendFeedbackRequestEmail as sendRestaurantFeedback } from '@/lib/restaurantEmail'
import { sendPushToUsers } from '@/lib/webPush'
import type { Salon, Service, StaffMember, Booking, Restaurant, Reservation, User, Membership } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

const relId = (v: unknown): string | null =>
  v == null ? null : typeof v === 'object' ? String((v as { id: string | number }).id) : String(v)

function toMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}

function earliestReminderHours(fm: Salon['feature_modules'] | Restaurant['feature_modules']): number | null {
  if (fm?.reminder_t_24h) return 24
  if (fm?.reminder_t_3h) return 3
  if (fm?.reminder_t_1h) return 1
  return null
}

function reminderEnabled(biz: Salon | Restaurant): boolean {
  return !!(biz.feature_modules?.reminders_on && biz.feature_modules?.reminder_ch_email)
}

function feedbackEnabled(biz: Salon | Restaurant): boolean {
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

  const now = Date.now()
  const summary = { reminders: 0, feedback: 0, digest: 0, errors: 0 }

  try {
    const payload = await getPayloadClient()

    // ── SALON: emlékeztetők ────────────────────────────────────────────────
    const salonReminderCandidates = await payload.find({
      collection: 'bookings',
      where: { reminder_sent: { not_equals: true }, status: { not_in: ['cancelled', 'completed'] } },
      depth: 0, limit: 500, overrideAccess: true,
    })

    for (const doc of salonReminderCandidates.docs as Booking[]) {
      try {
        const salonId = relId(doc.salon)
        if (!salonId) continue
        const salon = (await payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Salon
        if (!reminderEnabled(salon)) continue
        const hours = earliestReminderHours(salon.feature_modules)
        if (hours == null) continue
        const start = toMinutes(doc.date, doc.start_time)
        if (now < start - hours * 3600_000 || now >= start) continue

        const serviceId = relId(doc.service)
        const staffId = relId(doc.staff)
        if (!serviceId || !staffId) continue
        const [service, staff] = await Promise.all([
          payload.findByID({ collection: 'services', id: serviceId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' }) as Promise<Service>,
          payload.findByID({ collection: 'staff', id: staffId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' }) as Promise<StaffMember>,
        ])
        await sendSalonReminder({ booking: doc, salon, service, staff })
        await payload.update({ collection: 'bookings', id: doc.id, data: { reminder_sent: true }, overrideAccess: true })
        summary.reminders++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Salon reminder failed for booking', doc.id, err)
      }
    }

    // ── SALON: visszajelzés-kérés ────────────────────────────────────────────
    const salonFeedbackCandidates = await payload.find({
      collection: 'bookings',
      where: { feedback_sent: { not_equals: true }, status: { not_equals: 'cancelled' } },
      depth: 0, limit: 500, overrideAccess: true,
    })

    for (const doc of salonFeedbackCandidates.docs as Booking[]) {
      try {
        const end = toMinutes(doc.date, doc.end_time)
        if (end > now || now - end > 2 * 24 * 3600_000) continue
        const salonId = relId(doc.salon)
        if (!salonId) continue
        const salon = (await payload.findByID({ collection: 'salons', id: salonId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Salon
        if (!feedbackEnabled(salon)) continue
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
      where: { reminder_sent: { not_equals: true }, status: { not_in: ['cancelled', 'completed', 'no_show'] } },
      depth: 0, limit: 500, overrideAccess: true,
    })

    for (const doc of resReminderCandidates.docs as Reservation[]) {
      try {
        if (!doc.customer_email) continue
        const restId = relId(doc.restaurant)
        if (!restId) continue
        const restaurant = (await payload.findByID({ collection: 'restaurants', id: restId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Restaurant
        if (!reminderEnabled(restaurant)) continue
        const hours = earliestReminderHours(restaurant.feature_modules)
        if (hours == null) continue
        const start = toMinutes(doc.date, doc.start_time)
        if (now < start - hours * 3600_000 || now >= start) continue

        await sendRestaurantReminder({ reservation: doc, restaurant })
        await payload.update({ collection: 'reservations', id: doc.id, data: { reminder_sent: true }, overrideAccess: true })
        summary.reminders++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Restaurant reminder failed for reservation', doc.id, err)
      }
    }

    // ── RESTAURANT: visszajelzés-kérés ─────────────────────────────────────
    const resFeedbackCandidates = await payload.find({
      collection: 'reservations',
      where: { feedback_sent: { not_equals: true }, status: { not_in: ['cancelled', 'no_show'] } },
      depth: 0, limit: 500, overrideAccess: true,
    })

    for (const doc of resFeedbackCandidates.docs as Reservation[]) {
      try {
        if (!doc.customer_email) continue
        const end = toMinutes(doc.date, doc.end_time)
        if (end > now || now - end > 2 * 24 * 3600_000) continue
        const restId = relId(doc.restaurant)
        if (!restId) continue
        const restaurant = (await payload.findByID({ collection: 'restaurants', id: restId, overrideAccess: true, locale: (doc.locale ?? 'hu') as 'hu', fallbackLocale: 'hu' })) as Restaurant
        if (!feedbackEnabled(restaurant)) continue
        await sendRestaurantFeedback({ reservation: doc, restaurant })
        await payload.update({ collection: 'reservations', id: doc.id, data: { feedback_sent: true }, overrideAccess: true })
        summary.feedback++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Restaurant feedback failed for reservation', doc.id, err)
      }
    }

    // ── DIGEST összefoglalók (üzletenként a saját nyitás/zárás idejéhez igazítva) ──
    const { hour, dateStr, dow } = getBudapestInfo()

    // ── SALON digest ──────────────────────────────────────────────────────────
    const allSalons = await payload.find({
      collection: 'salons',
      where: { notify_new_bookings: { equals: true } },
      depth: 0, limit: 200, overrideAccess: true,
    })

    for (const salon of allSalons.docs as Salon[]) {
      try {
        const salonId = String(salon.id)

        let isMorning: boolean
        let isEvening: boolean
        const digestType: 'digest_morning' | 'digest_evening' = forceDigest === 'evening' ? 'digest_evening' : 'digest_morning'

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

          if (await digestAlreadySent(payload, digestType, 'salon', salonId, dateStr)) continue
        }

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
        if (bookingCount === 0 && isMorning && !forceDigest) continue

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

        await payload.create({
          collection: 'notifications',
          overrideAccess: true,
          data: {
            salon: Number(salonId),
            audience: 'owner',
            type: digestType,
            title: isEvening ? `Esti összefoglaló – ${dateStr}` : `Reggeli összefoglaló – ${dateStr}`,
            body: `${bookingCount} foglalás`,
            read: false,
            metadata: {
              bookings: bookingCount,
              guests: bookingCount,
              date: dateStr,
              team_count: teamCount,
              shift_manager: shiftManager,
              staff_breakdown: staffBreakdown,
              status: statusCounts,
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

        const ownerId = relId(salon.owner)
        const np = salon.notification_prefs as { digest_morning_email?: boolean | null; digest_evening_email?: boolean | null } | null
        const emailEnabled = isEvening ? np?.digest_evening_email !== false : np?.digest_morning_email !== false
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
            })
          }
        }
        // Push — szalon digest (ugyanúgy mint az étteremnél).
        try {
          if (ownerId) {
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
      where: { notify_new_bookings: { equals: true } },
      depth: 0, limit: 200, overrideAccess: true,
    })

    for (const restaurant of allRestaurants.docs as Restaurant[]) {
      try {
        const restId = String(restaurant.id)

        let isMorning: boolean
        let isEvening: boolean
        const digestType: 'digest_morning' | 'digest_evening' = forceDigest === 'evening' ? 'digest_evening' : 'digest_morning'

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

          if (await digestAlreadySent(payload, digestType, 'restaurant', restId, dateStr)) continue
        }

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

        const occasions: Record<string, number> = {}
        for (const r of docs) {
          if (r.occasion) occasions[r.occasion] = (occasions[r.occasion] ?? 0) + 1
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

        await payload.create({
          collection: 'notifications',
          overrideAccess: true,
          data: {
            restaurant: Number(restId),
            audience: 'owner',
            type: digestType,
            title: isEvening ? `Esti összefoglaló – ${dateStr}` : `Reggeli összefoglaló – ${dateStr}`,
            body: `${bookingCount} foglalás, ${guestCount} fő`,
            read: false,
            metadata: {
              bookings: bookingCount,
              guests: guestCount,
              date: dateStr,
              team_count: todayShifts.totalDocs,
              occasions: Object.keys(occasions).length > 0 ? occasions : undefined,
              shift_manager: shiftManager,
              source,
              status,
            },
          },
        })

        // Push — étteremnél nincs email digest
        try {
          const ownerId = relId(restaurant.owner)
          const members = await payload.find({
            collection: 'memberships',
            where: { and: [{ restaurant: { equals: restId } }, { status: { equals: 'active' } }] },
            limit: 200, depth: 0, overrideAccess: true,
          })
          const memberUserIds = members.docs.map((m) => m.user).filter(Boolean) as (string | number)[]
          await sendPushToUsers(
            payload,
            [ownerId, ...memberUserIds].filter(Boolean) as (string | number)[],
            {
              title: `${isEvening ? 'Esti' : 'Reggeli'} összefoglaló · ${restaurant.name}`,
              body: `${bookingCount} foglalás, ${guestCount} fő`,
              url: '/restaurant/bookings',
              tag: `digest-${restId}-${dateStr}-${digestType}`,
            },
          )
        } catch (pushErr) {
          console.error('[Cron] Restaurant digest push failed', pushErr)
        }

        summary.digest++
      } catch (err) {
        summary.errors++
        console.error('[Cron] Restaurant digest failed for', restaurant.id, err)
      }
    }

    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[Cron] Fatal error', err)
    return NextResponse.json({ error: 'Szerver hiba', ...summary }, { status: 500 })
  }
}
