import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getMoveOptions } from '@/lib/restaurantBooking'
import type { Restaurant } from '@/payload/payload-types'

/**
 * GET /api/restaurant/move-options?date=&start_time=&pax=&excludeReservationId=
 * A bejelentkezett tulajdonos étterméhez visszaadja az adott időablakban szabad asztalokat.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'restaurant_owner' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const date = searchParams.get('date')
  const start_time = searchParams.get('start_time')
  const pax = Number(searchParams.get('pax') ?? '0')
  const excludeReservationId = searchParams.get('excludeReservationId') ?? undefined

  if (!date || !start_time || !pax) {
    return NextResponse.json({ error: 'Hiányzó paraméter' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'restaurants',
    where: { owner: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  const restaurant = result.docs[0] as Restaurant | undefined
  if (!restaurant) return NextResponse.json({ error: 'Nincs étterem' }, { status: 404 })

  const options = await getMoveOptions({
    restaurantId: restaurant.id,
    date,
    start_time,
    pax,
    excludeReservationId,
  })

  return NextResponse.json(options)
}
