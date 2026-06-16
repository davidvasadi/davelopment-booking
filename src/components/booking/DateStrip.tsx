'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, type Variants } from 'framer-motion'
import { format, addDays, isSameDay, isToday } from 'date-fns'
import { hu } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EASE, DUR } from '@/lib/motion'

const HU_DAYS = ['V', 'H', 'K', 'Sz', 'Cs', 'P', 'Szo']

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
}: {
  selected: string
  onChange: (d: string) => void
  dayCount?: number
}) {
  const days = Array.from({ length: dayCount }, (_, i) => addDays(new Date(), i))
  const selectedDate = new Date(selected + 'T00:00:00')
  const [month, setMonth] = useState(format(selectedDate, 'MMMM yyyy', { locale: hu }))
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const idx = days.findIndex((d) => isSameDay(d, selectedDate))
    if (scrollRef.current && idx >= 0) {
      const el = scrollRef.current.children[idx] as HTMLElement
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
    setMonth(format(selectedDate, 'MMMM yyyy', { locale: hu }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected])

  const shiftMonth = (dir: 1 | -1) => {
    const cur = days.findIndex((d) => isSameDay(d, selectedDate))
    const next = days.find((d, i) => i > cur + 20 * dir && d.getMonth() !== selectedDate.getMonth())
    if (next) onChange(format(next, 'yyyy-MM-dd'))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => shiftMonth(-1)} className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-zinc-900 capitalize">{month}</p>
        <button onClick={() => shiftMonth(1)} className="h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
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
                'flex flex-col items-center gap-1 py-3 px-3 rounded-2xl shrink-0 snap-center transition-colors min-w-[52px]',
                isSelected
                  ? 'bg-zinc-950 text-white'
                  : today
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50',
              )}
            >
              <span className="text-[10px] font-semibold uppercase text-zinc-400">{HU_DAYS[d.getDay()]}</span>
              <span className="text-base font-black leading-none">{format(d, 'd')}</span>
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}
