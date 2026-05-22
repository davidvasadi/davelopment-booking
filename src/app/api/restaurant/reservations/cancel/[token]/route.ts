import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { sendReservationCancellation } from '@/lib/restaurantEmail'
import type { Reservation, Restaurant } from '@/payload/payload-types'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Hiányzó token' }, { status: 400 })

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
    })

    const restaurant = reservation.restaurant as Restaurant
    if (restaurant && typeof restaurant === 'object') {
      void sendReservationCancellation({ reservation: { ...reservation, status: 'cancelled' }, restaurant })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Restaurant Cancel API]', err)
    return NextResponse.json({ error: 'Szerver hiba' }, { status: 500 })
  }
}
