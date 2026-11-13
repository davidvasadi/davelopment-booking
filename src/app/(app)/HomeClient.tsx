import type { LandingPricing } from '@/components/landing/types'
import { CookieBanner } from '@/components/landing/CookieBanner'
import { LandingClickTracker } from '@/components/landing/LandingClickTracker'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { ConceptLight, DarkFeatureBlock, TipsK2 } from '@/components/blocks/landing-concepts'
import { HomeSteps } from '@/components/blocks/landing-stepvisuals'
import { Pricing as PricingK2 } from '@/components/blocks/landing-pricing'
import { Faq as FaqK2 } from '@/components/blocks/landing-faq'

export type { LandingPricing }

/**
 * A főoldal (design 22.21 „Koncepció 2”): a világos landing a koncepció saját világos láblécével; a szekció-horgonyok
 * megmaradnak: #hogyan, #arazas, #funkciok, #gyik. Szerver-komponens.
 *
 * (Az iparági oldalak 2026-11-13 óta a saját felépítésükön futnak — components/blocks/landing-industry; a régi,
 * főoldal-alapú iparági elrendezés és a csak általa használt régi szekciók kikerültek.)
 */
export default async function HomeClient({ pricing }: { pricing: LandingPricing }) {
  const googleRating = await getCachedGoogleRating()
  return (
    <main className="min-h-screen bg-white text-ui-text">
      <ConceptLight
        rating={googleRating}
        trialDays={pricing.trial_days}
        tail={<>
          <HomeSteps />
          <PricingK2 pricing={pricing} look="k2" />
          <DarkFeatureBlock />
          <FaqK2 pricing={pricing} look="k2" />
          <TipsK2 />
        </>}
      />
      <CookieBanner />
      <LandingClickTracker />
    </main>
  )
}
