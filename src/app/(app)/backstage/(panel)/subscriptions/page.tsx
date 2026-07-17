import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Subscription, User } from '@/payload/payload-types'
import Link from 'next/link'
import { Clock, CheckCircle2, AlertTriangle, XCircle, PauseCircle, Receipt, type LucideIcon } from 'lucide-react'
import SubscriptionStatusSelect from './SubscriptionStatusSelect'
import { subAmountHuf, PLAN_LABELS, ownerIdOfSubscription } from '@/lib/backstagePlaces'
import { getPricing } from '@/lib/pricing'
import { StatusBadge, formatHuf } from '@/components/backstage/BackstageUi'
import { BackstageHero } from '@/components/backstage/BackstageHero'
import { CreditCard, Users, Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_ICONS: Record<string, LucideIcon> = {
  trialing: Clock, active: CheckCircle2, past_due: AlertTriangle, canceled: XCircle, paused: PauseCircle,
}

const PLAN_BADGE: Record<string, string> = {
  trial: 'bg-warn-bg text-warn',
  paid: 'bg-paper text-ink-soft',
}

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAuth('admin')
  const { status: statusFilter } = await searchParams
  const payload = await getPayloadClient()

  const [subsResult, pricing] = await Promise.all([
    payload.find({ collection: 'subscriptions', sort: '-createdAt', limit: 500, depth: 2, overrideAccess: true }),
    getPricing(),
  ])

  let subs = subsResult.docs as Subscription[]
  if (statusFilter) subs = subs.filter(s => s.status === statusFilter)

  const allSubs = subsResult.docs as Subscription[]
  const byStatus = {
    active: allSubs.filter(s => s.status === 'active').length,
    trialing: allSubs.filter(s => s.status === 'trialing').length,
    past_due: allSubs.filter(s => s.status === 'past_due').length,
  }
  const mrr = allSubs.filter(s => s.status === 'active').reduce((sum, s) => sum + subAmountHuf(s), 0)

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)

  const totalSub = allSubs.length || 1
  const activePct = Math.round((byStatus.active / totalSub) * 100)
  const trialPct = Math.round((byStatus.trialing / totalSub) * 100)
  const riskPct = Math.max(0, 100 - activePct - trialPct)

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <BackstageHero
        title="Előfizetések"
        subtitle={`${allSubs.length} előfizetés · szalon + étterem`}
        segments={[
          { label: 'Aktív', pct: activePct, background: '#1D1C19', color: '#fff' },
          { label: 'Próba', pct: trialPct, background: '#F1CE45', color: '#1D1C19' },
          { label: 'Egyéb', pct: riskPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
        ]}
        kpis={[
          { icon: Users, value: String(byStatus.active), label: 'Aktív fiók' },
          { icon: CreditCard, value: formatHuf(mrr), label: 'Havi bevétel (MRR)' },
          { icon: AlertTriangle, value: String(byStatus.past_due), label: 'Lejárt fizetés' },
        ]}
      />

      {statusFilter && (
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-soft">Szűrő:</span>
          <StatusBadge status={statusFilter as never} />
          <Link href="/backstage/subscriptions" className="text-[12px] font-semibold text-ink-soft underline hover:text-ink">Szűrő törlése</Link>
        </div>
      )}

      {/* List */}
      <div className="overflow-hidden rounded-[26px] p-2.5 dav-card-glass">
        {subs.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13.5px] text-ink-soft">Nincs a szűrőnek megfelelő előfizetés.</p>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(220px,1.5fr)_140px_130px_130px_210px] gap-4 px-[13px] py-2.5 lg:grid">
              {['Fiók', 'Státusz', 'Időszak vége', 'Utolsó számla', 'Módosítás'].map(h => (
                <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{h}</span>
              ))}
            </div>

            {subs.map((sub) => {
              const owner = sub.owner && typeof sub.owner === 'object' ? (sub.owner as User) : null
              const ownerId = ownerIdOfSubscription(sub)
              const periodEnd = sub.status === 'trialing' && sub.trial_ends_at ? new Date(sub.trial_ends_at)
                : sub.current_period_end ? new Date(sub.current_period_end) : null
              const isExpiringSoon = sub.status === 'trialing' && periodEnd && periodEnd >= now && periodEnd <= in14
              const StatusIcon = STATUS_ICONS[sub.status] ?? CheckCircle2

              const accountNode = (
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[12px] font-bold text-white">
                    {(owner?.email ?? '?').trim()[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-semibold text-ink">{owner?.email ?? '— (fiók)'}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${PLAN_BADGE[sub.plan] ?? 'bg-paper text-ink-soft'}`}>{PLAN_LABELS[sub.plan] ?? sub.plan}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ink-soft">{sub.breakdown || '— nincs üzlet —'}</p>
                  </div>
                </div>
              )
              const inner = ownerId
                ? <Link href={`/backstage/accounts/${ownerId}`} className="block hover:opacity-80">{accountNode}</Link>
                : accountNode

              const periodEndNode = periodEnd ? (
                <div>
                  <p className={`text-[13px] ${isExpiringSoon ? 'font-semibold text-warn' : 'text-ink-soft'}`}>
                    {periodEnd.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {isExpiringSoon && <p className="text-[10px] text-warn">⚠ Lejár hamarosan</p>}
                </div>
              ) : <span className="text-[13px] text-ink-soft2">—</span>
              const invoiceNode = sub.last_invoice_number ? (
                sub.last_invoice_url ? (
                  <a href={sub.last_invoice_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-ink underline">
                    <Receipt className="h-3.5 w-3.5" />{sub.last_invoice_number}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft"><Receipt className="h-3.5 w-3.5" />{sub.last_invoice_number}</span>
                )
              ) : <span className="text-[12px] text-ink-soft2">—</span>

              return (
                <div
                  key={sub.id}
                  className={`rounded-[20px] px-[13px] py-3 transition-colors hover:bg-white ${isExpiringSoon ? 'bg-warn-bg/40 ring-1 ring-inset ring-gold/40' : ''}`}
                >
                  {/* Desktop */}
                  <div className="hidden grid-cols-[minmax(220px,1.5fr)_140px_130px_130px_210px] items-center gap-4 lg:grid">
                    {inner}
                    <StatusBadge status={sub.status as never} icon={StatusIcon} />
                    {periodEndNode}
                    {invoiceNode}
                    <SubscriptionStatusSelect subId={sub.id} currentStatus={sub.status} currentPlan={sub.plan} />
                  </div>

                  {/* Mobile */}
                  <div className="space-y-3 lg:hidden">
                    {inner}
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={sub.status as never} icon={StatusIcon} />
                      {periodEndNode}
                    </div>
                    <SubscriptionStatusSelect subId={sub.id} currentStatus={sub.status} currentPlan={sub.plan} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
