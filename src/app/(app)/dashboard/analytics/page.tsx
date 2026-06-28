import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { getDashboardStats } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { TrendChart, DowChart, ServiceChart, StaffChart, HourChart } from '@/components/dashboard/DashboardCharts'
import { AnalyticsOverview, type OverviewMetric } from '@/components/dashboard/AnalyticsOverview'
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
  // Idősorok a metrika-diagramokhoz.
  const revenueSeries = stats.trend.map((d) => ({ label: d.label, value: d.revenue }))
  const bookingsSeries = stats.trend.map((d) => ({ label: d.label, value: d.bookings }))

  const metrics: OverviewMetric[] = [
    {
      id: 'revenue', label: 'Bevétel', value: formatPrice(stats.periodRevenue, 'HUF'), unit: 'Ft',
      deltaPct: stats.periodRevenueDiff, color: '#00bb88', icon: 'revenue', series: revenueSeries,
      views: [
        { id: 'trend', label: 'Bevétel alakulása', icon: 'trend', target: 'trend' },
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'bookings', label: 'Foglalások', value: String(stats.periodBookings), unit: 'foglalás',
      deltaPct: stats.periodBookingsDiff, color: '#0099ff', icon: 'bookings', series: bookingsSeries,
      views: [
        { id: 'trend', label: 'Foglalások alakulása', icon: 'trend', target: 'trend' },
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'completion', label: 'Teljesítés', value: `${stats.completionRate}%`, unit: '',
      color: '#8b5cf6', icon: 'completion', series: bookingsSeries, deltaPct: stats.completionRateDiff,
      views: [
        ...(stats.byService.length ? [{ id: 'service', label: 'Szolgáltatások', icon: 'service', target: 'service' }] : []),
        ...(stats.byStaff.length ? [{ id: 'staff', label: 'Munkatársak', icon: 'staff', target: 'staff' }] : []),
      ],
    },
    {
      id: 'avg', label: 'Átl. érték', value: formatPrice(stats.avgBookingValue, 'HUF'), unit: 'Ft',
      color: '#f59e0b', icon: 'avg', series: revenueSeries, deltaPct: stats.avgBookingValueDiff,
      views: [
        { id: 'trend', label: 'Bevétel alakulása', icon: 'trend', target: 'trend' },
        ...(stats.byService.length ? [{ id: 'service', label: 'Szolgáltatások', icon: 'service', target: 'service' }] : []),
      ],
    },
    {
      id: 'cancelled', label: 'Lemondások', value: String(stats.cancelledCount), unit: 'foglalás',
      color: '#f87171', icon: 'cancelled', series: stats.cancelledTrend, deltaPct: stats.cancelledCountDiff,
      views: [
        { id: 'trend', label: 'Foglalások alakulása', icon: 'trend', target: 'trend' },
      ],
    },
  ]

  const detailCharts: Record<string, React.ReactNode> = {
    trend: <TrendChart key="trend" data={stats.trend} period={stats.period} embedded />,
    hour: <HourChart key="hour" data={stats.byHour} period={stats.period} rawDays={stats.trend} embedded />,
    dow: <DowChart key="dow" data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} embedded />,
    service: stats.byService.length ? <ServiceChart key="service" data={stats.byService} period={stats.period} embedded /> : null,
    staff: stats.byStaff.length ? <StaffChart key="staff" data={stats.byStaff} period={stats.period} embedded /> : null,
  }

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header — mobilon a cím a globális headerben van, ezért itt csak desktopon */}
      <div className="hidden lg:block">
        <PageHeader eyebrow="Részletes nézet" title="Statisztikák" />
      </div>

      {/* Áttekintés — kártya → nagy grafikon vált; részlet-sor → a lenti grafikon a slotban vált */}
      <AnalyticsOverview
        metrics={metrics}
        filter={<PeriodFilter current={days} csvExport={false} />}
        csvHref={`/api/export-csv?days=${days}`}
        detailCharts={detailCharts}
      />

      {/* Insight */}
      {(stats.bestDay || stats.bestHour) && (
        <DashboardCard className="text-sm text-zinc-500 dark:text-white/50">
          {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> az Ön legerősebb napja.</>}
          {stats.bestDay && stats.bestHour && ' '}
          {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
        </DashboardCard>
      )}
    </div>
  )
}
