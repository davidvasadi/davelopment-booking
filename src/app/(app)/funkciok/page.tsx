import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { ConceptLightFooter } from '@/components/blocks/landing-concepts'
import { FeatureGroupsK2 } from '@/components/blocks/landing-funkciok'
import { getPricing } from '@/lib/pricing'
import { SITE_URL } from '@/lib/publicSeo'
import { FEATURE_GROUPS } from '@/lib/landingFeatures'

/**
 * /funkciok — a hat funkció-csoport gyűjtőoldala (a morzsamenü középső lépcsője:
 * Főoldal › Funkciók › Pénz). A funkció-oldalak dizájn-nyelvén: sötét hero, alatta bento-rács
 * (csoportonként kép, mottó, a funkciók linkként), a végén egy sötét „Árak” kártya.
 * Minden a `landingFeatures.ts`-ből jön.
 */
const TITLE = 'Funkciók — online foglalás, naptár, vendégek, előleg és marketing'
const DESCRIPTION = 'A davelopment booking összes funkciója egy helyen: saját weboldal online foglalással, csapat-naptár bérrel, vendégnyilvántartás, előleg, ajándékutalvány, automatikus számla és marketing.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/funkciok` },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/funkciok`, siteName: 'davelopment booking' },
}

export default async function FeaturesIndexPage() {
  const pricing = await getPricing()
  const total = FEATURE_GROUPS.reduce((n, g) => n + g.items.length, 0)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Főoldal', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Funkciók', item: `${SITE_URL}/funkciok` },
        ],
      },
      {
        '@type': 'ItemList',
        itemListElement: FEATURE_GROUPS.filter((g) => g.ready).map((g, i) => ({
          '@type': 'ListItem', position: i + 1, name: g.label, url: `${SITE_URL}/funkciok/${g.slug}`,
        })),
      },
    ],
  }

  return (
    <main className="min-h-screen bg-white font-onest text-ui-text" style={{ '--page-bg': '#ffffff' } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <FeatureHeroCentered
        label="Funkciók"
        h1="Funkciók: minden, ami egy üzlethez kell."
        lead={`${total} funkció hat csoportban: saját foglalóoldal, csapat-naptár, vendégek, előleg és számla, marketing. Szakembereknek és vendéglátóhelyeknek is.`}
        trialDays={pricing.trial_days}
        secondary={{ href: '#csoportok', label: 'Funkciók böngészése' }}
        breadcrumb={
          <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-[14px] text-brand-ink/45">
            <Link href="/" className="hover:text-brand-ink">Főoldal</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="text-brand-ink/70">Funkciók</span>
          </nav>
        }
      />
      {/* a hero után: fehér, felső réteg — egyenes éllel rácsúszik a fél sebességgel lemaradó hero-ra (mint a főoldalon) */}
      <div className="relative z-10 flow-root bg-white">

      <FeatureGroupsK2 trialDays={pricing.trial_days} />

      <CtaGlow
        trial_days={pricing.trial_days}
        button="dark"
        bg="/landing/hero/new-york-studio-online-foglalas-davelopment-booking.webp"
        strong
        label="Funkciók"
        title="Próbáld ki mindet a saját üzleteden."
        lead="A próbaidő alatt minden funkció a tiéd: foglalóoldal, naptár, előleg, számla és marketing."
      />
      <ConceptLightFooter trialDays={pricing.trial_days} />
      </div>
    </main>
  )
}
