import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { getDashboardStats } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { TrendChart, DowChart, ServiceChart, StaffChart, HourChart } from '@/components/dashboard/DashboardCharts'
import { KpiCardWithDetails } from '@/components/dashboard/KpiCardWithDetails'
import PeriodFilter from '@/components/dashboard/PeriodFilter'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'

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
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  const days = VALID_PERIODS.includes(Number(periodParam)) ? Number(periodParam) : 30
  const stats = await getDashboardStats(salon.id, days)
  const label = periodLabel(days)

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header */}
      <PageHeader eyebrow="Részletes nézet" title="Statisztikák" action={<PeriodFilter current={days} />} />

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
        <DashboardCard className="text-sm text-zinc-500 dark:text-white/50">
          {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> az Ön legerősebb napja.</>}
          {stats.bestDay && stats.bestHour && ' '}
          {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
        </DashboardCard>
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
