'use client'

import { Loader2 } from 'lucide-react'
import { Segmented } from '@/components/ui-kit'
import { LOCALE_LABELS, type Locale } from '@/lib/i18n'

/**
 * Nyelvváltó a fordítható tartalom fölé (szolgáltatás, kategória, e-mail-szöveg, „jó tudni”, feltételek) — a design
 * 16.12 („Foglalási feltételek”) kicsi, cella-színű váltója (HU / EN / DE). Csak akkor látszik, ha az üzlet egynél több
 * nyelvet kínál. A kiválasztott nyelven szerkeszthető a fordítható mező (üresen hagyva a magyar jelenik meg); a mentés a
 * `?locale=` paraméterrel az adott nyelvre megy.
 */
export function LocaleEditBar({ available, active, onSelect, loading, tone = 'cell', className = '' }: {
  available: Locale[]
  /** a választó háttere: szürke (fehér ablakban, alap) vagy fehér (üveges kártyán) */
  tone?: 'cell' | 'glass'
  active: Locale
  onSelect: (loc: Locale) => void
  loading?: boolean
  className?: string
}) {
  if (available.length <= 1) return null
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Segmented tone={tone} size="sm" className={tone === 'glass' ? 'max-lg:bg-ui-cell' : undefined} options={available.map((l) => LOCALE_LABELS[l])} active={available.indexOf(active)} onSelect={(i) => onSelect(available[i])} />
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-ui-muted" />}
    </div>
  )
}
