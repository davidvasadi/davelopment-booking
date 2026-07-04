import { getPayloadClient } from './payload'
import { sendWaitlistOpeningEmail as sendSalonWaitlistOpening } from './email'
import { sendWaitlistOpeningEmail as sendRestaurantWaitlistOpening } from './restaurantEmail'
import type { Salon, Restaurant, Waitlist } from '@/payload/payload-types'

/** Percben. Egy várólista-bejegyzés akkor „egyező”, ha az időpontja ±ennyi percen belül van. */
const TIME_WINDOW_MIN = 90

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Auto-promote: egy foglalás lemondása után, ha az üzletnél be van kapcsolva a
 * waitlist_auto_promote, keres egy egyező (ugyanaz a nap, ±90 perc, elférő pax) 'waiting'
 * várólista-bejegyzést, 'notified'-ra állítja és értesítő emailt küld. NEM hoz létre
 * foglalást — csak értesít. Defenzív: flag ki / nincs találat → csendben nem csinál semmit.
 */
export async function promoteWaitlistOnCancel(params: {
  kind: 'salon' | 'restaurant'
  business: Salon | Restaurant
  date: string
  time: string
  /** A felszabaduló foglalás létszáma (étterem); szalonnál nincs, ekkor a pax-szűrés kimarad. */
  pax?: number | null
}): Promise<void> {
  const { kind, business, date, time, pax } = params

  if (!business.feature_modules?.waitlist_auto_promote) return

  try {
    const payload = await getPayloadClient()
    const relField = kind === 'salon' ? 'salon' : 'restaurant'

    const res = await payload.find({
      collection: 'waitlist',
      where: {
        and: [
          { [relField]: { equals: business.id } },
          { date: { equals: date } },
          { status: { equals: 'waiting' } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const slotMin = toMin(time)
    const candidates = (res.docs as Waitlist[])
      .filter((w) => Math.abs(toMin(w.time) - slotMin) <= TIME_WINDOW_MIN)
      // Ha van felszabaduló pax és a bejegyzés kér pax-ot, csak az elférőt vesszük.
      .filter((w) => pax == null || w.pax == null || w.pax <= pax)
      // A kért időponthoz legközelebbit értesítjük először.
      .sort((a, b) => Math.abs(toMin(a.time) - slotMin) - Math.abs(toMin(b.time) - slotMin))

    const target = candidates[0]
    if (!target) return

    await payload.update({
      collection: 'waitlist',
      id: target.id,
      data: { status: 'notified' },
      overrideAccess: true,
    })

    if (kind === 'salon') {
      void sendSalonWaitlistOpening({
        salon: business as Salon,
        customer_name: target.customer_name,
        customer_email: target.customer_email,
        date: target.date,
        time: target.time,
      })
    } else {
      void sendRestaurantWaitlistOpening({
        restaurant: business as Restaurant,
        customer_name: target.customer_name,
        customer_email: target.customer_email,
        date: target.date,
        time: target.time,
        pax: target.pax,
      })
    }
  } catch (err) {
    console.error('[Waitlist] Auto-promote failed:', err)
  }
}
