import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { TipArticleHeader } from '@/components/landing/TipArticleHeader'
import { Footer } from '@/components/landing/sections/Footer'
import { TipsTeaser } from '@/components/landing/sections/TipsTeaser'
import { getPricing } from '@/lib/pricing'
import { getTip, TIPS, articleJsonLd } from '@/lib/tips-content'

export function generateStaticParams() {
  return TIPS.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tip = getTip(slug)
  if (!tip) return {}
  return {
    title: `${tip.title} — davelopment booking`,
    description: tip.excerpt,
    openGraph: {
      title: tip.title,
      description: tip.excerpt,
      type: 'article',
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

export default async function TipArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tip = getTip(slug)
  if (!tip) notFound()

  const pricing = await getPricing()

  return (
    <main className="min-h-screen bg-[#F7F7F7] text-brand-ink font-geist">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(tip)) }}
      />

      {/* Fejléc */}
      <header className="border-b border-black/5">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link href="/" aria-label="Főoldal">
            <BrandLogo variant="light" className="h-8" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink/50 hover:text-brand-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Vissza a főoldalra
          </Link>
        </div>
      </header>

      {/* Cikk */}
      <article className="mx-auto max-w-3xl px-6 pt-12 pb-4 flex flex-col gap-4">
        <TipArticleHeader key={tip.slug} tip={tip} />

        {/* Törzs */}
        <div className="rounded-[20px] bg-white px-6 py-8 lg:px-10 lg:py-10 flex flex-col gap-8">
          <p className="text-[17px] leading-[1.6] text-brand-ink/75">{tip.intro}</p>

          {tip.sections.map((s, i) => (
            <div key={s.title} className="flex flex-col gap-1.5">
              <h2 className="font-semibold text-[20px] tracking-[-0.02em] text-brand-ink">
                {i + 1}. {s.title}
              </h2>
              <p className="text-[16px] leading-[1.6] text-brand-ink/65">{s.body}</p>
            </div>
          ))}

          <div className="rounded-[16px] p-5" style={{ background: '#f7f7f7' }}>
            <p className="text-[15px] leading-[1.6] text-brand-ink/70">{tip.closing}</p>
          </div>
        </div>
      </article>

      <TipsTeaser relatedExclude={tip.slug} />
      <Footer trial_days={pricing.trial_days} />
    </main>
  )
}
