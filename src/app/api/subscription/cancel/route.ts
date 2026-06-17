import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'

/**
 * POST /api/subscription/cancel
 *
 * A FIÓK (account-level) előfizetésének lemondása / visszavonása (`{ undo: true }`) a
 * `cancel_at_period_end` flag váltásával. Egy fiók = egy előfizetés, ezért az egész fiók
 * (minden üzlet) számlázása mondódik le egyszerre.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { undo?: boolean }
  const undo = body.undo === true

  const payload = await getPayloadClient()
  const sub = await findAccountSubscription({ payload }, user.id)
  if (!sub) return NextResponse.json({ error: 'No subscription' }, { status: 404 })

  const updated = await payload.update({
    collection: 'subscriptions',
    id: sub.id,
    data: { cancel_at_period_end: !undo },
    overrideAccess: true,
  })

  return NextResponse.json({ subscription: updated })
}
