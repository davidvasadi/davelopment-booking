import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { autoCompleteBookings } from '@/lib/autoComplete'
import { expireOneTrial } from '@/lib/subscriptionSync'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import { SubscriptionBanner } from '@/components/dashboard/SubscriptionBanner'
import { DashboardLockModal } from '@/components/dashboard/DashboardLockModal'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import type { Salon, Subscription } from '@/payload/payload-types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth('salon_owner')

  if (user.role === 'admin') redirect('/backstage')
  if (user.role === 'restaurant_owner') redirect('/restaurant')

  const payload = await getPayloadClient()
  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })

  if (!salonResult.docs.length) redirect('/register')
  const salon = salonResult.docs[0] as Salon

  const subResult = await payload.find({
    collection: 'subscriptions',
    where: { salon: { equals: salon.id } },
    limit: 1,
    overrideAccess: true,
  })
  let subscription: Subscription | null = (subResult.docs[0] as Subscription) ?? null
  subscription = await expireOneTrial(subscription)

  autoCompleteBookings(salon.id).catch(() => null)

  const sub = subscription
    ? { plan: subscription.plan, status: subscription.status, trial_ends_at: subscription.trial_ends_at, current_period_end: subscription.current_period_end }
    : null

  const lockedStatus: 'past_due' | 'canceled' | 'paused' | null =
    sub?.status === 'past_due' || sub?.status === 'canceled' || sub?.status === 'paused'
      ? sub.status
      : null

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex flex-col lg:flex-row">
      <DashboardNav salonName={salon.name} salonSlug={salon.slug} subscription={sub} />
      <main className="flex-1 pb-24 lg:pb-0">
        <SubscriptionBanner subscription={sub} />
        {children}
      </main>
      <MobileBottomNav subscription={sub} />
      {lockedStatus && <DashboardLockModal status={lockedStatus} />}
      <OnboardingTour variant="salon" userId={String(user.id)} />
    </div>
  )
}
