import type { Viewport } from 'next'
import { redirect } from 'next/navigation'

export const viewport: Viewport = { themeColor: '#E3E5E6' }
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { expireOneTrial } from '@/lib/subscriptionSync'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { findAccountSubscription } from '@/lib/accountSubscription'
import { AppShell } from '@/components/dashboard/AppShell'
import { PageTransition } from '@/components/ui/page-transition'
import { LiveRefreshProvider } from '@/components/LiveRefreshProvider'
import { RestaurantUIProvider } from '@/components/restaurant/RestaurantUIContext'
import type { Restaurant, Subscription } from '@/payload/payload-types'
import { brandImage, type BrandPlace } from '@/lib/brandImage'

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
    // a keretnek csak ennyi kell (név, slug, logó, tulaj, utalvány / hírlevél be-ki) — a teljes adatlap 14–20 al-táblát
    // töltene minden oldalbetöltésnél (sebesség, docs/audit/2026-11-05_1921)
    depth: 1,
    select: { name: true, slug: true, logo: true, owner: true, voucher_settings: true, newsletter_settings: true },
    overrideAccess: true,
  })) as Restaurant

  // Fiók-szintű előfizetés: a lock-státusz a FIÓK (owner) egyetlen előfizetéséből jön — az
  // ÜZLET tulajdonosáé, NEM a bejelentkezett useré (lásd dashboard/layout.tsx azonos indoklása).
  const ownerId = typeof restaurant.owner === 'object' && restaurant.owner ? restaurant.owner.id : restaurant.owner
  let subscription: Subscription | null = ownerId ? await findAccountSubscription({ payload }, ownerId) : null
  subscription = await expireOneTrial(subscription)

  const sub = subscription
    ? { plan: subscription.plan, status: subscription.status, trial_ends_at: subscription.trial_ends_at, current_period_end: subscription.current_period_end, setup_done: !!subscription.stripe_subscription_id }
    : null

  const lockedStatus: 'past_due' | 'canceled' | 'paused' | null =
    sub?.status === 'past_due' || sub?.status === 'canceled' || sub?.status === 'paused'
      ? sub.status
      : null

  const logo = restaurant.logo
  const brandLogoUrl = brandImage(restaurant as BrandPlace, 'dash') ?? (typeof logo === 'object' && logo?.url ? logo.url : null)

  return (
    <RestaurantUIProvider>
      <AppShell
        variant="restaurant"
        businessName={restaurant.name}
        businessSlug={restaurant.slug}
        brandLogoUrl={brandLogoUrl}
        subscription={sub}
        lockedStatus={lockedStatus}
        basePath="/restaurant"
        userId={String(user.id)}
        userName={user.name}
        userEmail={user.email}
        userAvatarUrl={user.avatar_url ?? null}
        businesses={businesses}
        activeBusinessKey={`${active.type}:${active.id}`}
        capabilities={active.capabilities}
      isOwner={active.role === 'owner'}
        voucherEnabled={!!restaurant.voucher_settings?.enabled}
        newsletterEnabled={restaurant.newsletter_settings?.package !== 'none'}
      >
        <LiveRefreshProvider businessKey={`${active.type}:${active.id}`} />
        <PageTransition>{children}</PageTransition>
      </AppShell>
    </RestaurantUIProvider>
  )
}
