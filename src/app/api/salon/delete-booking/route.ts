import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { assertCapability } from '@/lib/apiCapability'
import type { Booking } from '@/payload/payload-types'

/**
 * POST /api/salon/delete-booking — foglalás VÉGLEGES törlése (nem lemondás/státuszváltás —
 * a rekord ténylegesen kikerül az adatbázisból). A szerkesztő ablak "Törlés" gombja hívja.
 * Az étteremi `/api/restaurant/delete-reservation` párja.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { bookingId?: string | number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  if (!body.bookingId) return NextResponse.json({ error: 'Hiányzó bookingId' }, { status: 400 })

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'salon') return NextResponse.json({ error: 'Nincs aktív szalon' }, { status: 404 })

  const denied = await assertCapability(user.id, 'salon', active.id, 'bookings.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const payload = await getPayloadClient()

  const existing = (await payload
    .findByID({ collection: 'bookings', id: body.bookingId, depth: 0, overrideAccess: true })
    .catch(() => null)) as Booking | null
  const salonId = existing && (typeof existing.salon === 'object' ? existing.salon.id : existing.salon)
  if (!existing || String(salonId) !== String(active.id)) {
    return NextResponse.json({ error: 'A foglalás nem található' }, { status: 404 })
  }

  await payload.delete({ collection: 'bookings', id: body.bookingId, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
