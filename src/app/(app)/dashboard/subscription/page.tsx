import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { getAccountBilling } from '@/lib/accountBilling'
import { getPricing } from '@/lib/pricing'
import { getUserBusinesses } from '@/lib/activeBusiness'
import { SubscriptionView } from '@/components/dashboard/SubscriptionView'

export default async function SubscriptionPage() {
  const { salon, userId, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'billing.manage', '/dashboard')
  const payload = await getPayloadClient()
  if (!salon) return null

  const [sub, billing, pricing, allBusinesses] = await Promise.all([
    findAccountSubscription({ payload }, userId),
    getAccountBilling(userId),
    getPricing(),
    getUserBusinesses(userId),
  ])
  const businesses = allBusinesses.map((b) => ({ type: b.type, id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl }))

  return (
    <SubscriptionView
      kind="salon"
      sub={sub}
      billing={billing}
      pricing={pricing}
      activeBusinessId={String(salon.id)}
      businesses={businesses}
      activeKey={`salon:${salon.id}`}
      startedAt={salon?.createdAt as unknown as string}
      settingsBase="/dashboard"
    />
  )
}
