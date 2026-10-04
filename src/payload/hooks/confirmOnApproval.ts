import type { CollectionAfterChangeHook } from 'payload'
import type { Booking, Reservation, Restaurant, Salon, Service, StaffMember } from '../payload-types'

function relId(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'object' && val !== null && 'id' in val) return String((val as { id: unknown }).id)
  return String(val)
}

// Ha az automatikus megerősítés ki van kapcsolva, az online foglalás 'pending' státusszal jön
// létre, és a vendég ekkor még NEM kap visszaigazolót. Ez a hook küldi ki, amikor a tulaj
// jóváhagyja (pending → confirmed) — bármelyik felületről (naptár, státusz-gomb, szerkesztő).
export function confirmOnApproval(kind: 'restaurant' | 'salon'): CollectionAfterChangeHook {
  return async ({ req, doc, previousDoc, operation }) => {
    if (operation !== 'update' || previousDoc?.status !== 'pending' || doc.status !== 'confirmed') return doc
    if (!doc.customer_email) return doc

    const locale = (doc.locale ?? 'hu') as 'hu'
    try {
      if (kind === 'salon') {
        const salon = (await req.payload.findByID({ collection: 'salons', id: relId(doc.salon), overrideAccess: true, locale, fallbackLocale: 'hu', req })) as Salon
        if (salon.notification_prefs?.confirm_email === false) return doc
        const [service, staff] = await Promise.all([
          req.payload.findByID({ collection: 'services', id: relId(doc.service), overrideAccess: true, locale, fallbackLocale: 'hu', req }) as Promise<Service>,
          req.payload.findByID({ collection: 'staff', id: relId(doc.staff), overrideAccess: true, locale, fallbackLocale: 'hu', req }) as Promise<StaffMember>,
        ])
        const { sendBookingConfirmation } = await import('../../lib/email')
        void sendBookingConfirmation({ booking: doc as Booking, salon, service, staff })
      } else {
        const restaurant = (await req.payload.findByID({ collection: 'restaurants', id: relId(doc.restaurant), overrideAccess: true, locale, fallbackLocale: 'hu', req })) as Restaurant
        if (restaurant.notification_prefs?.confirm_email === false) return doc
        const { sendReservationConfirmation } = await import('../../lib/restaurantEmail')
        void sendReservationConfirmation({ reservation: doc as Reservation, restaurant })
      }
    } catch (err) {
      req.payload.logger.error(`[confirmOnApproval] ${kind} ${String(doc.id)}: ${String(err)}`)
    }
    return doc
  }
}
