import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { TipsHub } from '@/components/landing/TipsHub'
import { ConceptLightFooter } from '@/components/blocks/landing-concepts'
import { getPricing } from '@/lib/pricing'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { TIPS, articleJsonLd } from '@/lib/tips-content'
import { SITE_URL, orgGraphNodes } from '@/lib/publicSeo'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'

const URL = `${SITE_URL}/tips`
const TITLE = 'Tippek és cikkek — davelopment booking'
const DESCRIPTION = 'Útmutatók a davelopment booking használatához, és gyakorlati cikkek a foglalásról, a no-show csökkentéséről, a csapatbeosztásról és a vendégmegtartásról.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: URL, siteName: 'davelopment booking' },
}

export default async function TipsIndexPage() {
  const [pricing, googleRating] = await Promise.all([getPricing(), getCachedGoogleRating()])

  // AI-keresőknek és a Google-nek: morzsamenü, a gyűjtőoldal a tételek listájával, és minden írás BlogPostingként
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ...orgGraphNodes(googleRating),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Főoldal', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Tippek és cikkek', item: URL },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${URL}#webpage`,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'hu-HU',
        about: { '@id': `${SITE_URL}/#organization` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: TIPS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/tips/${t.slug}`, name: t.title })),
        },
      },
      {
        '@type': 'Blog',
        '@id': `${URL}#blog`,
        url: URL,
        name: 'Tippek és cikkek',
        inLanguage: 'hu-HU',
        publisher: { '@id': `${SITE_URL}/#organization` },
        blogPost: TIPS.map((t) => { const { '@context': _c, ...post } = articleJsonLd(t); return post }),
      },
    ],
  }

  return (
    // a főoldal (2. koncepció) elemei: fehér oldal, Onest, ui-* színek, ugyanaz az aloldal-hero, mint az áraknál
    <main className="min-h-screen bg-white font-onest text-ui-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FeatureHeroCentered
        label="Tippek és cikkek"
        h1="Tippek és cikkek: így lesz több foglalásod."
        lead="Útmutatók a rendszer használatához, és cikkek a foglalásról, a no-show-ról, a csapatról és a vendégmegtartásról — kisvállalkozásoknak."
        trialDays={pricing.trial_days}
        secondary={{ href: '#cikkek', label: 'Olvasnivaló' }}
        breadcrumb={
          <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-ui-body">
            <Link href="/">Főoldal</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Tippek és cikkek</span>
          </nav>
        }
      />
      {/* a hero után: fehér, felső réteg — egyenes éllel rácsúszik a fél sebességgel lemaradó hero-ra (mint a főoldalon) */}
      <div className="relative z-10 flow-root bg-white">

      {/* tippek és cikkek váltóval — fehér háttéren #F7F7F7 kártyák */}
      <section id="cikkek" className="scroll-mt-[88px] bg-white px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <TipsHub articles={TIPS} />
        </div>
      </section>

      <CtaGlow
        trial_days={pricing.trial_days}
        button="dark"
        label="Kezdd el ma"
        title="Próbáld ki a saját üzleteden."
        lead="Amit itt olvastál, a fiókodban pár kattintással beállítod — ma elindulsz, holnap már foglalnak."
        bg="/landing/cta/cta-hatter-davelopment-booking.webp"
        plain
        bgPosition="object-[center_75%]"
      />
      <ConceptLightFooter trialDays={pricing.trial_days} />
      </div>
    </main>
  )
}
