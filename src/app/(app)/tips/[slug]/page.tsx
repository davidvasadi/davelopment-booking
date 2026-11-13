import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, Lightbulb } from 'lucide-react'
import { FeatureHeroCentered } from '@/components/landing/FeatureHeroCentered'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { ConceptLightFooter } from '@/components/blocks/landing-concepts'
import { TipsTeaser } from '@/components/landing/sections/TipsTeaser'
import { TipFigure } from '@/components/landing/TipFigure'
import { getPricing } from '@/lib/pricing'
import { getTip, TIPS, articleJsonLd, howToJsonLd } from '@/lib/tips-content'
import { INDUSTRY_SHORT_LABEL, currentIndustrySlug } from '@/lib/industryLandings'
import { SITE_URL } from '@/lib/publicSeo'

export function generateStaticParams() {
  return TIPS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tip = getTip(slug)
  if (!tip) return {}
  const url = `${SITE_URL}/tippek-es-cikkek/${tip.slug}`
  return {
    // a márkanevet a layout sablonja (`%s — davelopment booking`) teszi hozzá — itt még egyszer kétszer szerepelt
    title: tip.title,
    description: tip.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: tip.title,
      description: tip.excerpt,
      type: 'article',
      url,
      siteName: 'davelopment booking',
      images: [{ url: tip.image, width: 1220, height: 992, alt: tip.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: tip.title,
      description: tip.excerpt,
      images: [tip.image],
    },
  }
}

/**
 * Cikk- és kézikönyv-oldal az új (2. koncepció) kinézetben: a közös aloldal-hero (mint az árak / tippek), fehér oldal,
 * #F7F7F7 mezők. A kézikönyv-oldalak (`kind: 'tipp'`) szakaszai számozott lépéseket, képet (valódi képernyő
 * telefonkeretben vagy kártya-kompozíció) és „Tipp” dobozt is kaphatnak; a lépésekből HowTo strukturált adat lesz.
 */
export default async function TipArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tip = getTip(slug)
  if (!tip) notFound()

  const pricing = await getPricing()
  const manual = tip.kind === 'tipp'
  const howTo = howToJsonLd(tip)

  return (
    <main className="min-h-screen bg-white font-onest text-ui-text">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(tip)) }} />
      {howTo && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />}

      <FeatureHeroCentered
        label={manual ? `Kézikönyv · ${tip.category}` : tip.category}
        h1={tip.title}
        lead={tip.excerpt}
        trialDays={pricing.trial_days}
        secondary={{ href: '/tippek-es-cikkek', label: manual ? 'Összes útmutató' : 'Összes cikk' }}
        breadcrumb={
          <nav aria-label="Morzsamenü" className="flex items-center gap-1.5 text-ui-body">
            <Link href="/">Főoldal</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <Link href="/tippek-es-cikkek">Tippek és cikkek</Link>
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            <span>{tip.category}</span>
          </nav>
        }
      />
      <div className="relative z-10 flow-root bg-white">
        <article className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-16 lg:py-20">
          <div className="flex flex-col gap-5">
            <span className="text-ui-meta text-ui-muted">{tip.category} · {tip.date}</span>
            <p className="text-[clamp(1.1rem,1.6vw,21px)] leading-[1.6] text-ui-text">{tip.intro}</p> {/* ui-allow: bevezető */}
          </div>

          {/* cikknél a borító; a kézikönyvnél a tartalomjegyzék (a szakaszokra ugrik) */}
          {manual ? (
            <nav aria-label="Ebben az útmutatóban" className="rounded-ui-card bg-[#F7F7F7] p-5">
              <p className="text-ui-meta font-medium text-ui-muted">Ebben az útmutatóban</p>
              <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {tip.sections.map((s, i) => (
                  <li key={s.title}><a href={`#lepes-${i + 1}`} className="text-ui-body text-ui-text/80 underline-offset-4 hover:text-ui-text hover:underline">{i + 1}. {s.title}</a></li>
                ))}
              </ol>
            </nav>
          ) : (
            // a lista-kártyák mintája: szürke keret, benne fehér mező — a borító háttere is fehér, így nem látszik a széle
            // (korábban a szürke doboz közepén ült, két oldalt szürke sávval)
            <div className="rounded-ui-container bg-[#F7F7F7] p-3">
              <div className="overflow-hidden rounded-ui-card bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tip.image} alt={tip.title} className="mx-auto block max-h-[440px] w-auto" />
              </div>
            </div>
          )}

          {tip.sections.map((s, i) => (
            <section key={s.title} id={`lepes-${i + 1}`} className="flex scroll-mt-24 flex-col gap-5">
              <h2 className="text-[clamp(1.4rem,2.2vw,28px)] font-medium leading-[1.2] tracking-[-0.025em]">{i + 1}. {s.title}</h2> {/* ui-allow: szakaszcím */}
              <p className="text-ui-row leading-[1.7] text-ui-text/80">{s.body}</p>
              {s.steps && (
                <ol className="flex flex-col gap-3">
                  {s.steps.map((st, j) => (
                    <li key={j} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ui-yellow text-ui-meta font-medium text-ui-dark">{j + 1}</span>
                      <span className="pt-0.5 text-ui-row leading-[1.6] text-ui-text">{st}</span>
                    </li>
                  ))}
                </ol>
              )}
              {s.figure && <TipFigure figure={s.figure} />}
              {s.note && (
                <div className="flex gap-3 rounded-ui-card bg-[#FFF9E7] p-4"> {/* ui-allow: krém tipp-doboz */}
                  <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ui-text/70" strokeWidth={1.8} />
                  <p className="text-ui-body leading-[1.6] text-ui-text/80"><span className="font-medium text-ui-text">Tipp: </span>{s.note}</p>
                </div>
              )}
            </section>
          ))}

          <div className="rounded-ui-card bg-[#F7F7F7] p-6">
            <p className="text-ui-row leading-[1.6] text-ui-text/80">{tip.closing}</p>
          </div>

          {tip.relatedIndustrySlugs && tip.relatedIndustrySlugs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-ui-meta text-ui-muted">Kapcsolódó iparágak:</span>
              {tip.relatedIndustrySlugs.map(currentIndustrySlug).map((s) => (
                <Link key={s} href={`/${s}`} className="inline-flex items-center rounded-full bg-[#F7F7F7] px-3.5 py-1.5 text-ui-meta font-medium text-ui-text/80 transition-colors hover:bg-ui-dark hover:text-white">
                  {INDUSTRY_SHORT_LABEL[s]}
                </Link>
              ))}
            </div>
          )}
        </article>

        <TipsTeaser relatedExclude={tip.slug} look="k2" />
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
