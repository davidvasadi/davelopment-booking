import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight, CreditCard, Users, CalendarRange, Percent, Building2, RotateCcw } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { Pricing } from '@/components/landing/sections/Pricing'
import { PriceCalculator } from '@/components/landing/pricing/PriceCalculator'
import { CompareTable } from '@/components/landing/pricing/CompareTable'
import { FaqAccordion, FaqCta } from '@/components/landing/sections/Faq'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { Footer } from '@/components/landing/sections/Footer'
import { Reveal, RevealText } from '@/components/landing/Motion'
import { getPricing } from '@/lib/pricing'
import { SITE_URL } from '@/lib/publicSeo'
import { billingFacts, pricingFaqItems, pricingOffers, priceSummary } from '@/lib/pricingContent'
import { ftFmt } from '@/components/landing/types'

/**
 * /arak — részletes árazási oldal. Minden szöveg és szám a közös forrásból jön
 * (`src/lib/pricingContent.ts` + a backstage árazási beállításai), így a főoldali árkártyával,
 * a GYIK-kel, a strukturált adattal és az llms.txt-vel mindig egyezik.
 */
const URL = `${SITE_URL}/arak`
const SECTION = 'mx-auto max-w-7xl px-4 lg:px-5 py-10 lg:py-14'
const PILL = 'inline-flex self-start items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]'
const H2 = 'font-semibold text-[clamp(2rem,4.2vw,52px)] leading-[0.98] tracking-[-0.05em] text-brand-ink'
const FACT_ICONS = [CreditCard, Users, CalendarRange, Percent, Building2, RotateCcw]

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPricing()
  const title = 'Árak — online időpontfoglaló és asztalfoglaló rendszer'
  const description = `Átlátható havidíj: szakembereknek ${ftFmt(p.salon_starter_huf)}/hó-tól, éttermeknek ${ftFmt(p.restaurant_starter_huf)}/hó-tól. Minden funkció minden csomagban, ${p.trial_days} nap ingyen, bankkártya nélkül, jutalék nélkül.`
  return {
    title,
    description,
    alternates: { canonical: URL },
    openGraph: { type: 'website', title, description, url: URL, siteName: 'davelopment booking' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PricingPage() {
  const pricing = await getPricing()
  const faq = pricingFaqItems(pricing)
  const facts = billingFacts(pricing)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
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
    <main className="min-h-screen bg-[#F7F7F7] font-geist text-brand-ink" style={{ '--page-bg': '#F7F7F7' } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <FeatureHeroCentered
        label="Árak"
        h1="Átlátható árak, rejtett költségek nélkül."
        lead={`Szakembereknek ${ftFmt(pricing.salon_starter_huf)}/hó-tól, éttermeknek ${ftFmt(pricing.restaurant_starter_huf)}/hó-tól. Minden funkció minden csomagban — jutalék és apró betű nélkül.`}
        trialDays={pricing.trial_days}
        secondary={{ href: '#osszehasonlitas', label: 'Csomagok összehasonlítása' }}
        breadcrumb={
          <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-[14px] text-brand-ink/45">
            <Link href="/" className="hover:text-brand-ink">Főoldal</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="text-brand-ink/70">Árak</span>
          </nav>
        }
      />

      {/* Csomagkártyák — ugyanaz a komponens, mint a főoldalon */}
      <Pricing pricing={pricing} title="Válaszd ki a csomagod." compact />

      <PriceCalculator pricing={pricing} />

      <CompareTable pricing={pricing} />

      {/* Így működik a számlázás */}
      <section className={SECTION}>
        <div className="mb-7 flex flex-col gap-4">
          <Reveal><span className={PILL}>Számlázás</span></Reveal>
          <RevealText text="Így működik a fizetés." delay={0.1} className={H2} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f, i) => {
            const Icon = FACT_ICONS[i % FACT_ICONS.length]
            return (
              <Reveal key={f.title} delay={(i % 3) * 0.06} className="rounded-[18px] bg-white p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4F4F4] text-brand-ink">
                  <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <h3 className="mt-3.5 text-[17px] font-semibold tracking-[-0.03em] text-brand-ink">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-brand-ink/60">{f.body}</p>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* GYIK — két oszlop, mint a többi oldalon */}
      <section className={`${SECTION} flex flex-col gap-7`}>
        <div className="flex flex-col gap-6">
          <Reveal><span className={PILL}>FAQ</span></Reveal>
          <RevealText text="Kérdések az árakról." delay={0.1} className={H2} />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <FaqCta
            trialDays={pricing.trial_days}
            title="Számold ki a saját árad."
            body="A kalkulátorral pár kattintás, de a legbiztosabb, ha kipróbálod: a próbaidő alatt minden funkció a tiéd, és nem terhelünk semmit."
          />
          <FaqAccordion items={faq} compact />
        </div>
      </section>

      <CtaGlow
        trial_days={pricing.trial_days}
        button="dark"
        label="Árak"
        title="Kezdd ingyen, döntsd el később."
        lead="Minden funkció a tiéd a próbaidő alatt — csomagot csak akkor választasz, ha már látod, mennyit spórolsz vele."
      />
      <Footer trial_days={pricing.trial_days} />
    </main>
  )
}
