'use client'

import { Loader2, Languages } from 'lucide-react'
import { LOCALE_LABELS, type Locale } from '@/lib/i18n'

/**
 * Nyelvváltó sáv a localizált tartalom-szekciók fölé (email-szöveg, „jó tudni",
 * feltételek). Csak akkor látszik, ha az üzlet egynél több nyelvet kínál. A
 * kiválasztott nyelven szerkeszthető a localizált mező; a magyar a fallback.
 * A mentés a `?locale=` paraméterrel az adott nyelvre megy.
 */
export function LocaleEditBar({
  available,
  active,
  onSelect,
  loading,
}: {
  available: Locale[]
  active: Locale
  onSelect: (loc: Locale) => void
  loading?: boolean
}) {
  if (available.length <= 1) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-white/[0.1] dark:bg-white/[0.03]">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-white/50">
        <Languages className="h-3.5 w-3.5" />
        Szerkesztés nyelve
      </span>
      <div className="inline-flex items-center rounded-full border border-zinc-200 bg-white p-0.5 text-xs font-bold dark:border-white/[0.1] dark:bg-white/[0.06]">
        {available.map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => onSelect(loc)}
            aria-pressed={active === loc}
            className={`rounded-full px-2.5 py-1 uppercase transition-colors ${
              active === loc
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-white/50 dark:hover:text-white'
            }`}
          >
            {LOCALE_LABELS[loc]}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400 dark:text-white/40" />}
      {active !== 'hu' && (
        <span className="ml-auto text-[11px] text-zinc-400 dark:text-white/30">
          Üresen hagyva a magyar szöveg jelenik meg.
        </span>
      )}
    </div>
  )
}
