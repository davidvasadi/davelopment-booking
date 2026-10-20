import type { LandingPricing } from '@/components/landing/types'
import type { IndustryLanding } from '@/lib/industryLandings'
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
import { RelatedIndustries } from '@/components/landing/sections/RelatedIndustries'
import { TipsTeaser } from '@/components/landing/sections/TipsTeaser'
import { ContactSection } from '@/components/landing/sections/ContactSection'
import { DavelopmentBanner } from '@/components/landing/sections/DavelopmentBanner'
import { Footer } from '@/components/landing/sections/Footer'
import { CookieBanner } from '@/components/landing/CookieBanner'
import { LandingClickTracker } from '@/components/landing/LandingClickTracker'
import { getCachedGoogleRating, getCachedGoogleReviews } from '@/lib/google-rating'

export type { LandingPricing }

/**
 * A marketing landing vékony kompozíciója. Minden szekció self-contained, propból kap
 * (dinamikus árazás), a saját kliens-határát maga kezeli — ez a fájl szerver-komponens marad,
 * így a statikus szekciók (Nav, Pricing, Footer) nem visznek fölös JS-t a kliensre.
 *
 * Az `industry` prop az iparági SEO-landingeknél (lásd `[slug]/page.tsx`) írja felül a hero,
 * a "Hogyan működik" (fejléc + 3 lépés), a "Csapat", a "Látod mi történik" (SegmentToggle) és a
 * CTA-banner szövegét, fix Árazás/SegmentToggle-szegmensre állítja (nincs "Szakember/Étterem"
 * toggle gomb, csak a releváns nézet), és a GYIK-hez szakma-specifikus pontokat fűz a lista
 * elejére. A Marquee csak a főoldalon jelenik meg — az kifejezetten a homepage bemutató-jellegű
 * nyitányához tartozik, egy célzott landingen nincs rá szükség.
 */
export default async function HomeClient({
  pricing,
  industry,
}: {
  pricing: LandingPricing
  industry?: IndustryLanding
}) {
  const [googleRating, googleReviews] = await Promise.all([
    getCachedGoogleRating(),
    getCachedGoogleReviews(),
  ])
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-brand-ink font-geist" style={{ '--page-bg': '#F7F7F7' } as React.CSSProperties}>
      <div className="relative z-10">
        <Hero pricing={pricing} title={industry?.heroTitle} subtitle={industry?.heroSubtitle} />
      </div>
      {!industry && <Marquee />}
      <SegmentToggle segment={industry?.segment} title={industry?.segmentToggleTitle} subtitle={industry?.segmentToggleSubtitle} />
      <HowItWorks title={industry?.howItWorksTitle} subtitle={industry?.howItWorksSubtitle} steps={industry?.howItWorksSteps} />
      <CalendarSection title={industry?.calendarTitle} subtitle={industry?.calendarSubtitle} />
      <TeamSection title={industry?.teamTitle} subtitle={industry?.teamSubtitle} />
      <Testimonials
        trial_days={pricing.trial_days}
        joinLine={industry?.testimonialsJoinLine}
        googleRating={googleRating}
        googleReviews={googleReviews.map((r) => ({ authorName: r.authorName, photoUrl: r.photoUrl }))}
      />
      <Faq pricing={pricing} extraItems={industry?.faqItems} />
      <CtaBanner trial_days={pricing.trial_days} title={industry?.ctaTitle} />
      <Pricing pricing={pricing} segment={industry?.segment} />
      {industry && industry.relatedSlugs.length > 0 && <RelatedIndustries slugs={industry.relatedSlugs} />}
      <TipsTeaser />
      <ContactSection googleRating={googleRating} />
      <DavelopmentBanner />
      <Footer trial_days={pricing.trial_days} googleRating={googleRating} />
      <CookieBanner />
      <LandingClickTracker />
    </main>
  )
}
