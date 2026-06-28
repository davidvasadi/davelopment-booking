'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ReservationTrendChart, TrendChart } from './DashboardCharts'
import type { DayData } from '@/lib/dashboardStats'

const RANGES = [
  { label: 'Ez a hét', days: 7 },
  { label: 'Ez a hónap', days: 30 },
]

/**
 * Kezdőlapi „Foglalások alakulása" kártya működő időszak-választóval. A teljes
 * trendet (30 nap) szeleteljük a kiválasztott ablakra, a chart fejléce itt van
 * (a benti chart embedded módban, fejléc nélkül).
 */
export function HomeTrendChart({ trend, moneyless = true }: { trend: DayData[]; moneyless?: boolean }) {
  const [days, setDays] = useState(7)
  const data = trend.slice(-days)
  const Chart = moneyless ? ReservationTrendChart : TrendChart

  return (
    <div className="font-geist bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Az elmúlt {days} nap</p>
          <h3 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Foglalások alakulása</h3>
        </div>
        <div className="relative shrink-0">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="appearance-none bg-zinc-100 dark:bg-white/[0.06] rounded-xl pl-3.5 pr-9 h-9 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none cursor-pointer"
          >
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>{r.label}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 dark:text-white/40" />
        </div>
      </div>
      <div className="h-56 lg:h-64">
        <Chart data={data} period={days} embedded />
      </div>
    </div>
  )
}
