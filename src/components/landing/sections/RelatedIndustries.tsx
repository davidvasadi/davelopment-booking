import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { INDUSTRY_LANDINGS, INDUSTRY_SHORT_LABEL } from '@/lib/industryLandings'

/**
 * Belső linkelés a 13 iparág-landing között — a `relatedSlugs` (lásd industryLandings.ts) adja a
 * 2-3 rokon iparágat. Szándékosan szerver-komponens, framer-motion nélkül (a landingek amúgy is
 * client-JS-sűrűek, ez a blokk nem indokol animációt) — csak sima, gyors linkek.
 */
export function RelatedIndustries({ slugs }: { slugs: string[] }) {
  const items = slugs
    .map((slug) => ({ slug, label: INDUSTRY_SHORT_LABEL[slug], landing: INDUSTRY_LANDINGS[slug] }))
    .filter((i): i is { slug: string; label: string; landing: NonNullable<typeof i.landing> } => !!i.label && !!i.landing)
  if (items.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-5 py-10">
      <div className="rounded-[24px] bg-white px-6 py-7 lg:px-9 lg:py-8">
        <p className="mb-4 font-onest text-[13px] font-medium uppercase tracking-[0.08em] text-brand-ink/45">
          Kapcsolódó iparágak
        </p>
        <div className="flex flex-wrap gap-2.5">
          {items.map(({ slug, label }) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className="group inline-flex items-center gap-1.5 rounded-full border border-black/10 px-4 py-2.5 text-[14px] font-medium text-brand-ink transition-colors hover:border-black/25 hover:bg-black/[0.03]"
            >
              {label}
              <ArrowRight className="h-3.5 w-3.5 text-brand-ink/35 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
