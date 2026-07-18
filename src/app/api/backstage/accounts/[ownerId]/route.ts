import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import type { Subscription } from '@/payload/payload-types'

/**
 * FIÓK-szintű backstage műveletek. A fiók (owner) egyetlen előfizetéséhez tartozó admin-akciók:
 *  - `notes`: belső megjegyzés mentése a subscriptionre
 *  - `status`: előfizetés-státusz váltása (pl. paused ↔ active), + `plan` együtt
 *  - `is_active` (üzletekre): a fiók ÖSSZES helyének aktiválása/deaktiválása egy lépésben (bulk)
 * A payload-hívásokba átadjuk a `user`-t (audit-actor threading), különben a napló „Rendszer".
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ownerId } = await params
  const body = await req.json()
  const payload = await getPayloadClient()

  // A fiók előfizetése (egy owner = egy sub).
  const subRes = await payload.find({
    collection: 'subscriptions',
    where: { owner: { equals: ownerId } },
    limit: 1,
    overrideAccess: true,
  })
  const sub = subRes.docs[0] as Subscription | undefined

  // 1) Előfizetés-mezők (notes / status / plan)
  const subData: Record<string, unknown> = {}
  if (typeof body.notes === 'string') subData.notes = body.notes
  if (typeof body.status === 'string') subData.status = body.status
  if (typeof body.plan === 'string') subData.plan = body.plan
  if (Object.keys(subData).length > 0) {
    if (!sub) return NextResponse.json({ error: 'No subscription for account' }, { status: 404 })
    await payload.update({ collection: 'subscriptions', id: sub.id, data: subData, overrideAccess: true, user })
  }

  // 2) Bulk üzlet-aktiválás/deaktiválás (a fiók összes szalonja + étterme)
  if (typeof body.is_active === 'boolean') {
    const [salons, restaurants] = await Promise.all([
      payload.find({ collection: 'salons', where: { owner: { equals: ownerId } }, limit: 200, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'restaurants', where: { owner: { equals: ownerId } }, limit: 200, depth: 0, overrideAccess: true }),
    ])
    await Promise.all([
      ...salons.docs.map(s => payload.update({ collection: 'salons', id: s.id, data: { is_active: body.is_active }, overrideAccess: true, user })),
      ...restaurants.docs.map(r => payload.update({ collection: 'restaurants', id: r.id, data: { is_active: body.is_active }, overrideAccess: true, user })),
    ])
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/backstage/accounts/[ownerId]
 * Teljes fiók törlése backstage adminból. A Users beforeDelete hook kaszkádolja a
 * szalonokat, éttermeket és az előfizetést.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ ownerId: string }> },
) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { ownerId } = await params
  const id = Number(ownerId)
  if (!id || isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const payload = await getPayloadClient()
  await payload.delete({ collection: 'users', id, overrideAccess: true })
  return NextResponse.json({ ok: true })
}
