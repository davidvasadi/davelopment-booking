'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, type Variants } from 'framer-motion'
import { format, addDays, isSameDay, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE, DUR } from '@/lib/motion'
import { t, dfLocale, type Locale } from '@/lib/i18n'

// A napok lépcsőzött beúszása. Saját `initial="hidden"/animate="show"` a konténeren →
// megszakítja a wizard step-wrapper (stepSlide, initial="enter") variant-öröklését, ezért
// MINDKÉT foglalóban egységesen lejátszódik, függetlenül attól, melyik lépésen van.
const dayStripContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025, delayChildren: 0.05 } },
}
const dayItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.fast, ease: EASE } },
}

/**
 * Közös dátum-választó csík hónap-fejléccel — a szalon és az étterem foglaló is
 * ezt használja (egységes megjelenés). A `dayCount` adja, hány napra előre lehet
 * foglalni (helyenként az admin-beállításból jön).
 */
export function DateStrip({
  selected,
  onChange,
  dayCount = 60,
  locale = 'hu',
}: {
  selected: string
  onChange: (d: string) => void
  dayCount?: number
  locale?: Locale
}) {
  const days = Array.from({ length: dayCount }, (_, i) => addDays(new Date(), i))
  const selectedDate = new Date(selected + 'T00:00:00')
  const dayNames = t(locale, 'dateStrip.days').split(',') // V-tól (index = getDay())
  const [month, setMonth] = useState(format(selectedDate, 'MMMM yyyy', { locale: dfLocale(locale) }))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const idx = days.findIndex((d) => isSameDay(d, selectedDate))
    if (scrollRef.current && idx >= 0) {
      const el = scrollRef.current.children[idx] as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
    setMonth(format(selectedDate, 'MMMM yyyy', { locale: dfLocale(locale) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, locale])

  const shiftMonth = (dir: 1 | -1) => {
    const cur = days.findIndex((d) => isSameDay(d, selectedDate))
    const next = days.find((d, i) => i > cur + 20 * dir && d.getMonth() !== selectedDate.getMonth())
    if (next) onChange(format(next, 'yyyy-MM-dd'))
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <button onClick={() => shiftMonth(-1)} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper hover:text-ink">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-[14px] font-semibold capitalize text-ink">{month}</p>
        <button onClick={() => shiftMonth(1)} className="flex h-7 w-7 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper hover:text-ink">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <motion.div
        ref={scrollRef}
        variants={dayStripContainer}
        initial="hidden"
        animate="show"
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
      >
        {days.map((d) => {
          const str = format(d, 'yyyy-MM-dd')
          const isSelected = isSameDay(d, selectedDate)
          const today = isToday(d)
          return (
            <motion.button
              key={str}
              variants={dayItem}
              onClick={() => onChange(str)}
              className={cn(
                'flex min-w-[52px] shrink-0 snap-center flex-col items-center gap-1 rounded-[14px] px-3 py-3 transition-colors',
                isSelected
                  ? 'bg-ink-dark text-white'
                  : today
                    ? 'bg-gold/25 text-ink'
                    : 'bg-paper/50 text-ink-soft hover:bg-paper/80',
              )}
            >
              <span className={cn('text-[10px] font-semibold uppercase', isSelected ? 'text-white/50' : 'text-ink-soft2')}>{dayNames[d.getDay()]}</span>
              <span className="text-[16px] font-semibold leading-none">{format(d, 'd')}</span>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
