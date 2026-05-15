import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Subscription } from '@/payload/payload-types'
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react'

const PLAN_AMOUNTS: Record<string, number> = { free: 0, starter: 9900, pro: 19900 }

function formatHuf(n: number) {
  return n.toLocaleString('hu-HU') + ' Ft'
}

export default async function RevenuePage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const subsResult = await payload.find({
    collection: 'subscriptions',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })
  const subs = subsResult.docs as Subscription[]

  const activeSubs = subs.filter(s => s.status === 'active')
  const trialingSubs = subs.filter(s => s.status === 'trialing')
  const canceledSubs = subs.filter(s => s.status === 'canceled')
  const pastDueSubs = subs.filter(s => s.status === 'past_due')

  const mrr = activeSubs.reduce((sum, s) => sum + (s.amount_huf ?? 0), 0)
  const arr = mrr * 12
  const potentialMrr = [...activeSubs, ...trialingSubs].reduce((sum, s) => sum + (PLAN_AMOUNTS[s.plan] ?? 0), 0)
  const churnRate = subs.length > 0 ? ((canceledSubs.length / subs.length) * 100).toFixed(1) : '0.0'
  const conversionRate = (activeSubs.length + trialingSubs.length) > 0
    ? ((activeSubs.length / (activeSubs.length + trialingSubs.length)) * 100).toFixed(0)
    : '0'

  const byPlan = {
    starter: { count: activeSubs.filter(s => s.plan === 'starter').length, revenue: activeSubs.filter(s => s.plan === 'starter').reduce((s, sub) => s + (sub.amount_huf ?? 0), 0) },
    pro: { count: activeSubs.filter(s => s.plan === 'pro').length, revenue: activeSubs.filter(s => s.plan === 'pro').reduce((s, sub) => s + (sub.amount_huf ?? 0), 0) },
  }

  // Revenue by month (based on createdAt of active subs as approximation)
  const monthlyMap: Record<string, number> = {}
  activeSubs.forEach(sub => {
    const month = new Date(sub.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
    monthlyMap[month] = (monthlyMap[month] ?? 0) + (sub.amount_huf ?? 0)
  })
  const months = Object.entries(monthlyMap).slice(-6)
  const maxMonthRevenue = Math.max(...months.map(([, v]) => v), 1)

  const kpis = [
    { label: 'MRR', value: formatHuf(mrr), sub: 'havi visszatérő bevétel', icon: DollarSign, color: 'text-violet-400', positive: true },
    { label: 'ARR', value: formatHuf(arr), sub: 'éves vetítve', icon: TrendingUp, color: 'text-emerald-400', positive: true },
    { label: 'Potenciális MRR', value: formatHuf(potentialMrr), sub: 'aktív + próbaidőszak', icon: BarChart3, color: 'text-blue-400', positive: true },
    { label: 'Churn ráta', value: `${churnRate}%`, sub: `${canceledSubs.length} lemondás`, icon: TrendingDown, color: 'text-red-400', positive: false },
  ]

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">Bevétel</h1>
        <p className="text-zinc-500 text-sm mt-1">Előfizetési bevételek és konverzió</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map(k => (
          <div key={k.label} className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
            <k.icon className={`h-5 w-5 mb-3 ${k.color}`} />
            <p className="text-zinc-900 dark:text-white font-black text-xl leading-tight">{k.value}</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{k.sub}</p>
            <p className="text-zinc-400 dark:text-zinc-600 text-[11px] mt-0.5 uppercase tracking-wider">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Conversion funnel */}
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-zinc-900 dark:text-white font-bold text-sm mb-5">Konverziós tölcsér</h2>
          <div className="space-y-3">
            {[
              { label: 'Összes szalon', value: subs.length, color: 'bg-zinc-200 dark:bg-zinc-600' },
              { label: 'Próbaidőszak', value: trialingSubs.length, color: 'bg-blue-400' },
              { label: 'Aktív előfizető', value: activeSubs.length, color: 'bg-emerald-400' },
              { label: 'Lejárt fizetés', value: pastDueSubs.length, color: 'bg-red-400' },
              { label: 'Lemondott', value: canceledSubs.length, color: 'bg-zinc-300 dark:bg-zinc-700' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-600 dark:text-zinc-400 text-xs">{row.label}</span>
                  <span className="text-zinc-900 dark:text-white text-xs font-bold">{row.value}</span>
                </div>
                <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.color} transition-all`}
                    style={{ width: subs.length ? `${(row.value / subs.length) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-white/[0.06]">
            <p className="text-zinc-500 text-xs">Trial → Fizető konverzió</p>
            <p className="text-zinc-900 dark:text-white font-black text-2xl mt-0.5">{conversionRate}%</p>
          </div>
        </div>

        {/* Plan revenue breakdown */}
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-zinc-900 dark:text-white font-bold text-sm mb-5">Bevétel tervenként</h2>
          <div className="space-y-4">
            {[
              { plan: 'Pro', data: byPlan.pro, color: 'bg-violet-500', textColor: 'text-violet-400' },
              { plan: 'Starter', data: byPlan.starter, color: 'bg-blue-500', textColor: 'text-blue-400' },
            ].map(({ plan, data, color, textColor }) => (
              <div key={plan} className="flex items-center gap-4">
                <div className={`h-9 w-9 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                  <span className="text-white font-black text-xs">{plan[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-700 dark:text-zinc-300 text-sm font-medium">{plan}</span>
                    <span className={`font-black text-sm ${textColor}`}>{formatHuf(data.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: mrr ? `${(data.revenue / mrr) * 100}%` : '0%' }} />
                  </div>
                  <p className="text-zinc-400 text-xs mt-0.5">{data.count} ügyfél</p>
                </div>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500 text-sm">Összes MRR</span>
                <span className="text-zinc-900 dark:text-white font-black text-lg">{formatHuf(mrr)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly revenue bars */}
      {months.length > 0 && (
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6">
          <h2 className="text-zinc-900 dark:text-white font-bold text-sm mb-6">Aktív előfizetők belépési hónapja</h2>
          <div className="flex items-end gap-3 h-32">
            {months.map(([month, revenue]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-zinc-900 dark:text-white text-[10px] font-bold">
                  {Math.round(revenue / 1000)}k
                </span>
                <div className="w-full bg-zinc-100 dark:bg-white/[0.06] rounded-t-md relative" style={{ height: '80px' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-violet-500 rounded-t-md transition-all"
                    style={{ height: `${(revenue / maxMonthRevenue) * 80}px` }}
                  />
                </div>
                <span className="text-zinc-400 text-[10px] text-center leading-tight">{month}</span>
              </div>
            ))}
          </div>
          <p className="text-zinc-400 dark:text-zinc-600 text-xs mt-3">* Az aktív előfizetők regisztrációs hónapja alapján</p>
        </div>
      )}
    </div>
  )
}
