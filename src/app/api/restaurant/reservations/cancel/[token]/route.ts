import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendReservationCancellation } from '@/lib/restaurantEmail'
import { promoteWaitlistOnCancel } from '@/lib/waitlistPromote'
import type { Reservation, Restaurant } from '@/payload/payload-types'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Hiányzó token' }, { status: 400 })
  // Opcionális sorozat-lemondás: ?scope=series → a sorozat JÖVŐBELI, nem lemondott
  // alkalmait is lemondja. Hiánya → csak az egy alkalom (változatlan).
  const cancelSeries = _request.nextUrl.searchParams.get('scope') === 'series'

  try {
    const payload = await getPayloadClient()
    const res = await payload.find({
      collection: 'reservations',
      where: { cancel_token: { equals: token } },
      depth: 1,
      limit: 1,
      overrideAccess: true,
    })
    const reservation = res.docs[0] as Reservation | undefined
    if (!reservation) return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })

    if (reservation.status === 'cancelled') {
      return NextResponse.json({ ok: true, alreadyCancelled: true })
    }

    await payload.update({
      collection: 'reservations',
      id: reservation.id,
      data: { status: 'cancelled' },
      overrideAccess: true,
      context: { auditActor: 'Vendég (lemondás)' },
    })

    const restaurant = reservation.restaurant as Restaurant
    if (restaurant && typeof restaurant === 'object' && restaurant.notification_prefs?.cancel_email !== false) {
      void sendReservationCancellation({ reservation: { ...reservation, status: 'cancelled' }, restaurant })
    }

    // Auto-promote: a felszabaduló asztal-időpontra egyező várólista-bejegyzés értesítése (ha be van kapcsolva).
    if (restaurant && typeof restaurant === 'object') {
      void promoteWaitlistOnCancel({
        kind: 'restaurant',
        business: restaurant,
        date: reservation.date,
        time: reservation.start_time,
        pax: reservation.pax,
      })
    }

    // Sorozat-lemondás: a series_id-hez tartozó JÖVŐBELI, nem lemondott/befejezett alkalmakat
    // is lemondjuk. Csak explicit ?scope=series-re.
    if (cancelSeries && reservation.series_id) {
      const today = new Date().toISOString().split('T')[0]
      const siblings = await payload.find({
        collection: 'reservations',
        where: {
          series_id: { equals: reservation.series_id },
          id: { not_equals: reservation.id },
          status: { in: ['pending', 'confirmed'] },
          date: { greater_than_equal: today },
        },
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      for (const sib of siblings.docs as Reservation[]) {
        await payload.update({ collection: 'reservations', id: sib.id, data: { status: 'cancelled' }, overrideAccess: true, context: { auditActor: 'Vendég (lemondás)' } })
        if (restaurant && typeof restaurant === 'object' && restaurant.notification_prefs?.cancel_email !== false) {
          void sendReservationCancellation({ reservation: { ...sib, status: 'cancelled' }, restaurant })
        }
        if (restaurant && typeof restaurant === 'object') {
          void promoteWaitlistOnCancel({ kind: 'restaurant', business: restaurant, date: sib.date, time: sib.start_time, pax: sib.pax })
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Restaurant Cancel API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
