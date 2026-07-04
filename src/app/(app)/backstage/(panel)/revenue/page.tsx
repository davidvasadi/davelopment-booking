import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Subscription } from '@/payload/payload-types'
import { Building2, UtensilsCrossed } from 'lucide-react'
import { subAmountHuf } from '@/lib/backstagePlaces'
import { getPricing } from '@/lib/pricing'

function formatHuf(n: number) {
  return n.toLocaleString('hu-HU') + ' Ft'
}

export default async function RevenuePage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const [subsResult, pricing] = await Promise.all([
    payload.find({ collection: 'subscriptions', limit: 500, depth: 1, overrideAccess: true }),
    getPricing(),
  ])
  const subs = subsResult.docs as Subscription[]

  const activeSubs = subs.filter(s => s.status === 'active')
  const trialingSubs = subs.filter(s => s.status === 'trialing')
  const canceledSubs = subs.filter(s => s.status === 'canceled')
  const pastDueSubs = subs.filter(s => s.status === 'past_due')

  const mrr = activeSubs.reduce((sum, s) => sum + subAmountHuf(s), 0)
  const arr = mrr * 12
  // Potenciális MRR (fiók-szintű): ha minden aktív+trial fiók a számolt havidíját fizetné.
  // A fiók-sub `amount_huf`-ja már az üzlet-összetételből számolt teljes díj (trial alatt is).
  const potentialMrr = [...activeSubs, ...trialingSubs].reduce((sum, s) => sum + (s.amount_huf ?? 0), 0)
  const churnRate = subs.length > 0 ? ((canceledSubs.length / subs.length) * 100).toFixed(1) : '0.0'
  const conversionRate = (activeSubs.length + trialingSubs.length) > 0
    ? ((activeSubs.length / (activeSubs.length + trialingSubs.length)) * 100).toFixed(0)
    : '0'

  // Üzlet-típus szerinti bevétel-bontás: a fiókok count-mezőiből (salon_count/restaurant_count)
  // × a globális egységár — így látszik, mennyi bevétel jön szalonból ill. étteremből.
  const salonUnits = activeSubs.reduce((n, s) => n + (s.salon_count ?? 0), 0)
  const restaurantUnits = activeSubs.reduce((n, s) => n + (s.restaurant_count ?? 0), 0)
  const byPlan = {
    pro: { count: salonUnits, revenue: salonUnits * pricing.salon_pro_huf },
    restaurant_pro: { count: restaurantUnits, revenue: restaurantUnits * pricing.restaurant_pro_huf },
  }

  // Revenue by month (based on createdAt of active subs as approximation)
  const monthlyMap: Record<string, number> = {}
  activeSubs.forEach(sub => {
    const month = new Date(sub.createdAt).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
    monthlyMap[month] = (monthlyMap[month] ?? 0) + subAmountHuf(sub)
  })
  const months = Object.entries(monthlyMap).slice(-6)
  const maxMonthRevenue = Math.max(...months.map(([, v]) => v), 1)

  const kpis = [
    { label: 'MRR', value: formatHuf(mrr), sub: 'havi visszatérő bevétel', danger: false },
    { label: 'ARR', value: formatHuf(arr), sub: 'éves vetítve', danger: false },
    { label: 'Potenciális MRR', value: formatHuf(potentialMrr), sub: 'aktív + próbaidőszak', danger: false },
    { label: 'Churn ráta', value: `${churnRate}%`, sub: `${canceledSubs.length} lemondás`, danger: canceledSubs.length > 0 },
  ]

  return (
    <div className="space-y-[22px] p-5 font-onest lg:p-8">
      <div>
        <h1 className="text-[34px] font-light tracking-[-0.02em] text-ink lg:text-[43px] leading-none">Bevétel</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Előfizetési bevételek és konverzió (szalon + étterem)</p>
      </div>

      {/* KPI grid (HeroKpi stílus) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-[20px] sm:rounded-[24px] border border-line bg-white p-3.5 sm:p-5 shadow-dav-card">
            <p className="text-[12px] sm:text-[13px] font-medium text-ink-soft mb-2">{k.label}</p>
            <p className={`text-[22px] sm:text-[30px] font-light leading-none tracking-[-0.02em] ${k.danger ? 'text-[#C0392B]' : 'text-ink'}`}>{k.value}</p>
            <p className="text-ink-soft text-[12px] mt-1.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversion funnel */}
        <div className="rounded-[26px] border border-line bg-white p-6 shadow-dav-card">
          <h2 className="text-ink font-semibold text-[15px] mb-5">Konverziós tölcsér</h2>
          <div className="space-y-3">
            {[
              { label: 'Összes előfizetés', value: subs.length, color: '#C9BE9A' },
              { label: 'Próbaidőszak', value: trialingSubs.length, color: '#F1CE45' },
              { label: 'Aktív előfizető', value: activeSubs.length, color: '#1D9D63' },
              { label: 'Lejárt fizetés', value: pastDueSubs.length, color: '#C0392B' },
              { label: 'Lemondott', value: canceledSubs.length, color: '#86826F' },
            ].map(row => (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-ink-soft text-[12px]">{row.label}</span>
                  <span className="text-ink text-[12px] font-semibold">{row.value}</span>
                </div>
                <div className="h-1.5 bg-[#EAE5D6] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: subs.length ? `${(row.value / subs.length) * 100}%` : '0%', background: row.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-line">
            <p className="text-ink-soft text-[12px]">Trial → Fizető konverzió</p>
            <p className="text-ink font-light text-[30px] leading-none tracking-[-0.02em] mt-1">{conversionRate}%</p>
          </div>
        </div>

        {/* Plan revenue breakdown */}
        <div className="rounded-[26px] border border-line bg-white p-6 shadow-dav-card">
          <h2 className="text-ink font-semibold text-[15px] mb-5">Bevétel tervenként</h2>
          <div className="space-y-4">
            {[
              { plan: 'Szalon Pro', icon: Building2, data: byPlan.pro, bar: '#1D1C19', tile: 'bg-ink-dark', tint: 'text-gold' },
              { plan: 'Étterem Pro', icon: UtensilsCrossed, data: byPlan.restaurant_pro, bar: '#F1CE45', tile: 'bg-gold', tint: 'text-ink' },
            ].map(({ plan, icon: Icon, data, bar, tile, tint }) => (
              <div key={plan} className="flex items-center gap-4">
                <div className={`h-9 w-9 rounded-[13px] ${tile} flex items-center justify-center shrink-0`}>
                  <Icon className={`h-4 w-4 ${tint}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-ink text-[13.5px] font-medium">{plan}</span>
                    <span className="font-semibold text-[13.5px] text-ink">{formatHuf(data.revenue)}</span>
                  </div>
                  <div className="h-1.5 bg-[#EAE5D6] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: mrr ? `${(data.revenue / mrr) * 100}%` : '0%', background: bar }} />
                  </div>
                  <p className="text-ink-soft text-[12px] mt-0.5">{data.count} ügyfél</p>
                </div>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-line">
              <div className="flex items-center justify-between">
                <span className="text-ink-soft text-[13.5px]">Összes MRR</span>
                <span className="text-ink font-semibold text-[16px]">{formatHuf(mrr)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly revenue bars */}
      {months.length > 0 && (
        <div className="rounded-[26px] border border-line bg-white p-6 shadow-dav-card">
          <h2 className="text-ink font-semibold text-[15px] mb-6">Aktív előfizetők belépési hónapja</h2>
          <div className="flex items-end gap-3 h-32">
            {months.map(([month, revenue]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="text-ink text-[10px] font-semibold">
                  {Math.round(revenue / 1000)}k
                </span>
                <div className="w-full bg-[#EAE5D6] rounded-t-md relative" style={{ height: '80px' }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gold rounded-t-md transition-all"
                    style={{ height: `${(revenue / maxMonthRevenue) * 80}px` }}
                  />
                </div>
                <span className="text-ink-soft text-[10px] text-center leading-tight">{month}</span>
              </div>
            ))}
          </div>
          <p className="text-ink-soft text-[12px] mt-3">* Az aktív előfizetők regisztrációs hónapja alapján</p>
        </div>
      )}
    </div>
  )
}
