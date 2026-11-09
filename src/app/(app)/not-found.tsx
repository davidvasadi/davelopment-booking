import type { Metadata } from 'next'
import { NotFoundHero } from '@/components/landing/NotFoundHero'
import { CtaGlow } from '@/components/landing/sections/CtaGlow'
import { Footer } from '@/components/landing/sections/Footer'
import { getPricing } from '@/lib/pricing'

// A Next a not-found választ 404-es státusszal és saját noindex-szel küldi — a keresők nem indexelik.
export const metadata: Metadata = {
  title: 'Az oldal nem található',
}

export default async function NotFound() {
  const pricing = await getPricing()
  return (
    <main className="min-h-screen bg-[#F7F7F7] font-geist text-brand-ink" style={{ '--page-bg': '#F7F7F7' } as React.CSSProperties}>
      <NotFoundHero />
      <div className="pt-14 lg:pt-20">
        <CtaGlow
          trial_days={pricing.trial_days}
          button="dark"
          label="Ha már itt vagy"
          title="Nézd meg, mit tud a davelopment booking."
          lead="Foglalóoldal, csapat-naptár, vendégek, előleg és marketing egy rendszerben — szakembereknek és éttermeknek."
        />
      </div>
      <Footer trial_days={pricing.trial_days} />
    </main>
  )
}
