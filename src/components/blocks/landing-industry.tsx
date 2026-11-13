import Link from 'next/link'
import { ArrowUpRight, Check, ChevronRight, X } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { FeatureHandK2, FeatureIntroK2, FeatureTabsK2 } from '@/components/blocks/landing-funkciok'
import { ConceptLightFooter, SectionHead } from '@/components/blocks/landing-concepts'
import { FaqAccordion, FaqCta } from '@/components/blocks/landing-faq'
import { Reveal } from '@/components/landing/Motion'
import { TipsTeaser } from '@/components/landing/sections/TipsTeaser'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { BrandLogo } from '@/components/BrandLogo'
import { FEATURE_GROUPS, type LandingFeature } from '@/lib/landingFeatures'
import { INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'
import { INDUSTRY_PAGES, type IndustryPage } from '@/lib/industryPages'

/**
 * Iparági („Kinek”) oldal — a funkció-oldalak (2. koncepció, K2) nyelvén, ugyanazokból a darabokból: hero (morzsamenü
 * Főoldal › Kinek › szakma), kezes telefon, „Miért fontos” (a kiválasztott funkciók lenyitható listája), a funkciók
 * fülekben a valódi mobil képernyőképekkel, „Egy nap nálad” (a szakma fotója + idősávos jelenetek), eddig / most, GYIK,
 * rokon szakmák (fotós kártyák), tippek, záró CTA a szakma fotójával, világos lábléc. Tartalom: `lib/industryPages.ts`.
 */
const SECTION = 'mx-auto max-w-7xl px-4 lg:px-5 py-14 lg:py-20'

const ALL_FEATURES: LandingFeature[] = FEATURE_GROUPS.flatMap((g) => g.items)
const photoOf = (slug: string) => INDUSTRY_PAGES[slug]?.photo ?? `/landing/marquee/${slug}-davelopment-booking.webp`

export function IndustryPageK2({ page, trialDays }: { page: IndustryPage; trialDays: number }) {
  const features = page.features.map((s) => ALL_FEATURES.find((f) => f.slug === s)).filter((f): f is LandingFeature => !!f)
  return (
    <main className="min-h-screen bg-white font-onest text-ui-text" style={{ '--page-bg': '#ffffff' } as React.CSSProperties}>
      <FeatureHeroCentered label={page.label} h1={page.h1} lead={page.lead} trialDays={trialDays} breadcrumb={
        <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-[14px] text-brand-ink/45">
          <Link href="/" className="hover:text-brand-ink">Főoldal</Link>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          <span>Kinek</span>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="text-brand-ink/70">{page.label}</span>
        </nav>
      } />
      <div className="relative z-10 flow-root bg-white">
        <FeatureHandK2 groupId={page.phoneGroup} title={page.hand.title} lead={page.hand.lead} alt={`${page.label} — a davelopment booking a telefonon`} />

        <FeatureIntroK2 groupId={page.phoneGroup} title={page.intro.title} paragraphs={page.intro.paragraphs} tagline={page.hand.lead}
          items={features.map((f) => ({ slug: f.slug, title: f.title, desc: f.desc }))} />

        <FeatureTabsK2 label={page.featuresHead.title.replace(/\.$/, '')} tagline={page.featuresHead.lead}
          items={features.map((f) => ({ slug: f.slug, title: f.title, desc: f.desc, pain: f.pain, points: f.points, body: f.body, example: f.example, cta: f.cta }))} />

        {/* ── Egy nap nálad — balra a szakma fotója (gépen ragad), jobbra az idősávos jelenetek ── */}
        <section className={SECTION}>
          <SectionHead pill={`Egy nap — ${page.label.toLowerCase()}`} title={page.day.title} lead={page.day.lead} className="mb-12" />
          <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-4">
            <Reveal className="relative overflow-hidden rounded-ui-container bg-ui-cell lg:sticky lg:top-24">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.photo} alt={page.photoAlt} width={1200} height={1500} loading="lazy" decoding="async" className="aspect-[4/5] h-full w-full object-cover" />
            </Reveal>
            <ol className="space-y-3">
              {page.day.scenes.map((s, i) => (
                <li key={s.time}>
                  <Reveal delay={i * 0.06} className="flex gap-5 rounded-ui-container bg-[#F7F7F7] px-6 py-6 lg:px-8 lg:py-7">
                    <span className="h-fit shrink-0 rounded-full bg-ui-dark px-3 py-1.5 text-ui-meta font-medium tabular-nums text-white">{s.time}</span>
                    <div>
                      <h3 className="text-ui-title font-medium">{s.title}</h3>
                      <p className="mt-1.5 text-ui-row leading-[1.55] text-ui-muted">{s.body}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Eddig és most — ugyanaz, mint a funkció-oldalakon ── */}
        <section className={SECTION}>
          <SectionHead pill="Eddig és most" title="Kevesebb adminisztráció." className="mb-12" />
          <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
            <Reveal className="relative isolate overflow-hidden rounded-ui-container bg-ui-dark px-7 py-9 lg:px-12 lg:py-14">
              <h3 className="text-[clamp(1.6rem,2.6vw,36px)] font-normal leading-none tracking-[-0.04em] text-white/55">Eddig</h3> {/* ui-allow: a funkció-oldal eddig/most címe */}
              <ul className="mt-8 lg:mt-10">
                {page.compare.map(([before], i) => (
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
                {page.compare.map(([, after], i) => (
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

        {/* ── GYIK ── */}
        <section className={`${SECTION} flex flex-col gap-10`}>
          <SectionHead pill="FAQ" title="Gyakran kérdezik." className="mb-12" />
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
            <FaqCta k2 trialDays={trialDays} title={page.faqCta?.title} body={page.faqCta?.body} />
            <FaqAccordion k2 items={page.faq} compact />
          </div>
        </section>

        {/* ── Rokon szakmák — fotós kártyák (belső linkek: a szakma-oldalak egy témacsoportot alkotnak) ── */}
        {page.related.length > 0 && (
          <section className={SECTION}>
            <SectionHead pill="Kinek" title="Rokon szakmák." className="mb-12" />
            <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
              {page.related.map((slug, i) => (
                <Reveal key={slug} delay={i * 0.05}>
                  <Link href={`/${slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-ui-container bg-ui-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoOf(slug)} alt="" width={800} height={1000} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3">
                      <span className="text-ui-title font-medium text-white">{INDUSTRY_SHORT_LABEL[slug] ?? slug}</span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ui-text transition-colors group-hover:bg-ui-yellow">
                        <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {page.tips.length > 0 && <TipsTeaser slugs={page.tips} look="k2" />}

        <CtaGlow trial_days={trialDays} button="dark" bg={page.photo} strong label={page.cta.label} title={page.cta.title} lead={page.cta.lead} />
        <ConceptLightFooter trialDays={trialDays} />
      </div>
    </main>
  )
}
