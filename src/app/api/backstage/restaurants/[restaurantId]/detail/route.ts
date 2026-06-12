import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

// Az étterem-megfelelője a salons/[salonId]/detail végpontnak — a backstage PlaceDetailSheet
// hívja, ha a kiválasztott hely étterem (foglalás = reservations, nem bookings).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { restaurantId } = await params
  const payload = await getPayloadClient()

  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [restaurant, sub, totalBookings, monthBookings, recentBookings] = await Promise.all([
    payload.findByID({ collection: 'restaurants', id: restaurantId, depth: 2, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'subscriptions', where: { restaurant: { equals: restaurantId } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { restaurant: { equals: restaurantId } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { restaurant: { equals: restaurantId }, createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { restaurant: { equals: restaurantId } }, sort: '-createdAt', limit: 6, depth: 1, overrideAccess: true }),
  ])

  if (!restaurant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    salon: restaurant, // a sheet egységes `salon` kulccsal olvas (a hely-objektum mezői közösek)
    kind: 'restaurant',
    subscription: sub.docs[0] ?? null,
    totalBookings: totalBookings.totalDocs,
    monthBookings: monthBookings.totalDocs,
    recentBookings: recentBookings.docs,
  })
}
