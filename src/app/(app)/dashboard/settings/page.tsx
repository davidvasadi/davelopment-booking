import Link from 'next/link'
import { ArrowUpRight, Sparkles, AlertTriangle } from 'lucide-react'
import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getPricing } from '@/lib/pricing'
import type { Salon, Subscription } from '@/payload/payload-types'
import SalonSettingsForm from '@/components/dashboard/SalonSettingsForm'

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export default async function SettingsPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    depth: 1,
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  const [subResult, pricing] = await Promise.all([
    payload.find({ collection: 'subscriptions', where: { salon: { equals: salon.id } }, limit: 1, overrideAccess: true }),
    getPricing(),
  ])
  const sub = (subResult.docs[0] as Subscription) ?? null
  const days = sub?.status === 'trialing' ? daysLeft(sub.trial_ends_at) : null
  // Aktív Pro-nál a tényleges (befagyott) díj, egyébként a globális ajánlott ár.
  const salonProLabel = `${(sub?.plan === 'pro' ? (sub?.amount_huf ?? pricing.salon_pro_huf) : pricing.salon_pro_huf).toLocaleString('hu-HU')} Ft`

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Szalon adatok</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Beállítások</h1>
      </div>

      {sub && (() => {
        const isPastDue = sub.status === 'past_due'
        const isCanceled = sub.status === 'canceled'
        const isAlert = isPastDue || isCanceled

        let subtitle = ''
        if (isPastDue) subtitle = 'Fizetési probléma — frissítsd az előfizetést a folytatáshoz'
        else if (isCanceled) subtitle = 'Az előfizetésed megszűnt — aktiváld újra a Pro csomagot'
        else if (days !== null) subtitle = days === 0 ? 'Ma lejár a próbaidőszak' : `${days} nap maradt — Pro: ${salonProLabel}/hó`
        else if (sub.plan === 'pro') subtitle = `${salonProLabel} / hó`
        else subtitle = 'Előfizetés kezelése'

        return (
          <Link
            href="/dashboard/subscription"
            className={`group block p-5 rounded-2xl shadow-sm dark:shadow-none border transition-colors ${
              isAlert
                ? 'bg-red-50 border-red-200 hover:border-red-300 dark:bg-red-950/40 dark:border-red-900/40 dark:hover:border-red-900/60'
                : 'bg-white border-zinc-100 hover:border-zinc-200 dark:bg-white/[0.04] dark:border-white/[0.08] dark:hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                isAlert
                  ? 'bg-red-500/15 dark:bg-red-500/10'
                  : 'bg-gradient-to-br from-[#0099ff] to-[#00bb88]'
              }`}>
                {isAlert
                  ? <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  : <Sparkles className="h-5 w-5 text-white" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`font-semibold ${isAlert ? 'text-red-700 dark:text-red-300' : 'text-zinc-900 dark:text-white'}`}>
                    {sub.plan === 'pro' ? 'Pro csomag' : 'Próbaidőszak'}
                  </p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    sub.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    sub.status === 'trialing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {sub.status === 'active' ? 'aktív' : sub.status === 'trialing' ? 'próba' : sub.status === 'past_due' ? 'lejárt' : sub.status === 'canceled' ? 'megszűnt' : 'szünet'}
                  </span>
                </div>
                <p className={`text-xs ${isAlert ? 'text-red-700/80 dark:text-red-300/80 font-medium' : 'text-zinc-500 dark:text-white/40'}`}>
                  {subtitle}
                </p>
              </div>
              <ArrowUpRight className={`h-4 w-4 shrink-0 transition-colors ${
                isAlert
                  ? 'text-red-400 dark:text-red-500 group-hover:text-red-600 dark:group-hover:text-red-400'
                  : 'text-zinc-400 dark:text-white/30 group-hover:text-zinc-700 dark:group-hover:text-white/60'
              }`} />
            </div>
          </Link>
        )
      })()}

      <SalonSettingsForm salon={salon} />
    </div>
  )
}
