import { requireAuth } from '@/lib/auth'
import { Activity, CreditCard, UserPlus } from 'lucide-react'
import { Kpi, PageHead, type Status } from '@/components/ui-kit'
import { ActivityTimeline, AdminNoticesCard, AuditCard, type BsEvent, type BsEventKind, type BsNotice } from '@/components/blocks/backstage'
import { getPayloadClient } from '@/lib/payload'
import { ago, auditRows, dayLabel } from '@/lib/backstageView'
import type { Restaurant, Salon, Subscription, User } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

const SUB_EVENT: Record<string, { kind: BsEventKind; tag: string; tone: Status }> = {
  trialing: { kind: 'trial', tag: 'Próba indult', tone: 'pending' },
  active: { kind: 'active', tag: 'Előfizető lett', tone: 'ok' },
  past_due: { kind: 'pastDue', tag: 'Lejárt fizetés', tone: 'bad' },
  canceled: { kind: 'canceled', tag: 'Lemondott', tone: 'neutral' },
  paused: { kind: 'other', tag: 'Szüneteltetve', tone: 'warn' },
}
const pad = (n: number) => String(n).padStart(2, '0')
const hm = (d: Date) => `${d.getHours()}:${pad(d.getMinutes())}`

/** A csengő admin-értesítéseinek típusa a címükből (ikonhoz). */
function noticeKind(title: string): BsNotice['kind'] {
  const t = title.toLowerCase()
  if (t.includes('üzenet') || t.includes('kapcsolat')) return 'message'
  if (t.includes('ajánl')) return 'referral'
  if (t.includes('regisztr') || t.includes('új szalon') || t.includes('új étterem') || t.includes('új üzlet')) return 'register'
  return 'alert'
}

/** Backstage › Aktivitás (design B.12): idővonal (90 nap), admin-értesítések, napló. */
export default async function ActivityPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const [salons, restaurants, subs, audit, notifs, auditCount] = await Promise.all([
    payload.find({ collection: 'salons', where: { createdAt: { greater_than: since } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { createdAt: { greater_than: since } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', where: { updatedAt: { greater_than: since } }, sort: '-updatedAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'audit-log', sort: '-createdAt', limit: 12, depth: 1, overrideAccess: true }).then((r) => r.docs).catch(() => []),
    payload.find({ collection: 'notifications', where: { audience: { equals: 'admin' } }, sort: '-createdAt', limit: 8, depth: 0, overrideAccess: true }).then((r) => r.docs).catch(() => []),
    payload.count({ collection: 'audit-log', where: { createdAt: { greater_than: since } }, overrideAccess: true }).then((r) => r.totalDocs).catch(() => 0),
  ])

  type Ev = BsEvent & { at: Date }
  const events: Ev[] = []
  for (const doc of [...salons.docs.map((s) => ['salon', s] as const), ...restaurants.docs.map((r) => ['restaurant', r] as const)]) {
    const [kind, p] = doc as readonly ['salon' | 'restaurant', Salon | Restaurant]
    const owner = typeof p.owner === 'object' ? (p.owner as User) : null
    const at = new Date(p.createdAt)
    events.push({ key: `${kind}-${p.id}`, at, time: hm(at), kind: 'register', title: `${p.name} regisztrált`, meta: `${kind === 'restaurant' ? 'Étterem' : 'Szalon'} · ${owner?.name || owner?.email || '—'}`, tone: 'pending', tag: 'Új üzlet', href: owner ? `/backstage/accounts/${owner.id}` : `/backstage/salons?place=${kind}:${p.id}` })
  }
  for (const s of subs.docs as Subscription[]) {
    const owner = s.owner && typeof s.owner === 'object' ? (s.owner as User) : null
    const e = SUB_EVENT[s.status] ?? { kind: 'other' as const, tag: 'Előfizetés módosult', tone: 'neutral' as Status }
    const at = new Date(s.updatedAt)
    events.push({ key: `sub-${s.id}`, at, time: hm(at), kind: e.kind, title: owner?.name || owner?.email || 'Fiók nélküli előfizetés', meta: s.breakdown || (s.plan === 'paid' ? 'Fizető' : 'Próba'), tone: e.tone, tag: e.tag, href: owner ? `/backstage/accounts/${owner.id}` : undefined })
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime())
  const days: [string, BsEvent[]][] = []
  for (const e of events.slice(0, 30)) {
    const label = dayLabel(e.at)
    const last = days[days.length - 1]
    if (last && last[0] === label) last[1].push(e); else days.push([label, [e]])
  }
  const regs = events.filter((e) => e.kind === 'register').length
  const notices: BsNotice[] = (notifs as { id: string | number; title: string; body?: string | null; read?: boolean | null; createdAt: string }[])
    .map((n) => ({ key: String(n.id), kind: noticeKind(n.title), title: n.title, meta: [n.body, ago(n.createdAt)].filter(Boolean).join(' · '), unread: !n.read }))

  return (
    <div className="p-4 lg:p-0">
      <PageHead title="Aktivitás" sub="Regisztrációk, előfizetés-események és a napló · 90 nap"
        kpis={<><Kpi icon={UserPlus} value={String(regs)} label="Regisztráció · 90 nap" /><Kpi icon={CreditCard} value={String(events.length - regs)} label="Előfizetés-esemény" /><Kpi icon={Activity} value={String(auditCount)} label="Napló-bejegyzés" /></>} />
      <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ActivityTimeline days={days} total={events.length} />
        <div className="flex min-w-0 flex-col gap-[5px]">
          <AdminNoticesCard rows={notices} />
          <AuditCard rows={auditRows(audit as Parameters<typeof auditRows>[0])} />
        </div>
      </div>
    </div>
  )
}
