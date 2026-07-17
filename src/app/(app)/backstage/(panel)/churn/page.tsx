import { requireAuth } from '@/lib/auth'
import Link from 'next/link'
import { AlertTriangle, Clock, CalendarX, Building2, UtensilsCrossed, Store, ArrowRight } from 'lucide-react'
import { loadBackstageData, daysUntil, type BackstagePlaceRisk, type AccountSummary } from '@/lib/backstageMetrics'
import { BackstageHero } from '@/components/backstage/BackstageHero'
import { SectionPanel } from '@/components/backstage/BackstageUi'

export const dynamic = 'force-dynamic'

function PlaceRiskRow({ p, badge }: { p: BackstagePlaceRisk; badge: { label: string; cls: string } }) {
  const Icon = p.kind === 'restaurant' ? UtensilsCrossed : Building2
  const typeLabel = p.kind === 'restaurant' ? 'Étterem' : 'Szalon'
  const href = p.ownerId ? `/backstage/accounts/${p.ownerId}` : (p.kind === 'salon' ? `/backstage/salons/${p.id}` : `/backstage/salons?place=restaurant:${p.id}`)
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[18px] px-3 py-3 transition-colors hover:bg-white">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-gold/20 text-ink-dark">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-semibold text-ink">{p.name}</span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-ink-soft">{typeLabel}</span>
        </p>
        <p className="truncate text-[12px] text-ink-soft">{p.ownerEmail ?? '—'}{p.city ? ` · ${p.city}` : ''}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-soft2" />
    </Link>
  )
}

