'use client'

import { Check } from 'lucide-react'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n'

/** Emberi nyelvnevek a választóhoz (a LOCALE_LABELS rövid kódok mellé). */
const LOCALE_NAMES: Record<Locale, string> = {
  hu: 'Magyar',
  en: 'English',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  fr: 'Français',
}

/**
 * A tulaj által a foglalón kínált nyelvek választója (üzlet `supported_locales`-e).
 * A magyar fix alap+fallback — mindig bekapcsolt, nem kapcsolható ki. A többi nyelv
 * pipálható; a `value` a magyaron felüli, bekapcsolt nyelvek listája (HU nélkül),
 * ugyanúgy, ahogy a `supported_locales` mezőben tároljuk.
 */
export function SupportedLocalesPicker({
  value,
  onChange,
}: {
  value: Locale[]
  onChange: (next: Locale[]) => void
}) {
  const extras = LOCALES.filter((l) => l !== 'hu')
  const enabled = new Set(value)

  const toggle = (loc: Locale) => {
    const next = new Set(enabled)
    if (next.has(loc)) next.delete(loc)
    else next.add(loc)
    // Mindig a LOCALES sorrendjében, HU nélkül (a HU-t a kód külön kezeli).
    onChange(extras.filter((l) => next.has(l)))
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {/* Magyar — fix, letiltva */}
      <div className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 dark:border-white/[0.1] dark:bg-white/[0.04] opacity-90">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-900 dark:bg-white">
          <Check className="h-3.5 w-3.5 text-white dark:text-zinc-900" strokeWidth={3} />
        </span>
        <span className="text-sm font-semibold text-zinc-800 dark:text-white/80">
          {LOCALE_NAMES.hu} <span className="text-zinc-400 dark:text-white/30">(alap)</span>
        </span>
      </div>

      {extras.map((loc) => {
        const on = enabled.has(loc)
        return (
          <button
            key={loc}
            type="button"
            onClick={() => toggle(loc)}
            aria-pressed={on}
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors ${
              on
                ? 'border-zinc-900 bg-white dark:border-white/40 dark:bg-white/[0.08]'
                : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-white/[0.1] dark:bg-white/[0.02] dark:hover:border-white/20'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                on ? 'border-zinc-900 bg-zinc-900 dark:border-white dark:bg-white' : 'border-zinc-300 dark:border-white/20'
              }`}
            >
              {on && <Check className="h-3.5 w-3.5 text-white dark:text-zinc-900" strokeWidth={3} />}
            </span>
            <span className="text-sm font-semibold text-zinc-800 dark:text-white/80">
              {LOCALE_NAMES[loc]} <span className="text-zinc-400 dark:text-white/30">{LOCALE_LABELS[loc]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
