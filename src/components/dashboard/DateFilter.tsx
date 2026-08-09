'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { ymdLocal as ymd } from '@/lib/utils'
import { HoverButton } from '@/components/shared/HoverButton'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'

const HU_MONTHS = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']

function formatHu(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS[m - 1]} ${d}.`
}

export default function DateFilter({ currentDate }: { currentDate: string }) {
  const router = useRouter()

  const go = (offset: number) => {
    const [y, m, d] = currentDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + offset)
    router.push(`/dashboard/bookings?date=${ymd(date)}`)
  }

  const today = ymd(new Date())
  const isToday = currentDate === today

  return (
    <div className="flex h-[42px] items-center gap-1 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1">
      <HoverButton
        onClick={() => go(-1)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </HoverButton>

      <DatePickerPopover
        value={currentDate}
        onChange={(d) => router.push(`/dashboard/bookings?date=${d}`)}
        loadEndpoint="/api/salon/day-load"
        triggerClassName="flex items-center gap-2 rounded-full px-2 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-white"
      >
        <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
        {formatHu(currentDate)}
      </DatePickerPopover>

      <HoverButton
        onClick={() => go(1)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-white"
      >
        <ChevronRight className="h-4 w-4" />
      </HoverButton>

      {!isToday && (
        <HoverButton
          onClick={() => router.push(`/dashboard/bookings?date=${today}`)}
          className="h-8 rounded-full bg-ink-dark px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
          Ma
        </HoverButton>
      )}
    </div>
  )
}
