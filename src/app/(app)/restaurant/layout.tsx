import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { expireOneTrial } from '@/lib/subscriptionSync'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import { SubscriptionBanner } from '@/components/dashboard/SubscriptionBanner'
import { Reveal } from '@/components/ui/reveal'
import { DashboardLockModal } from '@/components/dashboard/DashboardLockModal'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import { RestaurantUIProvider } from '@/components/restaurant/RestaurantUIContext'
import type { Restaurant, Subscription } from '@/payload/payload-types'

export default async function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  if (user.role === 'admin') redirect('/backstage')

  // Több-üzlet: a NÉZETET az aktív üzlet típusa dönti el (nem a role). Ha az aktív
  // üzlet szalon, a felhasználó a /dashboard nézetre tartozik.
  const { active, businesses } = await getActiveBusiness(user)
  if (!active) redirect('/register-restaurant')
  if (active.type !== 'restaurant') redirect('/dashboard')

  const payload = await getPayloadClient()
  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: active.id,
    overrideAccess: true,
  })) as Restaurant

  // Fiók-szintű előfizetés: a lock-státusz a FIÓK (owner) egyetlen előfizetéséből jön.
  let subscription: Subscription | null = await findAccountSubscription({ payload }, user.id)
  subscription = await expireOneTrial(subscription)

  const sub = subscription
    ? { plan: subscription.plan, status: subscription.status, trial_ends_at: subscription.trial_ends_at, current_period_end: subscription.current_period_end }
    : null

  const lockedStatus: 'past_due' | 'canceled' | 'paused' | null =
    sub?.status === 'past_due' || sub?.status === 'canceled' || sub?.status === 'paused'
      ? sub.status
      : null

  const logo = restaurant.logo
  const brandLogoUrl = typeof logo === 'object' && logo?.url ? logo.url : null

  return (
    <RestaurantUIProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col lg:flex-row">
        <DashboardNav
          salonName={restaurant.name}
          salonSlug={restaurant.slug}
          subscription={sub}
          variant="restaurant"
          brandLogoUrl={brandLogoUrl}
          userName={user.name}
          userEmail={user.email}
          userAvatarUrl={user.avatar_url ?? null}
          businesses={businesses}
          activeBusinessKey={`${active.type}:${active.id}`}
        />
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <SubscriptionBanner subscription={sub} basePath="/restaurant" />
          <Reveal>{children}</Reveal>
        </main>
        <MobileBottomNav subscription={sub} variant="restaurant" userName={user.name} userEmail={user.email} userAvatarUrl={user.avatar_url ?? null} />
        {lockedStatus && <DashboardLockModal status={lockedStatus} />}
        <OnboardingTour variant="restaurant" userId={String(user.id)} />
      </div>
    </RestaurantUIProvider>
  )
}
