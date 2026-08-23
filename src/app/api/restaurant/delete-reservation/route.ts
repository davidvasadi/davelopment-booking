import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import type { Reservation } from '@/payload/payload-types'

/**
 * POST /api/restaurant/delete-reservation — foglalás VÉGLEGES törlése (nem lemondás/
 * státuszváltás — a rekord ténylegesen kikerül az adatbázisból). A szalon
 * `/api/salon/delete-booking` párja.
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

  const existing = (await payload
    .findByID({ collection: 'reservations', id: body.reservationId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Reservation | null
  const restId = existing && (typeof existing.restaurant === 'object' ? existing.restaurant.id : existing.restaurant)
  if (!existing || String(restId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  await payload.delete({ collection: 'reservations', id: body.reservationId, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
