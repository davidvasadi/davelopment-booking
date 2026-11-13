import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Check, ChevronRight, X } from 'lucide-react'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { BrandLogo } from '@/components/BrandLogo'
import { ConceptLightFooter, SectionHead } from '@/components/blocks/landing-concepts'
import { FeatureHandK2, FeatureIntroK2, FeatureStepsK2, FeatureTabsK2 } from '@/components/blocks/landing-funkciok'
import { FaqAccordion, FaqCta } from '@/components/blocks/landing-faq'
import { Reveal } from '@/components/landing/Motion'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { TipsTeaser } from '@/components/landing/sections/TipsTeaser'
import { getPricing } from '@/lib/pricing'
import { getCachedGoogleRating } from '@/lib/google-rating'
import { AudienceRows } from '@/components/blocks/landing-audience'
import { LaurelBadge } from '@/components/blocks/landing-marquee'
import { featurePageJsonLd, SITE_URL } from '@/lib/publicSeo'
import { FEATURE_GROUPS, featureGroupBySlug, groupHref } from '@/lib/landingFeatures'
import { IconCircle } from '@/components/ui-kit'

/**
 * Funkció-csoport oldal (/funkciok/foglalas, /funkciok/penz …). Egy csoport = egy oldal. Forrás:
 * `src/lib/landingFeatures.ts`. A dizájn a főoldal új (2. koncepció) nyelve, fehér háttéren #F7F7F7 kártyákkal:
 * „Miért fontos” (FeatureIntroK2), a funkciók fülekben (FeatureTabsK2 — #slug horgonyok megmaradnak), Kinek, lépések,
 * eddig/most, GYIK, többi csoport, tippek, CTA, lábléc. A tartalom mind a `landingFeatures.ts`-ből jön.
 */

// a főoldal szekció-építőkockái
const SECTION = 'mx-auto max-w-7xl px-4 lg:px-5 py-14 lg:py-20'

export function generateStaticParams() {
  return FEATURE_GROUPS.filter((g) => g.ready).map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const group = featureGroupBySlug(slug)
  if (!group?.ready) return {}
  const url = `${SITE_URL}/funkciok/${group.slug}`
  const ogImage = `${SITE_URL}/api/og/landing?title=${encodeURIComponent(group.h1)}`
  return {
    title: group.seoTitle,
    description: group.seoDescription,
    alternates: { canonical: url },
    openGraph: { type: 'website', title: group.seoTitle, description: group.seoDescription, url, siteName: 'davelopment booking', images: [{ url: ogImage, width: 1200, height: 630, alt: group.h1 }] },
    twitter: { card: 'summary_large_image', title: group.seoTitle, description: group.seoDescription, images: [ogImage] },
  }
}

