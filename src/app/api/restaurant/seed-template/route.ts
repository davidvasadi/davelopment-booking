import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getTemplate } from '@/lib/restaurantTemplates'
import { seedRestaurantTemplate } from '@/lib/seedTemplates'

export async function POST(req: Request) {
  const user = await getCurrentUser({ allowHeaderAuth: true })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { restaurantId?: number; templateId?: string }
  if (!body.restaurantId || !body.templateId) {
    return NextResponse.json({ error: 'restaurantId and templateId are required' }, { status: 400 })
  }
  const template = getTemplate(body.templateId)
  if (!template) return NextResponse.json({ error: 'Unknown template' }, { status: 404 })

  const payload = await getPayloadClient()

  // Verify ownership (admin bypasses)
  const restaurant = await payload.findByID({
    collection: 'restaurants',
    id: body.restaurantId,
    overrideAccess: true,
  })
  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })
  const ownerId = typeof restaurant.owner === 'object' ? restaurant.owner.id : restaurant.owner
  if (user.role !== 'admin' && ownerId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await seedRestaurantTemplate(payload, body.restaurantId, body.templateId, user)

  return NextResponse.json({ ok: true, rooms: template.rooms.length, opening_hours: template.opening_hours.length })
}
