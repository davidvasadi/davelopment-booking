'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { ymdLocal as ymd } from '@/lib/utils'
import { HoverButton } from '@/components/shared/HoverButton'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'

const HU_MONTHS = ['jan.', 'feb.', 'már.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szep.', 'okt.', 'nov.', 'dec.']
const HU_MONTHS_FULL = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
]

export type BookingsRange = 'day' | 'week' | 'month'
const RANGE_OPTIONS: { value: BookingsRange; label: string }[] = [
  { value: 'day', label: 'Nap' },
  { value: 'week', label: 'Hét' },
  { value: 'month', label: 'Hónap' },
]

function toDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** A `dateStr`-t tartalmazó hét hétfője. */
function mondayOf(dateStr: string): Date {
  const d = toDate(dateStr)
  const dow = (d.getDay() + 6) % 7 // hétfő = 0
  d.setDate(d.getDate() - dow)
  return d
}

function formatHu(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS[m - 1]} ${d}.`
}

function formatWeekLabel(dateStr: string) {
  const mon = mondayOf(dateStr)
  const sun = new Date(mon)
  sun.setDate(sun.getDate() + 6)
  if (mon.getMonth() === sun.getMonth()) return `${HU_MONTHS[mon.getMonth()]} ${mon.getDate()}–${sun.getDate()}.`
  return `${HU_MONTHS[mon.getMonth()]} ${mon.getDate()}. – ${HU_MONTHS[sun.getMonth()]} ${sun.getDate()}.`
}

function formatMonthLabel(dateStr: string) {
  const [y, m] = dateStr.split('-').map(Number)
  return `${y}. ${HU_MONTHS_FULL[m - 1]}`
}

export default function DateFilter({ currentDate, range = 'day' }: { currentDate: string; range?: BookingsRange }) {
  const router = useRouter()

  const go = (offset: number) => {
    const date = toDate(currentDate)
    if (range === 'day') date.setDate(date.getDate() + offset)
    else if (range === 'week') date.setDate(date.getDate() + offset * 7)
    else date.setMonth(date.getMonth() + offset)
    router.push(`/dashboard/bookings?date=${ymd(date)}&range=${range}`)
  }

  const today = ymd(new Date())
  const isToday = currentDate === today
  const label = range === 'day' ? formatHu(currentDate) : range === 'week' ? formatWeekLabel(currentDate) : formatMonthLabel(currentDate)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex h-[42px] items-center gap-0.5 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1">
        {RANGE_OPTIONS.map(({ value, label: rangeLabel }) => (
          <HoverButton
            key={value}
            onClick={() => router.push(`/dashboard/bookings?date=${currentDate}&range=${value}`)}
            className={`rounded-[15px] px-2.5 sm:px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              range === value ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink'
            }`}
          >
            {rangeLabel}
          </HoverButton>
        ))}
      </div>

      <div className="flex h-[42px] items-center gap-1 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1">
        <HoverButton
          onClick={() => go(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </HoverButton>

        <DatePickerPopover
          value={currentDate}
          onChange={(d) => router.push(`/dashboard/bookings?date=${d}&range=day`)}
          loadEndpoint="/api/salon/day-load"
          triggerClassName="flex items-center gap-2 rounded-full px-2 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-white"
        >
          <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
          {label}
        </DatePickerPopover>

        <HoverButton
          onClick={() => go(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-white"
        >
          <ChevronRight className="h-4 w-4" />
        </HoverButton>

        {!isToday && (
          <HoverButton
            onClick={() => router.push(`/dashboard/bookings?date=${today}&range=${range}`)}
            className="h-8 rounded-full bg-ink-dark px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          >
            Ma
          </HoverButton>
        )}
      </div>
    </div>
  )
}
