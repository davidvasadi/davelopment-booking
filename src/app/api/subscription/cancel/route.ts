import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import type { Salon, Subscription } from '@/payload/payload-types'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'salon_owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { undo?: boolean }
  const undo = body.undo === true

  const payload = await getPayloadClient()
  const salonRes = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonRes.docs[0] as Salon | undefined
  if (!salon) return NextResponse.json({ error: 'No salon' }, { status: 404 })

  const subRes = await payload.find({
    collection: 'subscriptions',
    where: { salon: { equals: salon.id } },
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
