'use client'

import { useState } from 'react'
import { Wallet, CalendarCheck, CheckCircle2, Receipt, type LucideIcon } from 'lucide-react'
import { StatCard } from './StatCard'
import { KpiDetailsSheet } from './KpiDetailsSheet'
import type { DayData } from '@/lib/dashboardStats'

type Metric = 'revenue' | 'bookings' | 'completion' | 'avg_value'

const METRIC_ICONS: Record<Metric, LucideIcon> = {
  revenue: Wallet,
  bookings: CalendarCheck,
  completion: CheckCircle2,
  avg_value: Receipt,
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
      <StatCard
        sub={sub}
        label={label}
        value={value}
        diff={diff}
        icon={METRIC_ICONS[metric]}
        onClick={() => setOpen(true)}
      />
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
