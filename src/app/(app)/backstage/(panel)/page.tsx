import { requireAuth, getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { AlertTriangle, Clock, Users, CreditCard, CalendarCheck, TrendingUp, Store, Activity, ArrowRight, Building2, Percent } from 'lucide-react'
import { loadBackstageData } from '@/lib/backstageMetrics'
import { CARD, HeroKpi } from '@/components/dashboard/overview-ui'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { formatHuf } from '@/components/backstage/BackstageUi'
import { BackstageTrendCard } from '@/components/backstage/BackstageTrendCard'
import { StatusDonut } from '@/components/backstage/BackstageCharts'
import RecentAccountsClient from './RecentAccountsClient'

export const dynamic = 'force-dynamic'

export default async function BackstagePage() {
  await requireAuth('admin')
  const [user, d] = await Promise.all([getCurrentUser(), loadBackstageData()])

  const hour = new Date().getHours()
  const greeting = hour < 10 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'

  // Előfizetés-státusz megoszlás a státusz-csíkhoz (mint az étterem confirmed/pending/cancelled).
  const subTotal = d.activeCount + d.trialingCount + d.pastDueCount + d.canceledCount + d.pausedCount || 1
  const activePct = Math.round((d.activeCount / subTotal) * 100)
  const trialPct = Math.round((d.trialingCount / subTotal) * 100)
  const riskPct = Math.round(((d.pastDueCount + d.canceledCount + d.pausedCount) / subTotal) * 100)

  const recentAccounts = [...d.accounts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
    .map(a => ({
      ownerId: a.ownerId, email: a.owner.email, name: a.owner.name, status: a.status,
      mrr: a.mrr, placeCount: a.placeCount, salonCount: a.salonCount, restaurantCount: a.restaurantCount, createdAt: a.createdAt,
    }))

  const riskCount = d.pastDueCount + d.expiringTrials.length

  return (
    <div className="space-y-6 p-5 lg:p-0">
      {/* ── HERO: köszönés + cím + akció (mint a dashboardon) ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[15px] text-ink-soft">{greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''},</p>
          <h1 className="mt-0.5 text-4xl font-light leading-[1.05] tracking-[-0.02em] text-ink lg:text-[46px]">Backstage</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/backstage/accounts" className="inline-flex h-[52px] items-center gap-2 rounded-dav-pill bg-ink-dark px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            <Users className="h-4 w-4 text-gold" strokeWidth={2.2} /> Előfizetők
          </Link>
        </div>
      </div>

      {/* ── STÁTUSZ-CSÍK (bal) + HeroKpi klaszter (jobb) ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills
          eager
          className="flex-1 lg:max-w-[720px]"
          segments={[
            { label: 'Fizető', pct: activePct, background: '#1D1C19', color: '#fff' },
            { label: 'Próba', pct: trialPct, background: '#F1CE45', color: '#1D1C19' },
            { label: 'Kockázat', pct: riskPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
          ]}
        />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <HeroKpi icon={CreditCard} value={formatHuf(d.mrr)} label="Havi bevétel (MRR)" />
          <HeroKpi icon={Users} value={String(d.totalAccounts)} label="Előfizető fiók" />
          <HeroKpi icon={Building2} value={String(d.totalPlaces)} label="Üzlet" />
        </div>
      </div>

      {/* ── Alert-sáv (ha van kockázat) — üveges kártya, ikon-badge + tiszta nyíl-gomb ── */}
      {(d.pastDueCount > 0 || d.expiringTrials.length > 0) && (
        <div className="grid gap-[5px] sm:grid-cols-2">
          {d.pastDueCount > 0 && (
            <Link href="/backstage/subscriptions?status=past_due" className={`group dav-hover-lift flex items-center gap-3 rounded-[20px] p-4 ${CARD}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bad-bg text-bad">
                <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{d.pastDueCount} fiók lejárt fizetéssel</p>
                <p className="text-[12px] text-ink-soft">Azonnali teendő — nézd át az előfizetéseket</p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-soft transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          )}
          {d.expiringTrials.length > 0 && (
            <Link href="/backstage/churn" className={`group dav-hover-lift flex items-center gap-3 rounded-[20px] p-4 ${CARD}`}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warn-bg text-warn">
                <Clock className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">{d.expiringTrials.length} próba jár le 14 napon belül</p>
                <p className="text-[12px] text-ink-soft">Kövesd a lejáró próbaidőszakokat</p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-soft transition-transform group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          )}
        </div>
      )}

      {/* ── BENTO (Crextio) — 3 oszlop: bal MRR-rail, közép trend-kártyák, jobb legutóbbi fiókok ── */}
      <div className="grid grid-cols-1 gap-[5px] lg:grid-cols-[300px_minmax(0,1.5fr)_minmax(0,1.05fr)] lg:items-stretch">

        {/* COL1: MRR sötét kártya + üzleti egészség rail */}
        <div className="flex flex-col gap-[5px]">
          <div className="relative shrink-0 overflow-hidden rounded-[26px] bg-ink-dark p-[22px] text-white shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)]">
            <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-gold/20 blur-2xl" />
            <p className="text-[12px] font-medium text-white/50">Havi visszatérő bevétel</p>
            <p className="mt-2 text-[40px] font-light leading-none tracking-[-0.02em]">
              {Math.round(d.mrr).toLocaleString('hu-HU')}<span className="ml-1 text-[17px] font-medium text-gold">Ft</span>
            </p>
            <p className="mt-2 text-[12.5px] text-white/60">{formatHuf(d.arr)} / év vetítve</p>
            <div className="mt-5 flex items-center gap-6 border-t border-white/10 pt-4">
              <div><p className="text-[19px] font-light">{d.payingAccounts}</p><p className="text-[11px] text-white/45">fizető</p></div>
              <div><p className="text-[19px] font-light">{d.conversionRate}%</p><p className="text-[11px] text-white/45">konverzió</p></div>
              <div><p className="text-[19px] font-light text-gold">{d.arpa > 0 ? Math.round(d.arpa / 1000) + 'k' : '0'}</p><p className="text-[11px] text-white/45">átlag/fiók</p></div>
            </div>
          </div>

          <div className={`${CARD} flex min-h-0 flex-1 flex-col gap-3 p-[22px]`}>
            <p className="text-[15px] font-medium text-ink">Üzleti egészség</p>
            {[
              { icon: Percent, label: 'Trial → fizető', value: `${d.conversionRate}%` },
              { icon: TrendingUp, label: 'Churn ráta', value: `${d.churnRate}%`, danger: d.canceledCount > 0 },
              { icon: Building2, label: 'Aktív üzlet arány', value: `${d.activePlaceRate}%` },
              { icon: CalendarCheck, label: 'Foglalás összesen', value: d.totalBookings.toLocaleString('hu-HU') },
            ].map(({ icon: Icon, label, value, danger }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/20">
                  <Icon className="h-[18px] w-[18px] text-ink-dark" strokeWidth={1.9} />
                </span>
                <span className="flex-1 text-[13px] text-ink-soft">{label}</span>
                <span className={`text-[15px] font-semibold ${danger ? 'text-bad' : 'text-ink'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COL2 (dashboard-minta): FELSŐ sor = donut (bal) + kártya (jobb) egymás MELLETT,
            ALATTA egy SZÉLES trend-grafikon. */}
        <div className="flex min-h-0 flex-col gap-[5px]">
          <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-2">
            {/* Bal: Előfizetés-státusz donut (kompakt, adatok alatta). Gold/ink skála. */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <p className="mb-3 text-[15px] font-medium text-ink">Előfizetés-státusz</p>
              <StatusDonut vertical data={[
                { label: 'Fizető', value: d.activeCount, color: '#F1CE45' },
                { label: 'Próba', value: d.trialingCount, color: '#E4CE7E' },
                { label: 'Lejárt', value: d.pastDueCount, color: '#C7C2B2' },
                { label: 'Lemondott', value: d.canceledCount, color: '#1D1C19' },
              ]} />
            </div>
            {/* Jobb: Kimenő emailek kártya (a donut MELLETT) — nagy szám + napi sparkline. */}
            <BackstageTrendCard title="Kimenő emailek" value={d.monthEmails.toLocaleString('hu-HU')} caption="e hónap · napi" trend={d.emailsTrend} color="#E4CE7E" />
          </div>
          {/* ALATTA: széles Előfizetők-trend VONALDIAGRAM (tengelyekkel, sima görbe). */}
          <BackstageTrendCard title="Előfizetők alakulása" value={String(d.totalAccounts)} caption={`${d.payingAccounts} fizető`} trend={d.accountsTrend} color="#F1CE45" wide line />
        </div>

        {/* COL3: legutóbbi fiókok + gyors nézetek */}
        <div className="flex min-h-0 flex-col gap-[5px]">
          <div className={`${CARD} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="flex items-center justify-between px-5 pb-3 pt-[22px]">
              <p className="text-[15px] font-medium text-ink">Legutóbbi előfizetők</p>
              <Link href="/backstage/accounts" className="text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink">Összes →</Link>
            </div>
            {recentAccounts.length === 0
              ? <p className="px-5 py-6 text-[13px] text-ink-soft">Még nincs regisztrált fiók.</p>
              : <RecentAccountsClient accounts={recentAccounts} />}
          </div>

          <div className={`${CARD} p-2.5`}>
            {[
              { href: '/backstage/revenue', icon: TrendingUp, label: 'Bevétel & kohorsz' },
              { href: '/backstage/churn', icon: AlertTriangle, label: 'Kockázat & churn', badge: riskCount > 0 ? riskCount : undefined },
              { href: '/backstage/salons', icon: Store, label: 'Helyek' },
              { href: '/backstage/activity', icon: Activity, label: 'Aktivitás & napló' },
            ].map(({ href, icon: Icon, label, badge }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gold/20 text-ink-dark">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="flex-1 text-[13.5px] font-medium text-ink">{label}</span>
                {badge != null && <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[11px] font-bold text-bad">{badge}</span>}
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-soft2 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
