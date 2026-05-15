import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, User, Subscription } from '@/payload/payload-types'
import { Users, CalendarCheck, TrendingUp, CreditCard, AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'
import RecentSalonsClient from './RecentSalonsClient'

export default async function BackstagePage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const since14 = new Date()
  since14.setDate(since14.getDate() - 14)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    salonsResult, activeSalons, usersResult, bookingsResult, monthBookings,
    recentSalons, subsResult,
  ] = await Promise.all([
    payload.find({ collection: 'salons', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'salons', where: { is_active: { equals: true } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'users', where: { role: { equals: 'salon_owner' } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', limit: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    payload.find({
      collection: 'salons',
      where: { createdAt: { greater_than: since14.toISOString() } },
      sort: '-createdAt',
      limit: 10,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({ collection: 'subscriptions', limit: 200, depth: 1, overrideAccess: true }),
  ])

  const subs = subsResult.docs as Subscription[]
  const activeSubs = subs.filter(s => s.status === 'active')
  const trialingSubs = subs.filter(s => s.status === 'trialing')
  const pastDueSubs = subs.filter(s => s.status === 'past_due')
  const mrr = activeSubs.reduce((sum, s) => sum + (s.amount_huf ?? 0), 0)

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)
  const expiringTrials = trialingSubs.filter(s => {
    if (!s.trial_ends_at) return false
    const end = new Date(s.trial_ends_at)
    return end >= now && end <= in14
  })

  const stats = [
    { label: 'Összes szalon', value: salonsResult.totalDocs, sub: `${activeSalons.totalDocs} aktív`, icon: Building2, color: 'text-violet-400' },
    { label: 'Tulajdonosok', value: usersResult.totalDocs, sub: 'regisztrált', icon: Users, color: 'text-blue-400' },
    { label: 'Összes foglalás', value: bookingsResult.totalDocs, sub: `${monthBookings.totalDocs} ebben a hónapban`, icon: CalendarCheck, color: 'text-emerald-400' },
    { label: 'Aktív előfiz.', value: activeSubs.length, sub: `${trialingSubs.length} próbaidőszak`, icon: CreditCard, color: 'text-amber-400' },
  ]

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">Áttekintő</h1>
        <p className="text-zinc-500 text-sm mt-1">Platform szintű statisztikák</p>
      </div>

      {/* MRR highlight */}
      <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl px-6 py-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="text-zinc-400 dark:text-zinc-500 text-xs font-semibold uppercase tracking-widest mb-0.5">MRR</p>
            <p className="text-zinc-900 dark:text-white font-black text-3xl tracking-tight leading-none">
              {mrr.toLocaleString('hu-HU')}<span className="text-lg font-semibold text-zinc-400 dark:text-zinc-500 ml-1">Ft</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">{activeSubs.length} fizető ügyfél</p>
          {pastDueSubs.length > 0 && (
            <p className="text-red-500 text-xs mt-0.5">{pastDueSubs.length} lejárt fizetés</p>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(expiringTrials.length > 0 || pastDueSubs.length > 0) && (
        <div className="mb-6 space-y-2">
          {pastDueSubs.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-red-400 text-sm font-medium">{pastDueSubs.length} előfizetés lejárt fizetéssel</p>
              <Link href="/bookly/backstage/subscriptions?status=past_due" className="ml-auto text-xs text-red-400 underline whitespace-nowrap">Megtekintés →</Link>
            </div>
          )}
          {expiringTrials.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-amber-400 text-sm font-medium">{expiringTrials.length} próbaidőszak jár le 14 napon belül</p>
              <Link href="/bookly/backstage/subscriptions?status=trialing" className="ml-auto text-xs text-amber-400 underline whitespace-nowrap">Megtekintés →</Link>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map(s => (
          <div key={s.label} className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5">
            <s.icon className={`h-5 w-5 mb-3 ${s.color}`} />
            <p className="text-zinc-900 dark:text-white font-black text-3xl">{s.value}</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs mt-1">{s.sub}</p>
            <p className="text-zinc-400 dark:text-zinc-600 text-[11px] mt-0.5 uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent signups — 14 days */}
      <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <h2 className="text-zinc-900 dark:text-white font-bold text-sm">
            Legutóbbi regisztrációk <span className="text-zinc-400 dark:text-zinc-600 font-normal">(14 nap)</span>
          </h2>
          <Link href="/bookly/backstage/salons" className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
            Összes →
          </Link>
        </div>
        {recentSalons.docs.length === 0 ? (
          <p className="px-6 py-8 text-zinc-400 dark:text-zinc-600 text-sm">Nincs új regisztráció az elmúlt 14 napban.</p>
        ) : (
          <RecentSalonsClient
            salons={recentSalons.docs.map(salon => {
              const s = salon as Salon
              const owner = typeof s.owner === 'object' ? (s.owner as User) : null
              return {
                id: s.id,
                name: s.name,
                city: s.city,
                is_active: s.is_active,
                createdAt: s.createdAt,
                ownerEmail: owner?.email,
              }
            })}
          />
        )}
      </div>
    </div>
  )
}
