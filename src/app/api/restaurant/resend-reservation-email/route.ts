import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import { sendReservationConfirmation } from '@/lib/restaurantEmail'
import type { Reservation, Restaurant } from '@/payload/payload-types'

/**
 * POST /api/restaurant/resend-reservation-email — a visszaigazoló emailt küldi el ÚJRA egy
 * meglévő foglaláshoz. A szalon `/api/salon/resend-booking-email` párja.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { reservationId?: string | number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  if (!body.reservationId) return NextResponse.json({ error: 'Hiányzó reservationId' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 404 })

  const denied = await assertCapability(user.id, 'restaurant', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  const reservation = (await payload
    .findByID({ collection: 'reservations', id: body.reservationId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Reservation | null
  const restId = reservation && (typeof reservation.restaurant === 'object' ? reservation.restaurant.id : reservation.restaurant)
  if (!reservation || String(restId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }
  if (!reservation.customer_email) {
    return NextResponse.json({ error: 'A foglaláshoz nincs email cím megadva' }, { status: 400 })
  }

  const restaurant = (await payload.findByID({ collection: 'restaurants', id: active.id, overrideAccess: true })) as Restaurant

  await sendReservationConfirmation({ reservation, restaurant })
  return NextResponse.json({ ok: true })
}
