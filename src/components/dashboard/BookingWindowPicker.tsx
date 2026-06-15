'use client'

import { useState } from 'react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isBefore, isSameDay, addDays, startOfDay, differenceInCalendarDays,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const DAY_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']

/**
 * "Foglalható napok előre" beállítás vizuálisan — a munkavállaló-elérhetőség
 * naptár-rács mintájára (StaffCalendarSheet). A tulaj rábök az UTOLSÓ napra,
 * ameddig a vendégek foglalhatnak; ebből számoljuk a napok számát (`value`).
 *
 * value  = hány napra előre (ma → ma+value). 0 = csak ma.
 * onChange(days) = az új napszám a kijelölt határnapból.
 */
export function BookingWindowPicker({
  value,
  onChange,
  maxDays = 365,
}: {
  value: number
  onChange: (days: number) => void
  maxDays?: number
}) {
  const today = startOfDay(new Date())
  const limit = addDays(today, value) // a jelenleg kijelölt határnap
  const maxBookable = addDays(today, maxDays)

  const [month, setMonth] = useState(startOfMonth(limit))

  const monthStart = startOfMonth(month)
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(month) })
  const startPad = (monthStart.getDay() + 6) % 7 // hétfő-kezdés

  const minMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const maxMonth = new Date(maxBookable.getFullYear(), maxBookable.getMonth(), 1)

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.08] p-4 max-w-xs">
      {/* Hónap-navigáció */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          disabled={month <= minMonth}
          className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-black text-sm text-zinc-900 dark:text-white capitalize">{format(month, 'MMMM yyyy', { locale: hu })}</p>
        <button
          type="button"
          onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          disabled={month >= maxMonth}
          className="h-8 w-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/[0.08] disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Nap-fejléc */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((l) => (
          <div key={l} className="text-center text-xs font-semibold text-zinc-400 dark:text-white/40 py-1">{l}</div>
        ))}
      </div>

      {/* Rács */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
        {days.map((d) => {
          const disabled = isBefore(d, today) || isBefore(maxBookable, d)
          const isSelected = isSameDay(d, limit)
          const inRange = !disabled && !isBefore(limit, d) // ma … határnap között
          return (
            <button
              key={format(d, 'yyyy-MM-dd')}
              type="button"
              onClick={() => onChange(differenceInCalendarDays(d, today))}
              disabled={disabled}
              className={cn(
                'relative aspect-square flex items-center justify-center rounded-xl text-sm font-semibold transition-all',
                disabled && 'opacity-25 cursor-default',
                isSelected
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-black'
                  : inRange
                    ? 'bg-zinc-100 dark:bg-white/[0.08] text-zinc-900 dark:text-white'
                    : !disabled && 'hover:bg-zinc-100 dark:hover:bg-white/[0.08] text-zinc-900 dark:text-white',
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-zinc-500 dark:text-white/40">
        Foglalható <span className="font-bold text-zinc-900 dark:text-white">{value}</span> napra előre
        {' '}(<span className="capitalize">{format(limit, 'MMM d.', { locale: hu })}</span>-ig)
      </p>
    </div>
  )
}
