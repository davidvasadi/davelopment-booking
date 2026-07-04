import { DashboardNav } from './DashboardNav'
import { AppNavbar } from './AppNavbar'
import MobileBottomNav from './MobileBottomNav'
import { SubscriptionBanner } from './SubscriptionBanner'
import { DashboardLockModal } from './DashboardLockModal'
import { OnboardingTour } from '@/components/onboarding/OnboardingTour'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import type { DashboardVariant } from './navConfig'
import type { SwitcherBusiness } from './StoreSwitcher'

type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
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
  children: React.ReactNode
}) {
  return (
    <div className="font-onest min-h-screen bg-paper text-ink">
      {/* Mobil fejléc + ⌘K (a desktop sidebart az új TopNav váltja) */}
      <DashboardNav
        mobileOnly
        salonName={businessName}
        salonSlug={businessSlug}
        subscription={subscription}
        variant={variant}
        brandLogoUrl={brandLogoUrl}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        businesses={businesses}
        activeBusinessKey={activeBusinessKey}
      />

      {/* Desktopon lekerekített, gradientes konténer; mobilon sima paper háttér */}
      <div className="lg:px-6 lg:py-7">
        <div className="lg:mx-auto lg:max-w-[1460px]">
          <div className="lg:rounded-dav-container lg:bg-dav-container lg:p-6 lg:shadow-dav-container">
            <AppNavbar
              variant={variant}
              businessSlug={businessSlug}
              subscription={subscription}
              userName={userName}
              userEmail={userEmail}
              userAvatarUrl={userAvatarUrl}
            />

            <div className="lg:mt-6">
              <SubscriptionBanner subscription={subscription ?? null} basePath={basePath} />
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobil lábléc — Schedulio logó */}
      <footer className="lg:hidden flex justify-center py-8">
        <a href="https://schedulio.hu" target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-80 transition-opacity">
          <SchedulioLogo className="h-5" />
        </a>
      </footer>

      <MobileBottomNav
        subscription={subscription}
        variant={variant}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
      />
      {lockedStatus && <DashboardLockModal status={lockedStatus} />}
      {variant !== 'backstage' && <OnboardingTour variant={variant} userId={userId} />}
    </div>
  )
}
