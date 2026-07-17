import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { PushSubscription as PushSub } from '@/payload/payload-types'

/**
 * WEB PUSH feliratkozás kezelése (eszközönként).
 *  - POST: a böngésző `PushSubscription`-jét elmentjük/frissítjük (upsert az `endpoint` alapján).
 *  - DELETE: leiratkozás — az adott endpoint rekordját töröljük.
 * A feliratkozás mindig a BEJELENTKEZETT userhez kötődik; küldéskor a user tulaj/tag viszonya dönti,
 * melyik üzlet eseményét kapja meg.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }

  const endpoint = body.endpoint
  const p256dh = body.keys?.p256dh
  const auth = body.keys?.auth
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Hiányos feliratkozás' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const userId = /^\d+$/.test(String(user.id)) ? Number(user.id) : user.id

  // Upsert: ugyanaz az endpoint (eszköz) átregisztrálhat (user-váltás / kulcs-rotáció).
  const existing = await payload.find({
    collection: 'push-subscriptions',
    where: { endpoint: { equals: endpoint } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const data = { user: userId, endpoint, p256dh, auth, user_agent: body.userAgent ?? req.headers.get('user-agent') ?? undefined }

  if (existing.docs.length > 0) {
    await payload.update({ collection: 'push-subscriptions', id: (existing.docs[0] as PushSub).id, data, overrideAccess: true })
  } else {
    await payload.create({ collection: 'push-subscriptions', data, overrideAccess: true })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })

  let body: { endpoint?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Hibás kérés' }, { status: 400 })
  }
  if (!body.endpoint) return NextResponse.json({ error: 'Hiányzó endpoint' }, { status: 400 })

  const payload = await getPayloadClient()
  const found = await payload.find({
    collection: 'push-subscriptions',
    where: { and: [{ endpoint: { equals: body.endpoint } }, { user: { equals: user.id } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (found.docs.length > 0) {
    await payload.delete({ collection: 'push-subscriptions', id: (found.docs[0] as PushSub).id, overrideAccess: true })
  }
  return NextResponse.json({ ok: true })
}
