import Link from 'next/link'
import { ArrowUpRight, Sparkles, AlertTriangle } from 'lucide-react'
import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { findAccountSubscription } from '@/lib/accountSubscription'
import SalonSettingsForm from '@/components/dashboard/SalonSettingsForm'

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

export default async function SettingsPage() {
  const { salon, businessCount } = await getOwnedSalon(1)
  const payload = await getPayloadClient()

  const ownerId = typeof salon.owner === 'object' && salon.owner ? salon.owner.id : salon.owner
  const sub = ownerId ? await findAccountSubscription({ payload }, ownerId) : null
  const days = sub?.status === 'trialing' ? daysLeft(sub.trial_ends_at) : null
  // Fiók-szintű: a teljes fiók havidíja (az üzletek összetételéből).
  const feeLabel = `${(sub?.amount_huf ?? 0).toLocaleString('hu-HU')} Ft`

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
        else if (isCanceled) subtitle = 'Az előfizetésed megszűnt — aktiváld újra a folytatáshoz'
        else if (days !== null) subtitle = days === 0 ? 'Ma lejár a próbaidőszak' : `${days} nap maradt — utána ${feeLabel}/hó`
        else if (sub.plan === 'paid') subtitle = `${feeLabel} / hó`
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
                    {sub.plan === 'paid' ? 'Előfizetés' : 'Próbaidőszak'}
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

      <SalonSettingsForm salon={salon} businessCount={businessCount} />
    </div>
  )
}
