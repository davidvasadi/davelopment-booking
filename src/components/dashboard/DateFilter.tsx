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
    router.push(`/dashboard/bookings?date=${d.toISOString().split('T')[0]}`)
  }

  const isToday = currentDate === new Date().toISOString().split('T')[0]

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-[var(--dav-glass)] p-[5px]">
        <button
          onClick={() => go(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={() => inputRef.current?.showPicker?.()}
          className="relative flex items-center gap-2 px-2 text-[13px] font-semibold text-ink"
        >
          <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
          {formatHu(currentDate)}
          <input
            ref={inputRef}
            type="date"
            value={currentDate}
            onChange={e => e.target.value && router.push(`/dashboard/bookings?date=${e.target.value}`)}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            tabIndex={-1}
          />
        </button>

        <button
          onClick={() => go(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {!isToday && (
        <button
          onClick={() => router.push(`/dashboard/bookings?date=${new Date().toISOString().split('T')[0]}`)}
          className="h-[42px] rounded-2xl bg-ink-dark px-4 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
        >
          Ma
        </button>
      )}
    </div>
  )
}
