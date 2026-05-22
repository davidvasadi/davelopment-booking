'use client'

import { useState } from 'react'
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ReservationTrendChart } from './DashboardCharts'
import type { DayData } from '@/lib/dashboardStats'

function DiffBadge({ diff }: { diff: number }) {
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-[#00bb88]">
      <TrendingUp className="h-3 w-3" />+{diff}%
    </span>
  )
  if (diff < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-400">
      <TrendingDown className="h-3 w-3" />{diff}%
    </span>
  )
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-zinc-400 dark:text-white/30">
      <Minus className="h-3 w-3" />0%
    </span>
  )
}

interface Props {
  sub: string
  label: string
  value: string
  diff?: number
  /** Sheet fejléc */
  title: string
  description?: string
  period: number
  /** A trend-grafikonhoz használt napi adatsor (a `revenue` mezőben a pax/foglalás-szám utazik). */
  trend?: DayData[]
}

export function RestaurantKpiCard({ sub, label, value, diff, title, description, period, trend }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none hover:border-zinc-300 dark:hover:border-white/[0.16] transition-colors text-left w-full"
      >
        <div className="flex items-start justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">{sub}</p>
          <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30 group-hover:text-zinc-700 dark:group-hover:text-white/60 transition-colors shrink-0 mt-0.5" />
        </div>
        <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
        <div className="flex items-center justify-between gap-1 flex-wrap">
          <p className="text-xs text-zinc-500 dark:text-white/40">{label}</p>
          {diff !== undefined && <DiffBadge diff={diff} />}
        </div>
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-950">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl p-5 bg-zinc-50 dark:bg-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{sub}</p>
              <p className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm text-zinc-500 dark:text-white/40">{label}</p>
                {diff !== undefined && <DiffBadge diff={diff} />}
              </div>
            </div>
            {description && <p className="text-sm text-zinc-500 dark:text-white/50">{description}</p>}
            {trend && trend.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-3">
                  Alakulás ({period} nap)
                </p>
                <ReservationTrendChart data={trend} period={period} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
