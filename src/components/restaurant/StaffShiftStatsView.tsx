'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Segmented } from '@/components/ui-kit'
import { StaffStats, type StaffStatsData } from '@/components/blocks/stats'
import { formatPrice } from '@/lib/utils'
import type { MyShiftStats } from '@/lib/myShiftStats'

/**
 * Étterem: a munkatárs saját statisztikája (csak `analytics.view.own` jog) — design 5.5. A beosztásból: ledolgozott óra,
 * munkanap, átlagos műszak, bér / borravaló, a hét napjai szerinti órák, jelenlét, közelgő műszakok. Az időszak a
 * `?period=` (7 / 30 / 90 / 365 nap).
 */
const PERIODS: [string, number][] = [['7 nap', 7], ['30 nap', 30], ['Negyedév', 90], ['Év', 365]]
const DOW: Record<string, string> = { 'Hétfő': 'H', 'Kedd': 'K', 'Szerda': 'Sze', 'Csütörtök': 'Cs', 'Péntek': 'P', 'Szombat': 'Szo', 'Vasárnap': 'V' }
const fmtH = (h: number) => `${Math.round(h * 10) / 10}`.replace('.', ',') + ' ó'

export function StaffShiftStatsView({ stats }: { stats: MyShiftStats }) {
  const router = useRouter()
  const pathname = usePathname()
  const max = Math.max(0, ...stats.byDayOfWeek.map((d) => d.hours))
  const data: StaffStatsData = {
    periodLabel: `az elmúlt ${stats.period} nap`,
    hours: fmtH(stats.periodHours), hoursDiff: stats.periodHoursDiff || null,
    days: stats.workedDays, daysDiff: stats.workedDaysDiff || null,
    avgShift: fmtH(stats.avgShiftHours),
    pay: stats.wageHuf != null ? { label: stats.payLabel ?? 'bér', value: formatPrice(stats.wageHuf) } : null,
    tip: stats.tipHuf != null ? formatPrice(stats.tipHuf) : null,
    dow: stats.byDayOfWeek.map((d) => ({ d: DOW[d.day] ?? d.day.slice(0, 3), v: Math.round(d.hours * 10) / 10, peak: d.hours === max && max > 0, closed: d.hours === 0 })),
    presence: { now: stats.workedDays, prev: stats.prevWorkedDays },
    leave: stats.leaveDays, sick: stats.sickDays,
    upcoming: stats.upcomingShifts.map((u, i) => ({ key: `${u.date}-${i}`, day: u.label, time: u.startTime && u.endTime ? `${u.startTime} – ${u.endTime}` : 'egész nap' })),
  }
  const active = Math.max(0, PERIODS.findIndex(([, n]) => n === stats.period))
  return (
    <div className="p-4 lg:p-0">
      <StaffStats data={data} period={<Segmented options={PERIODS.map(([l]) => l)} active={active} onSelect={(i) => router.push(`${pathname}?period=${PERIODS[i][1]}`)} />} />
    </div>
  )
}
