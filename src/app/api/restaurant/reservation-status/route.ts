import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import type { Reservation } from '@/payload/payload-types'

/**
 * FOGLALÁS-STÁTUSZ váltás a dashboardról (lemondás / leültetés / távozott / no-show / visszaigazolás).
 * A nyers Payload REST (/api/reservations/[id]) owner-only + payload-token-függő volt → 403-at adott
 * a capability-tagoknál (és app-auth mellett a tulajnál is). Ez a route az APP-auth-ot használja
 * (getCurrentUser) + a `bookings.manage` képességet ellenőrzi, majd overrideAccess-szel ír.
 */
const ALLOWED: Reservation['status'][] = ['pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled']

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { reservationId?: string | number; status?: Reservation['status'] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  const { reservationId, status } = body
  if (!reservationId || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: 'Hiányzó vagy érvénytelen státusz' }, { status: 400 })
  }

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 404 })
  }

  // RBAC: `bookings.manage` az AKTÍV étteremben (tulaj + a jogot kapó egyedi szerepek).
  const denied = await assertCapability(user.id, 'restaurant', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  // A foglalás az AKTÍV étteremhez tartozzon (IDOR-védelem).
  const existing = (await payload
    .findByID({ collection: 'reservations', id: reservationId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Reservation | null
  const restId = existing && (typeof existing.restaurant === 'object' ? existing.restaurant.id : existing.restaurant)
  if (!existing || String(restId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  const updated = await payload.update({
    collection: 'reservations',
    id: reservationId,
    data: { status },
    overrideAccess: true,
    user,
  })
  return NextResponse.json({ ok: true, reservation: updated })
}
