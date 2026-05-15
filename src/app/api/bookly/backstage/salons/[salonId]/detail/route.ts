import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ salonId: string }> }
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { salonId } = await params
  const payload = await getPayloadClient()

  const monthStart = new Date()
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [salon, sub, totalBookings, monthBookings, recentBookings] = await Promise.all([
    payload.findByID({ collection: 'salons', id: salonId, depth: 2, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'subscriptions', where: { salon: { equals: salonId } }, limit: 1, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { salon: { equals: salonId } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { salon: { equals: salonId }, createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { salon: { equals: salonId } }, sort: '-createdAt', limit: 6, depth: 1, overrideAccess: true }),
  ])

  if (!salon) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    salon,
    subscription: sub.docs[0] ?? null,
    totalBookings: totalBookings.totalDocs,
    monthBookings: monthBookings.totalDocs,
    recentBookings: recentBookings.docs,
  })
}
