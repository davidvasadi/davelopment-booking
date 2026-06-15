import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { autoCompleteBookings } from '@/lib/autoComplete'
import { expireOneTrial } from '@/lib/subscriptionSync'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { DashboardNav } from '@/components/dashboard/DashboardNav'
import MobileBottomNav from '@/components/dashboard/MobileBottomNav'
import { SubscriptionBanner } from '@/components/dashboard/SubscriptionBanner'
import { Reveal } from '@/components/ui/reveal'
import { DashboardLockModal } from '@/components/dashboard/DashboardLockModal'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import type { Salon, Subscription } from '@/payload/payload-types'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth()

  if (user.role === 'admin') redirect('/backstage')

  // Több-üzlet: a NÉZETET az aktív üzlet típusa dönti el (nem a role). Ha az aktív
  // üzlet étterem, a felhasználó a /restaurant nézetre tartozik.
  const { active, businesses } = await getActiveBusiness(user)
  if (!active) redirect('/register')
  if (active.type !== 'salon') redirect('/restaurant')

  const payload = await getPayloadClient()
  const salon = (await payload.findByID({
    collection: 'salons',
    id: active.id,
    overrideAccess: true,
  })) as Salon

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
      <DashboardNav
        salonName={salon.name}
        salonSlug={salon.slug}
        subscription={sub}
        brandLogoUrl={typeof salon.logo === 'object' && salon.logo?.url ? salon.logo.url : null}
        userName={user.name}
        userEmail={user.email}
        userAvatarUrl={user.avatar_url ?? null}
        businesses={businesses}
        activeBusinessKey={`${active.type}:${active.id}`}
      />
      <main className="flex-1 pb-24 lg:pb-0">
        <SubscriptionBanner subscription={sub} />
        <Reveal>{children}</Reveal>
      </main>
      <MobileBottomNav subscription={sub} userName={user.name} userEmail={user.email} userAvatarUrl={user.avatar_url ?? null} />
      {lockedStatus && <DashboardLockModal status={lockedStatus} />}
      <OnboardingTour variant="salon" userId={String(user.id)} />
    </div>
  )
}
