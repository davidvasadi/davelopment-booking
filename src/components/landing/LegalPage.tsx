import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'

/**
 * Közös elrendezés a jogi aloldalakhoz (Felhasználási feltételek, Adatkezelés, Sütik).
 * Egyszerű, olvasható dokumentum-elrendezés a landing tipográfiájával.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen bg-white text-brand-ink font-geist">
      {/* Fejléc */}
      <header className="border-b border-zinc-100">
        <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
          <Link href="/" aria-label="Főoldal">
            <BrandLogo variant="light" className="h-8" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-brand-ink transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Vissza a főoldalra
          </Link>
        </div>
      </header>

      {/* Tartalom */}
      <article className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400 mb-3">Jogi</p>
        <h1 className="font-semibold tracking-[-0.04em] leading-[1.05] text-[clamp(2rem,5vw,3.5rem)] mb-4">{title}</h1>
        <p className="text-sm text-zinc-400 mb-12">Utolsó frissítés: {updated}</p>

        <div className="legal-prose space-y-6 text-[16px] leading-[1.7] text-zinc-600">
          {children}
        </div>
      </article>

      {/* Lábléc */}
      <footer className="border-t border-zinc-100">
        <div className="mx-auto max-w-3xl px-6 py-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
          <span>©2026 davelopment booking</span>
          <Link href="/terms" className="hover:text-brand-ink transition-colors">Felhasználási feltételek</Link>
          <Link href="/privacy" className="hover:text-brand-ink transition-colors">Adatkezelési tájékoztató</Link>
          <Link href="/cookies" className="hover:text-brand-ink transition-colors">Sütikezelés</Link>
        </div>
      </footer>
    </main>
  )
}

/** Szekció-cím a jogi szövegben. */
export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-brand-ink pt-4">{heading}</h2>
      {children}
    </section>
  )
}
