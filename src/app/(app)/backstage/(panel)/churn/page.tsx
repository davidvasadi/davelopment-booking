import { requireAuth } from '@/lib/auth'
import { Building2, CircleAlert, Clock } from 'lucide-react'
import { Kpi, PageHead, SegmentBar } from '@/components/ui-kit'
import { RiskView } from '@/components/backstage/BackstageViews'
import type { BsRisk } from '@/components/blocks/backstage'
import { loadBackstageData, type AccountSummary, type BackstagePlaceRisk } from '@/lib/backstageMetrics'
import { accountTitle, daysLeft, shortDate } from '@/lib/backstageView'

export const dynamic = 'force-dynamic'

/** Backstage › Kockázat (design B.8–B.9): akikkel most foglalkozni kell, egy listában, ok szerint szűrve. */
export default async function ChurnPage() {
  await requireAuth('admin')
  const d = await loadBackstageData()
  const byOwner = new Map(d.accounts.map((a) => [a.ownerId, a]))
  const acc = (a: AccountSummary) => ({ name: accountTitle(a), owner: a.owner.name || a.owner.email || '—', href: `/backstage/accounts/${a.ownerId}`, ownerKey: a.ownerId })
  const place = (p: BackstagePlaceRisk) => {
    const a = p.ownerId ? byOwner.get(p.ownerId) : undefined
    const recent = a?.places.find((x) => x.kind === p.kind && x.id === p.id)?.recent ?? 0
    return { name: p.name, owner: a?.owner.name || p.ownerEmail || '—', href: `/backstage/salons?place=${p.kind}:${p.id}`, ownerKey: p.ownerId ?? undefined, last: String(recent) }
  }
  const rows: BsRisk[] = [
    ...d.pastDueAccounts.map((a) => ({ key: `due-${a.ownerId}`, kind: 'pastDue' as const, ...acc(a), detail: `Lejárt fizetés${a.sub?.current_period_end ? ` · ${shortDate(a.sub.current_period_end)}` : ''}${a.potentialFee ? ` · ${a.potentialFee.toLocaleString('hu-HU')} Ft` : ''}`, last: String(a.recentBookings) })),
    ...d.expiringTrials.map((a) => ({ key: `trial-${a.ownerId}`, kind: 'trial' as const, ...acc(a), detail: `Próba vége ${shortDate(a.sub?.trial_ends_at)} (még ${daysLeft(a.sub?.trial_ends_at) ?? 0} nap) · ${a.totalBookings} foglalás eddig`, last: String(a.recentBookings) })),
    ...d.dormantPlaces.map((p) => ({ key: `dorm-${p.kind}-${p.id}`, kind: 'dormant' as const, ...place(p), detail: `30 napja nincs foglalás · összesen ${p.totalBookings}` })),
    ...d.neverBookedPlaces.map((p) => ({ key: `never-${p.kind}-${p.id}`, kind: 'never' as const, ...place(p), detail: `Létrehozva ${shortDate(p.createdAt)} · még nincs foglalása` })),
    ...d.inactivePlaces.map((p) => ({ key: `off-${p.kind}-${p.id}`, kind: 'off' as const, ...place(p), detail: `Kikapcsolva · összesen ${p.totalBookings} foglalás` })),
  ]
  const critical = d.pastDueAccounts.length
  const watch = d.expiringTrials.length + d.dormantPlaces.length
  const ok = Math.max(0, d.totalAccounts - critical - d.expiringTrials.length)
  const sum = ok + watch + critical
  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Kockázat" sub="Akikkel most foglalkozni kell"
        bar={<SegmentBar segments={[
          { label: 'Rendben', value: String(ok), weight: sum ? ok : 34, tone: 'dark' },
          { label: 'Figyelendő', value: String(watch), weight: sum ? watch : 33, tone: 'yellow' },
          { label: 'Sürgős', value: String(critical), weight: sum ? Math.max(critical, sum * 0.06) : 33, tone: 'outline' },
        ]} />}
        kpis={<><Kpi icon={CircleAlert} value={String(critical)} label="Lejárt fizetés" /><Kpi icon={Clock} value={String(d.expiringTrials.length)} label="Lejáró próba" /><Kpi icon={Building2} value={String(d.dormantPlaces.length)} label="Alvó üzlet" /></>} />
      <RiskView rows={rows} />
    </div>
  )
}
