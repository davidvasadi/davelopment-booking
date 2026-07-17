import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

/**
 * BACKSTAGE adattisztítás — az árván maradt rekordokat listázza (GET) vagy törli (POST).
 * Árva = amire már semmi élő nem hivatkozik. Két kategória:
 *  1. Media: olyan feltöltött kép, amit se szalon/étterem logo/cover, se szolgáltatás/kategória
 *     kép, se Payload-reláció nem használ (a régi, hiányos törlési kaszkádból maradt vissza).
 *  2. Üres owner-fiók: owner-role user, akinek 0 üzlete, 0 előfizetése ÉS 0 staff-tagsága van
 *     (félbehagyott/teszt regisztráció). Az admin sosem, és az élő staff-ok sem törlődnek.
 *
 * Csak admin. A GET száraz futás (mit törölne), a POST ténylegesen töröl.
 */

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>

async function findOrphanMediaIds(payload: PayloadClient): Promise<number[]> {
  // A media-referáló mezők: salons(logo,cover), restaurants(logo,cover), services(image),
  // service-categories(image). Összegyűjtjük a HASZNÁLT media-id-ket, a többi árva.
  const [media, salons, restaurants, services, cats] = await Promise.all([
    payload.find({ collection: 'media', limit: 5000, depth: 0, overrideAccess: true, select: { id: true } as never }),
    payload.find({ collection: 'salons', limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'services', limit: 5000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'service-categories', limit: 5000, depth: 0, overrideAccess: true }),
  ])
  const used = new Set<number>()
  const add = (v: unknown) => {
    const id = v && typeof v === 'object' ? (v as { id?: number }).id : v
    if (typeof id === 'number') used.add(id)
  }
  for (const s of salons.docs as Record<string, unknown>[]) { add(s.logo); add(s.cover_image) }
  for (const r of restaurants.docs as Record<string, unknown>[]) { add(r.logo); add(r.cover_image) }
  for (const sv of services.docs as Record<string, unknown>[]) { add(sv.image) }
  for (const c of cats.docs as Record<string, unknown>[]) { add(c.image) }
  return (media.docs as { id: number }[]).map(m => m.id).filter(id => !used.has(id))
}

async function findEmptyOwnerIds(payload: PayloadClient): Promise<{ id: string; email: string }[]> {
  const users = await payload.find({ collection: 'users', where: { role: { in: ['salon_owner', 'restaurant_owner'] } }, limit: 5000, depth: 0, overrideAccess: true })
  const out: { id: string; email: string }[] = []
  for (const u of users.docs as { id: number | string; email: string }[]) {
    const [salons, restaurants, subs, staff] = await Promise.all([
      payload.find({ collection: 'salons', where: { owner: { equals: u.id } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'restaurants', where: { owner: { equals: u.id } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'subscriptions', where: { owner: { equals: u.id } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'staff', where: { email: { equals: u.email } }, limit: 0, overrideAccess: true }),
    ])
    if (salons.totalDocs === 0 && restaurants.totalDocs === 0 && subs.totalDocs === 0 && staff.totalDocs === 0) {
      out.push({ id: String(u.id), email: u.email })
    }
  }
  return out
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await getPayloadClient()
  const [orphanMedia, emptyOwners] = await Promise.all([findOrphanMediaIds(payload), findEmptyOwnerIds(payload)])
  return NextResponse.json({
    orphanMedia: orphanMedia.length,
    emptyOwners: emptyOwners.map(o => o.email),
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const payload = await getPayloadClient()
  const body = await req.json().catch(() => ({}))

  let deletedMedia = 0
  let deletedOwners = 0

  if (body.media !== false) {
    const ids = await findOrphanMediaIds(payload)
    for (const id of ids) {
      try { await payload.delete({ collection: 'media', id, overrideAccess: true, user }); deletedMedia++ } catch { /* skip */ }
    }
  }
  if (body.owners !== false) {
    const owners = await findEmptyOwnerIds(payload)
    for (const o of owners) {
      try { await payload.delete({ collection: 'users', id: o.id, overrideAccess: true, user }); deletedOwners++ } catch { /* skip */ }
    }
  }

  return NextResponse.json({ ok: true, deletedMedia, deletedOwners })
}