export default async function FeatureGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const group = featureGroupBySlug(slug)
  if (!group?.ready) notFound()
  const [pricing, googleRating] = await Promise.all([getPricing(), getCachedGoogleRating()])
  const others = FEATURE_GROUPS.filter((g) => g.id !== group.id)
  const x = group.extra

  return (
    <main className="min-h-screen bg-white font-onest text-ui-text" style={{ '--page-bg': '#ffffff' } as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(featurePageJsonLd(group)) }} />

      {/* Hero: középre zárt sötét doboz (benne a menü), alatta a mögüle kibújó döntött böngészőablak */}
      <FeatureHeroCentered groupId={group.id} h1={group.h1} lead={group.lead} trialDays={pricing.trial_days} breadcrumb={
        <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-[14px] text-brand-ink/45">
          <Link href="/" className="hover:text-brand-ink">Főoldal</Link>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          <Link href="/funkciok" className="hover:text-brand-ink">Funkciók</Link>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="text-brand-ink/70">{group.label}</span>
        </nav>
      } />
      {/* a hero után: fehér, felső réteg — egyenes éllel rácsúszik a fél sebességgel lemaradó hero-ra (mint a főoldalon) */}
      <div className="relative z-10 flow-root bg-white">
      {/* a hero alatt: a főoldal kezes telefonja a csoport saját két lebegő widgetjével */}
      <FeatureHandK2 groupId={group.id} title={`${group.label}, a zsebedben.`} lead={group.tagline} alt={`${group.label} — a davelopment booking a telefonon`} />


      {/* ── Miért fontos — a főoldal „Kevesebb adminisztráció” blokkjának stílusában (lenyitható funkció-lista + telefon) ── */}
      {x && <FeatureIntroK2 groupId={group.id} title={x.intro.title} paragraphs={x.intro.paragraphs} tagline={group.tagline} items={group.items.map((f) => ({ slug: f.slug, title: f.title, desc: f.desc }))} />}

      {/* ── A funkciók — a főoldal „Minden fontos, egy érintésre” fül-blokkjának stílusában (tartalom változatlan) ── */}
      <FeatureTabsK2 label={group.label} tagline={group.tagline} items={group.items.map((f) => ({ slug: f.slug, title: f.title, desc: f.desc, pain: f.pain, points: f.points, body: f.body, example: f.example, cta: f.cta }))} />

      {x && (
        <>
          {/* ── Két szemszög ── */}
          {/* ── Kinek — babérágas fejléc (mint a főoldalon), alatta a két célcsoport egy-egy sorban ── */}
          <section className="py-14 lg:py-20">
            <LaurelBadge as="h2" lines={['Szakembereknek', 'és vendéglátóknak']} className="mb-12 lg:mb-16" />
            <AudienceRows salon={x.audience.salon} restaurant={x.audience.restaurant} rating={googleRating} trialDays={pricing.trial_days} />
          </section>

          {/* ── Így indulsz el — a főoldal 3 lépéses blokkja (StepsK2), a csoport lépéseivel és telefonjaival ── */}
          <FeatureStepsK2 groupId={group.id} steps={x.steps} />

          {/* ── Eddig és most ── */}
          <section className={SECTION}>
            <SectionHead pill="Eddig és most" title="Kevesebb adminisztráció." className="mb-12" />
            <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
              <Reveal className="relative isolate overflow-hidden rounded-ui-container bg-ui-dark px-7 py-9 lg:px-12 lg:py-14">
                <h3 className="text-[clamp(1.6rem,2.6vw,36px)] font-normal leading-none tracking-[-0.04em] text-white/55">Eddig</h3>
                <ul className="mt-8 lg:mt-10">
                  {x.compare.map(([before], i) => (
                    <li key={before}>
                      <Reveal delay={0.15 + i * 0.07} className="flex items-start gap-4 py-4 text-[16px] leading-snug text-white/45 lg:text-[17px]">
                        <X className="mt-0.5 h-5 w-5 shrink-0 text-[#E0624F]" strokeWidth={2.4} /> {before}
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </Reveal>
              <Reveal delay={0.06} className="rounded-ui-container bg-[#F7F7F7] px-7 py-9 lg:px-12 lg:py-14">
                <h3 className="flex h-[36px] items-center">
                  <span className="sr-only">A davelopment bookinggal</span>
                  <BrandLogo variant="light" className="h-[30px] lg:h-[34px]" alt="" />
                </h3>
                <ul className="mt-8 divide-y divide-black/[0.08] lg:mt-10">
                  {x.compare.map(([, after], i) => (
                    <li key={after}>
                      <Reveal delay={0.2 + i * 0.07} className="flex items-start gap-4 py-4 text-[16px] font-medium leading-snug text-brand-ink lg:text-[17px]">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ui-ok-dot text-ui-dark">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {after}
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </section>

          {/* ── GYIK — a főoldal harmonikája ── */}
          <section className={`${SECTION} flex flex-col gap-10`}>
            <SectionHead pill="FAQ" title="Gyakran kérdezik." className="mb-12" />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
              <FaqCta k2 trialDays={pricing.trial_days} title={group.faqCta?.title} body={group.faqCta?.body} />
              <FaqAccordion k2 items={x.faq} compact />
            </div>
          </section>
        </>
      )}

      {/* ── Más funkciók ── */}
      <section className={SECTION}>
        <SectionHead pill="Funkciók" title="Még ezt is tudja." className="mb-12" />
        {/* a főoldali tény-kártyák mintája: fehér kártya, ikon-kör, lent a név és egy sor, rámutatásra kicsit felemelkedik */}
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {others.map((g, i) => (
            <Reveal key={g.id} delay={i * 0.04}>
              <Link href={groupHref(g)} className="group block h-full rounded-ui-card bg-[#F7F7F7] p-6 transition-transform hover:-translate-y-1">
                <IconCircle icon={g.icon} tone="cell" size="md" />
                <h3 className="mt-16 text-ui-title font-medium">{g.label}</h3>
                <p className="mt-2 text-ui-meta text-ui-muted">{g.tagline}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Kapcsolódó tippek — ugyanaz a lapozó, mint a főoldalon */}
      {x && x.related.some((r) => r.href.startsWith('/tippek-es-cikkek/')) && (
        <TipsTeaser slugs={x.related.filter((r) => r.href.startsWith('/tippek-es-cikkek/')).map((r) => r.href.replace('/tippek-es-cikkek/', ''))} look="k2" />
      )}

      <CtaGlow trial_days={pricing.trial_days} button="dark" bg="/landing/hero/new-york-studio-online-foglalas-davelopment-booking.webp" strong label={group.cta?.label} title={group.cta?.title} lead={group.cta?.lead} />
      <ConceptLightFooter trialDays={pricing.trial_days} />
      </div>
    </main>
  )
}
