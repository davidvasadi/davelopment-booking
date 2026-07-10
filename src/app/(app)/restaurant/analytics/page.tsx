import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { AnalyticsOverview, type OverviewMetric } from '@/components/dashboard/AnalyticsOverview'
import { ReservationTrendChart, DowChart, HourChart, DaypartChart } from '@/components/dashboard/DashboardCharts'
import { DailyBreakdownChart } from '@/components/restaurant/DailyBreakdownChart'
import { DwellCard } from '@/components/restaurant/DwellCard'
import { NationalityCard } from '@/components/restaurant/NationalityCard'
import PeriodFilter from '@/components/dashboard/PeriodFilter'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'

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

  // ── Crextio „stat bars" — teljesítés / lemondás+no-show / hátralévő arány ──
  const totalForBar = stats.periodReservations || 1
  const completedPct = Math.min(100, stats.completionRate)
  const cancelledPct = Math.min(100 - completedPct, Math.round(((stats.cancelledCount + stats.noShowCount) / totalForBar) * 100))
  const openPct = Math.max(0, 100 - completedPct - cancelledPct)

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

  // ── Nap×óra hőtérkép (10..22h) a hourlyByDate-ből aggregálva ──
  const HM_HOURS = Array.from({ length: 13 }, (_, i) => i + 10)
  const hmGrid = Array.from({ length: 7 }, () => Array.from({ length: HM_HOURS.length }, () => 0))
  for (const [date, hoursArr] of Object.entries(stats.hourlyByDate)) {
    const dow = (new Date(date + 'T00:00:00').getDay() + 6) % 7
    HM_HOURS.forEach((h, hi) => { hmGrid[dow][hi] += hoursArr[h] ?? 0 })
  }
  let hmPeakDay = 0, hmPeakHour = HM_HOURS[0], hmBest = -1
  hmGrid.forEach((row, di) => row.forEach((v, hi) => { if (v > hmBest) { hmBest = v; hmPeakDay = di; hmPeakHour = HM_HOURS[hi] } }))
  const heatmap = { grid: hmGrid, hours: HM_HOURS, peakDayIdx: hmPeakDay, peakHour: hmPeakHour }

  // ── Forrás-csík: online / telefon / walk-in + no-show (pax %) ──
  const srcTotal = Math.max(1, stats.onlineReservations + stats.phoneCount + stats.walkInCount + stats.noShowCount)
  const pctOf = (n: number) => Math.round((n / srcTotal) * 100)
  const sources = [
    { label: 'Online', value: `${pctOf(stats.onlineReservations)}%`, pct: pctOf(stats.onlineReservations), variant: 'ink' as const },
    { label: 'Telefon', value: `${pctOf(stats.phoneCount)}%`, pct: pctOf(stats.phoneCount), variant: 'gold' as const },
    { label: 'Beeső', value: `${pctOf(stats.walkInCount)}%`, pct: pctOf(stats.walkInCount), variant: 'striped' as const },
    { label: 'No-show', value: `${pctOf(stats.noShowCount)}%`, pct: pctOf(stats.noShowCount), variant: 'outline' as const },
  ]

  // 5 csoport-metrika; a részlet-nézetek a lenti grafikonokra ugranak (sec-*).
  const metrics: OverviewMetric[] = [
    {
      id: 'reservations', label: 'Foglalások', value: String(stats.periodReservations), unit: 'foglalás',
      deltaPct: stats.periodReservationsDiff, color: '#1D1C19', icon: 'reservations', series: reservationsSeries, // davelopment ink
      views: [
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'pax', label: 'Vendégszám', value: `${stats.periodPax} fő`, unit: 'fő',
      deltaPct: stats.periodPaxDiff, color: '#1D9D63', icon: 'pax', series: paxSeries,
      views: [
        { id: 'trend', label: 'Foglalások alakulása', icon: 'pax', target: 'trend' },
        { id: 'nat', label: 'Vendégek nemzetisége', icon: 'nat', target: 'nat' },
      ],
    },
    {
      id: 'completion', label: 'Teljesítés', value: `${stats.completionRate}%`, unit: 'befejezett',
      color: '#1D1C19', icon: 'completion', series: completedSeries, deltaPct: stats.completionRateDiff,
      views: [
        { id: 'dwell', label: 'Tartózkodási idő', icon: 'dwell', target: 'dwell' },
      ],
    },
    {
      id: 'source', label: 'Vendégforrás', value: `${stats.onlineReservations + stats.walkInCount + stats.phoneCount} fő`, unit: 'walk-in fő',
      color: '#B89530', icon: 'source', series: walkInSeries, deltaPct: stats.sourceTotalDiff,
      views: [
        { id: 'online', label: `Online · ${stats.onlineReservations} fő`, icon: 'online', series: onlineSeries, value: `${stats.onlineReservations} fő` },
        { id: 'walkin', label: `Walk-in · ${stats.walkInCount} fő`, icon: 'walkin', series: walkInSeries, value: `${stats.walkInCount} fő` },
        { id: 'phone', label: `Telefonos · ${stats.phoneCount} fő`, icon: 'phone', series: phoneSeries, value: `${stats.phoneCount} fő` },
      ],
    },
    {
      id: 'cancelled', label: 'Lemondások', value: `${stats.cancelledCount + stats.noShowCount} fő`, unit: 'fő',
      color: '#C0564A', icon: 'cancelled', series: cancelledSeries, deltaPct: stats.cancelledTotalDiff,
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
  }

  // A col2 tetejére 2 grafikon-kártya: óránkénti + heti ÁLLÓ OSZLOP (napi bontás kihagyva).
  const chartCards = [
    { title: 'Heti eloszlás', node: <DowChart key="cc-dow" data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} moneyless embedded /> },
    { title: 'Napszakok', node: <DaypartChart key="cc-daypart" data={stats.byHour} embedded /> },
  ]

  return (
    <div className="p-5 lg:p-0 space-y-6">

      {/* Header — mobilon a cím a globális headerben van, ezért itt csak desktopon */}
      <div className="hidden lg:block">
        <PageHeader eyebrow="Részletes nézet" title="Statisztikák" />
      </div>

      {/* ── Crextio stat-terület: státusz-csík (striped cellával) + nagy KPI-számok ──
          Reveal NÉLKÜL, mint az Áttekintésen — azonnal renderel, a chartok mount-kor animálnak. */}
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills
          eager
          className="flex-1 lg:max-w-[760px]"
          segments={[
            { label: 'Teljesített', pct: completedPct, background: '#1D1C19', color: '#fff' },
            { label: 'Lemondva', pct: cancelledPct, background: '#F1CE45', color: '#1D1C19' },
            { label: 'Nyitott', pct: openPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
          ]}
        />

        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <CountUpKpi icon="check" value={stats.periodReservations} label="Foglalás" />
          <CountUpKpi icon="users" value={stats.periodPax} label="Vendég (pax)" suffix=" fő" />
          <CountUpKpi icon="done" value={stats.completionRate} label="Teljesítés" suffix="%" />
        </div>
      </div>

      {/* Analitika bento — Reveal nélkül, pontosan úgy mint az Áttekintés grafikonjai. */}
      <AnalyticsOverview
        metrics={metrics}
        filter={<PeriodFilter key="period-filter" current={days} basePath="/restaurant/analytics" module="restaurant" csvExport={false} />}
        csvHref={`/api/export-csv?days=${days}&module=restaurant`}
        detailCharts={detailCharts}
        heatmap={heatmap}
        sources={sources}
        chartCards={chartCards}
      />

    </div>
  )
}
