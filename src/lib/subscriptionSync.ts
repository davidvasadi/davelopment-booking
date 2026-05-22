import { getPayloadClient } from '@/lib/payload'
import type { Subscription } from '@/payload/payload-types'

export async function expireStaleTrials(): Promise<number> {
  const payload = await getPayloadClient()
  const now = new Date().toISOString()
  const result = await payload.find({
    collection: 'subscriptions',
    where: {
      and: [
        { status: { equals: 'trialing' } },
        { trial_ends_at: { less_than: now } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  })
  for (const sub of result.docs as Subscription[]) {
    await payload.update({
      collection: 'subscriptions',
      id: sub.id,
      data: { status: 'past_due' },
      overrideAccess: true,
    })
  }
  return result.docs.length
}

export async function expireOneTrial(sub: Subscription | null): Promise<Subscription | null> {
  if (
    !sub ||
    sub.status !== 'trialing' ||
    !sub.trial_ends_at ||
    new Date(sub.trial_ends_at).getTime() >= Date.now()
  ) {
    return sub
  }
  const payload = await getPayloadClient()
  return (await payload.update({
    collection: 'subscriptions',
    id: sub.id,
    data: { status: 'past_due' },
    overrideAccess: true,
  })) as Subscription
}
