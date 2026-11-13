import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Calculator, LayoutGrid, Lightbulb, Rocket } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { ContactSection } from '@/components/blocks/landing-contact'
import { FaqAccordion, FaqCta } from '@/components/blocks/landing-faq'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { ConceptLightFooter, SectionHead } from '@/components/blocks/landing-concepts'
import { Reveal } from '@/components/landing/Motion'
import { IconCircle } from '@/components/ui-kit'
import { getPricing } from '@/lib/pricing'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { SITE_URL, orgGraphNodes } from '@/lib/publicSeo'
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_TEL, SUPPORT_HOURS, SUPPORT_HOURS_TEXT, SUPPORT_RESPONSE_TEXT } from '@/lib/brand'

/**
 * /kapcsolat — kapcsolatfelvétel: a főoldallal közös kapcsolat-blokk (itt H1-gyel), gyorslinkek,
 * ügyfélszolgálati GYIK. Az elérhetőségek a `src/lib/brand.ts`-ből jönnek — a látható szöveg és a
 * strukturált adat (contactPoint) ugyanabból.
 */
const URL = `${SITE_URL}/kapcsolat`
const TITLE = 'Kapcsolat — davelopment booking ügyfélszolgálat'
const DESCRIPTION = `Kérdésed van az online foglalórendszerről, az árakról vagy a beállításról? Írj nekünk, vagy hívj: ${CONTACT_PHONE} (${SUPPORT_HOURS_TEXT.toLowerCase()}). ${SUPPORT_RESPONSE_TEXT}`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { type: 'website', title: TITLE, description: DESCRIPTION, url: URL, siteName: 'davelopment booking' },
}


