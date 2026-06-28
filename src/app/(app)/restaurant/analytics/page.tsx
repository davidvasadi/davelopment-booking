import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { AnalyticsOverview, type OverviewMetric } from '@/components/dashboard/AnalyticsOverview'
import { ReservationTrendChart, DowChart, HourChart } from '@/components/dashboard/DashboardCharts'
import { DailyBreakdownChart } from '@/components/restaurant/DailyBreakdownChart'
import { DwellCard } from '@/components/restaurant/DwellCard'
import { NationalityCard } from '@/components/restaurant/NationalityCard'
import { Reveal } from '@/components/ui/reveal'
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

  // Idősorok a metrika-diagramokhoz (étterem: a trend.revenue mező pax-ot hordoz).
  const reservationsSeries = stats.trend.map((d) => ({ label: d.label, value: d.bookings }))
  const paxSeries = stats.trend.map((d) => ({ label: d.label, value: d.revenue }))
  // A napi bontásból az időszakra szabva (a dailyBreakdownFull min. 30 napot tart).
  const tailFull = stats.dailyBreakdownFull.slice(-days)
  const completedSeries = tailFull.map((d) => ({ label: d.label, value: d.completed }))
  const cancelledSeries = tailFull.map((d) => ({ label: d.label, value: d.cancelled }))
  const walkInSeries = tailFull.map((d) => ({ label: d.label, value: d.walkIn }))
  const onlineSeries = tailFull.map((d) => ({ label: d.label, value: d.online }))
  const phoneSeries = tailFull.map((d) => ({ label: d.label, value: d.phone }))
  const noShowSeries = tailFull.map((d) => ({ label: d.label, value: d.noShow }))
  const cancelOnlySeries = tailFull.map((d) => ({ label: d.label, value: d.cancelledOnly }))

  // 5 csoport-metrika; a részlet-nézetek a lenti grafikonokra ugranak (sec-*).
  const metrics: OverviewMetric[] = [
    {
      id: 'reservations', label: 'Foglalások', value: String(stats.periodReservations), unit: 'foglalás',
      deltaPct: stats.periodReservationsDiff, color: '#0099ff', icon: 'reservations', series: reservationsSeries,
      views: [
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
        { id: 'daily', label: 'Napi bontás', icon: 'daily', target: 'daily' },
      ],
    },
    {
      id: 'pax', label: 'Vendégszám', value: `${stats.periodPax} fő`, unit: 'fő',
      deltaPct: stats.periodPaxDiff, color: '#00bb88', icon: 'pax', series: paxSeries,
      views: [
        { id: 'trend', label: 'Foglalások alakulása', icon: 'pax', target: 'trend' },
        { id: 'nat', label: 'Vendégek nemzetisége', icon: 'nat', target: 'nat' },
      ],
    },
    {
      id: 'completion', label: 'Teljesítés', value: `${stats.completionRate}%`, unit: 'befejezett',
      color: '#8b5cf6', icon: 'completion', series: completedSeries, deltaPct: stats.completionRateDiff,
      views: [
        { id: 'dwell', label: 'Tartózkodási idő', icon: 'dwell', target: 'dwell' },
        { id: 'daily', label: 'Napi bontás', icon: 'daily', target: 'daily' },
      ],
    },
    {
      id: 'source', label: 'Vendégforrás', value: `${stats.onlineReservations + stats.walkInCount + stats.phoneCount} fő`, unit: 'walk-in fő',
      color: '#f59e0b', icon: 'source', series: walkInSeries, deltaPct: stats.sourceTotalDiff,
      views: [
        { id: 'online', label: `Online · ${stats.onlineReservations} fő`, icon: 'online', series: onlineSeries, value: `${stats.onlineReservations} fő` },
        { id: 'walkin', label: `Walk-in · ${stats.walkInCount} fő`, icon: 'walkin', series: walkInSeries, value: `${stats.walkInCount} fő` },
        { id: 'phone', label: `Telefonos · ${stats.phoneCount} fő`, icon: 'phone', series: phoneSeries, value: `${stats.phoneCount} fő` },
      ],
    },
    {
      id: 'cancelled', label: 'Lemondások', value: `${stats.cancelledCount + stats.noShowCount} fő`, unit: 'fő',
      color: '#f87171', icon: 'cancelled', series: cancelledSeries, deltaPct: stats.cancelledTotalDiff,
      views: [
        { id: 'cancel', label: `Lemondva · ${stats.cancelledCount} fő`, icon: 'cancelled', series: cancelOnlySeries, value: `${stats.cancelledCount} fő` },
        { id: 'noshow', label: `No-show · ${stats.noShowCount} fő`, icon: 'noshow', series: noShowSeries, value: `${stats.noShowCount} fő` },
      ],
    },
  ]

  // A részlet-nézetek kész grafikonjai (a kinézetük változatlan) — az áttekintő
  // slotjában jelennek meg, scroll helyett a részlet-sor választja ki.
  const detailCharts: Record<string, React.ReactNode> = {
    trend: days > 1 ? <ReservationTrendChart key="trend" data={stats.trend} period={stats.period} embedded /> : null,
    hour: <HourChart key="hour" data={stats.byHour} period={stats.period} rawDays={stats.trend} hourlyByDate={stats.hourlyByDate} moneyless embedded />,
    dwell: stats.avgDwellOverall > 0 ? (
      <DwellCard key="dwell" avgDwell={stats.avgDwell} avgDwellOverall={stats.avgDwellOverall} dwellRaw={stats.dwellRaw} periodLabel={label} embedded />
    ) : null,
    nat: (stats.domesticCount + stats.foreignCount) > 0 ? (
      <NationalityCard key="nat" domesticCount={stats.domesticCount} foreignCount={stats.foreignCount} topCountries={stats.topCountries} nationalityRaw={stats.nationalityRaw} periodLabel={label} embedded />
    ) : null,
    dow: days > 1 ? <DowChart key="dow" data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} moneyless embedded /> : null,
    daily: <DailyBreakdownChart key="daily" data={stats.dailyBreakdown} fullData={stats.dailyBreakdownFull} period={stats.period} embedded />,
  }

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header — mobilon a cím a globális headerben van, ezért itt csak desktopon */}
      <div className="hidden lg:block">
        <PageHeader eyebrow="Részletes nézet" title="Statisztikák" />
      </div>

      {/* Áttekintés — kártya → nagy grafikon vált; részlet-sor → a lenti grafikon a slotban vált */}
      <Reveal>
        <AnalyticsOverview
          metrics={metrics}
          filter={<PeriodFilter current={days} basePath="/restaurant/analytics" module="restaurant" csvExport={false} />}
          csvHref={`/api/export-csv?days=${days}&module=restaurant`}
          detailCharts={detailCharts}
        />
      </Reveal>

      {/* Insight */}
      {(stats.bestDay || stats.bestHour) && (
        <Reveal>
          <DashboardCard className="text-sm text-zinc-500 dark:text-white/50">
            {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> a legerősebb napja.</>}
            {stats.bestDay && stats.bestHour && ' '}
            {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
          </DashboardCard>
        </Reveal>
      )}
    </div>
  )
}
