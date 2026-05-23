import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { expireOneTrial } from '@/lib/subscriptionSync'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import { SubscriptionBanner } from '@/components/dashboard/SubscriptionBanner'
import { DashboardLockModal } from '@/components/dashboard/DashboardLockModal'
import type { Restaurant, Subscription } from '@/payload/payload-types'

export default async function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth('restaurant_owner')

  if (user.role === 'admin') redirect('/backstage')
  if (user.role === 'salon_owner') redirect('/dashboard')

  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'restaurants',
    where: { owner: { equals: user.id } },
    limit: 1,
    overrideAccess: true,
  })

  if (!result.docs.length) redirect('/register-restaurant')
  const restaurant = result.docs[0] as Restaurant

  const subResult = await payload.find({
    collection: 'subscriptions',
    where: { restaurant: { equals: restaurant.id } },
    limit: 1,
    overrideAccess: true,
  })
  let subscription: Subscription | null = (subResult.docs[0] as Subscription) ?? null
  subscription = await expireOneTrial(subscription)

  const sub = subscription
    ? { plan: subscription.plan, status: subscription.status, trial_ends_at: subscription.trial_ends_at, current_period_end: subscription.current_period_end }
    : null

  const lockedStatus: 'past_due' | 'canceled' | 'paused' | null =
    sub?.status === 'past_due' || sub?.status === 'canceled' || sub?.status === 'paused'
      ? sub.status
      : null

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col lg:flex-row">
      <DashboardNav
        salonName={restaurant.name}
        salonSlug={restaurant.slug}
        subscription={sub}
        variant="restaurant"
      />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <SubscriptionBanner subscription={sub} basePath="/restaurant" />
        {children}
      </main>
      <MobileBottomNav subscription={sub} variant="restaurant" />
      {lockedStatus && <DashboardLockModal status={lockedStatus} />}
    </div>
  )
}
