import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Subscription, User } from '@/payload/payload-types'
import { CreditCard, AlertTriangle, Clock, CheckCircle2, XCircle, PauseCircle, Building2 } from 'lucide-react'
import SubscriptionStatusSelect from './SubscriptionStatusSelect'
import { subAmountHuf, PLAN_LABELS, STATUS_LABELS } from '@/lib/backstagePlaces'
import { getPricing } from '@/lib/pricing'

const STATUS_ICONS: Record<string, React.ElementType> = {
  trialing: Clock, active: CheckCircle2, past_due: AlertTriangle,
  canceled: XCircle, paused: PauseCircle,
}

// davelopment státusz-badge színek
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-[#E7F2EA] text-[#1D9D63]',
  trialing: 'bg-[#FBF4DC] text-[#7A6A2E]',
  past_due: 'bg-[#F8E9E7] text-[#C0392B]',
  canceled: 'bg-[#F0EAD8] text-ink-soft',
  paused: 'bg-[#F0EAD8] text-ink-soft',
}
const PLAN_BADGE: Record<string, string> = {
  trial: 'bg-[#FBF4DC] text-[#7A6A2E]',
  paid: 'bg-[#F0EAD8] text-ink-soft',
  pro: 'bg-[#F0EAD8] text-ink-soft',
  restaurant_pro: 'bg-[#F0EAD8] text-ink-soft',
}
const badge = (map: Record<string, string>, key: string) => map[key] ?? 'bg-[#F0EAD8] text-ink-soft'

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

  const planMeta = [
    { plan: 'trial' as const, note: `${pricing.trial_days} nap ingyenes` },
    { plan: 'paid' as const, note: `Szalon ${pricing.salon_pro_huf.toLocaleString('hu-HU')} · Étterem ${pricing.restaurant_pro_huf.toLocaleString('hu-HU')} Ft/üzlet` },
  ]

  return (
    <div className="space-y-[22px] p-5 font-onest lg:p-8">
      <div>
        <h1 className="text-[34px] font-light tracking-[-0.02em] text-ink lg:text-[43px] leading-none">Előfizetések</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">{subs.length} előfizetés összesen (szalon + étterem)</p>
      </div>

      {/* Summary row — KPI kártyák */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Aktív', value: String(byStatus.active), dot: 'bg-[#1D9D63]' },
          { label: 'Próbaidőszak', value: String(byStatus.trialing), dot: 'bg-gold' },
          { label: 'Lejárt fizetés', value: String(byStatus.past_due), dot: 'bg-[#C0392B]' },
          { label: 'MRR', value: `${mrr.toLocaleString('hu-HU')} Ft`, dot: null },
        ].map(item => (
          <div key={item.label} className="rounded-[20px] sm:rounded-[24px] border border-line bg-white p-3.5 sm:p-5 shadow-dav-card">
            <p className="flex items-center gap-1.5 text-[12px] sm:text-[13px] font-medium text-ink-soft mb-2">
              {item.dot && <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />}
              {item.label}
            </p>
            <p className="text-[26px] sm:text-[38px] font-light leading-none tracking-[-0.02em] text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {planMeta.map(({ plan, note }) => (
          <div key={plan} className="rounded-[20px] sm:rounded-[24px] border border-line bg-white px-5 py-4 shadow-dav-card flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-ink font-semibold text-[13.5px] truncate">{PLAN_LABELS[plan]}</p>
              <p className="text-ink-soft text-[12px] mt-0.5 truncate">{note}</p>
            </div>
            <span className="text-[22px] font-light shrink-0 text-ink">{byPlan[plan]}</span>
          </div>
        ))}
      </div>

      {/* Subscription list — mobilon kártya-stack, asztalin táblázat-szerű grid. */}
      <div className="rounded-[24px] bg-white p-2.5 border border-line shadow-dav-card">
        {subs.length === 0 ? (
          <p className="px-5 py-10 text-ink-soft text-[13.5px] text-center">Nincs egyetlen előfizetés sem.</p>
        ) : (
          <div>
            {/* Desktop header */}
            <div className="hidden lg:grid grid-cols-[minmax(200px,1fr)_110px_150px_150px_220px] gap-4 px-[13px] py-2.5">
              {['Fiók / összetétel', 'Jelleg', 'Státusz', 'Időszak vége', 'Módosítás'].map(h => (
                <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{h}</span>
              ))}
            </div>

            {subs.map((sub) => {
              const owner = sub.owner && typeof sub.owner === 'object' ? (sub.owner as User) : null
              const periodEnd = sub.status === 'trialing' && sub.trial_ends_at
                ? new Date(sub.trial_ends_at)
                : sub.current_period_end ? new Date(sub.current_period_end) : null
              const isExpiringSoon = sub.status === 'trialing' && periodEnd && periodEnd >= now && periodEnd <= in14
              const StatusIcon = STATUS_ICONS[sub.status] ?? CreditCard
              const periodEndNode = periodEnd ? (
                <>
                  <p className={`text-[13px] ${isExpiringSoon ? 'text-[#7A6A2E] font-semibold' : 'text-ink-soft'}`}>
                    {periodEnd.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {isExpiringSoon && <p className="text-[10px] text-[#7A6A2E]">⚠ Lejár hamarosan</p>}
                </>
              ) : <span className="text-ink-soft2 text-[13px]">—</span>
              const planBadge = (
                <span className={`inline-flex w-fit text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge(PLAN_BADGE, sub.plan)}`}>
                  {PLAN_LABELS[sub.plan] ?? sub.plan}
                </span>
              )
              const statusBadge = (
                <span className={`inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge(STATUS_BADGE, sub.status)}`}>
                  <StatusIcon className="h-3.5 w-3.5 shrink-0" />
                  {STATUS_LABELS[sub.status] ?? sub.status}
                </span>
              )
              const placeNode = (
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-9 w-9 rounded-[13px] bg-[#F6F2E4] flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-ink-soft" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-ink text-[13.5px] font-semibold truncate">{owner?.email ?? '— (fiók)'}</p>
                    <p className="text-ink-soft text-[12px] truncate mt-0.5">{sub.breakdown || '— nincs üzlet —'}</p>
                  </div>
                </div>
              )

              return (
                <div key={sub.id}>
                  {/* Desktop row */}
                  <div
                    className="hidden lg:grid grid-cols-[minmax(200px,1fr)_110px_150px_150px_220px] gap-4 items-center rounded-[20px] px-[13px] py-3 transition-colors hover:bg-[#FCFAF1]"
                    style={isExpiringSoon ? { background: '#FCF6E3', boxShadow: 'inset 0 0 0 1px rgba(241,206,69,.4)' } : undefined}
                  >
                    {placeNode}
                    {planBadge}
                    {statusBadge}
                    <div>{periodEndNode}</div>
                    <SubscriptionStatusSelect subId={sub.id} currentStatus={sub.status} currentPlan={sub.plan} />
                  </div>

                  {/* Mobile card */}
                  <div
                    className="lg:hidden rounded-[20px] p-[13px] space-y-3 transition-colors hover:bg-[#FCFAF1]"
                    style={isExpiringSoon ? { background: '#FCF6E3', boxShadow: 'inset 0 0 0 1px rgba(241,206,69,.4)' } : undefined}
                  >
                    {placeNode}
                    <div className="flex items-center gap-2 flex-wrap">
                      {planBadge}
                      {statusBadge}
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
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
