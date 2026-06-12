import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, Restaurant, User, Subscription } from '@/payload/payload-types'
import { CreditCard, UserPlus, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { getPlaceFromSubscription } from '@/lib/backstagePlaces'

// Eladási fókuszú aktivitás: KIZÁRÓLAG regisztrációk és előfizetés/próbaidő-események.
// Foglalásokat NEM monitorozunk itt (felesleges ehhez a nézethez).
type ActivityType = 'place_registered' | 'sub_trial' | 'sub_active' | 'sub_past_due' | 'sub_canceled' | 'sub_other'

type ActivityItem = {
  id: string
  type: ActivityType
  title: string
  sub: string
  date: Date
  href?: string
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return 'Most'
  if (diff < 3600) return `${Math.floor(diff / 60)} perce`
  if (diff < 86400) return `${Math.floor(diff / 3600)} órája`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} napja`
  return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })
}

const TYPE_CONFIG: Record<ActivityType, { icon: React.ElementType; color: string }> = {
  place_registered: { icon: UserPlus, color: 'bg-violet-500/10 text-violet-500' },
  sub_trial: { icon: Clock, color: 'bg-blue-500/10 text-blue-500' },
  sub_active: { icon: CheckCircle2, color: 'bg-emerald-500/10 text-emerald-500' },
  sub_past_due: { icon: AlertTriangle, color: 'bg-red-500/10 text-red-500' },
  sub_canceled: { icon: XCircle, color: 'bg-zinc-200 dark:bg-zinc-700/50 text-zinc-500' },
  sub_other: { icon: CreditCard, color: 'bg-zinc-200 dark:bg-zinc-700/50 text-zinc-500' },
}

function subEvent(status: string): { type: ActivityType; label: string } {
  switch (status) {
    case 'trialing': return { type: 'sub_trial', label: 'Próbaidőszak indult' }
    case 'active': return { type: 'sub_active', label: 'Előfizető lett (fizető)' }
    case 'past_due': return { type: 'sub_past_due', label: 'Lejárt fizetés' }
    case 'canceled': return { type: 'sub_canceled', label: 'Lemondott' }
    case 'paused': return { type: 'sub_other', label: 'Szüneteltetve' }
    default: return { type: 'sub_other', label: 'Előfizetés módosult' }
  }
}

export default async function ActivityPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  // Tágabb ablak (90 nap) — eladási események ritkábbak, mint a foglalások.
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceISO = since.toISOString()

  const [salonsResult, restaurantsResult, subsResult] = await Promise.all([
    payload.find({ collection: 'salons', where: { createdAt: { greater_than: sinceISO } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { createdAt: { greater_than: sinceISO } }, sort: '-createdAt', limit: 100, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', where: { updatedAt: { greater_than: sinceISO } }, sort: '-updatedAt', limit: 100, depth: 1, overrideAccess: true }),
  ])

  const items: ActivityItem[] = []

  for (const doc of salonsResult.docs) {
    const s = doc as Salon
    const owner = typeof s.owner === 'object' ? (s.owner as User) : null
    items.push({
      id: `salon-${s.id}`,
      type: 'place_registered',
      title: `Új szalon: ${s.name}`,
      sub: owner?.email ?? '—',
      date: new Date(s.createdAt),
      href: `/backstage/salons/${s.id}`,
    })
  }

  for (const doc of restaurantsResult.docs) {
    const r = doc as Restaurant
    const owner = typeof r.owner === 'object' ? (r.owner as User) : null
    items.push({
      id: `restaurant-${r.id}`,
      type: 'place_registered',
      title: `Új étterem: ${r.name}`,
      sub: owner?.email ?? '—',
      date: new Date(r.createdAt),
      href: `/backstage/salons?place=restaurant:${r.id}`,
    })
  }

  for (const doc of subsResult.docs) {
    const s = doc as Subscription
    const place = getPlaceFromSubscription(s)
    const placeName = place?.name ?? '— (árva előfizetés)'
    const placeType = place ? (place.kind === 'restaurant' ? 'Étterem' : 'Szalon') : ''
    const { type, label } = subEvent(s.status)
    items.push({
      id: `sub-${s.id}`,
      type,
      title: `${label}: ${placeName}`,
      sub: [placeType, place?.owner?.email].filter(Boolean).join(' · ') || '—',
      date: new Date(s.updatedAt),
    })
  }

  items.sort((a, b) => b.date.getTime() - a.date.getTime())

  // Group by date
  const groups: Record<string, ActivityItem[]> = {}
  for (const item of items) {
    const key = item.date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }

  const cardBase = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl'

  return (
    <div className="p-5 lg:p-8 space-y-6">
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Backstage</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Aktivitás</h1>
        <p className="text-zinc-500 dark:text-white/40 text-sm mt-1">Regisztrációk és előfizetés-események (elmúlt 90 nap)</p>
      </div>

      {items.length === 0 ? (
        <div className={`${cardBase} px-6 py-12 text-center`}>
          <p className="text-zinc-400 dark:text-zinc-600 text-sm">Nincs regisztráció vagy előfizetés-esemény az elmúlt 90 napban.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([date, dayItems]) => (
            <div key={date}>
              <p className="text-zinc-400 dark:text-zinc-600 text-xs font-semibold uppercase tracking-wider mb-3">{date}</p>
              <div className={`${cardBase} overflow-hidden`}>
                {dayItems.map((item, i) => {
                  const { icon: Icon, color } = TYPE_CONFIG[item.type]
                  const showBorder = i < dayItems.length - 1
                  const inner = (
                    <div className={`flex items-center gap-3.5 px-5 py-3.5 ${showBorder ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''} ${item.href ? 'hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors' : ''}`}>
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-zinc-900 dark:text-white text-sm font-medium truncate">{item.title}</p>
                        <p className="text-zinc-400 text-xs truncate mt-0.5">{item.sub}</p>
                      </div>
                      <span className="text-zinc-400 dark:text-zinc-600 text-xs shrink-0">{timeAgo(item.date)}</span>
                    </div>
                  )
                  return item.href
                    ? <Link key={item.id} href={item.href}>{inner}</Link>
                    : <div key={item.id}>{inner}</div>
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
