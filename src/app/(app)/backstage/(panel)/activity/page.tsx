import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, Restaurant, User, Subscription } from '@/payload/payload-types'
import { CreditCard, UserPlus, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import Link from 'next/link'

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
  place_registered: { icon: UserPlus, color: 'bg-[#F6F2E4] text-ink-soft' },
  sub_trial: { icon: Clock, color: 'bg-[#FBF4DC] text-[#7A6A2E]' },
  sub_active: { icon: CheckCircle2, color: 'bg-[#E7F2EA] text-[#1D9D63]' },
  sub_past_due: { icon: AlertTriangle, color: 'bg-[#F8E9E7] text-[#C0392B]' },
  sub_canceled: { icon: XCircle, color: 'bg-[#F0EAD8] text-ink-soft' },
  sub_other: { icon: CreditCard, color: 'bg-[#F0EAD8] text-ink-soft' },
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
    // Fiók-szintű: az előfizetés az owner-höz tartozik; a cím a fiók emailje + összetétel.
    const owner = s.owner && typeof s.owner === 'object' ? (s.owner as User) : null
    const ownerEmail = owner?.email ?? '— (fiók)'
    const { type, label } = subEvent(s.status)
    items.push({
      id: `sub-${s.id}`,
      type,
      title: `${label}: ${ownerEmail}`,
      sub: s.breakdown || '—',
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

  const cardBase = 'rounded-[26px] bg-white border border-line shadow-dav-card'

  return (
    <div className="space-y-[22px] p-5 font-onest lg:p-8">
      <div>
        <h1 className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink lg:text-[43px]">Aktivitás</h1>
        <p className="mt-1 text-[13.5px] font-medium text-ink-soft">Regisztrációk és előfizetés-események (elmúlt 90 nap)</p>
      </div>

      {items.length === 0 ? (
        <div className={`${cardBase} px-6 py-12 text-center`}>
          <p className="text-[13.5px] text-ink-soft">Nincs regisztráció vagy előfizetés-esemény az elmúlt 90 napban.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([date, dayItems]) => (
            <div key={date}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">{date}</p>
              <div className={`${cardBase} overflow-hidden`}>
                {dayItems.map((item, i) => {
                  const { icon: Icon, color } = TYPE_CONFIG[item.type]
                  const showBorder = i < dayItems.length - 1
                  const inner = (
                    <div className={`flex items-center gap-3.5 px-5 py-3.5 ${showBorder ? 'border-b border-line' : ''} ${item.href ? 'transition-colors hover:bg-[#FCFAF1]' : ''}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{item.title}</p>
                        <p className="mt-0.5 truncate text-[12px] text-ink-soft">{item.sub}</p>
                      </div>
                      <span className="shrink-0 text-[12px] text-ink-soft2">{timeAgo(item.date)}</span>
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
