import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { assertCapability } from '@/lib/apiCapability'

/**
 * Mentett beosztás-sablonok (Naptár „+ Beosztás”, design 11.6). RBAC: `schedule.manage` az üzletben.
 * GET    ?salon=… | ?restaurant=…  — a sablonok
 * POST   { salon | restaurant, name, start_time, end_time, breaks, days, people } — új sablon
 * DELETE ?id=…                      — törlés
 */
const num = (v: unknown) => (v == null ? v : /^\d+$/.test(String(v)) ? Number(v) : v)
const relId = (v: unknown) => (v == null ? null : typeof v === 'object' ? (v as { id: string | number }).id : (v as string | number))

function bizOf(src: { salon?: unknown; restaurant?: unknown }): { type: 'salon' | 'restaurant'; id: string } | null {
  if (src.restaurant) return { type: 'restaurant', id: String(src.restaurant) }
  if (src.salon) return { type: 'salon', id: String(src.salon) }
  return null
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const sp = req.nextUrl.searchParams
  const biz = bizOf({ salon: sp.get('salon'), restaurant: sp.get('restaurant') })
  if (!biz) return NextResponse.json({ error: 'Hiányzó üzlet' }, { status: 400 })
  const denied = await assertCapability(user.id, biz.type, biz.id, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'shift-templates', where: { [biz.type]: { equals: num(biz.id) } }, sort: 'name', limit: 50, depth: 0, overrideAccess: true })
  return NextResponse.json({ templates: res.docs })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 }) }
  const biz = bizOf(body)
  if (!biz) return NextResponse.json({ error: 'Hiányzó üzlet' }, { status: 400 })
  const denied = await assertCapability(user.id, biz.type, biz.id, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Adj nevet a sablonnak' }, { status: 400 })
  const payload = await getPayloadClient()
  const doc = await payload.create({
    collection: 'shift-templates',
    data: {
      name, [biz.type]: num(biz.id),
      start_time: body.start_time ?? null, end_time: body.end_time ?? null,
      breaks: Array.isArray(body.breaks) ? body.breaks : [],
      days: Array.isArray(body.days) ? body.days : [],
      people: Array.isArray(body.people) ? body.people.map(String) : [],
    } as never,
    overrideAccess: true,
  })
  return NextResponse.json({ ok: true, template: doc }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Hiányzó azonosító' }, { status: 400 })
  const payload = await getPayloadClient()
  const tpl = await payload.findByID({ collection: 'shift-templates', id, depth: 0, overrideAccess: true }).catch(() => null)
  if (!tpl) return NextResponse.json({ error: 'A sablon nem található' }, { status: 404 })
  const biz = bizOf({ salon: relId((tpl as { salon?: unknown }).salon), restaurant: relId((tpl as { restaurant?: unknown }).restaurant) })
  if (!biz) return NextResponse.json({ error: 'Érvénytelen sablon' }, { status: 400 })
  const denied = await assertCapability(user.id, biz.type, biz.id, 'schedule.manage')
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })
  await payload.delete({ collection: 'shift-templates', id, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
