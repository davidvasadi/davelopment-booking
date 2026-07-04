import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'

/**
 * Napi teendők API a hely áttekintő-kártyájához. A tulajdonos a SAJÁT helyéhez (étterem
 * vagy szalon) vehet fel / pipálhat / törölhet feladatot. A hely-tulajdont minden hívásnál
 * ellenőrizzük (a body/queryben kapott restaurant/salon id az adott user-hez tartozik-e).
 */
async function ownsPlace(userId: string | number, type: 'restaurant' | 'salon', id: string | number): Promise<boolean> {
  const payload = await getPayloadClient()
  const collection = type === 'restaurant' ? 'restaurants' : 'salons'
  const res = await payload.find({
    collection,
    where: { and: [{ id: { equals: id } }, { owner: { equals: userId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.length > 0
}

// GET ?restaurantId= | ?salonId= — a hely nyitott/kész feladatai
export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId')
  const salonId = searchParams.get('salonId')
  const type = restaurantId ? 'restaurant' : 'salon'
  const id = restaurantId ?? salonId
  if (!id) return NextResponse.json({ error: 'missing place id' }, { status: 400 })
  if (!(await ownsPlace(user.id, type, id))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const payload = await getPayloadClient()
  const list = await payload.find({
    collection: 'tasks',
    where: { [type]: { equals: id } },
    sort: ['done', 'createdAt'],
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  return NextResponse.json({ tasks: list.docs })
}

// POST { restaurantId|salonId, title, due_date? }
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { restaurantId?: string; salonId?: string; title?: string; due_date?: string }
  const type = body.restaurantId ? 'restaurant' : 'salon'
  const id = body.restaurantId ?? body.salonId
  const title = body.title?.trim()
  if (!id || !title) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  if (!(await ownsPlace(user.id, type, id))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Csalás-védelem: MÚLTBA (a mai nap kezdete elé) nem lehet visszadátumozott teendőt felvenni.
  if (body.due_date) {
    const due = new Date(body.due_date)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    if (isNaN(due.getTime()) || due.getTime() < todayStart.getTime()) {
      return NextResponse.json({ error: 'past due date not allowed' }, { status: 400 })
    }
  }

  const payload = await getPayloadClient()
  // A reláció-mező Postgresen szám id-t vár — ha az id numerikus string, alakítsuk számmá.
  const relId = /^\d+$/.test(String(id)) ? Number(id) : id
  const task = await payload.create({
    collection: 'tasks',
    data: { [type]: relId, title, done: false, due_date: body.due_date || null },
    overrideAccess: true,
  })
  return NextResponse.json({ task })
}

// PATCH { id, done?, title? }
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { id?: string; done?: boolean; title?: string }
  if (!body.id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'tasks', id: body.id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const type = existing.restaurant ? 'restaurant' : 'salon'
  const placeId = (existing.restaurant ?? existing.salon) as string | number
  if (!(await ownsPlace(user.id, type, placeId))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const data: Record<string, unknown> = {}
  if (typeof body.done === 'boolean') data.done = body.done
  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim()
  const task = await payload.update({ collection: 'tasks', id: body.id, data, overrideAccess: true })
  return NextResponse.json({ task })
}

// DELETE ?id=
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const payload = await getPayloadClient()
  const existing = await payload.findByID({ collection: 'tasks', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const type = existing.restaurant ? 'restaurant' : 'salon'
  const placeId = (existing.restaurant ?? existing.salon) as string | number
  if (!(await ownsPlace(user.id, type, placeId))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  await payload.delete({ collection: 'tasks', id, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
