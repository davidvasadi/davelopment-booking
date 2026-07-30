import type { CollectionAfterChangeHook } from 'payload'
import { sendPushToUsers } from '../../lib/webPush'

function relId(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'object' && val !== null && 'id' in val) return String((val as { id: unknown }).id)
  return String(val)
}

// Közös afterChange hook gyár: új foglaláskor (create), lemondáskor és módosításkor
// app-on belüli értesítést hoz létre — csak ha a tulajnál `notify_new_bookings` be van kapcsolva.
export function notifyOnBooking(kind: 'restaurant' | 'salon'): CollectionAfterChangeHook {
  return async ({ req, doc, previousDoc, operation }) => {
    const isNew = operation === 'create'
    const becameCancelled =
      operation === 'update' &&
      doc.status === 'cancelled' &&
      previousDoc?.status !== 'cancelled'

    // Módosítás: frissítés, nem lemondás, és dátum/idő/hely változott.
    const staffField = kind === 'salon' ? 'staff' : 'table'
    const isModification =
      operation === 'update' &&
      !becameCancelled &&
      doc.status !== 'cancelled' &&
      (doc.date !== previousDoc?.date ||
        doc.start_time !== previousDoc?.start_time ||
        doc.end_time !== previousDoc?.end_time ||
        relId(doc[staffField]) !== relId(previousDoc?.[staffField]))

    if (!isNew && !becameCancelled && !isModification) return doc

    const placeRef = doc[kind]
    const placeId = relId(placeRef)
    if (!placeId) return doc

    try {
      const place = await req.payload.findByID({
        collection: kind === 'restaurant' ? 'restaurants' : 'salons',
        id: placeId,
        depth: 0,
        overrideAccess: true,
        req,
      })
      if (!place?.notify_new_bookings) return doc

      const type = becameCancelled ? 'cancellation' : isModification ? 'modification' : 'new_booking'
      const name = doc.customer_name ?? 'Vendég'
      const when = [doc.date, doc.start_time].filter(Boolean).join(' ')

      const title = becameCancelled
        ? 'Lemondott foglalás'
        : isModification
          ? 'Foglalás módosítva'
          : 'Új foglalás'
      const body = becameCancelled
        ? `${name} lemondta a foglalását${when ? ` – ${when}` : ''}`
        : isModification
          ? `${name} foglalása módosítva${when ? ` – ${when}` : ''}`
          : `${name} foglalt${when ? ` – ${when}` : ''}`

      const notifData = {
        [kind]: Number(placeId),
        audience: 'owner' as const,
        type,
        title,
        body,
        read: false,
        [kind === 'restaurant' ? 'reservation' : 'booking']: Number(doc.id),
      }
      console.log('[notifyOnBooking] create data:', notifData)
      await req.payload.create({
        collection: 'notifications',
        overrideAccess: true,
        req,
        data: notifData,
      })

      // ── Módosítás email a vendégnek (ha be van kapcsolva a notification_prefs-ben).
      if (isModification) {
        const modEnabled = (place.notification_prefs as { modification_email?: boolean | null } | null)?.modification_email
        if (modEnabled !== false) {
          try {
            if (kind === 'salon') {
              const fullBooking = await req.payload.findByID({
                collection: 'bookings',
                id: doc.id,
                depth: 2,
                overrideAccess: true,
                req,
              })
              if (fullBooking?.customer_email && fullBooking.service && fullBooking.staff) {
                const { sendBookingModification } = await import('../../lib/email')
                await sendBookingModification({
                  booking: fullBooking as Parameters<typeof sendBookingModification>[0]['booking'],
                  salon: place as Parameters<typeof sendBookingModification>[0]['salon'],
                  service: fullBooking.service as Parameters<typeof sendBookingModification>[0]['service'],
                  staff: fullBooking.staff as Parameters<typeof sendBookingModification>[0]['staff'],
                })
              }
            } else {
              const fullReservation = await req.payload.findByID({
                collection: 'reservations',
                id: doc.id,
                depth: 1,
                overrideAccess: true,
                req,
              })
              if (fullReservation?.customer_email) {
                const { sendReservationModification } = await import('../../lib/restaurantEmail')
                await sendReservationModification({
                  reservation: fullReservation as Parameters<typeof sendReservationModification>[0]['reservation'],
                  restaurant: place as Parameters<typeof sendReservationModification>[0]['restaurant'],
                })
              }
            }
          } catch (emailErr) {
            req.payload.logger.error(`notifyOnBooking modification email (${kind}) hiba: ${String(emailErr)}`)
          }
        }
      }

      // ── WEB PUSH: a tulaj + az aktív tagok opt-in eszközeire.
      try {
        const ownerId = relId((place as { owner?: unknown }).owner)
        const members = await req.payload.find({
          collection: 'memberships',
          where: { and: [{ [kind]: { equals: placeId } }, { status: { equals: 'active' } }] },
          limit: 200,
          depth: 0,
          overrideAccess: true,
          req,
        })
        const memberUserIds = members.docs.map((m) => m.user).filter(Boolean) as (string | number)[]
        const url =
          kind === 'restaurant'
            ? `/restaurant/bookings?reservation=${doc.id}`
            : `/dashboard/bookings?booking=${doc.id}`
        await sendPushToUsers(req.payload, [ownerId, ...memberUserIds].filter(Boolean) as (string | number)[], {
          title: `${title} · ${place.name ?? ''}`.trim().replace(/ ·\s*$/, ''),
          body,
          url,
          tag: `${kind}-${doc.id}`,
        })
      } catch (pushErr) {
        req.payload.logger.error(`notifyOnBooking push (${kind}) hiba: ${String(pushErr)}`)
      }
    } catch (err) {
      req.payload.logger.error(`notifyOnBooking (${kind}) hiba: ${String(err)}`)
    }

    return doc
  }
}
