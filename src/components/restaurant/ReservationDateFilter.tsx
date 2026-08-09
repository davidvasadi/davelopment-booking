'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { HoverButton } from '@/components/shared/HoverButton'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'

const HU_MONTHS = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

function formatHu(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS[m - 1]} ${d}.`
}

// YYYY-MM-DD lokális időzóna szerint (nincs UTC-csúszás, lásd PROJECT_STATUS bugfix)
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ReservationDateFilter({ currentDate }: { currentDate: string }) {
  const router = useRouter()

  const go = (offset: number) => {
    const [y, m, d] = currentDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + offset)
    router.push(`/restaurant/bookings?date=${ymd(date)}`)
  }

  const today = ymd(new Date())
  const isToday = currentDate === today

  return (
    <div className="flex h-[42px] items-center gap-1 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1">
      <HoverButton
        onClick={() => go(-1)}
        className="h-8 w-8 rounded-full flex items-center justify-center text-ink hover:bg-white/60 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
      </HoverButton>

      <DatePickerPopover
        value={currentDate}
        onChange={(d) => router.push(`/restaurant/bookings?date=${d}`)}
        loadEndpoint="/api/restaurant/day-load"
        triggerClassName="h-8 px-2 rounded-full text-sm font-semibold text-ink hover:bg-white/60 transition-colors flex items-center gap-2"
      >
        <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
        {formatHu(currentDate)}
      </DatePickerPopover>

      <HoverButton
        onClick={() => go(1)}
        className="h-8 w-8 rounded-full flex items-center justify-center text-ink hover:bg-white/60 transition-colors"
      >
        <ChevronRight className="h-4 w-4" />
      </HoverButton>
      {!isToday && (
        <HoverButton
          onClick={() => router.push(`/restaurant/bookings?date=${today}`)}
          className="h-8 px-3 rounded-full bg-ink-dark text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Ma
        </HoverButton>
      )}
    </div>
  )
}
