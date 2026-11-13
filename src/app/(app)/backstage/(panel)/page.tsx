import { requireAuth } from '@/lib/auth'
import { Building2, Users, Wallet } from 'lucide-react'
import { Kpi, PageHead, SegmentBar } from '@/components/ui-kit'
import { RingCard, WeekCard } from '@/components/blocks/overview'
import { StatRevenueCard } from '@/components/blocks/stats'
import { OverviewAccordion } from '@/components/shared/OverviewPanels'
import { BsTodoRows, MailStatusCard, MrrCard, RecentAccountsCard } from '@/components/blocks/backstage'
import { loadBackstageData, loadEmailStats, loadRevenueBreakdown } from '@/lib/backstageMetrics'
import { accountTitle, accountVM, daysLeft, monthShort, shortDate, thousands } from '@/lib/backstageView'
import { getPayloadClient } from '@/lib/payload'
import { authQuery, sql } from '@/lib/authDb'
import { DAY_NAMES, MONTHS } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

const WEEK_DAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

/** Backstage › Áttekintő (design B.1): fejléc (fiók-megoszlás, nagy számok), sötét bevétel-kártya, heti regisztrációk,
 *  próbából fizetők, „Figyelj rá” akkordeon, havi bevétel görbéje, legutóbbi előfizetők. */
