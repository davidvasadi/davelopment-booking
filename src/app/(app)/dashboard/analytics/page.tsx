import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getDashboardStats } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { TrendChart, DowChart, ServiceChart, StaffChart, HourChart } from '@/components/dashboard/DashboardCharts'
import { KpiCardWithDetails } from '@/components/dashboard/KpiCardWithDetails'
import PeriodFilter from '@/components/dashboard/PeriodFilter'
import type { Salon } from '@/payload/payload-types'

const VALID_PERIODS = [1, 7, 30, 90, 180, 365]

function periodLabel(days: number) {
  if (days === 1) return 'mai'
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
        <KpiCardWithDetails
          sub={`${label} bevétel`}
          label="előző időszakhoz képest"
          value={formatPrice(stats.periodRevenue, 'HUF')}
          diff={stats.periodRevenueDiff}
          metric="revenue"
          title={`${label} bevétel`}
          period={stats.period}
          data={stats.trend}
        />
        <KpiCardWithDetails
          sub={`${label} foglalás`}
          label="előző időszakhoz képest"
          value={String(stats.periodBookings)}
          diff={stats.periodBookingsDiff}
          metric="bookings"
          title={`${label} foglalások`}
          period={stats.period}
          data={stats.trend}
        />
        <KpiCardWithDetails
          sub="Átl. érték"
          label="foglalásonként"
          value={formatPrice(stats.avgBookingValue, 'HUF')}
          metric="avg_value"
          title="Átlagos foglalás értéke"
          period={stats.period}
          data={stats.trend}
        />
        <KpiCardWithDetails
          sub="Teljesítési arány"
          label="befejezett / lezárt"
          value={`${stats.completionRate}%`}
          metric="completion"
          title="Teljesítési arány"
          period={stats.period}
          data={stats.trend}
        />
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
      <HourChart data={stats.byHour} period={stats.period} rawDays={stats.trend} />

      {/* DoW + service breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DowChart data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} />
        {stats.byService.length > 0 && <ServiceChart data={stats.byService} period={stats.period} />}
      </div>

      {stats.byStaff.length > 0 && (
        <StaffChart data={stats.byStaff} period={stats.period} />
      )}
    </div>
  )
}
