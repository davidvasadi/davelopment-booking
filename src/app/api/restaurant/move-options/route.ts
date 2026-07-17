import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getMoveOptions } from '@/lib/restaurantBooking'
import type { Restaurant } from '@/payload/payload-types'

/**
 * GET /api/restaurant/move-options?date=&start_time=&pax=&excludeReservationId=
 * A bejelentkezett tulajdonos étterméhez visszaadja az adott időablakban szabad asztalokat.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  // A scope-ot az AKTÍV étterem adja lentebb (nem a user.role) — vegyes fiók is működik.
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const date = searchParams.get('date')
  const start_time = searchParams.get('start_time')
  const pax = Number(searchParams.get('pax') ?? '0')
  const excludeReservationId = searchParams.get('excludeReservationId') ?? undefined

  if (!date || !start_time || !pax) {
    return NextResponse.json({ error: 'Hiányzó paraméter' }, { status: 400 })
  }

  // Aktív étterem (több-üzlet aware): a store-switcherrel kiválasztott, nem az „első".
  const payload = await getPayloadClient()
  const { active } = await getActiveBusiness(user)
  const restaurant = active && active.type === 'restaurant'
    ? ((await payload.findByID({ collection: 'restaurants', id: active.id, depth: 0, overrideAccess: true }).catch(() => null)) as Restaurant | undefined)
    : undefined
  if (!restaurant) return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 404 })

  const options = await getMoveOptions({
    restaurantId: restaurant.id,
    date,
    start_time,
    pax,
    excludeReservationId,
  })

  return NextResponse.json(options)
}
