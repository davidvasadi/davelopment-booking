import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, Calculator, LayoutGrid, Lightbulb, Rocket } from 'lucide-react'
import { SiteNav } from '@/components/landing/sections/Hero'
import { ContactSection } from '@/components/landing/sections/ContactSection'
import { FaqAccordion, FaqCta } from '@/components/landing/sections/Faq'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { Footer } from '@/components/landing/sections/Footer'
import { Reveal, RevealText } from '@/components/landing/Motion'
import { getPricing } from '@/lib/pricing'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { SITE_URL } from '@/lib/publicSeo'
import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_TEL, SUPPORT_HOURS, SUPPORT_HOURS_TEXT, SUPPORT_RESPONSE_TEXT } from '@/lib/brand'
import { featurePath } from '@/lib/landingFeatures'

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

const SECTION = 'mx-auto max-w-7xl px-4 lg:px-5 py-10 lg:py-14'
const PILL = 'inline-flex self-start items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]'
const H2 = 'font-semibold text-[clamp(2rem,4.2vw,52px)] leading-[0.98] tracking-[-0.05em] text-brand-ink'

export default async function ContactPage() {
  const [pricing, googleRating] = await Promise.all([getPricing(), getCachedGoogleRating()])

  const quick = [
    { icon: Calculator, title: 'Árak és kalkulátor', body: 'Csomagok, összehasonlítás és díjkalkulátor.', href: '/arak' },
    { icon: LayoutGrid, title: 'Funkciók', body: 'Foglalás, naptár, vendégek, pénz, marketing, csapat.', href: featurePath('/funkciok') },
    { icon: Lightbulb, title: 'Tippek', body: 'Gyakorlati cikkek a foglalásról és a vendégmegtartásról.', href: '/tips' },
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
    <main className="min-h-screen bg-[#F7F7F7] font-geist text-brand-ink" style={{ '--page-bg': '#F7F7F7' } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />

      <nav aria-label="Morzsamenü" className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 pt-6 text-[14px] text-brand-ink/45 lg:px-5">
        <Link href="/" className="hover:text-brand-ink">Főoldal</Link>
        <span aria-hidden>›</span>
        <span className="text-brand-ink/70">Kapcsolat</span>
      </nav>

      <ContactSection googleRating={googleRating} asPage />

      {/* Mielőtt írsz — gyorslinkek */}
      <section className={SECTION}>
        <div className="mb-7 flex flex-col gap-4">
          <Reveal><span className={PILL}>Mielőtt írsz</span></Reveal>
          <RevealText text="Lehet, hogy itt a válasz." delay={0.1} className={H2} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quick.map(({ icon: Icon, title, body, href }, i) => (
            <Reveal key={href} delay={i * 0.05}>
              <Link href={href} className="group flex h-full flex-col rounded-[18px] bg-white p-5 transition-shadow hover:shadow-[0_14px_36px_-18px_rgba(30,28,20,.35)]">
                <span className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F4F4F4] text-brand-ink transition-colors group-hover:bg-brand-ink group-hover:text-white">
                    <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <ArrowUpRight aria-hidden className="h-4 w-4 text-brand-ink/30 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink" />
                </span>
                <span className="mt-4 text-[17px] font-semibold tracking-[-0.03em] text-brand-ink">{title}</span>
                <span className="mt-1 text-[14px] leading-[1.5] text-brand-ink/55">{body}</span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Ügyfélszolgálati GYIK */}
      <section className={`${SECTION} flex flex-col gap-7`}>
        <div className="flex flex-col gap-4">
          <Reveal><span className={PILL}>FAQ</span></Reveal>
          <RevealText text="Gyakori kérdések." delay={0.1} className={H2} />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
          <FaqCta trialDays={pricing.trial_days} title="Próbáld ki, mielőtt döntesz." body="A legtöbb kérdésre a saját fiókod válaszol a legjobban — a próbaidő alatt minden funkciót kipróbálhatsz." />
          <FaqAccordion items={faq} compact />
        </div>
      </section>

      <CtaGlow
        trial_days={pricing.trial_days}
        button="dark"
        label="Kezdd el ma"
        title="Indulj el most, kérdezz közben."
        lead="Regisztrálj ingyen, állítsd be az oldalad — ha bárhol elakadsz, egy üzenetnyire vagyunk."
      />
      <Footer trial_days={pricing.trial_days} googleRating={googleRating} />
    </main>
  )
}
