import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { StatCard } from '@/components/dashboard/StatCard'
import { ReservationTrendChart, DowChart, HourChart } from '@/components/dashboard/DashboardCharts'
import PeriodFilter from '@/components/dashboard/PeriodFilter'

const VALID_PERIODS = [7, 30, 90, 180, 365]

function periodLabel(days: number) {
  if (days === 7) return '7 nap'
  if (days === 30) return '30 nap'
  if (days === 90) return '90 nap'
  if (days === 180) return '6 hónap'
  if (days === 365) return '1 év'
  return `${days} nap`
}

export default async function RestaurantAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  const { period: periodParam } = await searchParams
  const { restaurant } = await getOwnedRestaurant()

  const days = VALID_PERIODS.includes(Number(periodParam)) ? Number(periodParam) : 30
  const stats = await getRestaurantStats(restaurant.id, days)
  const label = periodLabel(days)

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Részletes nézet</p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Statisztikák</h1>
        </div>
        <PeriodFilter current={days} basePath="/restaurant/analytics" csvExport={false} />
      </div>

      {/* Period KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard sub={`${label} foglalás`} label="előző időszakhoz képest" value={String(stats.periodReservations)} diff={stats.periodReservationsDiff} />
        <StatCard sub={`${label} vendég`} label="előző időszakhoz képest" value={`${stats.periodPax} fő`} diff={stats.periodPaxDiff} />
        <StatCard sub="Átl. társaság" label="foglalásonként" value={`${stats.avgPartySize} fő`} />
        <StatCard sub="Teljesítési arány" label="befejezett / lezárt" value={`${stats.completionRate}%`} />
      </div>

      {/* Insight */}
      {(stats.bestDay || stats.bestHour) && (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl px-5 py-4 text-sm text-zinc-500 dark:text-white/50">
          {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> a legerősebb napja.</>}
          {stats.bestDay && stats.bestHour && ' '}
          {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
        </div>
      )}

      {/* Trend chart */}
      <ReservationTrendChart data={stats.trend} period={stats.period} />

      {/* Hourly distribution */}
      <HourChart data={stats.byHour} period={stats.period} rawDays={stats.trend} />

      {/* DoW breakdown */}
      <DowChart data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} />
    </div>
  )
}
