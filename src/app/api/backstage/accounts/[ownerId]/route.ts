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
  // Admin manuálisan próbaidőszakra állít: ez a legmagasabb prioritású döntés, a próbaidő
  // MOSTANTÓL számoljon, ne egy régi (esetleg már lejárt) trial_ends_at-ból — különben a háttérben
  // futó expireStaleTrials/expireOneTrial a következő betöltéskor azonnal visszaírná past_due-ra.
  // a próba vége kézzel is állítható (Előfizetés állapota ablak) — ilyenkor nem a próbaidő hosszából számoljuk
  const manualTrialEnd = typeof body.trial_ends_at === 'string' && !Number.isNaN(new Date(body.trial_ends_at).getTime()) ? new Date(body.trial_ends_at).toISOString() : null
  if (manualTrialEnd) subData.trial_ends_at = manualTrialEnd
  else if (body.status === 'trialing') {
    const pricing = await payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true })
    const trialDays = (pricing as { trial_days?: number }).trial_days ?? 14
    subData.trial_ends_at = new Date(Date.now() + trialDays * 86_400_000).toISOString()
  }
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
  try {
    await payload.delete({ collection: 'users', id, overrideAccess: true })
  } catch (e) {
    console.error('[backstage/accounts DELETE] végleges törlés sikertelen:', e)
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
