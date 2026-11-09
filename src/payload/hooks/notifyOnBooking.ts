import type { CollectionAfterChangeHook } from 'payload'
import { isSilentImport } from '../../lib/silentImport'
import { sendPushToUsers } from '../../lib/webPush'
import { findMyStaffId } from '../../lib/myStaffLink'

function relId(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'object' && val !== null && 'id' in val) return String((val as { id: unknown }).id)
  return String(val)
}

// Közös afterChange hook gyár: új foglaláskor (create), lemondáskor és módosításkor
// app-on belüli értesítést hoz létre — csak ha a tulajnál `notify_new_bookings` be van kapcsolva.
export function notifyOnBooking(kind: 'restaurant' | 'salon'): CollectionAfterChangeHook {
  return async ({ req, doc, previousDoc, operation }) => {
    // Importált (korábbi rendszerből behozott) foglalásról nincs értesítés / push / email
    if (isSilentImport(req)) return doc
    const isNew = operation === 'create'
    const becameCancelled =
      operation === 'update' &&
      doc.status === 'cancelled' &&
      previousDoc?.status !== 'cancelled'

    // Módosítás: frissítés, nem lemondás, és dátum/idő/hely változott — szalonnál a szakember, étteremnél az asztal(ok)
    // (a `tables` tömb — korábban a nem létező `table` mezőt nézte, így az asztalcsere nem számított) és a létszám.
    const ids = (v: unknown) => (Array.isArray(v) ? v : v != null ? [v] : []).map((x) => String(relId(x as never) ?? '')).filter(Boolean).sort().join(',')
    const placeChanged = kind === 'salon'
      ? relId(doc.staff) !== relId(previousDoc?.staff)
      : ids(doc.tables) !== ids(previousDoc?.tables) || doc.pax !== previousDoc?.pax
    const isModification =
      operation === 'update' &&
      !becameCancelled &&
      doc.status !== 'cancelled' &&
      (doc.date !== previousDoc?.date ||
        doc.start_time !== previousDoc?.start_time ||
        doc.end_time !== previousDoc?.end_time ||
        placeChanged)

    if (!isNew && !becameCancelled && !isModification) return doc

    const placeRef = doc[kind]
    const placeId = relId(placeRef)
    if (!placeId) return doc

    // ── Módosítás e-mail a vendégnek — EGYETLEN küldési pont (korábban a manage-booking /
    //    manage-reservation route is küldte, így egy szerkesztés két levelet is okozhatott, a route
    //    ráadásul minden mentésnél, csak megjegyzés-változásnál is). Csak valódi módosításnál
    //    (dátum/idő/szakember/asztal), csak ha a tulaj bekapcsolta (alap: ki), és független az
    //    app-on belüli értesítés (`notify_new_bookings`) kapcsolójától.
    if (isModification) {
      try {
        const emailPlace = await req.payload.findByID({
          collection: kind === 'restaurant' ? 'restaurants' : 'salons',
          id: placeId,
          depth: 1,
          overrideAccess: true,
          req,
        })
        const modEnabled = (emailPlace?.notification_prefs as { modification_email?: boolean | null } | null)?.modification_email === true
        if (emailPlace && modEnabled) {
          if (kind === 'salon') {
            const fullBooking = await req.payload.findByID({ collection: 'bookings', id: doc.id, depth: 2, overrideAccess: true, req })
            if (fullBooking?.customer_email && fullBooking.service && fullBooking.staff) {
              const { sendBookingModification } = await import('../../lib/email')
              await sendBookingModification({
                booking: fullBooking as Parameters<typeof sendBookingModification>[0]['booking'],
                salon: emailPlace as Parameters<typeof sendBookingModification>[0]['salon'],
                service: fullBooking.service as Parameters<typeof sendBookingModification>[0]['service'],
                staff: fullBooking.staff as Parameters<typeof sendBookingModification>[0]['staff'],
              })
            }
          } else {
            const fullReservation = await req.payload.findByID({ collection: 'reservations', id: doc.id, depth: 1, overrideAccess: true, req })
            if (fullReservation?.customer_email) {
              const { sendReservationModification } = await import('../../lib/restaurantEmail')
              await sendReservationModification({
                reservation: fullReservation as Parameters<typeof sendReservationModification>[0]['reservation'],
                restaurant: emailPlace as Parameters<typeof sendReservationModification>[0]['restaurant'],
              })
            }
          }
        }
      } catch (emailErr) {
        req.payload.logger.error(`notifyOnBooking modification email (${kind}) hiba: ${String(emailErr)}`)
      }
    }

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

      // Kikapcsolt automatikus megerősítésnél az új foglalás 'pending' — az értesítésben
      // gyorsgombbal elfogadható/elutasítható (ld. NotificationsPage).
      const awaitingApproval = type === 'new_booking' && doc.status === 'pending'
      const title = becameCancelled
        ? 'Lemondott foglalás'
        : isModification
          ? 'Foglalás módosítva'
          : awaitingApproval
            ? 'Új foglalás – jóváhagyásra vár'
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
        ...(awaitingApproval ? { metadata: { awaiting_approval: true } } : {}),
      }
      console.log('[notifyOnBooking] create data:', notifData)
      await req.payload.create({
        collection: 'notifications',
        overrideAccess: true,
        req,
        data: notifData,
      })

      // ── WEB PUSH: a tulaj mindig, a tagok a szerepük „Foglalás-értesítés" szintje szerint —
      //    korábban EZ HIÁNYZOTT: minden aktív tag push-ot kapott MINDEN foglalásról, függetlenül
      //    attól, kihez van rendelve. Most: `roles.booking_notify_level` dönt — 'off' = semmi,
      //    'own' = csak a hozzá rendelt foglalások (KIZÁRÓLAG szalonnál értelmezhető, mert csak ott
      //    van a foglalás szakemberhez kötve), 'all' = minden. Szerep nélküli tag = 'off' (biztonságos
      //    alapértelmezés — az app a fő csatorna, explicit be kell kapcsolni a szerepén).
      try {
        const ownerId = relId((place as { owner?: unknown }).owner)
        const assignedStaffId = kind === 'salon' ? relId(doc.staff) : ''
        const members = await req.payload.find({
          collection: 'memberships',
          where: { and: [{ [kind]: { equals: placeId } }, { status: { equals: 'active' } }] },
          limit: 200,
          depth: 2,
          overrideAccess: true,
          req,
        })
        const eligibleMemberIds = (await Promise.all(members.docs.map(async (m) => {
          // Személyes preferencia: explicit kikapcsolás mindig felülír mindent.
          const user = m.user as { id?: string | number; email?: string | null; personal_notif_prefs?: Record<string, boolean | null> } | null | undefined
          if (typeof user !== 'object' || !user) return null
          if (user.personal_notif_prefs?.bookings === false) return null

          const level = (m.custom_role as { booking_notify_level?: 'off' | 'own' | 'all' | null } | null | undefined)?.booking_notify_level ?? 'off'
          if (level === 'off') return null
          if (level === 'all') return relId(user.id)
          // level === 'own' — csak szalonnál értelmezhető; ha valahogy mégis étteremnél áll be
          // (védelemből, bár az API már 'off'-ra kényszeríti), essen vissza 'off'-ra.
          if (kind !== 'salon') return null
          if (!assignedStaffId || !user.id) return null
          const myStaffId = await findMyStaffId(placeId, user.id, user.email)
          return myStaffId != null && String(myStaffId) === assignedStaffId ? relId(user.id) : null
        }))).filter((id): id is string => !!id)
        const url =
          kind === 'restaurant'
            ? `/restaurant/bookings?reservation=${doc.id}`
            : `/dashboard/bookings?booking=${doc.id}`
        await sendPushToUsers(req.payload, [ownerId, ...eligibleMemberIds].filter(Boolean) as (string | number)[], {
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
