import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { NotFoundNumber } from '@/components/NotFoundNumber'

export const metadata: Metadata = {
  title: 'Az oldal nem található',
}

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#F7F7F7] px-6 text-center font-geist text-brand-ink">
      <Link href="/" aria-label="Főoldal" className="mb-10">
        <BrandLogo variant="light" className="h-8" />
      </Link>
      <NotFoundNumber />
      <h1 className="mt-4 font-semibold text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] tracking-[-0.05em] text-brand-ink mb-3">
        Ez az oldal nem található.
      </h1>
      <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-md mb-8">
        Lehet, hogy elavult a link, vagy elgépelted a címet — a keresett oldal nem létezik.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-full bg-[#3B3B3B] px-6 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" /> Vissza a főoldalra
      </Link>
    </main>
  )
}
