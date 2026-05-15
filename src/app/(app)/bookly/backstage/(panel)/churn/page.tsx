import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, User, Subscription } from '@/payload/payload-types'
import { AlertTriangle, Clock, CalendarX, Building2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function SalonRow({ salon, owner, sub, badge }: {
  salon: Salon
  owner: User | null
  sub?: Subscription
  badge: { label: string; color: string }
}) {
  return (
    <Link
      href={`/bookly/backstage/salons/${salon.id}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
    >
      <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
        <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{salon.name}</p>
        <p className="text-zinc-400 text-xs truncate">{owner?.email ?? '—'}{salon.city ? ` · ${salon.city}` : ''}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {sub && (
          <span className="text-[11px] text-zinc-400 dark:text-zinc-600">{sub.plan}</span>
        )}
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-600" />
      </div>
    </Link>
  )
}

function Section({ title, icon: Icon, color, count, children, empty }: {
  title: string; icon: React.ElementType; color: string; count: number
  children: React.ReactNode; empty: string
}) {
  return (
    <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center gap-3">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-zinc-900 dark:text-white font-bold text-sm flex-1">{title}</h2>
        <span className="text-zinc-400 dark:text-zinc-600 text-xs font-semibold">{count}</span>
      </div>
      {count === 0
        ? <p className="px-5 py-6 text-zinc-400 dark:text-zinc-600 text-sm">{empty}</p>
        : <div className="divide-y divide-zinc-100 dark:divide-white/[0.04]">{children}</div>
      }
    </div>
  )
}

export default async function ChurnPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const now = new Date()
  const in14 = new Date(); in14.setDate(now.getDate() + 14)
  const ago30 = new Date(); ago30.setDate(now.getDate() - 30)
  const ago14 = new Date(); ago14.setDate(now.getDate() - 14)

  const [salonsResult, subsResult] = await Promise.all([
    payload.find({ collection: 'salons', limit: 500, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', limit: 500, depth: 1, overrideAccess: true }),
  ])

  const salons = salonsResult.docs as Salon[]
  const subs = subsResult.docs as Subscription[]
  const subMap = new Map(subs.map(s => [typeof s.salon === 'object' ? s.salon.id : s.salon, s]))

  // Booking counts per salon
  const bookingCounts = await Promise.all(
    salons.map(async s => {
      const [total, recent] = await Promise.all([
        payload.find({ collection: 'bookings', where: { salon: { equals: s.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection: 'bookings', where: { salon: { equals: s.id }, createdAt: { greater_than: ago30.toISOString() } }, limit: 0, overrideAccess: true }),
      ])
      return { salonId: s.id, total: total.totalDocs, recent: recent.totalDocs }
    })
  )
  const bookingMap = new Map(bookingCounts.map(b => [b.salonId, b]))

  const owner = (s: Salon) => typeof s.owner === 'object' ? (s.owner as User) : null

  // 1. Trials expiring in 7 days
  const expiringTrials = subs.filter(sub => {
    if (sub.status !== 'trialing' || !sub.trial_ends_at) return false
    const end = new Date(sub.trial_ends_at)
    return end >= now && end <= in14
  })
  const expiringTrialSalons = expiringTrials
    .map(sub => salons.find(s => s.id === (typeof sub.salon === 'object' ? sub.salon.id : sub.salon)))
    .filter(Boolean) as Salon[]

  // 2. Past due
  const pastDueSubs = subs.filter(s => s.status === 'past_due')
  const pastDueSalons = pastDueSubs
    .map(sub => salons.find(s => s.id === (typeof sub.salon === 'object' ? sub.salon.id : sub.salon)))
    .filter(Boolean) as Salon[]

  // 3. Active salons with 0 bookings in 30 days (but have bookings overall)
  const dormant = salons.filter(s => {
    if (!s.is_active) return false
    const b = bookingMap.get(s.id)
    return b && b.total > 0 && b.recent === 0
  })

  // 4. Never had a booking (registered 7+ days ago)
  const neverBooked = salons.filter(s => {
    const b = bookingMap.get(s.id)
    const old = new Date(s.createdAt) <= ago14
    return old && b && b.total === 0
  })

  // 5. Inactive salons
  const inactive = salons.filter(s => !s.is_active)

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">Kockázat & Churn</h1>
        <p className="text-zinc-500 text-sm mt-1">Figyelmet igénylő ügyfelek</p>
      </div>

      <div className="space-y-5">
        <Section title="Lejáró próbaidőszak (14 napon belül)" icon={Clock} color="bg-amber-500/10 text-amber-500" count={expiringTrialSalons.length} empty="Nincs lejáró próbaidőszak a következő 14 napban.">
          {expiringTrialSalons.map(s => {
            const sub = subMap.get(s.id)
            const days = sub?.trial_ends_at ? Math.ceil((new Date(sub.trial_ends_at).getTime() - now.getTime()) / 86400000) : null
            return <SalonRow key={s.id} salon={s} owner={owner(s)} sub={sub} badge={{ label: days != null ? `${days} nap` : 'Lejár', color: 'bg-amber-500/10 text-amber-500' }} />
          })}
        </Section>

        <Section title="Lejárt fizetés" icon={AlertTriangle} color="bg-red-500/10 text-red-500" count={pastDueSalons.length} empty="Nincs lejárt fizetésű előfizetés.">
          {pastDueSalons.map(s => (
            <SalonRow key={s.id} salon={s} owner={owner(s)} sub={subMap.get(s.id)} badge={{ label: 'Lejárt', color: 'bg-red-500/10 text-red-500' }} />
          ))}
        </Section>

        <Section title="30 napja nem volt foglalás" icon={CalendarX} color="bg-orange-500/10 text-orange-500" count={dormant.length} empty="Minden aktív szalonnak volt foglalása az elmúlt 30 napban.">
          {dormant.map(s => {
            const b = bookingMap.get(s.id)
            return <SalonRow key={s.id} salon={s} owner={owner(s)} sub={subMap.get(s.id)} badge={{ label: `${b?.total ?? 0} összes`, color: 'bg-orange-500/10 text-orange-500' }} />
          })}
        </Section>

        <Section title="Soha nem volt foglalás" icon={Building2} color="bg-zinc-200 dark:bg-zinc-700/50 text-zinc-500" count={neverBooked.length} empty="Minden szalonnak volt már foglalása.">
          {neverBooked.map(s => {
            const daysAgo = Math.floor((now.getTime() - new Date(s.createdAt).getTime()) / 86400000)
            return <SalonRow key={s.id} salon={s} owner={owner(s)} sub={subMap.get(s.id)} badge={{ label: `${daysAgo} napja regisztrált`, color: 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500' }} />
          })}
        </Section>

        <Section title="Inaktív szalonok" icon={Building2} color="bg-zinc-200 dark:bg-zinc-700/50 text-zinc-400" count={inactive.length} empty="Nincs inaktív szalon.">
          {inactive.map(s => (
            <SalonRow key={s.id} salon={s} owner={owner(s)} sub={subMap.get(s.id)} badge={{ label: 'Inaktív', color: 'bg-zinc-100 dark:bg-zinc-700/50 text-zinc-500' }} />
          ))}
        </Section>
      </div>
    </div>
  )
}
