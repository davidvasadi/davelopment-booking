import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Subscription, User } from '@/payload/payload-types'
import { CreditCard, AlertTriangle, Clock, CheckCircle2, XCircle, PauseCircle, Building2 } from 'lucide-react'
import SubscriptionStatusSelect from './SubscriptionStatusSelect'
import {
  subAmountHuf, PLAN_LABELS, PLAN_COLORS, STATUS_LABELS, STATUS_COLORS, textColorOf,
} from '@/lib/backstagePlaces'
import { getPricing } from '@/lib/pricing'

const STATUS_ICONS: Record<string, React.ElementType> = {
  trialing: Clock, active: CheckCircle2, past_due: AlertTriangle,
  canceled: XCircle, paused: PauseCircle,
}

export default async function SubscriptionsPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const [subsResult, pricing] = await Promise.all([
    payload.find({ collection: 'subscriptions', sort: '-createdAt', limit: 200, depth: 2, overrideAccess: true }),
    getPricing(),
  ])

  const subs = subsResult.docs as Subscription[]

  const byStatus = {
    active: subs.filter(s => s.status === 'active').length,
    trialing: subs.filter(s => s.status === 'trialing').length,
    past_due: subs.filter(s => s.status === 'past_due').length,
    canceled: subs.filter(s => s.status === 'canceled').length,
    paused: subs.filter(s => s.status === 'paused').length,
  }
  const byPlan = {
    trial: subs.filter(s => s.plan === 'trial').length,
    paid: subs.filter(s => s.plan === 'paid').length,
  }
  const mrr = subs.filter(s => s.status === 'active').reduce((sum, s) => sum + subAmountHuf(s), 0)

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)

  const cardBase = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl'

  const planMeta = [
    { plan: 'trial' as const, note: `${pricing.trial_days} nap ingyenes` },
    { plan: 'paid' as const, note: `Szalon ${pricing.salon_pro_huf.toLocaleString('hu-HU')} · Étterem ${pricing.restaurant_pro_huf.toLocaleString('hu-HU')} Ft/üzlet` },
  ]

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Backstage</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Előfizetések</h1>
        <p className="text-zinc-500 dark:text-white/40 text-sm mt-1">{subs.length} előfizetés összesen (szalon + étterem)</p>
      </div>

      {/* Summary row — étteri stílus (visszafogott szám, a státuszt apró színpötty jelzi). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Aktív', value: String(byStatus.active), dot: 'bg-emerald-500' },
          { label: 'Próbaidőszak', value: String(byStatus.trialing), dot: 'bg-blue-500' },
          { label: 'Lejárt fizetés', value: String(byStatus.past_due), dot: 'bg-red-500' },
          { label: 'MRR', value: `${mrr.toLocaleString('hu-HU')} Ft`, dot: null },
        ].map(item => (
          <div key={item.label} className={`${cardBase} p-5`}>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-2">
              {item.dot && <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />}
              {item.label}
            </p>
            <p className="text-zinc-900 dark:text-white font-black text-2xl leading-none">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {planMeta.map(({ plan, note }) => (
          <div key={plan} className={`${cardBase} px-5 py-4 flex items-center justify-between`}>
            <div className="min-w-0">
              <p className="text-zinc-900 dark:text-white font-bold text-sm truncate">{PLAN_LABELS[plan]}</p>
              <p className="text-zinc-400 text-xs mt-0.5 truncate">{note}</p>
            </div>
            <span className={`text-lg font-black shrink-0 ${textColorOf(PLAN_COLORS[plan])}`}>{byPlan[plan]}</span>
          </div>
        ))}
      </div>

      {/* Subscription list — mobilon kártya-stack, asztalin táblázat (overflow-x a kis ablakhoz). */}
      <div className={`${cardBase} overflow-hidden`}>
        {subs.length === 0 ? (
          <p className="px-5 py-10 text-zinc-400 dark:text-zinc-600 text-sm text-center">Nincs egyetlen előfizetés sem.</p>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop header */}
            <div className="hidden lg:grid grid-cols-[minmax(200px,1fr)_110px_140px_150px_220px] gap-4 px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06] min-w-[820px]">
              {['Fiók / összetétel', 'Jelleg', 'Státusz', 'Időszak vége', 'Módosítás'].map(h => (
                <span key={h} className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {subs.map((sub, i) => {
              const owner = sub.owner && typeof sub.owner === 'object' ? (sub.owner as User) : null
              const periodEnd = sub.status === 'trialing' && sub.trial_ends_at
                ? new Date(sub.trial_ends_at)
                : sub.current_period_end ? new Date(sub.current_period_end) : null
              const isExpiringSoon = sub.status === 'trialing' && periodEnd && periodEnd >= now && periodEnd <= in14
              const StatusIcon = STATUS_ICONS[sub.status] ?? CreditCard
              const showBorder = i < subs.length - 1
              const periodEndNode = periodEnd ? (
                <>
                  <p className={`text-xs ${isExpiringSoon ? 'text-amber-500 font-semibold' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {periodEnd.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {isExpiringSoon && <p className="text-[10px] text-amber-500">⚠ Lejár hamarosan</p>}
                </>
              ) : <span className="text-zinc-400 dark:text-zinc-600 text-xs">—</span>
              const planBadge = (
                <span className={`inline-flex w-fit text-[11px] font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[sub.plan]}`}>
                  {PLAN_LABELS[sub.plan] ?? sub.plan}
                </span>
              )
              const statusBadge = (
                <span className="flex items-center gap-1.5">
                  <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${textColorOf(STATUS_COLORS[sub.status])}`} />
                  <span className={`text-[11px] font-semibold ${textColorOf(STATUS_COLORS[sub.status])}`}>{STATUS_LABELS[sub.status] ?? sub.status}</span>
                </span>
              )
              const placeNode = (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{owner?.email ?? '— (fiók)'}</p>
                    <p className="text-zinc-400 text-xs truncate mt-0.5">{sub.breakdown || '— nincs üzlet —'}</p>
                  </div>
                </div>
              )

              return (
                <div key={sub.id}>
                  {/* Desktop row */}
                  <div className={`hidden lg:grid grid-cols-[minmax(200px,1fr)_110px_140px_150px_220px] gap-4 items-center px-5 py-3.5 min-w-[820px] ${showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''} ${isExpiringSoon ? 'bg-amber-50 dark:bg-amber-500/[0.04]' : ''}`}>
                    {placeNode}
                    {planBadge}
                    {statusBadge}
                    <div>{periodEndNode}</div>
                    <SubscriptionStatusSelect subId={sub.id} currentStatus={sub.status} currentPlan={sub.plan} />
                  </div>

                  {/* Mobile card */}
                  <div className={`lg:hidden px-4 py-4 space-y-3 ${showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''} ${isExpiringSoon ? 'bg-amber-50 dark:bg-amber-500/[0.04]' : ''}`}>
                    {placeNode}
                    <div className="flex items-center gap-2 flex-wrap">
                      {planBadge}
                      {statusBadge}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>{periodEndNode}</div>
                      <SubscriptionStatusSelect subId={sub.id} currentStatus={sub.status} currentPlan={sub.plan} />
                    </div>
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
