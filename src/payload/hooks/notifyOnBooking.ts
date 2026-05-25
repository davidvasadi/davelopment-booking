import type { CollectionAfterChangeHook } from 'payload'

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
          type,
          title,
          body,
          read: false,
          [kind === 'restaurant' ? 'reservation' : 'booking']: doc.id,
        },
      })
    } catch (err) {
      // Az értesítés best-effort: ne bukjon el rajta a foglalás mentése.
      req.payload.logger.error(`notifyOnBooking (${kind}) hiba: ${String(err)}`)
    }

    return doc
  }
}
