import type { LandingPricing } from '@/components/landing/types'
import { Hero } from '@/components/landing/sections/Hero'
import { Marquee } from '@/components/landing/sections/Marquee'
import { HowItWorks } from '@/components/landing/sections/HowItWorks'
import { CalendarSection } from '@/components/landing/sections/CalendarSection'
import { Testimonials } from '@/components/landing/sections/Testimonials'
import { Pricing } from '@/components/landing/sections/Pricing'
import { Faq } from '@/components/landing/sections/Faq'
import { SegmentToggle } from '@/components/landing/sections/SegmentToggle'
import { TeamSection } from '@/components/landing/sections/TeamSection'
import { CtaBanner } from '@/components/landing/sections/CtaBanner'
import { Footer } from '@/components/landing/sections/Footer'
import { CookieBanner } from '@/components/landing/CookieBanner'

export type { LandingPricing }

/**
 * A marketing landing vékony kompozíciója. Minden szekció self-contained, propból kap
 * (dinamikus árazás), a saját kliens-határát maga kezeli — ez a fájl szerver-komponens marad,
 * így a statikus szekciók (Nav, Pricing, Footer) nem visznek fölös JS-t a kliensre.
 */
export default function HomeClient({ pricing }: { pricing: LandingPricing }) {
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-brand-ink font-geist" style={{ '--page-bg': '#F7F7F7' } as React.CSSProperties}>
      <div className="relative z-10">
        <Hero pricing={pricing} />
      </div>
      <Marquee />
      <SegmentToggle />
      <HowItWorks />
      <CalendarSection />
      <TeamSection />
      <Testimonials trial_days={pricing.trial_days} />
      <Faq pricing={pricing} />
      <CtaBanner trial_days={pricing.trial_days} />
      <Pricing pricing={pricing} />
      <Footer trial_days={pricing.trial_days} />
      <CookieBanner />
    </main>
  )
}