export default async function BackstagePage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()
  const [d, rev, mails, newMessages, newRefs] = await Promise.all([
    loadBackstageData(),
    loadRevenueBreakdown(),
    loadEmailStats().catch(() => null),
    payload.count({ collection: 'contact-messages', where: { status: { equals: 'new' } }, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0),
    authQuery<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM referrals WHERE created_at > now() - interval '14 days'`).then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
  ])

  const now = new Date()
  const risk = d.pastDueCount + d.pausedCount + d.canceledCount
  const sub = `${DAY_NAMES[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}. · ${d.totalAccounts} fiók · ${d.totalPlaces} üzlet`

  // heti regisztrációk (hétfőtől), a mai nap kiemelve
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const week = WEEK_DAYS.map((label, i) => ({ d: label, v: 0, peak: false, closed: false, i }))
  for (const a of d.accounts) {
    const t = new Date(a.createdAt)
    const idx = Math.floor((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - monday.getTime()) / 86_400_000)
    if (idx >= 0 && idx < 7) week[idx].v += 1
  }
  const todayIdx = (now.getDay() + 6) % 7
  week[todayIdx].peak = true
  const weekTotal = week.reduce((n, x) => n + x.v, 0)

  // havi bevétel görbéje + változás az előző hónaphoz
  const months = rev.monthlyRevenue.slice(-8)
  const mrrNow = months.map((m) => m.total)
  const prevMrr = months.length > 1 ? months[months.length - 2].total : 0
  const delta = prevMrr > 0 ? Math.round(((d.mrr - prevMrr) / prevMrr) * 100) : null
  const revenue = { total: d.mrr, delta, now: mrrNow.length ? mrrNow : [d.mrr], prev: [] as number[], ticks: months.map((m) => monthShort(m.month)), points: months.map((m) => monthShort(m.month)), parts: [] }

  const trialRows = d.expiringTrials.slice(0, 3).map((a) => ({ key: a.ownerId, name: accountTitle(a), meta: `még ${daysLeft(a.sub?.trial_ends_at) ?? 0} nap · ${a.recentBookings} foglalás`, action: 'Megnyitás', href: `/backstage/accounts/${a.ownerId}` }))
  const dueRows = d.pastDueAccounts.slice(0, 3).map((a) => ({ key: a.ownerId, name: accountTitle(a), meta: `${a.sub?.current_period_end ? shortDate(a.sub.current_period_end) : '—'} · ${a.potentialFee.toLocaleString('hu-HU')} Ft`, action: 'Megnyitás', href: `/backstage/accounts/${a.ownerId}` }))
  const dormantRows = d.dormantPlaces.slice(0, 3).map((p) => ({ key: `${p.kind}:${p.id}`, name: p.name, meta: `${p.totalBookings} foglalás összesen`, action: 'Megnyitás', href: `/backstage/salons?place=${p.kind}:${p.id}` }))

  // „Figyelj rá” — az első nem üres sor nyílik ki (üres nyitott sor nem foglal helyet)
  const more = (n: number) => (n > 3 ? { label: 'Mind a Kockázatban ›', href: '/backstage/churn' } : undefined)
  const attention = [
    { label: 'Lejárt fizetés', count: d.pastDueAccounts.length, body: dueRows.length ? <BsTodoRows rows={dueRows} more={more(d.pastDueAccounts.length)} /> : null },
    { label: 'Lejáró próba (14 nap)', count: d.expiringTrials.length, body: trialRows.length ? <BsTodoRows rows={trialRows} more={more(d.expiringTrials.length)} /> : null },
    { label: 'Új üzenet', count: newMessages, body: newMessages ? <BsTodoRows rows={[{ name: `${newMessages} megválaszolatlan üzenet`, meta: 'Kapcsolat-űrlap', action: 'Megnyitás', href: '/backstage/contact' }]} /> : null },
    { label: 'Új ajánlás (14 nap)', count: newRefs, body: newRefs ? <BsTodoRows rows={[{ name: `${newRefs} új ajánlás`, meta: 'Ajánló program', action: 'Megnyitás', href: '/backstage/referrals' }]} /> : null },
    { label: 'Alvó üzlet (30 napja nincs foglalás)', count: d.dormantPlaces.length, body: dormantRows.length ? <BsTodoRows rows={dormantRows} more={more(d.dormantPlaces.length)} /> : null },
  ]

  const recent = [...d.accounts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5).map(accountVM)
  const total = d.payingAccounts + d.trialingCount + risk

  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Áttekintő" sub={sub}
        bar={<SegmentBar segments={[
          { label: 'Fizető', value: String(d.payingAccounts), weight: total ? d.payingAccounts : 34, tone: 'dark' },
          { label: 'Próba', value: String(d.trialingCount), weight: total ? d.trialingCount : 33, tone: 'yellow' },
          { label: 'Kockázat', value: String(risk), weight: total ? Math.max(risk, total * 0.06) : 33, tone: 'hatch' },
        ]} />}
        kpis={<>
          <Kpi icon={Wallet} value={thousands(d.mrr)} label="Havi bevétel" />
          <Kpi icon={Users} value={String(d.totalAccounts)} label="Előfizető fiók" />
          <Kpi icon={Building2} value={String(d.totalPlaces)} label="Üzlet" />
        </>} />
      <div className="grid grid-cols-1 gap-[5px] [&>*]:min-w-0 lg:grid-cols-4">
        <MrrCard mrr={d.mrr} arr={d.arr} paying={d.payingAccounts} conversion={d.conversionRate} arpa={d.arpa} delta={delta != null ? `${delta >= 0 ? '+' : ''}${delta}% az előző hónaphoz` : null} href="/backstage/revenue" />
        <WeekCard title="Regisztrációk" total={weekTotal} unit="ezen a héten" days={week} tag={(v) => `ma ${v}`} />
        <RingCard title="Próbából fizető" sub="fizető / (fizető + próbán)" pct={d.conversionRate} foot={[`${d.payingAccounts} fizető`, `${d.trialingCount} próbán`]} />
        {/* a jobb oszlop a két sor magasságához igazodik (desktopon kitölti, nem nyújtja meg őket) */}
        <div className="relative min-w-0 lg:row-span-2">
          <div className="flex flex-col gap-[5px] lg:absolute lg:inset-0">
            <div className="shrink-0"><OverviewAccordion defaultOpen={Math.max(-1, attention.findIndex((x) => x.count > 0))} items={attention} /></div>
            {mails && <MailStatusCard className="min-h-0 flex-1" href="/backstage/revenue" month={mails.month} last30={mails.last30} all={mails.all}
              delivered={mails.last30 ? Math.round((mails.delivered / mails.last30) * 100) : 0} opened={mails.last30 ? Math.round((mails.opened / mails.last30) * 100) : 0}
              failed={mails.last30 ? Math.round(((mails.failed30 + mails.bounced) / mails.last30) * 100) : 0} />}
          </div>
        </div>
        <StatRevenueCard className="lg:col-span-2" title="Havi bevétel alakulása" revenue={revenue} />
        <RecentAccountsCard rows={recent} allHref="/backstage/accounts" hrefOf={(k) => `/backstage/accounts/${k}`} />
      </div>
    </div>
  )
}
