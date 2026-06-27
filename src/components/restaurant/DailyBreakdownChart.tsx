'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { hu } from 'date-fns/locale'
import type { RestaurantDayBreakdown } from '@/lib/restaurantStats'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

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
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  // A léptetés a bővebb halmazon, dátum szerint megy – így rövid időszaknál is
  // lapozható tegnap/holnap felé.
  const nav = fullData && fullData.length ? fullData : data
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickColor = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'

  const openSheet = (date: string) => setSelectedDate(date)
  const closeSheet = () => setSelectedDate(null)
  const navIdx = selectedDate !== null ? nav.findIndex(d => d.date === selectedDate) : -1
  const day = navIdx >= 0 ? nav[navIdx] : null

  const canPrev = navIdx > 0
  const canNext = navIdx >= 0 && navIdx < nav.length - 1

  // A "Részletek" gomb a legutóbbi forgalmas napot nyitja (vagy az utolsó napot, ha nincs).
  const lastActive = nav.filter(d => d.active + d.cancelled + d.completed > 0).pop()
  const lastWithData = lastActive ? lastActive.date : nav[nav.length - 1]?.date

  return (
    <div className={embedded ? '' : 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">
              Elmúlt {periodLabel(period)}
            </p>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Napi bontás</h3>
          </div>
          <button
            type="button"
            onClick={() => openSheet(lastWithData)}
            className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 transition-colors shrink-0"
          >
            <span className="hidden sm:inline">Részletek</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ResponsiveContainer width="100%" height={embedded ? '100%' : 220}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} interval={xAxisInterval(period)} />
          <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as RestaurantDayBreakdown
              return (
                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                  <p className="text-zinc-400 dark:text-white/40 mb-1">{fullDayLabel(d.date)}</p>
                  <p className="font-black">{d.active} aktív foglalás · {d.pax} fő</p>
                </div>
              )
            }}
          />
          <Bar
            dataKey="active"
            stackId="s"
            fill="#0099ff"
            radius={[0, 0, 0, 0]}
            className="cursor-pointer"
            background={{ fill: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', radius: 4 }}
            onClick={(_, index) => data[index] && openSheet(data[index].date)}
          />
          <Bar dataKey="cancelled" stackId="s" fill="#f43f5e" radius={[4, 4, 0, 0]} className="cursor-pointer" onClick={(_, index) => data[index] && openSheet(data[index].date)} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400 dark:text-white/30">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0099ff]" /> Aktív</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f43f5e]" /> Lemondva / nem jött</span>
      </div>

      <Sheet open={day !== null} onOpenChange={(v) => { if (!v) closeSheet() }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-950">
          {day && (
            <>
              <SheetHeader className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-0.5">Napi részletek</p>
                <SheetTitle className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                  {fullDayLabel(day.date)}
                </SheetTitle>
              </SheetHeader>

              {/* Nap-léptető */}
              <div className="flex items-center justify-between mb-5">
                <button
                  type="button"
                  disabled={!canPrev}
                  onClick={() => canPrev && setSelectedDate(nav[navIdx - 1].date)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1] transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Előző nap
                </button>
                <button
                  type="button"
                  disabled={!canNext}
                  onClick={() => canNext && setSelectedDate(nav[navIdx + 1].date)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.1] transition-colors"
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
                className="mt-5 flex items-center justify-center gap-1.5 w-full py-3 rounded-xl text-sm font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-white/90 transition-colors"
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
    <div className="rounded-xl p-3.5 bg-zinc-50 dark:bg-white/[0.03] border border-zinc-100 dark:border-white/[0.06]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{label}</p>
      <p className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">{value}{suffix}</p>
    </div>
  )
}
