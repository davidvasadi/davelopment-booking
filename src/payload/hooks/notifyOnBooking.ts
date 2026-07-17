import type { CollectionAfterChangeHook } from 'payload'
import { sendPushToUsers } from '../../lib/webPush'

// Közös afterChange hook gyár: új foglaláskor (create) és lemondáskor (status → cancelled)
// app-on belüli értesítést hoz létre — de csak ha a tulajnál `notify_new_bookings` be van kapcsolva.
//
// `kind` választja a relációs mezőt (étterem vs. szalon) és a megfelelő szövegezést.
export function notifyOnBooking(kind: 'restaurant' | 'salon'): CollectionAfterChangeHook {
  return async ({ req, doc, previousDoc, operation }) => {
    const isNew = operation === 'create'
    const becameCancelled =
      operation === 'update' &&
      doc.status === 'cancelled' &&
      previousDoc?.status !== 'cancelled'

    if (!isNew && !becameCancelled) return doc

    // A reláció lehet id vagy kifejtett objektum.
    const placeRef = doc[kind]
    const placeId =
      placeRef && typeof placeRef === 'object' ? (placeRef as { id: number | string }).id : placeRef
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

      const type = becameCancelled ? 'cancellation' : 'new_booking'
      const name = doc.customer_name ?? 'Vendég'
      const when = [doc.date, doc.start_time].filter(Boolean).join(' ')

      const title = becameCancelled ? 'Lemondott foglalás' : 'Új foglalás'
      const body = becameCancelled
        ? `${name} lemondta a foglalását${when ? ` – ${when}` : ''}`
        : `${name} foglalt${when ? ` – ${when}` : ''}`

      await req.payload.create({
        collection: 'notifications',
        overrideAccess: true,
        req,
        data: {
          [kind]: placeId,
          audience: 'owner',
          type,
          title,
          body,
          read: false,
          [kind === 'restaurant' ? 'reservation' : 'booking']: doc.id,
        },
      })

      // ── WEB PUSH: a tulaj + az aktív tagok opt-in eszközeire (csak akiknek van feliratkozása).
      // Best-effort, külön try — az esetleges push-hiba ne érintse a foglalás/értesítés mentését.
      try {
        const ownerId = place.owner && typeof place.owner === 'object' ? (place.owner as { id: number | string }).id : (place as { owner?: number | string }).owner
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
        await sendPushToUsers(req.payload, [ownerId, ...memberUserIds], {
          title: `${title} · ${place.name ?? ''}`.trim().replace(/ ·\s*$/, ''),
          body,
          url,
          tag: `${kind}-${doc.id}`,
        })
      } catch (pushErr) {
        req.payload.logger.error(`notifyOnBooking push (${kind}) hiba: ${String(pushErr)}`)
      }
    } catch (err) {
      // Az értesítés best-effort: ne bukjon el rajta a foglalás mentése.
      req.payload.logger.error(`notifyOnBooking (${kind}) hiba: ${String(err)}`)
    }

    return doc
  }
}
