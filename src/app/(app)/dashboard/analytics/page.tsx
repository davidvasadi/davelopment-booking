import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { findMyStaffId } from '@/lib/myStaffLink'
import { getDashboardStats } from '@/lib/dashboardStats'
import { getReviewSummary } from '@/lib/reviews'
import { daypartBuckets } from '@/lib/daypartBuckets'
import { formatPrice } from '@/lib/utils'
import { TrendChart, DowChart, ServiceChart, StaffChart, HourChart, DaypartChart, PopularServicesChart } from '@/components/dashboard/DashboardCharts'
import { AnalyticsOverview, type OverviewMetric } from '@/components/dashboard/AnalyticsOverview'
import { buildPeriodInfo } from '@/lib/periodInfo'
import { AnalyticsScopeToggle } from '@/components/dashboard/AnalyticsScopeToggle'
import { WeekMiniBars, WeekDayLabels, type WeekBar } from '@/components/shared/OverviewCharts'
import { DateRangeFilter } from '@/components/dashboard/DateRangeFilter'
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

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; scope?: string }>
}) {
  const { period: periodParam, from: fromParam, to: toParam, scope: scopeParam } = await searchParams
  const { salon, capabilities, userId, userEmail } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['analytics.view', 'analytics.view.own'], '/dashboard')

  let days = VALID_PERIODS.includes(Number(periodParam)) ? Number(periodParam) : 30
  let range: { dateFrom: string; dateTo: string } | undefined
  if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
    // Cap end date at today
    const today = new Date().toISOString().slice(0, 10)
    range = { dateFrom: fromParam, dateTo: toParam > today ? today : toParam }
  }

  // `analytics.view` hiányában (csak `.own`) a nézet MINDIG a bejelentkezett szakember SAJÁT
  // foglalásaira/bevételére szűkül — a `findMyStaffId` elsődlegesen a `Staff.user` relációt
  // nézi (megbízható), email-fallbackkel. Akinek VAN teljes `analytics.view`-ja (tulaj,
  // üzletvezető), az egy váltóval (`?scope=own`) IS átválthat a saját munkájára.
  const hasFullView = can(capabilities, 'analytics.view')
  const isOwnScope = !hasFullView || scopeParam === 'own'
  // FONTOS: ha nincs saját staff-rekord (pl. a tulaj sose vette fel magát szakembernek), a
  // `staffId` NEM maradhat undefined — a `getDashboardStats` üres szűrőt épít undefined-ra, ami
  // a TELJES üzleti adatot adná vissza. Helyette egy sosem-egyező, NUMERIKUS sentinelt (0) adunk
  // át — a `staff_id` oszlop numerikus, egy string sentinel NaN-re castolva eldobatta a lekérdezést.
  const staffId = isOwnScope ? (await findMyStaffId(salon.id, userId, userEmail)) ?? 0 : undefined

  const stats = await getDashboardStats(salon.id, days, range, staffId)
  // A review-mérőszám csak a TELJES cégnézetben jelenik meg — nincs megbízható mód arra, hogy
  // egy adott szakemberhez kössünk egy értékelést, ezért a saját (own-scope) nézetben kihagyjuk.
  const reviewSummary = isOwnScope ? null : await getReviewSummary('salon', salon.id)

  // ── Statisztika-specifikus, ELEMZŐ jobb-oldali KPI-k — szándékosan MÁST mérnek,
  //    mint az áttekintő (az napi Foglalás/Bevétel/Teljesítés): havi átlagos bevétel
  //    (időszakra vetített futó-ütem) · átlagos foglalás-érték (pénzügyi). ──
  const monthlyAvgRevenue = Math.round((stats.periodRevenue / Math.max(1, days)) * 30)

  // Idősorok a metrika-diagramokhoz.
  const revenueSeries = stats.trend.map((d) => ({ label: d.label, value: d.revenue }))
  const bookingsSeries = stats.trend.map((d) => ({ label: d.label, value: d.bookings }))
  // Az előző, azonos hosszúságú időszak VALÓDI napi sora — a sidebar „Előző” görbéjéhez
  const prevRevenueSeries = stats.prevTrend.map((d) => ({ label: d.label, value: d.revenue }))
  const prevBookingsSeries = stats.prevTrend.map((d) => ({ label: d.label, value: d.bookings }))
  const periodInfo = buildPeriodInfo(periodLabel(days), stats.periodRange)

  // ── Crextio „stat bars" — teljesítés/lemondás/hátralévő arány az időszakra ──
  const totalForBar = stats.periodBookings || 1
  const completedPct = Math.min(100, stats.completionRate)
  const cancelledPct = Math.min(100 - completedPct, Math.round(((stats.cancelledCount + stats.noShowCount) / totalForBar) * 100))
  const openPct = Math.max(0, 100 - completedPct - cancelledPct)

  // ── Nap×óra hőtérkép (10..22h) — a szalonnál nincs per-nap-óra kereszt, ezért a
  //    heti eloszlás (byDayOfWeek) × óra-profil (byHour) külső szorzatával közelít. ──
  const HM_HOURS = Array.from({ length: 13 }, (_, i) => i + 10)
  const hourProfileMap: Record<number, number> = {}
  for (const h of stats.byHour) hourProfileMap[parseInt(h.hour, 10)] = h.bookings
  const dowWeights = stats.byDayOfWeek.map((d) => d.bookings)
  const hmGrid = dowWeights.map((dw) => HM_HOURS.map((h) => dw * (hourProfileMap[h] ?? 0)))
  let hmPeakDay = 0, hmPeakHour = HM_HOURS[0], hmBest = -1
  hmGrid.forEach((row, di) => row.forEach((v, hi) => { if (v > hmBest) { hmBest = v; hmPeakDay = di; hmPeakHour = HM_HOURS[hi] } }))
  const heatmap = { grid: hmGrid, hours: HM_HOURS, peakDayIdx: hmPeakDay, peakHour: hmPeakHour }

  // ── Forrás-/státusz-csík: teljesített / lemondott / nyitott (%) ──
  const sources = [
    { label: 'Teljesített', value: `${completedPct}%`, pct: completedPct, variant: 'ink' as const },
    { label: 'Lemondva', value: `${cancelledPct}%`, pct: cancelledPct, variant: 'gold' as const },
    { label: 'Nyitott', value: `${openPct}%`, pct: openPct, variant: 'striped' as const },
  ]

  const reviewMetric: OverviewMetric | null = reviewSummary
    ? {
        id: 'reviews', label: 'Értékelések', value: reviewSummary.count > 0 ? reviewSummary.average.toFixed(1) : '—', unit: '★',
        color: '#B89530', icon: 'reviews', series: [],
        views: reviewSummary.count > 0
          ? [
              {
                id: 'distribution', label: `Csillag-eloszlás · ${reviewSummary.count} értékelés`, icon: 'reviews',
                series: [1, 2, 3, 4, 5].map((n) => ({ label: `${n}★`, value: reviewSummary.distribution[n - 1] })),
                value: `${reviewSummary.count} értékelés`,
              },
            ]
          : [],
      }
    : null

  const metrics: OverviewMetric[] = [
    {
      id: 'revenue', label: 'Bevétel', value: formatPrice(stats.periodRevenue, 'HUF'), unit: 'Ft',
      deltaPct: stats.periodRevenueDiff, color: '#1D1C19', icon: 'revenue', series: revenueSeries,
      prevSeries: prevRevenueSeries, prevValue: formatPrice(stats.prevPeriodRevenue, 'HUF'),
      views: [
        { id: 'trend', label: 'Bevétel alakulása', icon: 'trend', target: 'trend' },
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'bookings', label: 'Foglalások', value: String(stats.periodBookings), unit: 'foglalás',
      deltaPct: stats.periodBookingsDiff, color: '#1D1C19', icon: 'bookings', series: bookingsSeries,
      prevSeries: prevBookingsSeries, prevValue: `${stats.prevPeriodBookings} foglalás`,
      views: [
        { id: 'trend', label: 'Foglalások alakulása', icon: 'trend', target: 'trendBookings' },
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'completion', label: 'Teljesítés', value: `${stats.completionRate}%`, unit: '',
      color: '#1D9D63', icon: 'completion', series: bookingsSeries, deltaPct: stats.completionRateDiff,
      views: [
        ...(stats.byService.length ? [{ id: 'service', label: 'Szolgáltatások', icon: 'service', target: 'service' }] : []),
        ...(stats.byService.length ? [{ id: 'popular', label: 'Legnépszerűbb szolgáltatások', icon: 'popular', target: 'popular' }] : []),
        ...(!isOwnScope && stats.byStaff.length ? [{ id: 'staff', label: 'Munkatársak', icon: 'staff', target: 'staff' }] : []),
      ],
    },
    {
      id: 'avg', label: 'Átl. érték', value: formatPrice(stats.avgBookingValue, 'HUF'), unit: 'Ft',
      color: '#B89530', icon: 'avg', series: revenueSeries, deltaPct: stats.avgBookingValueDiff,
      views: [
        { id: 'trend', label: 'Bevétel alakulása', icon: 'trend', target: 'trend' },
        ...(stats.byService.length ? [{ id: 'service', label: 'Szolgáltatások', icon: 'service', target: 'service' }] : []),
      ],
    },
    {
      id: 'cancelled', label: 'Lemondások', value: `${stats.cancelledCount + stats.noShowCount}`, unit: 'foglalás',
      color: '#C0564A', icon: 'cancelled', series: stats.cancelledTrend, deltaPct: stats.cancelledTotalDiff,
      views: [
        { id: 'cancel', label: `Lemondva · ${stats.cancelledCount} foglalás`, icon: 'cancelled', series: stats.cancelledTrend, value: String(stats.cancelledCount) },
        { id: 'noshow', label: `Nem jött meg · ${stats.noShowCount} foglalás`, icon: 'noshow', series: stats.noShowTrend, value: String(stats.noShowCount) },
        { id: 'trend', label: 'Foglalások alakulása', icon: 'trend', target: 'trendBookings' },
      ],
    },
    {
      id: 'returning', label: 'Visszatérő vendégek', value: `${stats.returningGuestPct.toLocaleString('hu-HU')}%`, unit: '%',
      color: '#1D9D63', icon: 'returning', series: stats.returningGuestTrend, deltaPct: stats.returningGuestPctDiff,
      views: [
        { id: 'new', label: `Új vendégek · ${stats.newGuestCount} fő`, icon: 'newguest', series: stats.newGuestTrend, value: `${stats.newGuestCount} fő` },
        { id: 'returning', label: `Visszatérő · ${stats.returningGuestCount} fő`, icon: 'returning', series: stats.returningGuestTrend, value: `${stats.returningGuestCount} fő` },
      ],
    },
    {
      id: 'leadtime', label: 'Átlagos előrefoglalás', value: `${stats.avgLeadDays} nap előre`, unit: 'nap',
      color: '#B89530', icon: 'leadtime', series: stats.leadTrend, deltaPct: stats.avgLeadDaysDiff,
      views: [
        { id: 'buckets', label: 'Mikor foglalnak', icon: 'dow', series: stats.leadBuckets, value: `${stats.periodBookings} foglalás` },
      ],
    },
    ...(reviewMetric ? [reviewMetric] : []),
  ]

  const detailCharts: Record<string, React.ReactNode> = {
    trend: <TrendChart key="trend" data={stats.trend} period={stats.period} embedded />,
    // "Foglalások alakulása" nézetekhez (bookings/cancelled) — a `trend` a Bevétel-fülre
    // van hangolva alapból, ide egy külön, bookings-fülre nyíló példány kell, különben a
    // sub-view "Foglalások alakulása" címkével pénz-adatot (Ft, "8e" Y-tengely) mutatna.
    trendBookings: <TrendChart key="trend-bookings" data={stats.trend} period={stats.period} embedded defaultTab="bookings" />,
    hour: <HourChart key="hour" data={stats.byHour} period={stats.period} rawDays={stats.trend} embedded />,
    dow: <DowChart key="dow" data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} embedded />,
    service: stats.byService.length ? <ServiceChart key="service" data={stats.byService} period={stats.period} embedded /> : null,
    staff: stats.byStaff.length ? <StaffChart key="staff" data={stats.byStaff} period={stats.period} embedded /> : null,
    popular: stats.byService.length ? <PopularServicesChart key="popular" data={stats.byService} embedded /> : null,
  }

  // A col2 tetejére 2 grafikon-kártya: heti ÁLLÓ OSZLOP + (szolgáltatás-összetétel,
  // ha van; különben napszak-bontás — az óra×nap hőtérkép már mutatja az órákat). A kompakt
  // kártya-nézet ugyanazt a pont+szaggatott-vonal stílust kapja, mint az Áttekintésen (a teljes
  // recharts-verzió a `dow`/`hour` detailCharts alatt marad, a sidebar-részletnézethez).
  const DOW_SHORT3: Record<string, string> = {
    'Hétfő': 'Hét', 'Kedd': 'Ked', 'Szerda': 'Sze', 'Csütörtök': 'Csü', 'Péntek': 'Pén', 'Szombat': 'Szo', 'Vasárnap': 'Vas',
  }
  const dowBarsRaw: WeekBar[] = stats.byDayOfWeek.map((d) => ({ label: DOW_SHORT3[d.day] ?? d.day, value: d.bookings }))
  const dowMax = Math.max(1, ...dowBarsRaw.map((b) => b.value))
  const dowBars = dowBarsRaw.map((b) => ({ ...b, peak: b.value === dowMax && b.value > 0 }))

  const daypartRows = daypartBuckets(stats.byHour)
  const daypartBarsRaw: WeekBar[] = daypartRows.map((p) => ({ label: p.label, value: p.bookings }))
  const daypartMax = Math.max(1, ...daypartBarsRaw.map((b) => b.value))
  const daypartBars = daypartBarsRaw.map((b) => ({ ...b, peak: b.value === daypartMax && b.value > 0 }))

  const chartCards = [
    {
      title: 'Heti eloszlás',
      node: (
        <div className="flex h-full flex-1 flex-col justify-end">
          <WeekMiniBars bars={dowBars} weekMax={dowMax} unit="foglalás" />
          <WeekDayLabels bars={dowBars} />
        </div>
      ),
    },
    stats.byService.length
      ? { title: 'Szolgáltatások', node: <ServiceChart key="cc-service" data={stats.byService} period={stats.period} embedded /> }
      : {
          title: 'Napszakok',
          node: (
            <div className="flex h-full flex-1 flex-col justify-end">
              <WeekMiniBars bars={daypartBars} weekMax={daypartMax} unit="foglalás" />
              <WeekDayLabels bars={daypartBars} />
            </div>
          ),
        },
  ]

  return (
    <div className="p-5 lg:p-0 space-y-6">

      <PageHeader
        eyebrow={isOwnScope ? 'Saját nézet' : 'Részletes nézet'}
        title={isOwnScope ? 'Saját statisztika' : 'Statisztikák'}
        description={isOwnScope ? 'A saját foglalásaid és bevételed — nem a teljes üzleté.' : undefined}
      />

      {/* ── Crextio stat-terület: státusz-csík (striped cellával) + nagy KPI-számok ── */}
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
          <CountUpKpi icon="wallet" value={monthlyAvgRevenue} label="Havi átl. bevétel" suffix=" Ft" group />
          <CountUpKpi icon="gauge" value={stats.avgBookingValue} label="Átl. foglalás-érték" suffix=" Ft" group />
        </div>
      </div>

      {/* Áttekintés — kártya → nagy grafikon vált; részlet-sor → a lenti grafikon a slotban vált.
          Reveal nélkül, pontosan úgy mint az Áttekintés grafikonjai (azonnal renderel). */}
      <AnalyticsOverview
        metrics={metrics}
        periodInfo={periodInfo}
        filter={
          <>
            {hasFullView && (
              <AnalyticsScopeToggle
                basePath="/dashboard/analytics"
                scope={isOwnScope ? 'own' : 'business'}
                period={days}
                from={range?.dateFrom}
                to={range?.dateTo}
              />
            )}
            <DateRangeFilter basePath="/dashboard/analytics" />
          </>
        }
        csvHref={
          range
            ? `/api/export-csv?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`
            : `/api/export-csv?days=${days}`
        }
        detailCharts={detailCharts}
        heatmap={heatmap}
        sources={sources}
        chartCards={chartCards}
      />
    </div>
  )
}
