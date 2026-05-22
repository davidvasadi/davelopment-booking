import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getTemplate } from '@/lib/restaurantTemplates'

export async function POST(req: Request) {
  const user = await getCurrentUser()
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

  // Update restaurant settings from template
  await payload.update({
    collection: 'restaurants',
    id: body.restaurantId,
    data: {
      capacity_mode: template.capacity_mode,
      turn_duration_minutes: template.turn_duration_minutes,
      slot_step_minutes: template.slot_step_minutes,
      lead_time_hours: template.lead_time_hours,
      ...(template.max_pax ? { max_pax: template.max_pax } : {}),
    },
    overrideAccess: true,
  })

  // Wipe existing rooms, tables & opening hours (idempotent seed)
  await payload.delete({ collection: 'tables', where: { restaurant: { equals: body.restaurantId } }, overrideAccess: true })
  await payload.delete({ collection: 'rooms', where: { restaurant: { equals: body.restaurantId } }, overrideAccess: true })
  await payload.delete({ collection: 'opening-hours', where: { restaurant: { equals: body.restaurantId } }, overrideAccess: true })

  // Seed rooms + their tables
  let tableCount = 0
  for (const room of template.rooms) {
    const created = await payload.create({
      collection: 'rooms',
      data: { restaurant: body.restaurantId, name: room.name, sort_order: room.sort_order ?? 0 },
      overrideAccess: true,
    })
    for (const t of room.tables) {
      await payload.create({
        collection: 'tables',
        data: { restaurant: body.restaurantId, room: created.id, name: t.name, capacity: t.capacity, sort_order: t.sort_order ?? 0 },
        overrideAccess: true,
      })
      tableCount++
    }
  }

  // Seed opening hours
  for (const h of template.opening_hours) {
    await payload.create({
      collection: 'opening-hours',
      data: { restaurant: body.restaurantId, ...h },
      overrideAccess: true,
    })
  }

  return NextResponse.json({ ok: true, rooms: template.rooms.length, tables: tableCount, opening_hours: template.opening_hours.length })
}
