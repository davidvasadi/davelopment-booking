'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { RestaurantDayBreakdown } from '@/lib/restaurantStats'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/* davelopment-design chart-paletta. */
const C = {
  ink: '#1D1C19',
  bad: '#C0564A',
  grid: 'rgba(120,110,70,.14)',
  tick: '#9b9788',
}

function periodLabel(days: number) {
  if (days === 7) return '7 nap'
  if (days === 30) return '30 nap'
  if (days === 90) return '90 nap'
  if (days === 180) return '6 hónap'
  if (days === 365) return '1 év'
  return `${days} nap`
}

function xAxisInterval(days: number) {
  if (days <= 14) return 0
  if (days <= 30) return 3
  if (days <= 90) return 13
  if (days <= 180) return 26
  return 60
}

function fullDayLabel(iso: string) {
  return format(parseISO(iso), 'yyyy. MMMM d., EEEE', { locale: hu })
}

export function DailyBreakdownChart({
  data,
  fullData,
  period = 30,
  embedded = false,
}: {
  data: RestaurantDayBreakdown[]
  /** Bővebb (≥30 napos) halmaz a sheet lapozásához; ha hiányzik, a data-ra esik vissza. */
  fullData?: RestaurantDayBreakdown[]
  period?: number
  embedded?: boolean
}) {
  // A léptetés a bővebb halmazon, dátum szerint megy.
  const nav = fullData && fullData.length ? fullData : data
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const openSheet = (date: string) => setSelectedDate(date)
  const closeSheet = () => setSelectedDate(null)
  const navIdx = selectedDate !== null ? nav.findIndex(d => d.date === selectedDate) : -1
  const day = navIdx >= 0 ? nav[navIdx] : null

  const canPrev = navIdx > 0
  const canNext = navIdx >= 0 && navIdx < nav.length - 1

  const lastActive = nav.filter(d => d.active + d.cancelled + d.completed > 0).pop()
  const lastWithData = lastActive ? lastActive.date : nav[nav.length - 1]?.date

  return (
    <div className={embedded ? 'h-full' : 'bg-[#fcfbf7] border border-line rounded-[26px] shadow-dav-card p-6'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">
              Elmúlt {periodLabel(period)}
            </p>
            <h3 className="text-[19px] font-medium tracking-tight text-ink">Napi bontás</h3>
          </div>
          <button
            type="button"
            onClick={() => openSheet(lastWithData)}
            aria-label="Részletek"
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f0ed] text-ink transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={embedded ? '100%' : 220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} interval={xAxisInterval(period)} />
          <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(120,110,70,.06)', radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as RestaurantDayBreakdown
              return (
                <div className="rounded-[14px] border border-line bg-white text-ink text-xs px-3 py-2 shadow-dav-card">
                  <p className="text-ink-soft mb-1">{fullDayLabel(d.date)}</p>
                  <p className="font-semibold">{d.active} aktív foglalás · {d.pax} fő</p>
                </div>
              )
            }}
          />
          <Bar
            dataKey="active"
            stackId="s"
            fill={C.ink}
            radius={[0, 0, 0, 0]}
            className="cursor-pointer"
            background={embedded ? undefined : { fill: 'rgba(120,110,70,.05)', radius: 4 }}
            onClick={(_, index) => data[index] && openSheet(data[index].date)}
          />
          <Bar dataKey="cancelled" stackId="s" fill={C.bad} radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(_, index) => data[index] && openSheet(data[index].date)} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.ink }} /> Aktív</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.bad }} /> Lemondva / nem jött</span>
      </div>

      <Sheet open={day !== null} onOpenChange={(v) => { if (!v) closeSheet() }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white">
          {day && (
            <>
              <SheetHeader className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-0.5">Napi részletek</p>
                <SheetTitle className="text-lg font-medium tracking-tight text-ink">
                  {fullDayLabel(day.date)}
                </SheetTitle>
              </SheetHeader>

              {/* Nap-léptető */}
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => canPrev && setSelectedDate(nav[navIdx - 1].date)}
                  className="flex items-center gap-1 px-3 py-2 rounded-[12px] text-xs font-semibold bg-[var(--dav-glass-strong)] border border-line text-ink-soft2 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Előző nap
                </button>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => canNext && setSelectedDate(nav[navIdx + 1].date)}
                  className="flex items-center gap-1 px-3 py-2 rounded-[12px] text-xs font-semibold bg-[var(--dav-glass-strong)] border border-line text-ink-soft2 hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Következő nap <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <DayStat label="Aktív foglalás" value={day.active} />
                <DayStat label="Várható vendég" value={day.pax} suffix=" fő" />
                <DayStat label="Befejezett" value={day.completed} />
                <DayStat label="Lemondva / nem jött" value={day.cancelled} />
                <DayStat label="Beeső (walk-in)" value={day.walkIn} />
              </div>

              <a
                href={`/restaurant/bookings?date=${day.date}`}
                className="mt-5 flex items-center justify-center gap-1.5 w-full py-3 rounded-[14px] text-sm font-semibold bg-ink-dark text-white hover:opacity-90 transition-opacity"
              >
                Nap megnyitása a foglalásoknál <ArrowUpRight className="h-4 w-4" />
              </a>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DayStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-[14px] p-3.5 bg-[var(--dav-glass)] border border-line">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">{label}</p>
      <p className="text-2xl font-light tracking-[-0.02em] text-ink">{value}{suffix}</p>
    </div>
  )
}
