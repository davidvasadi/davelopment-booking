'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Clock, ListChecks, ArrowRight, X, type LucideIcon } from 'lucide-react'
import type { SetupFlags } from '@/lib/setupFlags'

/**
 * Főoldali onboarding-nudge: „Fejezd be a beállítást (X/Y)". Csak akkor jelenik meg, ha a
 * nyitvatartás vagy a katalógus (asztal/szolgáltatás) még hiányzik — enélkül a vendégek nem
 * tudnak online foglalni. A teljes checklist a Funkciók (/tips) oldalon; ide csak a hiányzó,
 * kattintható lépéseket tesszük. Dismissable (localStorage, üzletenként) — de amint kész a
 * beállítás, magától eltűnik.
 */
export function SetupNudge({
  variant,
  base,
  flags,
}: {
  variant: 'salon' | 'restaurant'
  /** URL-prefix: '/restaurant' vagy '/dashboard'. */
  base: string
  flags: SetupFlags
}) {
  const [dismissed, setDismissed] = useState(false)

  const catalog: { label: string; href: string } =
    variant === 'restaurant'
      ? { label: 'Asztalok', href: `${base}/tables` }
      : { label: 'Szolgáltatások', href: `${base}/services` }

  const steps: { key: string; label: string; icon: LucideIcon; done: boolean; href: string }[] = [
    { key: 'hours', label: 'Nyitvatartás', icon: Clock, done: flags.openingHours, href: `${base}/availability` },
    { key: 'catalog', label: catalog.label, icon: ListChecks, done: flags.catalog, href: catalog.href },
  ]
  const doneCount = steps.filter((s) => s.done).length
  const pending = steps.filter((s) => !s.done)

  // Kész beállítás → nincs mit tenni; ha a user elrejtette, tiszteljük.
  if (pending.length === 0 || dismissed) return null

  return (
    <div className="relative overflow-hidden rounded-[22px] dav-card-glass px-5 py-4 sm:px-6">
      {/* finom arany kiemelés bal szélen */}
      <span className="absolute inset-y-0 left-0 w-1 bg-gold" aria-hidden />
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Elrejtés"
        className="absolute right-3 top-3 rounded-full p-1 text-ink-soft2 transition-colors hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0 pr-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-ink-dark text-gold">
              <ListChecks className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <span className="text-[15px] font-semibold text-ink">Fejezd be a beállítást</span>
            <span className="rounded-full bg-[#F2ECDA] px-2 py-0.5 text-[11px] font-semibold text-ink-soft">{doneCount}/{steps.length}</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
            Ezek nélkül a vendégek még nem tudnak online foglalni.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pending.map((s) => {
            const Icon = s.icon
            return (
              <Link
                key={s.key}
                href={s.href}
                className="inline-flex items-center gap-1.5 rounded-dav-pill border border-line-strong bg-white px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink/25"
              >
                <Icon className="h-4 w-4 text-ink-soft2" strokeWidth={1.8} />
                {s.label}
                <ArrowRight className="h-3.5 w-3.5 text-ink-soft2" strokeWidth={2} />
              </Link>
            )
          })}
          <Link
            href={`${base}/tips`}
            className="inline-flex items-center gap-1.5 rounded-dav-pill bg-ink-dark px-3.5 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Összes lépés
            <ArrowRight className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  )
}
