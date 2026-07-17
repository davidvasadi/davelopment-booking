import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { getAccountBilling } from '@/lib/accountBilling'
import { getPricing } from '@/lib/pricing'
import { getUserBusinesses } from '@/lib/activeBusiness'
import { SubscriptionView } from '@/components/dashboard/SubscriptionView'

export default async function RestaurantSubscriptionPage() {
  const { restaurant, userId, capabilities } = await getOwnedRestaurant()
  requireCapability(capabilities, 'billing.manage', '/restaurant')
  const payload = await getPayloadClient()

  const [sub, billing, pricing, allBusinesses] = await Promise.all([
    findAccountSubscription({ payload }, userId),
    getAccountBilling(userId),
    getPricing(),
    getUserBusinesses(userId),
  ])
  const businesses = allBusinesses.map((b) => ({ type: b.type, id: b.id, name: b.name, slug: b.slug, logoUrl: b.logoUrl }))

  return (
    <SubscriptionView
      kind="restaurant"
      sub={sub}
      billing={billing}
      pricing={pricing}
      activeBusinessId={restaurant?.id ? String(restaurant.id) : undefined}
      businesses={businesses}
      activeKey={restaurant?.id ? `restaurant:${restaurant.id}` : null}
      startedAt={restaurant?.createdAt as unknown as string}
      settingsBase="/restaurant"
    />
  )
}
