'use client'

import { useState, useRef, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Tablet-barát szám-beállító a foglaló „Létszám" stepper mintájára:
 *   [ −  |  érték (kattintható)  |  + ]
 * A két szélén kör-gombok (lépés a `step`-pel), középen az érték — rákattintva egy
 * kis számpanel nyílik (gyors-értékek + kézi beírás), hogy ne kelljen a default
 * number-input nyilaival pötyögni. Egységes komponens: a szalon és az étterem
 * beállítások is ezt használják (egy helyen karbantartva).
 *
 * Kontrollált: `value` + `onChange(next)`. A `clamp` a min/max közé szorít.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  presets,
  suffix,
  className,
}: {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  /** Gyors-választható értékek a számpanelen (pl. [15, 30, 60, 90]). */
  presets?: number[]
  /** Mértékegység-felirat az érték mellett (pl. "perc", "óra"). */
  suffix?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => setDraft(String(value)), [value])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const set = (n: number) => onChange(clamp(n))

  const commitDraft = () => {
    const n = parseInt(draft, 10)
    if (!Number.isNaN(n)) set(n)
    else setDraft(String(value))
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-zinc-50 dark:bg-white/[0.04] p-1.5">
        <button
          type="button"
          onClick={() => set(value - step)}
          disabled={value <= min}
          aria-label="Csökkentés"
          className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-zinc-700 dark:text-white/70 hover:bg-white dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Érték beállítása"
          className="flex-1 h-10 rounded-lg flex items-center justify-center gap-1.5 hover:bg-white dark:hover:bg-white/[0.08] transition-colors"
        >
          <span className="text-lg font-black tabular-nums text-zinc-900 dark:text-white">{value}</span>
          {suffix && <span className="text-xs font-medium text-zinc-400 dark:text-white/30">{suffix}</span>}
        </button>

        <button
          type="button"
          onClick={() => set(value + step)}
          disabled={value >= max}
          aria-label="Növelés"
          className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-zinc-700 dark:text-white/70 hover:bg-white dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Számpanel: kézi beírás + gyors-értékek. */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-zinc-950 shadow-lg p-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { commitDraft(); setOpen(false) } }}
              autoFocus
              className="w-full h-10 rounded-lg bg-zinc-50 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.1] px-3 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={() => { commitDraft(); setOpen(false) }}
              className="h-10 px-4 shrink-0 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-bold hover:opacity-90 transition-opacity"
            >
              OK
            </button>
          </div>
          {presets && presets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { set(p); setOpen(false) }}
                  className={cn(
                    'h-8 px-3 rounded-lg text-sm font-semibold tabular-nums transition-colors',
                    value === p
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                      : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/70 hover:bg-zinc-200 dark:hover:bg-white/[0.1]',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
