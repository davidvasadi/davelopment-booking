import { NextResponse } from 'next/server'
import type { Where } from 'payload'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import type { Subscription } from '@/payload/payload-types'

/**
 * POST /api/subscription/cancel
 *
 * Az AKTÍV üzlet előfizetésének lemondása (vagy visszavonása `{ undo: true }`-vel) —
 * a `cancel_at_period_end` flag váltásával. Több-üzlet (multi-tenant) aware:
 *  - NEM role-szűrt (szalon ÉS étterem tulajdonos is hívhatja).
 *  - Az érintett üzlet az AKTÍV üzlet (getActiveBusiness), nem az „első" szalon.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { undo?: boolean }
  const undo = body.undo === true

  const { active } = await getActiveBusiness(user)
  if (!active) return NextResponse.json({ error: 'No active business' }, { status: 404 })

  const payload = await getPayloadClient()
  const where: Where = active.type === 'salon'
    ? { salon: { equals: active.id } }
    : { restaurant: { equals: active.id } }

  const subRes = await payload.find({
    collection: 'subscriptions',
    where,
    limit: 1,
    overrideAccess: true,
  })
  const sub = subRes.docs[0] as Subscription | undefined
  if (!sub) return NextResponse.json({ error: 'No subscription' }, { status: 404 })

  const updated = await payload.update({
    collection: 'subscriptions',
    id: sub.id,
    data: { cancel_at_period_end: !undo },
    overrideAccess: true,
  })

  return NextResponse.json({ subscription: updated })
}
