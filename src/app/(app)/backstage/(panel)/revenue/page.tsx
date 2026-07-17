import { requireAuth } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { AnalyticsOverview, type OverviewMetric } from '@/components/dashboard/AnalyticsOverview'
import { SectionPanel } from '@/components/backstage/BackstageUi'
import { loadBackstageData, loadRevenueBreakdown } from '@/lib/backstageMetrics'
import { StatusDonut, MrrLineChart } from '@/components/backstage/BackstageCharts'

export const dynamic = 'force-dynamic'

/** Retenció-arány → tint (heat). */
function retentionTint(pct: number): string {
  if (pct >= 80) return 'bg-ok-bg text-ok'
  if (pct >= 50) return 'bg-warn-bg text-warn'
  return 'bg-bad-bg text-bad'
}

export default async function RevenuePage() {
  await requireAuth('admin')
  const [d, rev] = await Promise.all([loadBackstageData(), loadRevenueBreakdown()])

  // Státusz-csík: fizető / próba / kockázat megoszlás (mint a Statisztikán a teljesített/lemondva/nyitott).
  const total = d.activeCount + d.trialingCount + d.pastDueCount + d.canceledCount + d.pausedCount || 1
  const payingPct = Math.round((d.activeCount / total) * 100)
  const trialPct = Math.round((d.trialingCount / total) * 100)
  const riskPct = Math.max(0, 100 - payingPct - trialPct)

  // Az AnalyticsOverview metrikái — a bento-motor ezekből építi a teljes statisztika-elrendezést.
  const metrics: OverviewMetric[] = [
    {
      id: 'revenue', label: 'Havi bevétel (MRR)', value: `${Math.round(d.mrr).toLocaleString('hu-HU')} Ft`, unit: 'Ft',
      deltaPct: undefined, color: '#1D1C19', icon: 'revenue', series: d.mrrTrend,
      views: [{ id: 'trend', label: 'MRR alakulása', icon: 'trend', series: d.mrrTrend }],
    },
    {
      id: 'accounts', label: 'Előfizetők', value: String(d.totalAccounts), unit: 'fiók',
      color: '#1D1C19', icon: 'reservations', series: d.accountsTrend,
      views: [{ id: 'trend', label: 'Fiókok alakulása', icon: 'dow', series: d.accountsTrend }],
    },
    {
      id: 'completion', label: 'Trial → fizető', value: `${rev.conversionRate}%`, unit: '%',
      color: '#1D9D63', icon: 'completion', series: d.accountsTrend,
      views: [],
    },
    {
      id: 'bookings', label: 'Foglalások', value: d.totalBookings.toLocaleString('hu-HU'), unit: 'foglalás',
      color: '#8A6D12', icon: 'bookings', series: d.bookingsTrend,
      views: [{ id: 'trend', label: 'Foglalások alakulása', icon: 'trend', series: d.bookingsTrend }],
    },
  ]

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <div className="hidden lg:block">
        <PageHeader eyebrow="Platform-bevétel" title="Bevétel & kohorsz" />
      </div>

      {/* Státusz-csík + 3 nagy KPI (mint a Statisztika hero) */}
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills
          eager
          className="flex-1 lg:max-w-[760px]"
          segments={[
            { label: 'Fizető', pct: payingPct, background: '#1D1C19', color: '#fff' },
            { label: 'Próba', pct: trialPct, background: '#F1CE45', color: '#1D1C19' },
            { label: 'Kockázat', pct: riskPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
          ]}
        />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <CountUpKpi icon="wallet" value={Math.round(d.mrr)} label="Havi bevétel" suffix=" Ft" group />
          <CountUpKpi icon="wallet" value={Math.round(rev.ltv)} label="Élettartam-érték" suffix=" Ft" group />
          <CountUpKpi icon="done" value={rev.conversionRate} label="Konverzió" suffix="%" />
        </div>
      </div>

      {/* A statisztika-bento motor a saját bevétel-metrikáinkkal + valós diagramok a col2 tetejére */}
      <AnalyticsOverview
        metrics={metrics}
        filter={<span key="none" className="text-[12px] text-ink-soft">Platform összesített</span>}
        sources={[
          { label: 'Aktív', value: String(rev.activeCount), pct: rev.activeCount, variant: 'ink' },
          { label: 'Próba', value: String(rev.trialingCount), pct: rev.trialingCount, variant: 'gold' },
          { label: 'Lejárt', value: String(rev.pastDueCount), pct: rev.pastDueCount, variant: 'striped' },
          { label: 'Lemondott', value: String(rev.canceledCount), pct: rev.canceledCount, variant: 'outline' },
        ]}
        chartCards={[
          {
            // NEM a státusz-megoszlás (azt a bal oldali sötét „Foglalási arány" donut már mutatja) —
            // itt a bevétel ÜZLET-TÍPUS szerinti bontása (szalon vs étterem), ami eltérő, hasznos adat.
            title: 'Bevétel típusonként',
            node: (
              <StatusDonut
                vertical
                unit=" Ft"
                data={[
                  { label: 'Szalon', value: rev.salonMrr, color: '#F1CE45' },
                  { label: 'Étterem', value: rev.restaurantMrr, color: '#1D1C19' },
                ]}
              />
            ),
          },
          { title: 'Foglalások alakulása', node: <MrrLineChart trend={d.bookingsTrend} unit=" foglalás" /> },
        ]}
      />

      {/* Kohorsz-retenció — mélyebb tartalom a bento alatt */}
      <SectionPanel title="Kohorsz-retenció (regisztráció hónapja szerint)">
        {rev.cohorts.length === 0 ? (
          <p className="px-5 py-8 text-[13.5px] text-ink-soft">Még nincs elég fiók a kohorsz-elemzéshez.</p>
        ) : (
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left">
                  {['Kohorsz', 'Fiókok', 'Még aktív', 'Retenció'].map(h => (
                    <th key={h} className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rev.cohorts.map(c => (
                  <tr key={c.month} className="border-t border-line">
                    <td className="py-2.5 pr-4 font-medium text-ink">{c.month}</td>
                    <td className="py-2.5 pr-4 text-ink-soft">{c.size}</td>
                    <td className="py-2.5 pr-4 text-ink">{c.retained}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${retentionTint(c.retentionPct)}`}>
                        {c.retentionPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionPanel>
    </div>
  )
}
