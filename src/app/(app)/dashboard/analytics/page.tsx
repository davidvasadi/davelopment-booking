import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getDashboardStats } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { TrendChart, DowChart, ServiceChart, StaffChart, HourChart } from '@/components/dashboard/DashboardCharts'
import PeriodFilter from '@/components/dashboard/PeriodFilter'
import type { Salon } from '@/payload/payload-types'
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react'

const VALID_PERIODS = [7, 30, 90, 180, 365]

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
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-zinc-400 dark:text-white/30"><Minus className="h-3 w-3" />0%</span>
}

function StatCard({ label, sub, value, diff }: { label: string; sub: string; value: string; diff?: number }) {
  return (
    <div className="rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none">
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">{sub}</p>
        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-300 dark:text-white/20 shrink-0 mt-0.5" />
      </div>
      <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <p className="text-xs text-zinc-500 dark:text-white/40">{label}</p>
        {diff !== undefined && <DiffBadge diff={diff} />}
      </div>
    </div>
  )
}

function periodLabel(days: number) {
  if (days === 7) return '7 nap'
  if (days === 30) return '30 nap'
  if (days === 90) return '90 nap'
  if (days === 180) return '6 hónap'
  if (days === 365) return '1 év'
  return `${days} nap`
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  const days = VALID_PERIODS.includes(Number(periodParam)) ? Number(periodParam) : 30
  const stats = await getDashboardStats(salon.id, days)
  const label = periodLabel(days)

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Részletes nézet</p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Statisztikák</h1>
        </div>
        <PeriodFilter current={days} />
      </div>

      {/* Period KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          sub={`${label} bevétel`}
          label="előző időszakhoz képest"
          value={formatPrice(stats.periodRevenue, 'HUF')}
          diff={stats.periodRevenueDiff}
        />
        <StatCard
          sub={`${label} foglalás`}
          label="előző időszakhoz képest"
          value={String(stats.periodBookings)}
          diff={stats.periodBookingsDiff}
        />
        <div className="rounded-2xl p-4 lg:p-6 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-zinc-400 dark:text-white/30">Átl. érték</p>
          <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">
            {formatPrice(stats.avgBookingValue, 'HUF')}
          </p>
          <p className="text-xs text-zinc-500 dark:text-white/40">foglalásonként</p>
        </div>
        <div className="rounded-2xl p-4 lg:p-6 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1 text-zinc-400 dark:text-white/30">Teljesítési arány</p>
          <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white">{stats.completionRate}%</p>
          <p className="text-xs text-zinc-500 dark:text-white/40">befejezett / lezárt</p>
        </div>
      </div>

      {/* Insight */}
      {(stats.bestDay || stats.bestHour) && (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl px-5 py-4 text-sm text-zinc-500 dark:text-white/50">
          {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> az Ön legerősebb napja.</>}
          {stats.bestDay && stats.bestHour && ' '}
          {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
        </div>
      )}

      {/* Trend chart */}
      <TrendChart data={stats.trend} period={stats.period} />

      {/* Hourly distribution */}
      <HourChart data={stats.byHour} period={stats.period} />

      {/* DoW + service breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DowChart data={stats.byDayOfWeek} period={stats.period} />
        {stats.byService.length > 0 && <ServiceChart data={stats.byService} period={stats.period} />}
      </div>

      {stats.byStaff.length > 0 && (
        <StaffChart data={stats.byStaff} period={stats.period} />
      )}
    </div>
  )
}
