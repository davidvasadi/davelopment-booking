import { NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { User } from '@/payload/payload-types'

/**
 * Több-üzlet (multi-tenant): a tulajdonos MINDIG az ÉPP AKTÍV üzlete (szalon VAGY étterem)
 * owner-értesítéseit látja — az aktív üzletet a `davelopment_active_business` cookie adja
 * (getActiveBusiness). Így szalon nézetben a szalon, étterem nézetben az étterem értesítései
 * jelennek meg (nem keverve, nem mindig az étteremé). Admin az admin-közönségű értesítéseket.
 */
async function placeFilter(user: User): Promise<Where | null> {
  if (user.role === 'admin') return { audience: { equals: 'admin' } }

  const { active } = await getActiveBusiness(user)
  // user-célzott értesítések (alkalmazotti digest) mindig látszanak, üzlettől függetlenül.
  const or: Where['or'] = [{ user: { equals: user.id } }]
  if (active) {
    const id: string | number = /^\d+$/.test(active.id) ? Number(active.id) : active.id
    const place: Where = active.type === 'salon' ? { salon: { equals: id } } : { restaurant: { equals: id } }
    or.push({ and: [place, { audience: { equals: 'owner' } }] })
  }
  // Kikapcsolt „Napi összefoglaló” → a digest-értesítések NEM látszanak (sem a listában, sem a
  // harangon, sem felugróként). A cron a rekordot ettől még létrehozza (az a „ma már ment”
  // idempotencia-jelzője), ezért itt, a megjelenítésnél kell kiszűrni.
  const prefs = (user.personal_notif_prefs as Record<string, boolean | null> | null) ?? {}
  if (prefs.digest === false) {
    return { and: [{ or }, { type: { not_in: ['digest_morning', 'digest_evening'] } }] }
  }
  return { or }
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

// DELETE — egyetlen értesítés (`?id=`) vagy az összes (`?all=1`) törlése (a saját helyen)
export async function DELETE(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const where = await placeFilter(user)
  if (!where) return NextResponse.json({ ok: true })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const all = searchParams.get('all') === '1'
  if (!id && !all) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const payload = await getPayloadClient()
  await payload.delete({
    collection: 'notifications',
    // `?all=1` → a felhasználó összes látható értesítése (ugyanaz a hely-szűrő, mint a GET-nél).
    where: all ? where : { ...where, id: { equals: id } },
    overrideAccess: true,
  })

  return NextResponse.json({ ok: true })
}
