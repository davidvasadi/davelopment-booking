import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, CreditCard, Users, CalendarRange, Percent, Building2, RotateCcw } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { Pricing } from '@/components/blocks/landing-pricing'
import { PriceCalculator } from '@/components/landing/pricing/PriceCalculator'
import { CompareTable } from '@/components/landing/pricing/CompareTable'
import { FaqAccordion, FaqCta } from '@/components/blocks/landing-faq'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { ConceptLightFooter, SectionHead } from '@/components/blocks/landing-concepts'
import { Reveal } from '@/components/landing/Motion'
import { IconCircle } from '@/components/ui-kit'
import { getPricing } from '@/lib/pricing'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { SITE_URL, orgGraphNodes } from '@/lib/publicSeo'
import { billingFacts, pricingFaqItems, pricingOffers, priceSummary } from '@/lib/pricingContent'
import { ftFmt } from '@/components/landing/types'

/**
 * /arak — részletes árazási oldal. Minden szöveg és szám a közös forrásból jön
 * (`src/lib/pricingContent.ts` + a backstage árazási beállításai), így a főoldali árkártyával,
 * a GYIK-kel, a strukturált adattal és az llms.txt-vel mindig egyezik.
 */
const URL = `${SITE_URL}/arak`
const FACT_ICONS = [CreditCard, Users, CalendarRange, Percent, Building2, RotateCcw]

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPricing()
  const title = 'Árak — online időpontfoglaló és asztalfoglaló rendszer'
  const description = `Átlátható havidíj: szakembereknek ${ftFmt(p.salon_starter_huf)}/hó-tól, éttermeknek ${ftFmt(p.restaurant_starter_huf)}/hó-tól. Starter, Pro és egyedi csomag, ${p.trial_days} nap ingyen, bankkártya nélkül, jutalék nélkül.`
  return {
    title,
    description,
    alternates: { canonical: URL },
    openGraph: { type: 'website', title, description, url: URL, siteName: 'davelopment booking' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PricingPage() {
  const [pricing, googleRating] = await Promise.all([getPricing(), getCachedGoogleRating()])
  const faq = pricingFaqItems(pricing)
  const facts = billingFacts(pricing)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ...orgGraphNodes(googleRating),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Főoldal', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Árak', item: URL },
        ],
      },
      {
        '@type': 'WebPage',
        '@id': `${URL}#webpage`,
        url: URL,
        name: 'Árak — davelopment booking',
        description: priceSummary(pricing),
        inLanguage: 'hu-HU',
      },
      {
        '@type': 'SoftwareApplication',
        name: 'davelopment booking',
        url: SITE_URL,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'AggregateOffer',
          priceCurrency: 'HUF',
          lowPrice: Math.min(pricing.salon_starter_huf, pricing.restaurant_starter_huf),
          highPrice: Math.max(pricing.salon_pro_huf, pricing.restaurant_pro_huf),
          offerCount: 4,
          offers: pricingOffers(pricing, URL),
        },
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
    ],
  }

  return (
    // a főoldal (2. koncepció) elemei: fehér oldal, Onest, ui-* színek; a kártyák #F7F7F7 sávon
    <main className="min-h-screen bg-white font-onest text-ui-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <FeatureHeroCentered
        label="Árak"
        h1="Árak: a foglalás a tiéd, a jutalék is."
        lead={`Szakembereknek ${ftFmt(pricing.salon_starter_huf)}/hó-tól, éttermeknek ${ftFmt(pricing.restaurant_starter_huf)}/hó-tól.`}
        trialDays={pricing.trial_days}
        secondary={{ href: '#osszehasonlitas', label: 'Csomagok összehasonlítása' }}
        breadcrumb={
          <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-ui-body text-white/50">
            <Link href="/" className="transition-colors hover:text-white">Főoldal</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="text-white/75">Árak</span>
          </nav>
        }
      />
      {/* a hero után: fehér, felső réteg — egyenes éllel rácsúszik a fél sebességgel lemaradó hero-ra (mint a főoldalon) */}
      <div className="relative z-10 flow-root bg-white">

      {/* Csomagkártyák — ugyanaz a komponens és stílus, mint a főoldalon */}
      <Pricing pricing={pricing} title="Válaszd ki a csomagod." compact look="k2" />

      <PriceCalculator pricing={pricing} />

      <CompareTable pricing={pricing} />

      {/* Így működik a fizetés — fehér kártyák #F7F7F7 sávon, mint a főoldal ikonos kártyái */}
      <section className="bg-[#F7F7F7] px-4 py-24">
        <SectionHead pill="Számlázás" title="Így működik a fizetés." className="mb-12" />
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06} className="h-full">
              <div className="h-full rounded-ui-card bg-white p-6">
                <IconCircle icon={FACT_ICONS[i % FACT_ICONS.length]} tone="cell" size="md" />
                <h3 className="mt-10 text-ui-title font-medium">{f.title}</h3>
                <p className="mt-2 text-ui-meta text-ui-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* GYIK — ugyanaz, mint a főoldalon */}
      <section className="mx-auto max-w-7xl px-4 py-24 lg:px-5">
        <SectionHead pill="GYIK" title="Kérdések az árakról." className="mb-12" />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <FaqCta
            k2
            trialDays={pricing.trial_days}
            title="Számold ki a saját árad."
            body="A kalkulátorral pár kattintás, de a legbiztosabb, ha kipróbálod: a próbaidő alatt minden funkció a tiéd, és nem terhelünk semmit."
          />
          <FaqAccordion items={faq} compact k2 />
        </div>
      </section>

      <CtaGlow
        trial_days={pricing.trial_days}
        button="dark"
        label="Árak"
        title="Kezdd ingyen, döntsd el később."
        lead="Minden funkció a tiéd a próbaidő alatt — csomagot csak akkor választasz, ha már látod, mennyit spórolsz vele."
        bg="/landing/cta/cta-hatter-davelopment-booking.webp"
        plain
        bgPosition="object-[center_75%]"
      />
      <ConceptLightFooter trialDays={pricing.trial_days} />
      </div>
    </main>
  )
}
