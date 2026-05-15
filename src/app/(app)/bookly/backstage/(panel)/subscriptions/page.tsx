import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Subscription, Salon, User } from '@/payload/payload-types'
import { CreditCard, AlertTriangle, Clock, CheckCircle2, XCircle, PauseCircle } from 'lucide-react'
import SubscriptionStatusSelect from './SubscriptionStatusSelect'

const PLAN_LABELS: Record<string, string> = { free: 'Ingyenes', starter: 'Starter', pro: 'Pro' }
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-zinc-100 dark:bg-zinc-500/10 text-zinc-500',
  starter: 'bg-blue-500/10 text-blue-500',
  pro: 'bg-violet-500/10 text-violet-400',
}
const STATUS_LABELS: Record<string, string> = {
  trialing: 'Próbaidőszak', active: 'Aktív', past_due: 'Lejárt fizetés',
  canceled: 'Megszakítva', paused: 'Szüneteltetett',
}
const STATUS_COLORS: Record<string, string> = {
  trialing: 'bg-blue-500/10 text-blue-400',
  active: 'bg-emerald-500/10 text-emerald-400',
  past_due: 'bg-red-500/10 text-red-400',
  canceled: 'bg-zinc-100 dark:bg-zinc-500/10 text-zinc-500',
  paused: 'bg-amber-500/10 text-amber-400',
}
const STATUS_ICONS: Record<string, React.ElementType> = {
  trialing: Clock, active: CheckCircle2, past_due: AlertTriangle,
  canceled: XCircle, paused: PauseCircle,
}

export default async function SubscriptionsPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const subsResult = await payload.find({
    collection: 'subscriptions',
    sort: '-createdAt',
    limit: 200,
    depth: 2,
    overrideAccess: true,
  })

  const subs = subsResult.docs as Subscription[]

  const byStatus = {
    active: subs.filter(s => s.status === 'active').length,
    trialing: subs.filter(s => s.status === 'trialing').length,
    past_due: subs.filter(s => s.status === 'past_due').length,
    canceled: subs.filter(s => s.status === 'canceled').length,
    paused: subs.filter(s => s.status === 'paused').length,
  }
  const byPlan = {
    free: subs.filter(s => s.plan === 'free').length,
    starter: subs.filter(s => s.plan === 'starter').length,
    pro: subs.filter(s => s.plan === 'pro').length,
  }
  const mrr = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + (s.amount_huf ?? 0), 0)

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">Előfizetések</h1>
        <p className="text-zinc-500 text-sm mt-1">{subs.length} előfizetés összesen</p>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Aktív', value: byStatus.active, color: 'text-emerald-400' },
          { label: 'Próbaidőszak', value: byStatus.trialing, color: 'text-blue-400' },
          { label: 'Lejárt fizetés', value: byStatus.past_due, color: 'text-red-400' },
          { label: 'MRR', value: `${mrr.toLocaleString('hu-HU')} Ft`, color: 'text-violet-400' },
        ].map(item => (
          <div key={item.label} className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
            <CreditCard className={`h-5 w-5 mb-3 ${item.color}`} />
            <p className={`font-black text-2xl ${item.color}`}>{item.value}</p>
            <p className="text-zinc-400 dark:text-zinc-600 text-[11px] mt-1 uppercase tracking-wider">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {(['free', 'starter', 'pro'] as const).map(plan => (
          <div key={plan} className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-zinc-900 dark:text-white font-bold text-sm">{PLAN_LABELS[plan]}</p>
              <p className="text-zinc-400 text-xs mt-0.5">
                {plan === 'free' ? '0 Ft' : plan === 'starter' ? '9 900 Ft/hó' : '19 900 Ft/hó'}
              </p>
            </div>
            <span className={`text-lg font-black ${PLAN_COLORS[plan].includes('text-') ? PLAN_COLORS[plan].split(' ').find(c => c.startsWith('text-')) : 'text-zinc-900 dark:text-white'}`}>
              {byPlan[plan]}
            </span>
          </div>
        ))}
      </div>

      {/* Subscription list */}
      <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
          <div className="grid grid-cols-[1fr_100px_120px_140px_130px] gap-4">
            {['Szalon / Tulajdonos', 'Terv', 'Státusz', 'Időszak vége', 'Módosítás'].map(h => (
              <span key={h} className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{h}</span>
            ))}
          </div>
        </div>

        {subs.length === 0 ? (
          <p className="px-5 py-10 text-zinc-400 dark:text-zinc-600 text-sm text-center">Nincs egyetlen előfizetés sem.</p>
        ) : (
          <div>
            {subs.map((sub, i) => {
              const salon = typeof sub.salon === 'object' ? (sub.salon as Salon) : null
              const owner = salon && typeof salon.owner === 'object' ? (salon.owner as User) : null
              const periodEnd = sub.status === 'trialing' && sub.trial_ends_at
                ? new Date(sub.trial_ends_at)
                : sub.current_period_end ? new Date(sub.current_period_end) : null
              const isExpiringSoon = sub.status === 'trialing' && periodEnd && periodEnd >= now && periodEnd <= in14
              const StatusIcon = STATUS_ICONS[sub.status] ?? CreditCard
              const showBorder = i < subs.length - 1

              return (
                <div
                  key={sub.id}
                  className={`grid grid-cols-[1fr_100px_120px_140px_130px] gap-4 items-center px-5 py-3.5 ${showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''} ${isExpiringSoon ? 'bg-amber-50 dark:bg-amber-500/[0.04]' : ''}`}
                >
                  {/* Salon */}
                  <div className="min-w-0">
                    <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{salon?.name ?? '—'}</p>
                    <p className="text-zinc-400 text-xs truncate mt-0.5">{owner?.email ?? '—'}</p>
                  </div>

                  {/* Plan */}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full w-fit ${PLAN_COLORS[sub.plan]}`}>
                    {PLAN_LABELS[sub.plan]}
                  </span>

                  {/* Status */}
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${STATUS_COLORS[sub.status].split(' ').find(c => c.startsWith('text-'))}`} />
                    <span className={`text-[11px] font-semibold ${STATUS_COLORS[sub.status].split(' ').find(c => c.startsWith('text-'))}`}>
                      {STATUS_LABELS[sub.status]}
                    </span>
                  </div>

                  {/* Period end */}
                  <div>
                    {periodEnd ? (
                      <>
                        <p className={`text-xs ${isExpiringSoon ? 'text-amber-500 font-semibold' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {periodEnd.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        {isExpiringSoon && <p className="text-[10px] text-amber-500">⚠ Lejár hamarosan</p>}
                      </>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600 text-xs">—</span>
                    )}
                  </div>

                  {/* Status change */}
                  <SubscriptionStatusSelect subId={sub.id} currentStatus={sub.status} currentPlan={sub.plan} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
