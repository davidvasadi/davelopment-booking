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
import { LiveRefreshProvider } from '@/components/LiveRefreshProvider'
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
    // a keretnek csak ennyi kell (név, slug, logó, tulaj, utalvány / hírlevél be-ki) — a teljes adatlap 14–20 al-táblát
    // töltene minden oldalbetöltésnél (sebesség, docs/audit/2026-11-05_1921)
    depth: 1,
    select: { name: true, slug: true, logo: true, owner: true, voucher_settings: true, newsletter_settings: true },
    overrideAccess: true,
  })) as Salon

  // Fiók-szintű előfizetés: a lock-státusz a FIÓK (owner) egyetlen előfizetéséből jön — az
  // ÜZLET tulajdonosáé, NEM a bejelentkezett useré. Enélkül egy meghívott csapattagnak (akinek
  // sosincs saját subscription-rekordja) sosem lenne lockedStatus-a, akkor sem, ha a tulaj
  // előfizetése lejárt — teljesen megkerülné a zárat.
  const ownerId = typeof salon.owner === 'object' && salon.owner ? salon.owner.id : salon.owner
  let subscription: Subscription | null = ownerId ? await findAccountSubscription({ payload }, ownerId) : null
  subscription = await expireOneTrial(subscription)

  autoCompleteBookings(salon.id).catch(() => null)

  const sub = subscription
    ? { plan: subscription.plan, status: subscription.status, trial_ends_at: subscription.trial_ends_at, current_period_end: subscription.current_period_end, setup_done: !!subscription.stripe_subscription_id }
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
      isOwner={active.role === 'owner'}
      voucherEnabled={!!salon.voucher_settings?.enabled}
      newsletterEnabled={salon.newsletter_settings?.package !== 'none'}
    >
      <LiveRefreshProvider businessKey={`${active.type}:${active.id}`} />
      <PageTransition>{children}</PageTransition>
    </AppShell>
  )
}