function AccountRiskRow({ a, badge }: { a: AccountSummary; badge: { label: string; cls: string } }) {
  return (
    <Link href={`/backstage/accounts/${a.ownerId}`} className="flex items-center gap-3 rounded-[18px] px-3 py-3 transition-colors hover:bg-white">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[12px] font-bold text-white">
        {(a.owner.email ?? '?').trim()[0]?.toUpperCase() ?? '?'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-ink">{a.owner.email}</p>
        <p className="truncate text-[12px] text-ink-soft">{a.placeCount} üzlet · {a.owner.name || '—'}</p>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-soft2" />
    </Link>
  )
}

export default async function ChurnPage() {
  await requireAuth('admin')
  const d = await loadBackstageData()

  const sections = [
    { key: 'expiring', title: 'Lejáró próbaidőszak (14 napon belül)', icon: Clock, iconCls: 'bg-warn-bg text-warn', count: d.expiringTrials.length, empty: 'Nincs lejáró próbaidőszak a következő 14 napban.' },
    { key: 'pastdue', title: 'Lejárt fizetés', icon: AlertTriangle, iconCls: 'bg-bad-bg text-bad', count: d.pastDueAccounts.length, empty: 'Nincs lejárt fizetésű fiók.' },
    { key: 'dormant', title: '30 napja nincs foglalás (alvó)', icon: CalendarX, iconCls: 'bg-warn-bg text-warn', count: d.dormantPlaces.length, empty: 'Minden aktív helynek volt foglalása az elmúlt 30 napban.' },
    { key: 'never', title: 'Soha nem volt foglalás', icon: Store, iconCls: 'bg-paper text-ink-soft', count: d.neverBookedPlaces.length, empty: 'Minden helynek volt már foglalása.' },
    { key: 'inactive', title: 'Inaktív helyek', icon: Store, iconCls: 'bg-paper text-ink-soft', count: d.inactivePlaces.length, empty: 'Nincs inaktív hely.' },
  ]

  // A kockázati megoszlás a státusz-csíkhoz: rendben / figyelendő / kritikus arány a fiókokból.
  const totalAcc = d.totalAccounts || 1
  const criticalCount = d.pastDueAccounts.length
  const watchCount = d.expiringTrials.length
  const okCount = Math.max(0, d.totalAccounts - criticalCount - watchCount)

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHero
        title="Kockázat & churn"
        subtitle="Figyelmet igénylő fiókok és üzletek"
        segments={[
          { label: 'Rendben', pct: Math.round((okCount / totalAcc) * 100), background: '#1D1C19', color: '#fff' },
          { label: 'Figyelendő', pct: Math.round((watchCount / totalAcc) * 100), background: '#F1CE45', color: '#1D1C19' },
          { label: 'Kritikus', pct: Math.round((criticalCount / totalAcc) * 100), background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
        ]}
        kpis={[
          { icon: Clock, value: String(d.expiringTrials.length), label: 'Lejáró próba' },
          { icon: AlertTriangle, value: String(d.pastDueAccounts.length), label: 'Lejárt fizetés' },
          { icon: CalendarX, value: String(d.dormantPlaces.length), label: 'Alvó üzlet' },
        ]}
      />

      <div className="space-y-4">
        {/* Fiók-szintű: lejáró próba */}
        <SectionPanel title={sections[0].title} icon={sections[0].icon} iconClass={sections[0].iconCls} count={sections[0].count}>
          {d.expiringTrials.length === 0
            ? <p className="px-5 py-6 text-[13.5px] text-ink-soft">{sections[0].empty}</p>
            : <div className="p-2">{d.expiringTrials.map(a => {
                const days = daysUntil(a.sub?.trial_ends_at)
                return <AccountRiskRow key={a.ownerId} a={a} badge={{ label: days != null ? `${days} nap` : 'Lejár', cls: 'bg-warn-bg text-warn' }} />
              })}</div>}
        </SectionPanel>

        {/* Fiók-szintű: lejárt fizetés */}
        <SectionPanel title={sections[1].title} icon={sections[1].icon} iconClass={sections[1].iconCls} count={sections[1].count}>
          {d.pastDueAccounts.length === 0
            ? <p className="px-5 py-6 text-[13.5px] text-ink-soft">{sections[1].empty}</p>
            : <div className="p-2">{d.pastDueAccounts.map(a => <AccountRiskRow key={a.ownerId} a={a} badge={{ label: 'Lejárt', cls: 'bg-bad-bg text-bad' }} />)}</div>}
        </SectionPanel>

        {/* Hely-szintű: alvó */}
        <SectionPanel title={sections[2].title} icon={sections[2].icon} iconClass={sections[2].iconCls} count={sections[2].count}>
          {d.dormantPlaces.length === 0
            ? <p className="px-5 py-6 text-[13.5px] text-ink-soft">{sections[2].empty}</p>
            : <div className="p-2">{d.dormantPlaces.map(p => <PlaceRiskRow key={`${p.kind}-${p.id}`} p={p} badge={{ label: `${p.totalBookings} összes`, cls: 'bg-warn-bg text-warn' }} />)}</div>}
        </SectionPanel>

        {/* Hely-szintű: soha nem foglaltak */}
        <SectionPanel title={sections[3].title} icon={sections[3].icon} iconClass={sections[3].iconCls} count={sections[3].count}>
          {d.neverBookedPlaces.length === 0
            ? <p className="px-5 py-6 text-[13.5px] text-ink-soft">{sections[3].empty}</p>
            : <div className="p-2">{d.neverBookedPlaces.map(p => {
                const days = Math.floor((Date.now() - new Date(p.createdAt).getTime()) / 86400000)
                return <PlaceRiskRow key={`${p.kind}-${p.id}`} p={p} badge={{ label: `${days} napja`, cls: 'bg-paper text-ink-soft' }} />
              })}</div>}
        </SectionPanel>

        {/* Hely-szintű: inaktív */}
        <SectionPanel title={sections[4].title} icon={sections[4].icon} iconClass={sections[4].iconCls} count={sections[4].count}>
          {d.inactivePlaces.length === 0
            ? <p className="px-5 py-6 text-[13.5px] text-ink-soft">{sections[4].empty}</p>
            : <div className="p-2">{d.inactivePlaces.map(p => <PlaceRiskRow key={`${p.kind}-${p.id}`} p={p} badge={{ label: 'Inaktív', cls: 'bg-paper text-ink-soft' }} />)}</div>}
        </SectionPanel>
      </div>
    </div>
  )
}
