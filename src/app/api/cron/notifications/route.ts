/**
 * Értesítési cron — emlékeztetők + visszajelzés-kérések (email).
 *
 * VPS cron hívja (percenként vagy óránként), CRON_SECRET-tel védve, pl.:
 *   * * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://booking.davelopment.hu/api/cron/notifications
 * vagy: curl -s "https://booking.davelopment.hu/api/cron/notifications?secret=$CRON_SECRET"
 *
 * SMS-t SEHOL nem küld — kizárólag email csatorna.
 *
 * Két feladat:
 *  1) Emlékeztető: közelgő, még ki nem küldött (reminder_sent=false), nem lemondott
 *     foglalások, ahol az üzlet feature_modules.reminders_on && reminder_ch_email, és a
 *     foglalás időpontja a legkorábbi bekapcsolt küszöb (24h/3h/1h) ablakába esett →
 *     sendReminderEmail + reminder_sent=true.
 *  2) Visszajelzés-kérés: ~1 nappal ezelőtt lezajlott (múltbeli), feedback_sent=false,
 *     nem lemondott foglalások, ahol feature_modules.reviews_on → sendFeedbackRequestEmail
 *     + feedback_sent=true.
 *
 *  A kapcsolók GAZDÁJA a Funkciók oldal (`feature_modules`); a `notification_prefs` csak a
 *  tranzakciós emaileket (visszaigazolás/lemondás) vezérli, ide NEM szól bele (nincs dupla-gate).
 *
 * Robusztus: foglalásonként try/catch, egy hiba nem állítja le a többit.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendReminderEmail as sendSalonReminder, sendFeedbackRequestEmail as sendSalonFeedback } from '@/lib/email'
import { sendReminderEmail as sendRestaurantReminder, sendFeedbackRequestEmail as sendRestaurantFeedback } from '@/lib/restaurantEmail'
import type { Salon, Service, StaffMember, Booking, Restaurant, Reservation } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

const relId = (v: unknown): string | null =>
  v == null ? null : typeof v === 'object' ? String((v as { id: string | number }).id) : String(v)

function toMinutes(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).getTime()
}

/** A legkorábbi bekapcsolt emlékeztető-küszöb órában (24 > 3 > 1), vagy null ha egyik sem. */
function earliestReminderHours(fm: Salon['feature_modules'] | Restaurant['feature_modules']): number | null {
  if (fm?.reminder_t_24h) return 24
  if (fm?.reminder_t_3h) return 3
  if (fm?.reminder_t_1h) return 1
  return null
}

// Egységes modell: az emlékeztető/értékelés KÉPESSÉG gazdája a Funkciók oldal (`feature_modules`).
// Az `notification_prefs` NEM vétózza felül (megszűnt a korábbi dupla-gate) — a Funkciók a forrás.
function reminderEnabled(biz: Salon | Restaurant): boolean {
  return !!(biz.feature_modules?.reminders_on && biz.feature_modules?.reminder_ch_email)
}

function feedbackEnabled(biz: Salon | Restaurant): boolean {
  return !!biz.feature_modules?.reviews_on
}

export async function GET(request: NextRequest) {
  return handle(request)
}
export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const provided =
    request.headers.get('x-cron-secret') ?? request.nextUrl.searchParams.get('secret')
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = Date.now()
  const summary = { reminders: 0, feedback: 0, errors: 0 }

  try {
    const payload = await getPayloadClient()

    // ── SALON: emlékeztetők ────────────────────────────────────────────────
    const salonReminderCandidates = await payload.find({
      collection: 'bookings',
      where: {
        reminder_sent: { not_equals: true },
        status: { not_in: ['cancelled', 'completed'] },
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
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
        // Küldés, ha már a küszöb-ablakon belül vagyunk, de a foglalás még jövőbeli.
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

    // ── SALON: visszajelzés-kérés (múltbeli, ~1 napja lezajlott) ────────────
    const salonFeedbackCandidates = await payload.find({
      collection: 'bookings',
      where: {
        feedback_sent: { not_equals: true },
        status: { not_equals: 'cancelled' },
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    })

    for (const doc of salonFeedbackCandidates.docs as Booking[]) {
      try {
        const end = toMinutes(doc.date, doc.end_time)
        // Csak lezajlott (múltbeli) foglalás, legfeljebb ~2 napja (különben ne küldjünk réginek).
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
      where: {
        reminder_sent: { not_equals: true },
        status: { not_in: ['cancelled', 'completed', 'no_show'] },
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
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
      where: {
        feedback_sent: { not_equals: true },
        status: { not_in: ['cancelled', 'no_show'] },
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
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

    return NextResponse.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[Cron] Fatal error', err)
    return NextResponse.json({ error: 'Szerver hiba', ...summary }, { status: 500 })
  }
}
