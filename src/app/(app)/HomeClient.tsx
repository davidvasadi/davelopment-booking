import type { LandingPricing } from '@/components/landing/types'
import type { IndustryLanding } from '@/lib/industryLandings'
import { Hero } from '@/components/blocks/landing-hero'
import { Marquee } from '@/components/blocks/landing-marquee'
import { HowItWorks } from '@/components/landing/sections/HowItWorks'
import { CalendarSection } from '@/components/landing/sections/CalendarSection'
import { Testimonials } from '@/components/landing/sections/Testimonials'
import { Pricing } from '@/components/landing/sections/Pricing'
import { Faq } from '@/components/landing/sections/Faq'
import { SegmentToggle } from '@/components/landing/sections/SegmentToggle'
import { TeamSection } from '@/components/landing/sections/TeamSection'
import { FeatureGroupSection } from '@/components/landing/sections/FeatureGroupSection'
import { FeatureChapters } from '@/components/blocks/landing-showcase'
import { CtaBanner } from '@/components/landing/sections/CtaBanner'
import { RelatedIndustries } from '@/components/landing/sections/RelatedIndustries'
import { TipsTeaser } from '@/components/landing/sections/TipsTeaser'
import { IndustryDeepDive } from '@/components/landing/sections/IndustryDeepDive'
import { ContactSection } from '@/components/landing/sections/ContactSection'
import { DavelopmentBanner } from '@/components/landing/sections/DavelopmentBanner'
import { Footer } from '@/components/landing/sections/Footer'
import { CookieBanner } from '@/components/landing/CookieBanner'
import { LandingClickTracker } from '@/components/landing/LandingClickTracker'
import { getCachedGoogleRating, getCachedGoogleReviews } from '@/lib/google-rating'
import { homeVisuals } from '@/components/landing/designVisuals'
import { ConceptLight, DarkFeatureBlock, TipsK2 } from '@/components/blocks/landing-concepts'
import { HomeSteps } from '@/components/blocks/landing-stepvisuals'
import { Pricing as PricingK2 } from '@/components/blocks/landing-pricing'
import { Faq as FaqK2 } from '@/components/blocks/landing-faq'

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
  // főoldal: az új, világos landing (design 22.21 „Koncepció 2”). Az iparági landingek egyelőre a régi szekciókon maradnak.
  // A lábléc a koncepció világos lábléce (appnext-minta, „Csatlakozz”); a szekció-horgonyok megmaradnak: #hogyan, #arazas, #funkciok, #gyik.
  if (!industry) {
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
  // a képernyőképek helyén a dashboard design-kártyái (src/components/blocks) — itt, a szerveren készülnek
  const kit = homeVisuals()
  return (
    <main className="min-h-screen bg-[#F7F7F7] text-brand-ink font-geist" style={{ '--page-bg': '#F7F7F7' } as React.CSSProperties}>
      <div className="relative z-10">
        <Hero pricing={pricing} title={industry?.heroTitle} subtitle={industry?.heroSubtitle} miniPairs={kit.heroPairs} />
      </div>
      {!industry && <Marquee />}
      <SegmentToggle segment={industry?.segment} title={industry?.segmentToggleTitle} subtitle={industry?.segmentToggleSubtitle} visuals={kit.segment} />
      {industry?.deepDive && <IndustryDeepDive data={industry.deepDive} />}
      <HowItWorks title={industry?.howItWorksTitle} subtitle={industry?.howItWorksSubtitle} steps={industry?.howItWorksSteps} visuals={kit.steps} />
      {/* a főoldalon a funkció-fejezetek (design 22.0.2); az iparági oldalakon egyelőre a régi szekciók (saját szövegeik) */}
      {industry ? <>
        <FeatureGroupSection groupId="booking" visuals={kit.features.booking} title={"Saját weboldal,\nfoglalással."} subtitle="Bemutatkozó oldal élő szerkesztővel, online foglalás 6 nyelven, emlékeztetők és automatikus vagy kézi jóváhagyás." />
        <CalendarSection title={industry?.calendarTitle} subtitle={industry?.calendarSubtitle} visuals={kit.calendar} />
        <TeamSection title={industry?.teamTitle} subtitle={industry?.teamSubtitle} />
        <FeatureGroupSection groupId="guests" visuals={kit.features.guests} tone="light" layout="bento" title={"Minden vendéged,\negy helyen."} subtitle="Vendégkártya előzményekkel, feketelista, vendég-térkép és export — a foglalásokból magától épül." />
        <FeatureGroupSection groupId="money" visuals={kit.features.money} layout="stage" title={"Előleg, utalvány, számla\n— magától."} subtitle="Kártyás előleg automatikus visszatérítéssel, online ajándékutalvány és automatikus számla, egyenesen a te fiókodba." />
        <FeatureGroupSection groupId="marketing" visuals={kit.features.marketing} tone="light" layout="cards" title={"Hozd vissza\na vendégeidet."} subtitle="Hírlevél a feliratkozott vendégeknek, automatikus Google-értékelés kérés és QR-kód az üzletnek." />
      </> : <section id="funkciok" className="mx-auto max-w-7xl px-4 lg:px-5"><FeatureChapters /></section>}
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
