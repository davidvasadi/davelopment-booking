import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Reservation, EmailLogEntry } from '@/payload/payload-types'

/**
 * GET /api/restaurant/reservation-email-status?reservationId= — a foglaláshoz tartozó legutóbbi
 * kimenő email kézbesítési állapota, a szerkesztő ablak fejlécéhez. A szalon
 * `/api/salon/booking-email-status` párja.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  const reservationId = req.nextUrl.searchParams.get('reservationId')
  if (!reservationId) return NextResponse.json({ error: 'Hiányzó reservationId' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 404 })

  const payload = await getPayloadClient()

  const reservation = (await payload
    .findByID({ collection: 'reservations', id: reservationId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Reservation | null
  const restId = reservation && (typeof reservation.restaurant === 'object' ? reservation.restaurant.id : reservation.restaurant)
  if (!reservation || String(restId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  const logs = await payload.find({
    collection: 'email-log',
    where: { reservation: { equals: reservationId } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = logs.docs[0] as EmailLogEntry | undefined

  return NextResponse.json({
    ok: doc?.ok ?? null,
    status: doc?.status ?? null,
    deliveredAt: doc?.delivered_at ?? null,
    openedAt: doc?.opened_at ?? null,
  })
}
