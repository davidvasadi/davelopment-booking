import { DashboardNav } from './DashboardNav'
import { AppNavbar } from './AppNavbar'
import MobileBottomNav from './MobileBottomNav'
import { SubscriptionBanner } from './SubscriptionBanner'
import { DashboardLockModal } from './DashboardLockModal'
import { DigestAutoPopup } from './DigestAutoPopup'
import { AttentionHost } from './AttentionHost'
import { BroadcastAutoPopup } from './BroadcastAutoPopup'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import type { DashboardVariant } from './navConfig'
import type { SwitcherBusiness } from './switcherTypes'
import type { Capability } from '@/lib/permissions'

type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  /** a próbaidő utáni fizetés be van állítva (van Stripe-előfizetés) */
  setup_done?: boolean
  current_period_end?: string | null
} | null

/**
 * Egységes app-keret (davelopment-design) — a szalon és az étterem UGYANEZT rendereli,
 * csak a `variant` + adatok térnek el. Desktopon: egy 34px lekerekített, gradientes
 * konténer, felül a közös `AppNavbar` pill-nav. Mobilon: a meglévő `DashboardNav` fejléc +
 * `MobileBottomNav` (érintetlen funkció). A `children` EGYSZER renderelődik, reszponzív
 * kerettel. Minden funkció megmarad (előfizetés-banner/lock, onboarding, értesítések).
 */
export function AppShell({
  variant,
  businessName,
  businessSlug,
  brandLogoUrl = null,
  subscription,
  lockedStatus = null,
  basePath,
  userId,
  userName = null,
  userEmail = null,
  userAvatarUrl = null,
  businesses = [],
  activeBusinessKey = null,
  capabilities = [],
  voucherEnabled = false,
  newsletterEnabled = false,
  isOwner = false,
  children,
}: {
  variant: DashboardVariant
  businessName: string
  businessSlug: string
  brandLogoUrl?: string | null
  subscription?: SubInfo
  lockedStatus?: 'past_due' | 'canceled' | 'paused' | null
  basePath: string
  userId: string
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
  businesses?: SwitcherBusiness[]
  activeBusinessKey?: string | null
  /** A hatékony képesség-halmaz az aktív üzletben — a nav-láthatóság ez alapján szűr. */
  capabilities?: Capability[]
  /** Ha false, az "Utalványok" nav-elem sehol nem jelenik meg (a funkció ki van kapcsolva). */
  voucherEnabled?: boolean
  /** Ha false, a "Marketing" nav-elem sehol nem jelenik meg — ugyanaz a minta, mint a
   *  voucherEnabled-nél (a hírlevél-csomag "Nincs"-re állítva a Beállítások/Fizetéseknél). */
  newsletterEnabled?: boolean
  /** Az aktív üzlet tulajdonosa — csak ő látja a Partnerprogramot (ajánló link). */
  isOwner?: boolean
  children: React.ReactNode
}) {
  const hiddenHrefs = [
    ...(voucherEnabled ? [] : [variant === 'restaurant' ? '/restaurant/vouchers' : '/dashboard/vouchers']),
    ...(newsletterEnabled ? [] : [variant === 'restaurant' ? '/restaurant/marketing' : '/dashboard/marketing']),
    ...(isOwner ? [] : [variant === 'restaurant' ? '/restaurant/partnerprogram' : '/dashboard/partnerprogram']),
  ]
  return (
    <div data-app-variant={variant} className="font-onest min-h-screen bg-ui-page text-ui-text">
      {/* Mobil fejléc (desktopon az AppNavbar) */}
      <DashboardNav
        salonName={businessName}
        salonSlug={businessSlug}
        subscription={subscription}
        variant={variant}
        capabilities={capabilities}
        brandLogoUrl={brandLogoUrl}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        businesses={businesses}
        activeBusinessKey={activeBusinessKey}
        hiddenHrefs={hiddenHrefs}
      />

      {/* A krém háttér a teljes oldal (nincs külön lekerekített konténer); desktopon a tartalom középen, max. 1460px */}
      <div className="max-lg:pb-24 lg:mx-auto lg:max-w-[1460px] lg:px-6 lg:py-6">
        <AppNavbar
          variant={variant}
          capabilities={capabilities}
          businessSlug={businessSlug}
          subscription={subscription}
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          businesses={businesses}
          activeBusinessKey={activeBusinessKey}
          hiddenHrefs={hiddenHrefs}
        />

        <div className="lg:mt-6">
          <SubscriptionBanner subscription={subscription ?? null} basePath={basePath} />
          {children}
        </div>
      </div>

      <MobileBottomNav
        subscription={subscription}
        variant={variant}
        capabilities={capabilities}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        hiddenHrefs={hiddenHrefs}
      />
      {lockedStatus && <DashboardLockModal status={lockedStatus} paid={subscription?.plan === 'paid'} />}
      {variant !== 'backstage' && <OnboardingTour variant={variant} userId={userId} userName={userName} businessName={businessName} />}
      {/* „Ami figyelmet kér” (design 6.8.1): jóváhagyásra váró sáv / popup, fizetésre vár sáv */}
      {variant !== 'backstage' && !lockedStatus && <AttentionHost basePath={basePath} restaurant={variant === 'restaurant'} />}
      {variant !== 'backstage' && <DigestAutoPopup />}
      {variant !== 'backstage' && <BroadcastAutoPopup />}
    </div>
  )
}
