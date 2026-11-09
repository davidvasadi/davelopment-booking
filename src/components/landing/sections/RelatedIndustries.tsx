import Link from 'next/link'
import { ArrowUpRight, Scissors, UtensilsCrossed } from 'lucide-react'
import { Reveal, RevealText } from '@/components/landing/Motion'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'

/**
 * Belső linkelés a rokon iparág-landingek között — a `relatedSlugs` (lásd industryLandings.ts)
 * adja a 2-3 rokon oldalt. Kártyánként: szegmens-ikon, rövid név, a landing saját alcíme, nyíl.
 * Szerver-komponens; csak a belépő animáció kliens (Reveal).
 */
export function RelatedIndustries({ slugs }: { slugs: string[] }) {
  const items = slugs
    .map((slug) => ({ slug, label: INDUSTRY_SHORT_LABEL[slug], landing: INDUSTRY_LANDINGS[slug] }))
    .filter((i): i is { slug: string; label: string; landing: NonNullable<typeof i.landing> } => !!i.label && !!i.landing)
  if (items.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 lg:px-5 lg:py-20">
      <div className="mb-8 flex flex-col gap-4">
        <Reveal>
          <span className="inline-flex items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">Hasonló üzletek</span>
        </Reveal>
        <RevealText text="Más is így dolgozik." delay={0.1} className="font-semibold text-[clamp(2rem,4.2vw,52px)] leading-[0.98] tracking-[-0.05em] text-brand-ink" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ slug, label, landing }, i) => {
          const Icon = landing.segment === 'restaurant' ? UtensilsCrossed : Scissors
          return (
            <Reveal key={slug} delay={i * 0.06}>
              <Link
                href={`/${slug}`}
                className="group flex h-full flex-col justify-between gap-10 rounded-[22px] bg-white p-6 transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_rgba(30,28,20,.35)] lg:p-7"
              >
                <span className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[#F4F4F4] text-brand-ink transition-colors duration-300 group-hover:bg-brand-ink group-hover:text-white">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-brand-ink/50 transition-all duration-300 group-hover:border-transparent group-hover:bg-[#F1CE45] group-hover:text-[#1D1C19]">
                    <ArrowUpRight aria-hidden className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" strokeWidth={2} />
                  </span>
                </span>
                <span>
                  <span className="block text-[clamp(1.3rem,1.8vw,24px)] font-semibold tracking-[-0.04em] text-brand-ink">{label}</span>
                  <span className="mt-2 line-clamp-2 block text-[14.5px] leading-[1.55] text-brand-ink/55">{landing.heroSubtitle}</span>
                </span>
              </Link>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
