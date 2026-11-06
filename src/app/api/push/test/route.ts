import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { sendPushToUsers } from '@/lib/webPush'

export const dynamic = 'force-dynamic'

/** Beállítások › Értesítések „Teszt értesítés” (design 16.18): próba-push a bejelentkezett felhasználó minden eszközére. */
export async function POST() {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user
  const payload = await getPayloadClient()
  const subs = await payload.find({ collection: 'push-subscriptions', where: { user: { equals: user.id } }, limit: 0, depth: 0, overrideAccess: true })
  if (!subs.totalDocs) return NextResponse.json({ error: 'Ezen a fiókon még egy eszközön sincs bekapcsolva a telefonos értesítés.' }, { status: 400 })
  await sendPushToUsers(payload, [user.id], { title: 'Teszt értesítés', body: 'Így érkezik majd minden új foglalás. Minden rendben!', url: '/', tag: 'test' })
  return NextResponse.json({ ok: true, devices: subs.totalDocs })
}
