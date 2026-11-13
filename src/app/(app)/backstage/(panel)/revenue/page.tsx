import { requireAuth } from '@/lib/auth'
import { CreditCard, TrendingUp, Wallet } from 'lucide-react'
import { Kpi, PageHead, SegmentBar } from '@/components/ui-kit'
import { StatRevenueCard } from '@/components/blocks/stats'
import { CohortTable, EmailHealthCard, EmailVolumeCard, MonthlyTable, RevenueMixCard } from '@/components/blocks/backstage'
import { loadBackstageData, loadEmailHealth, loadEmailStats, loadRevenueBreakdown } from '@/lib/backstageMetrics'
import { dayTime, emailErrorHu, emailTypeLabel, monthName, monthShort, shortDate, thousands } from '@/lib/backstageView'
import { BS_TIER, type BsTier } from '@/components/blocks/backstage'

export const dynamic = 'force-dynamic'

const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

/** Backstage › Bevétel (design B.7): havi bevétel görbéje, miből jön, havonta, kohorsz, e-mail kézbesítés. */
export default async function RevenuePage() {
  await requireAuth('admin')
  const [d, rev, mails, email] = await Promise.all([
    loadBackstageData(),
    loadRevenueBreakdown(),
    loadEmailStats().catch(() => null),
    // best-effort: egy hiba itt ne vigye el az oldalt, és ne mutasson hamis „100%”-ot
    loadEmailHealth().catch(() => ({ total30d: 0, failed30d: 0, successRatePct: 100, recentFailures: [], loadFailed: true })),
  ])
  const risk = d.pastDueCount + d.pausedCount + d.canceledCount
  const total = d.payingAccounts + d.trialingCount + risk
  const months = rev.monthlyRevenue
  const delta = months.length > 1 && months[months.length - 2].total > 0 ? Math.round(((d.mrr - months[months.length - 2].total) / months[months.length - 2].total) * 100) : null
  const revenue = { total: d.mrr, delta, now: months.length ? months.map((m) => m.total) : [d.mrr], prev: [] as number[], ticks: months.map((m) => monthShort(m.month)), points: months.map((m) => monthShort(m.month)), parts: [] }

  // csomag szerinti bontás a fizető fiókokból
  const tiers = (['starter', 'pro', 'egyedi'] as BsTier[]).map((t) => {
    const accs = d.accounts.filter((a) => a.status === 'active' && a.tier === t)
    const sum = accs.reduce((n, a) => n + a.mrr, 0)
    return [`${BS_TIER[t]} · ${accs.length} fiók`, thousands(sum), pct(sum, d.mrr)] as [string, string, number]
  })
  const activeSalons = d.accounts.filter((a) => a.status === 'active').reduce((n, a) => n + a.salonCount, 0)
  const activeRests = d.accounts.filter((a) => a.status === 'active').reduce((n, a) => n + a.restaurantCount, 0)

  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Bevétel" sub="Szalon + étterem · a fizető fiókok díjából"
        bar={<SegmentBar segments={[
          { label: 'Fizető', value: String(d.payingAccounts), weight: total ? d.payingAccounts : 34, tone: 'dark' },
          { label: 'Próba', value: String(d.trialingCount), weight: total ? d.trialingCount : 33, tone: 'yellow' },
          { label: 'Kockázat', value: String(risk), weight: total ? Math.max(risk, total * 0.06) : 33, tone: 'hatch' },
        ]} />}
        kpis={<><Kpi icon={Wallet} value={thousands(d.mrr)} label="Havi bevétel" /><Kpi icon={TrendingUp} value={thousands(rev.ltv)} label="Élettartam-érték" /><Kpi icon={CreditCard} value={`${d.conversionRate}%`} label="Próbából fizető" /></>} />
      <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 lg:grid-cols-3">
        <StatRevenueCard className="lg:col-span-2" title="Havi bevétel alakulása" revenue={revenue} />
        <RevenueMixCard
          kinds={[[`Szalon · ${activeSalons} üzlet`, thousands(d.salonMrr), pct(d.salonMrr, d.mrr)], [`Étterem · ${activeRests} üzlet`, thousands(d.restaurantMrr), pct(d.restaurantMrr, d.mrr)]]}
          tiers={tiers} className="h-full" />
        {mails
          ? <EmailVolumeCard className="lg:col-span-2" month={mails.month} last30={mails.last30} all={mails.all} delivered={mails.delivered} opened={mails.opened} bounced={mails.bounced}
              daily={mails.daily.map((x) => x.n)} prevDaily={mails.prevDaily} points={mails.daily.map((x) => shortDate(x.day))} byType={mails.byType.map((t) => [emailTypeLabel(t.type), t.n] as [string, number])} />
          : <div className="lg:col-span-2" />}
        <div className="flex min-w-0 flex-col gap-[5px]">
          <MonthlyTable rows={[...months].reverse().map((m) => [monthName(m.month), m.total, m.newCount] as [string, number, number])} />
          <CohortTable rows={rev.cohorts.map((c) => [monthName(c.month), c.size, c.retained] as [string, number, number])} />
          <EmailHealthCard total={email.total30d} failed={email.failed30d} rate={email.successRatePct} loadFailed={!!email.loadFailed}
            failures={email.recentFailures.map((f, i) => ({ key: String(i), type: emailTypeLabel(f.type), to: f.to, error: emailErrorHu(f.error), when: dayTime(f.createdAt) }))} />
        </div>
      </div>
    </div>
  )
}
