import { NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

function placeFilter(user: { role: string; restaurant?: unknown; salon?: unknown }): Where | null {
  const idOf = (ref: unknown) =>
    ref && typeof ref === 'object' ? (ref as { id: number | string }).id : ref
  if (user.role === 'restaurant_owner') {
    const id = idOf(user.restaurant)
    return id ? { restaurant: { equals: id } } : null
  }
  if (user.role === 'salon_owner') {
    const id = idOf(user.salon)
    return id ? { salon: { equals: id } } : null
  }
  return null
}

// GET — legutóbbi értesítések + olvasatlan számláló
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const where = placeFilter(user)
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

  const where = placeFilter(user)
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

  const where = placeFilter(user)
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
