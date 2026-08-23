import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import type { Booking } from '@/payload/payload-types'

/**
 * FOGLALÁS-STÁTUSZ váltás a dashboardról (lista-nézet gyorsmenü). A nyers Payload REST
 * (/api/bookings/[id]) owner-only + payload-token-függő volt → 403-at adott a capability-tagoknál
 * (managerek/staff, akik a `bookings.manage` jogot kapták, de nem ők a szalon tulajdonosai). Ez a
 * route az APP-auth-ot használja (getCurrentUser) + a `bookings.manage` képességet ellenőrzi, majd
 * overrideAccess-szel ír — az étteremi /api/restaurant/reservation-status párja.
 */
const ALLOWED: Booking['status'][] = ['confirmed', 'completed', 'cancelled']

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { bookingId?: string | number; status?: Booking['status'] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const { bookingId, status } = body
  if (!bookingId || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'Hiányzó vagy érvénytelen státusz' }, { status: 400 })
  }

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') {
    return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })
  }

  // RBAC: `bookings.manage` az AKTÍV szalonban (tulaj + a jogot kapó egyedi szerepek).
  const denied = await assertCapability(user.id, 'salon', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  // A foglalás az AKTÍV szalonhoz tartozzon (IDOR-védelem).
  const existing = (await payload
    .findByID({ collection: 'bookings', id: bookingId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const salonId = existing && (typeof existing.salon === 'object' ? existing.salon.id : existing.salon)
  if (!existing || String(salonId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  const updated = await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: { status },
    overrideAccess: true,
    user,
  })
  return NextResponse.json({ ok: true, booking: updated })
}
