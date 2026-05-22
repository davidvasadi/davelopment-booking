'use client'

import { useState } from 'react'
import { ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { KpiDetailsSheet } from './KpiDetailsSheet'
import type { DayData } from '@/lib/dashboardStats'

type Metric = 'revenue' | 'bookings' | 'completion' | 'avg_value'

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
  label: string
  sub: string
  value: string
  diff?: number
  metric: Metric
  title: string
  period: number
  data: DayData[]
}

export function KpiCardWithDetails({ label, sub, value, diff, metric, title, period, data }: Props) {
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
      <KpiDetailsSheet
        kind="kpi"
        open={open}
        onClose={() => setOpen(false)}
        period={period}
        metric={metric}
        title={title}
        currentValue={value}
        currentDiff={diff}
        data={data}
      />
    </>
  )
}
