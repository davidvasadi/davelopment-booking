import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import { getDashboardStats } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { TrendChart, DowChart, ServiceChart, StaffChart, HourChart, DaypartChart } from '@/components/dashboard/DashboardCharts'
import { AnalyticsOverview, type OverviewMetric } from '@/components/dashboard/AnalyticsOverview'
import PeriodFilter from '@/components/dashboard/PeriodFilter'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { Sparkles } from 'lucide-react'

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
  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'analytics.view', '/dashboard')
  const payload = await getPayloadClient()

  const days = VALID_PERIODS.includes(Number(periodParam)) ? Number(periodParam) : 30
  const stats = await getDashboardStats(salon.id, days)

  // ── Statisztika-specifikus, ELEMZŐ jobb-oldali KPI-k — szándékosan MÁST mérnek,
  //    mint az áttekintő (az napi Foglalás/Bevétel/Teljesítés): havi átlagos bevétel
  //    (időszakra vetített futó-ütem) · átlagos foglalás-érték (pénzügyi) · a
  //    legnépszerűbb (legtöbbet foglalt) szolgáltatás neve. ──
  const monthlyAvgRevenue = Math.round((stats.periodRevenue / Math.max(1, days)) * 30)
  const topService = [...stats.byService].sort((a, b) => b.bookings - a.bookings)[0]?.name ?? '—'

  // Idősorok a metrika-diagramokhoz.
  const revenueSeries = stats.trend.map((d) => ({ label: d.label, value: d.revenue }))
  const bookingsSeries = stats.trend.map((d) => ({ label: d.label, value: d.bookings }))

  // ── Crextio „stat bars" — teljesítés/lemondás/hátralévő arány az időszakra ──
  const totalForBar = stats.periodBookings || 1
  const completedPct = Math.min(100, stats.completionRate)
  const cancelledPct = Math.min(100 - completedPct, Math.round((stats.cancelledCount / totalForBar) * 100))
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

  const metrics: OverviewMetric[] = [
    {
      id: 'revenue', label: 'Bevétel', value: formatPrice(stats.periodRevenue, 'HUF'), unit: 'Ft',
      deltaPct: stats.periodRevenueDiff, color: '#1D1C19', icon: 'revenue', series: revenueSeries,
      views: [
        { id: 'trend', label: 'Bevétel alakulása', icon: 'trend', target: 'trend' },
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'bookings', label: 'Foglalások', value: String(stats.periodBookings), unit: 'foglalás',
      deltaPct: stats.periodBookingsDiff, color: '#1D1C19', icon: 'bookings', series: bookingsSeries,
      views: [
        { id: 'trend', label: 'Foglalások alakulása', icon: 'trend', target: 'trend' },
        { id: 'hour', label: 'Óránkénti forgalom', icon: 'hour', target: 'hour' },
        { id: 'dow', label: 'Heti eloszlás', icon: 'dow', target: 'dow' },
      ],
    },
    {
      id: 'completion', label: 'Teljesítés', value: `${stats.completionRate}%`, unit: '',
      color: '#1D9D63', icon: 'completion', series: bookingsSeries, deltaPct: stats.completionRateDiff,
      views: [
        ...(stats.byService.length ? [{ id: 'service', label: 'Szolgáltatások', icon: 'service', target: 'service' }] : []),
        ...(stats.byStaff.length ? [{ id: 'staff', label: 'Munkatársak', icon: 'staff', target: 'staff' }] : []),
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
      id: 'cancelled', label: 'Lemondások', value: String(stats.cancelledCount), unit: 'foglalás',
      color: '#C0564A', icon: 'cancelled', series: stats.cancelledTrend, deltaPct: stats.cancelledCountDiff,
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

  // A col2 tetejére 2 grafikon-kártya: heti ÁLLÓ OSZLOP + (szolgáltatás-összetétel,
  // ha van; különben napszak-bontás — az óra×nap hőtérkép már mutatja az órákat).
  const chartCards = [
    { title: 'Heti eloszlás', node: <DowChart key="cc-dow" data={stats.byDayOfWeek} period={stats.period} rawDays={stats.trend} embedded /> },
    stats.byService.length
      ? { title: 'Szolgáltatások', node: <ServiceChart key="cc-service" data={stats.byService} period={stats.period} embedded /> }
      : { title: 'Napszakok', node: <DaypartChart key="cc-daypart" data={stats.byHour} embedded /> },
  ]

  return (
    <div className="p-5 lg:p-0 space-y-6">

      {/* Header — mobilon a cím a globális headerben van, ezért itt csak desktopon */}
      <div className="hidden lg:block">
        <PageHeader eyebrow="Részletes nézet" title="Statisztikák" />
      </div>

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
          {/* Legnépszerűbb szolgáltatás — NÉV, nem szám: a KPI-ritmust követi, de kisebb
              betűvel + truncate, hogy hosszú név se lógjon ki. */}
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-6 w-6 shrink-0 text-ink-soft" strokeWidth={1.6} />
              <div className="max-w-[190px] truncate text-2xl lg:text-[26px] font-light leading-none tracking-[-0.02em] text-ink">
                {topService}
              </div>
            </div>
            <div className="mt-1.5 text-[13px] font-medium text-ink-soft">Legnépszerűbb szolgáltatás</div>
          </div>
        </div>
      </div>

      {/* Áttekintés — kártya → nagy grafikon vált; részlet-sor → a lenti grafikon a slotban vált.
          Reveal nélkül, pontosan úgy mint az Áttekintés grafikonjai (azonnal renderel). */}
      <AnalyticsOverview
        metrics={metrics}
        filter={<PeriodFilter current={days} csvExport={false} />}
        csvHref={`/api/export-csv?days=${days}`}
        detailCharts={detailCharts}
        heatmap={heatmap}
        sources={sources}
        chartCards={chartCards}
      />

    </div>
  )
}
