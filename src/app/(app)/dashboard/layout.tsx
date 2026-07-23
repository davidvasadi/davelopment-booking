import type { Viewport } from 'next'
import { redirect } from 'next/navigation'

export const viewport: Viewport = { themeColor: '#ECECE8' }
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { autoCompleteBookings } from '@/lib/autoComplete'
import { expireOneTrial } from '@/lib/subscriptionSync'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { AppShell } from '@/components/dashboard/AppShell'
import { PageTransition } from '@/components/ui/page-transition'
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

  // Fiók-szintű előfizetés: a lock-státusz a FIÓK (owner) egyetlen előfizetéséből jön.
  let subscription: Subscription | null = await findAccountSubscription({ payload }, user.id)
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
    <AppShell
      variant="salon"
      businessName={salon.name}
      businessSlug={salon.slug}
      brandLogoUrl={typeof salon.logo === 'object' && salon.logo?.url ? salon.logo.url : null}
      subscription={sub}
      lockedStatus={lockedStatus}
      basePath="/dashboard"
      userId={String(user.id)}
      userName={user.name}
      userEmail={user.email}
      userAvatarUrl={user.avatar_url ?? null}
      businesses={businesses}
      activeBusinessKey={`${active.type}:${active.id}`}
      capabilities={active.capabilities}
    >
      <PageTransition>{children}</PageTransition>
    </AppShell>
  )
}