export default async function ContactPage() {
  const [pricing, googleRating] = await Promise.all([getPricing(), getCachedGoogleRating()])

  const quick = [
    { icon: Calculator, title: 'Árak és kalkulátor', body: 'Csomagok, összehasonlítás és díjkalkulátor.', href: '/arak#kalkulator' },
    { icon: LayoutGrid, title: 'Funkciók', body: 'Foglalás, naptár, vendégek, pénz, marketing, csapat.', href: '/funkciok' },
    { icon: Lightbulb, title: 'Tippek', body: 'Gyakorlati cikkek a foglalásról és a vendégmegtartásról.', href: '/tippek-es-cikkek' },
    { icon: Rocket, title: `${pricing.trial_days} nap ingyen`, body: 'Próbáld ki bankkártya nélkül, minden funkcióval.', href: '/register' },
  ]

  const faq = [
    { q: 'Mikor érlek el titeket?', a: `Telefonon ${SUPPORT_HOURS_TEXT.toLowerCase()} a ${CONTACT_PHONE} számon. Emailben (${CONTACT_EMAIL}) és ezen az űrlapon bármikor írhatsz — ${SUPPORT_RESPONSE_TEXT.charAt(0).toLowerCase()}${SUPPORT_RESPONSE_TEXT.slice(1)}` },
    { q: 'Már ügyfél vagyok — hogyan kérhetek segítséget?', a: 'Írj nekünk ezen az űrlapon vagy emailben, a „Technikai segítség” témát választva, és add meg az üzleted nevét — így rögtön a te fiókodat nézzük.' },
    { q: 'Kérhetek bemutatót a rendszerről?', a: 'Igen. Válaszd a „Bemutató kérése” témát, és írd meg, milyen üzleted van — egyeztetünk egy időpontot, és a te helyzetedre szabva mutatjuk meg a rendszert.' },
    { q: 'Egyedi igényem van — kaphatok ajánlatot?', a: 'Igen. Válaszd az „Egyedi csomag” témát, és írd le, mire van szükséged (egyedi fejlesztés, integráció, saját arculat) — az igényeid alapján árajánlatot küldünk.' },
    { q: 'Hol találom a számláimat?', a: 'A fiókod Pénzügy menüjében minden kiállított számlát megtalálsz és letölthetsz. Ha valami nem stimmel, válaszd a „Számlázás” témát.' },
  ]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      ...orgGraphNodes(googleRating),
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Főoldal', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Kapcsolat', item: URL },
        ],
      },
      {
        '@type': 'ContactPage',
        '@id': `${URL}#webpage`,
        url: URL,
        name: TITLE,
        description: DESCRIPTION,
        inLanguage: 'hu-HU',
        about: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'davelopment booking',
        url: SITE_URL,
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE_TEL,
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          telephone: CONTACT_PHONE_TEL,
          email: CONTACT_EMAIL,
          availableLanguage: ['hu'],
          areaServed: 'HU',
          hoursAvailable: { '@type': 'OpeningHoursSpecification', dayOfWeek: SUPPORT_HOURS.days, opens: SUPPORT_HOURS.opens, closes: SUPPORT_HOURS.closes },
        },
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
        label="Kapcsolat"
        h1="Kapcsolat: beszéljünk a foglalásaidról."
        lead={`Hívj minket ${SUPPORT_HOURS_TEXT.toLowerCase()} a ${CONTACT_PHONE} számon, vagy írj bármikor. ${SUPPORT_RESPONSE_TEXT}`}
        trialDays={pricing.trial_days}
        secondary={{ href: '#kapcsolat', label: 'Írj nekünk' }}
        breadcrumb={
          <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-ui-body">
            <Link href="/">Főoldal</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Kapcsolat</span>
          </nav>
        }
      />
      {/* a hero után: fehér, felső réteg — egyenes éllel rácsúszik a fél sebességgel lemaradó hero-ra (mint a főoldalon) */}
      <div className="relative z-10 flow-root bg-white">

      <ContactSection googleRating={googleRating} title="Írj nekünk, vagy hívj fel." />

      {/* Mielőtt írsz — gyorslinkek: fehér kártyák #F7F7F7 sávon, mint a főoldal ikonos kártyái */}
      <section className="bg-[#F7F7F7] px-4 py-24">
        <SectionHead pill="Mielőtt írsz" title="Lehet, hogy itt a válasz." className="mb-12" />
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map(({ icon, title, body, href }, i) => (
            <Reveal key={href} delay={i * 0.06} className="h-full">
              <Link href={href} className="group flex h-full flex-col rounded-ui-card bg-white p-6 transition-transform hover:-translate-y-1">
                <span className="flex items-center justify-between">
                  <IconCircle icon={icon} tone="cell" size="md" />
                  <ArrowUpRight aria-hidden className="h-4 w-4 text-ui-muted transition-colors group-hover:text-ui-text" />
                </span>
                <span className="mt-10 text-ui-title font-medium">{title}</span>
                <span className="mt-2 text-ui-meta text-ui-muted">{body}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Ügyfélszolgálati GYIK — ugyanaz, mint a főoldalon */}
      <section className="mx-auto max-w-7xl px-4 py-24 lg:px-5">
        <SectionHead pill="GYIK" title="Gyakori kérdések." className="mb-12" />
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <FaqCta k2 trialDays={pricing.trial_days} title="Próbáld ki, mielőtt döntesz." body="A legtöbb kérdésre a saját fiókod válaszol a legjobban — a próbaidő alatt minden funkciót kipróbálhatsz." />
          <FaqAccordion items={faq} compact k2 />
        </div>
      </section>

      <CtaGlow
        trial_days={pricing.trial_days}
        button="dark"
        label="Kezdd el ma"
        title="Indulj el most, kérdezz közben."
        lead="Regisztrálj ingyen, állítsd be az oldalad — ha bárhol elakadsz, egy üzenetnyire vagyunk."
        bg="/landing/cta/cta-hatter-davelopment-booking.webp"
        plain
        bgPosition="object-[center_75%]"
      />
      <ConceptLightFooter trialDays={pricing.trial_days} />
      </div>
    </main>
  )
}
