'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { HoverButton } from '@/components/shared/HoverButton'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { RangeMenu } from '@/components/shared/RangeMenu'

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

// YYYY-MM-DD lokális időzóna szerint (nincs UTC-csúszás, lásd PROJECT_STATUS bugfix)
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

export function ReservationDateFilter({
  currentDate,
  range = 'day',
  hideRangeOnMobile = false,
}: {
  currentDate: string
  range?: BookingsRange
  /** A Nap/Hét/Hónap pill mobilon MINDIG a fejléc-ikon nézet-választó sheet-jébe kerül (ld.
   *  DailyView / RestaurantScheduleView), itt nem kell duplán, külön sorban megjelenítenünk. */
  hideRangeOnMobile?: boolean
}) {
  const router = useRouter()

  const go = (offset: number) => {
    const date = toDate(currentDate)
    if (range === 'day') date.setDate(date.getDate() + offset)
    else if (range === 'week') date.setDate(date.getDate() + offset * 7)
    else date.setMonth(date.getMonth() + offset)
    router.push(`/restaurant/bookings?date=${ymd(date)}&range=${range}`)
  }

  const today = ymd(new Date())
  const isToday = currentDate === today
  const label = range === 'day' ? formatHu(currentDate) : range === 'week' ? formatWeekLabel(currentDate) : formatMonthLabel(currentDate)

  return (
    <div className="flex flex-wrap items-center gap-2">

      <div className="flex h-[42px] items-center gap-1 rounded-dav-pill border border-line bg-[var(--dav-glass)] p-1">
        <HoverButton
          onClick={() => go(-1)}
          className="h-8 w-8 rounded-full flex items-center justify-center text-ink hover:bg-white/60 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </HoverButton>

        <DatePickerPopover
          value={currentDate}
          onChange={(d) => router.push(`/restaurant/bookings?date=${d}&range=day`)}
          loadEndpoint="/api/restaurant/day-load"
          triggerClassName="h-8 px-2 rounded-full text-sm font-semibold text-ink hover:bg-white/60 transition-colors flex items-center gap-2"
        >
          <CalendarDays className="h-3.5 w-3.5 text-ink-soft" />
          {label}
        </DatePickerPopover>

        <HoverButton
          onClick={() => go(1)}
          className="h-8 w-8 rounded-full flex items-center justify-center text-ink hover:bg-white/60 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </HoverButton>
        {!isToday && (
          <HoverButton
            onClick={() => router.push(`/restaurant/bookings?date=${today}&range=${range}`)}
            className="h-8 px-3 rounded-full bg-ink-dark text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            Ma
          </HoverButton>
        )}
        {/* Nap / Hét / Hónap — a dátum-pill része („Nap ▾”); mobilon a nézet-választó sheet kezeli */}
        <span className={`${hideRangeOnMobile ? 'hidden lg:block' : ''} mx-0.5 h-5 w-px bg-line`} />
        <RangeMenu
          className={hideRangeOnMobile ? 'hidden lg:block' : ''}
          value={range}
          onChange={(v) => router.push(`/restaurant/bookings?date=${currentDate}&range=${v}`)}
        />
      </div>
    </div>
  )
}
