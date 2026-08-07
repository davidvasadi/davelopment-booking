import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { TipsIndexGrid } from '@/components/landing/TipsIndexGrid'
import { Footer } from '@/components/landing/sections/Footer'
import { getPricing } from '@/lib/pricing'
import { TIPS } from '@/lib/tips-content'

export const metadata: Metadata = {
  title: 'Tippek — davelopment booking',
  description: 'Hasznos tippek a foglalás-kezeléshez, no-show csökkentéshez, csapatbeosztáshoz és vendégmegtartáshoz.',
}

export default async function TipsIndexPage() {
  const pricing = await getPricing()

  return (
    <main className="min-h-screen bg-[#F7F7F7] text-brand-ink font-geist">
      <header className="border-b border-black/5">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-center justify-between">
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

      <div className="mx-auto max-w-5xl px-6 pt-12 pb-16">
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[15px] tracking-[-0.03em] text-brand-ink mb-4">
          Tippek
        </span>
        <h1 className="font-semibold text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] tracking-[-0.05em] text-brand-ink mb-3">
          Tekints meg néhány hasznos tippet a rendszerből.
        </h1>
        <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-lg mb-10">
          Fedezd fel a hatékonyság növelése érdekében a saját rendszered.
        </p>

        <TipsIndexGrid tips={TIPS} />
      </div>

      <Footer trial_days={pricing.trial_days} />
    </main>
  )
}
