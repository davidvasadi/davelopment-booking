import { NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

/**
 * Több-üzlet (multi-tenant): a tulajdonos az ÖSSZES saját helye (szalon + étterem) owner-
 * értesítéseit látja — nem csak a régi `user.salon`/`user.restaurant` fix mezőét. Admin az
 * admin-közönségű értesítéseket.
 */
async function placeFilter(user: { id: string | number; role: string }): Promise<Where | null> {
  if (user.role === 'admin') return { audience: { equals: 'admin' } }

  const payload = await getPayloadClient()
  const [salons, restaurants] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: user.id } }, limit: 100, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: user.id } }, limit: 100, depth: 0, overrideAccess: true }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  if (or.length === 0) return null

  return { and: [{ or }, { audience: { equals: 'owner' } }] }
}

// GET — legutóbbi értesítések + olvasatlan számláló
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const where = await placeFilter(user)
  if (!where) return NextResponse.json({ notifications: [], unread: 0 })

  const payload = await getPayloadClient()
  const [list, unread] = await Promise.all([
    payload.find({
      collection: 'notifications',
      where,
      sort: '-createdAt',
      limit: 20,
      depth: 0,
      overrideAccess: true,
    }),
    payload.count({
      collection: 'notifications',
      where: { ...where, read: { equals: false } },
      overrideAccess: true,
    }),
  ])

  return NextResponse.json({ notifications: list.docs, unread: unread.totalDocs })
}

// PATCH — olvasottnak jelöl (egy id, vagy mind a felhasználó helyén)
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const where = await placeFilter(user)
  if (!where) return NextResponse.json({ ok: true })

  const body = (await req.json().catch(() => ({}))) as { id?: number | string }
  const payload = await getPayloadClient()

  await payload.update({
    collection: 'notifications',
    where: body.id ? { ...where, id: { equals: body.id } } : { ...where, read: { equals: false } },
    data: { read: true },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}

// DELETE — egyetlen értesítés törlése (a saját helyen)
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const where = await placeFilter(user)
  if (!where) return NextResponse.json({ ok: true })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const payload = await getPayloadClient()
  await payload.delete({
    collection: 'notifications',
    where: { ...where, id: { equals: id } },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
