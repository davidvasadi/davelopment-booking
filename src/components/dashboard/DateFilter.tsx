'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

const HU_MONTHS = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

function formatHu(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS[m - 1]} ${d}.`
}

export default function DateFilter({ currentDate }: { currentDate: string }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (offset: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + offset)
    router.push(`/bookly/dashboard/bookings?date=${d.toISOString().split('T')[0]}`)
  }

  const isToday = currentDate === new Date().toISOString().split('T')[0]

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go(-1)}
        className="h-9 w-9 rounded-full border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] flex items-center justify-center text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.2] transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={() => inputRef.current?.showPicker?.()}
        className="relative h-9 px-4 rounded-full border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm font-semibold text-zinc-700 dark:text-white/80 hover:border-zinc-400 dark:hover:border-white/[0.2] transition-colors flex items-center gap-2"
      >
        <CalendarDays className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30" />
        {formatHu(currentDate)}
        <input
          ref={inputRef}
          type="date"
          value={currentDate}
          onChange={e => e.target.value && router.push(`/bookly/dashboard/bookings?date=${e.target.value}`)}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
          tabIndex={-1}
        />
      </button>

      <button
        onClick={() => go(1)}
        className="h-9 w-9 rounded-full border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] flex items-center justify-center text-zinc-400 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 dark:hover:border-white/[0.2] transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      {!isToday && (
        <button
          onClick={() => router.push(`/bookly/dashboard/bookings?date=${new Date().toISOString().split('T')[0]}`)}
          className="h-9 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:bg-zinc-700 dark:hover:bg-white/90 transition-colors"
        >
          Ma
        </button>
      )}
    </div>
  )
}
