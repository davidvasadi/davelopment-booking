import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, Restaurant, User, Subscription } from '@/payload/payload-types'
import Link from 'next/link'
import {
  CreditCard, UserPlus, Clock, CheckCircle2, AlertTriangle, XCircle,
  Pencil, Trash2, PlusCircle, Bell, History,
} from 'lucide-react'
import { SectionPanel } from '@/components/backstage/BackstageUi'
import { BackstageHero } from '@/components/backstage/BackstageHero'
import { Activity as ActivityIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

type ActivityType = 'place_registered' | 'sub_trial' | 'sub_active' | 'sub_past_due' | 'sub_canceled' | 'sub_other'
type ActivityItem = { id: string; type: ActivityType; title: string; sub: string; date: Date; href?: string }

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'Most'
  if (diff < 3600) return `${Math.floor(diff / 60)} perce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} órája`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} napja`
  return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}

const TYPE_CONFIG: Record<ActivityType, { icon: React.ElementType; color: string }> = {
  place_registered: { icon: UserPlus, color: 'bg-paper text-ink-soft' },
  sub_trial: { icon: Clock, color: 'bg-warn-bg text-warn' },
  sub_active: { icon: CheckCircle2, color: 'bg-ok-bg text-ok' },
  sub_past_due: { icon: AlertTriangle, color: 'bg-bad-bg text-bad' },
  sub_canceled: { icon: XCircle, color: 'bg-paper text-ink-soft' },
  sub_other: { icon: CreditCard, color: 'bg-paper text-ink-soft' },
}

function subEvent(status: string): { type: ActivityType; label: string } {
  switch (status) {
    case 'trialing': return { type: 'sub_trial', label: 'Próbaidőszak indult' }
    case 'active': return { type: 'sub_active', label: 'Előfizető lett (fizető)' }
    case 'past_due': return { type: 'sub_past_due', label: 'Lejárt fizetés' }
    case 'canceled': return { type: 'sub_canceled', label: 'Lemondott' }
    case 'paused': return { type: 'sub_other', label: 'Szüneteltetve' }
    default: return { type: 'sub_other', label: 'Előfizetés módosult' }
  }
}

const AUDIT_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  create: { icon: PlusCircle, color: 'bg-ok-bg text-ok' },
  update: { icon: Pencil, color: 'bg-warn-bg text-warn' },
  delete: { icon: Trash2, color: 'bg-bad-bg text-bad' },
}

export default async function ActivityPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const since = new Date(); since.setDate(since.getDate() - 90)
  const sinceISO = since.toISOString()

  const [salonsResult, restaurantsResult, subsResult, auditResult, notifResult] = await Promise.all([
    payload.find({ collection: 'salons', where: { createdAt: { greater_than: sinceISO } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { createdAt: { greater_than: sinceISO } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', where: { updatedAt: { greater_than: sinceISO } }, sort: '-updatedAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'audit-log', sort: '-createdAt', limit: 40, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as unknown[] })),
    payload.find({ collection: 'notifications', where: { audience: { equals: 'admin' } }, sort: '-createdAt', limit: 20, depth: 0, overrideAccess: true }).catch(() => ({ docs: [] as unknown[] })),
  ])

  const items: ActivityItem[] = []
  for (const doc of salonsResult.docs) {
    const s = doc as Salon
    const owner = typeof s.owner === 'object' ? (s.owner as User) : null
    items.push({ id: `salon-${s.id}`, type: 'place_registered', title: `Új szalon: ${s.name}`, sub: owner?.email ?? '—', date: new Date(s.createdAt), href: owner ? `/backstage/accounts/${owner.id}` : `/backstage/salons/${s.id}` })
  }
  for (const doc of restaurantsResult.docs) {
    const r = doc as Restaurant
    const owner = typeof r.owner === 'object' ? (r.owner as User) : null
    items.push({ id: `restaurant-${r.id}`, type: 'place_registered', title: `Új étterem: ${r.name}`, sub: owner?.email ?? '—', date: new Date(r.createdAt), href: owner ? `/backstage/accounts/${owner.id}` : `/backstage/salons?place=restaurant:${r.id}` })
  }
  for (const doc of subsResult.docs) {
    const s = doc as Subscription
    const owner = s.owner && typeof s.owner === 'object' ? (s.owner as User) : null
    const { type, label } = subEvent(s.status)
    items.push({ id: `sub-${s.id}`, type, title: `${label}: ${owner?.email ?? '— (fiók)'}`, sub: s.breakdown || '—', date: new Date(s.updatedAt), href: owner ? `/backstage/accounts/${owner.id}` : undefined })
  }
  items.sort((a, b) => b.date.getTime() - a.date.getTime())

  // Napok szerint csoportosítva
  const groups: Record<string, ActivityItem[]> = {}
  for (const item of items) {
    const key = item.date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    ;(groups[key] ??= []).push(item)
  }

  const audit = auditResult.docs as { id: string | number; action: string; collection_name?: string; actor_label?: string; actor_email?: string; summary?: string; createdAt: string }[]
  const notifs = notifResult.docs as { id: string | number; title: string; body?: string; read?: boolean; createdAt: string }[]

  // Hero-adatok: az események típus-megoszlása (regisztráció / előfizetés-esemény) + KPI-k.
  const regCount = items.filter(i => i.type === 'place_registered').length
  const subEvtCount = items.length - regCount
  const evtTotal = items.length || 1

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHero
        title="Aktivitás & napló"
        subtitle="Regisztrációk, előfizetés-események és a rendszer audit-naplója (90 nap)"
        segments={[
          { label: 'Regisztráció', pct: Math.round((regCount / evtTotal) * 100), background: '#1D1C19', color: '#fff' },
          { label: 'Előfizetés', pct: Math.round((subEvtCount / evtTotal) * 100), background: '#F1CE45', color: '#1D1C19' },
        ]}
        kpis={[
          { icon: ActivityIcon, value: String(items.length), label: 'Esemény (90 nap)' },
          { icon: Bell, value: String(notifs.length), label: 'Admin értesítés' },
          { icon: History, value: String(audit.length), label: 'Napló-bejegyzés' },
        ]}
      />

      <div className="grid gap-[5px] lg:grid-cols-[1.4fr_1fr]">
        {/* Bal: IGAZI idővonal — bal pont+vonal, dátum-fejlécek, esemény-kártyák */}
        <SectionPanel title="Idővonal" icon={ActivityIcon} count={items.length}>
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13.5px] text-ink-soft">Nincs regisztráció vagy előfizetés-esemény az elmúlt 90 napban.</p>
          ) : (
            <div className="px-5 py-5">
              {Object.entries(groups).map(([date, dayItems], gi) => (
                <div key={date} className={gi > 0 ? 'mt-6' : ''}>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{date}</p>
                  {/* Timeline: bal oldalon folytonos vonal, minden eseménynél színes pont. */}
                  <div className="relative space-y-1 pl-6 before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-line-strong">
                    {dayItems.map((item) => {
                      const { icon: Icon, color } = TYPE_CONFIG[item.type]
                      const inner = (
                        <div className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-white">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${color}`}><Icon className="h-[15px] w-[15px]" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
                            <p className="truncate text-[11.5px] text-ink-soft">{item.sub}</p>
                          </div>
                          <span className="shrink-0 text-[11.5px] text-ink-soft2">{timeAgo(item.date)}</span>
                        </div>
                      )
                      return (
                        <div key={item.id} className="relative">
                          {/* A timeline-pont a vonalon */}
                          <span className="absolute -left-[15px] top-[18px] h-2.5 w-2.5 rounded-full border-2 border-[var(--dav-glass-strong)] bg-gold" />
                          {item.href ? <Link href={item.href}>{inner}</Link> : inner}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* Jobb: admin-értesítések + audit-napló */}
        <div className="flex flex-col gap-[5px]">
          <SectionPanel title="Admin értesítések" icon={Bell} count={notifs.length}>
            {notifs.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-ink-soft">Nincs admin-értesítés.</p>
            ) : (
              <div className="p-2.5">
                {notifs.map(n => (
                  <div key={n.id} className="flex items-start gap-3 rounded-[16px] px-3 py-2.5 transition-colors hover:bg-white">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-line-strong' : 'bg-gold'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">{n.title}</p>
                      {n.body && <p className="truncate text-[12px] text-ink-soft">{n.body}</p>}
                      <p className="mt-0.5 text-[11px] text-ink-soft2">{timeAgo(new Date(n.createdAt))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionPanel>

          <SectionPanel title="Audit-napló" icon={History} count={audit.length}>
            {audit.length === 0 ? (
              <p className="px-5 py-6 text-[13.5px] text-ink-soft">Még nincs naplózott módosítás.</p>
            ) : (
              <div className="p-2.5">
                {audit.map(a => {
                  const cfg = AUDIT_ICON[a.action] ?? AUDIT_ICON.update
                  const Icon = cfg.icon
                  return (
                    <div key={a.id} className="flex items-start gap-3 rounded-[16px] px-3 py-2.5 transition-colors hover:bg-white">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${cfg.color}`}><Icon className="h-3.5 w-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{a.summary || `${a.action} · ${a.collection_name ?? ''}`}</p>
                        <p className="truncate text-[12px] text-ink-soft">{a.actor_label || a.actor_email || 'Rendszer'} · {timeAgo(new Date(a.createdAt))}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionPanel>
        </div>
      </div>
    </div>
  )
}
