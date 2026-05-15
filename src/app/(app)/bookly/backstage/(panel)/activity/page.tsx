import { getPayloadClient } from '@/lib/payload'
import { requireAuth } from '@/lib/auth'
import type { Salon, User, Booking, Subscription } from '@/payload/payload-types'
import { CalendarCheck, CreditCard, UserPlus } from 'lucide-react'
import Link from 'next/link'

type ActivityItem = {
  id: string
  type: 'salon_registered' | 'booking_created' | 'subscription_changed'
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

const TYPE_CONFIG = {
  salon_registered: { icon: UserPlus, color: 'bg-violet-500/10 text-violet-500' },
  booking_created: { icon: CalendarCheck, color: 'bg-emerald-500/10 text-emerald-500' },
  subscription_changed: { icon: CreditCard, color: 'bg-blue-500/10 text-blue-500' },
}

export default async function ActivityPage() {
  await requireAuth('admin')
  const payload = await getPayloadClient()

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)

  const [salonsResult, bookingsResult, subsResult] = await Promise.all([
    payload.find({
      collection: 'salons',
      where: { createdAt: { greater_than: since30.toISOString() } },
      sort: '-createdAt',
      limit: 50,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'bookings',
      where: { createdAt: { greater_than: since30.toISOString() } },
      sort: '-createdAt',
      limit: 80,
      depth: 2,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'subscriptions',
      where: { updatedAt: { greater_than: since30.toISOString() } },
      sort: '-updatedAt',
      limit: 50,
      depth: 1,
      overrideAccess: true,
    }),
  ])

  const items: ActivityItem[] = []

  for (const doc of salonsResult.docs) {
    const s = doc as Salon
    const owner = typeof s.owner === 'object' ? (s.owner as User) : null
    items.push({
      id: `salon-${s.id}`,
      type: 'salon_registered',
      title: `Új szalon: ${s.name}`,
      sub: owner?.email ?? '—',
      date: new Date(s.createdAt),
      href: `/bookly/backstage/salons/${s.id}`,
    })
  }

  for (const doc of bookingsResult.docs) {
    const b = doc as Booking
    const salonName = typeof b.salon === 'object' ? (b.salon as Salon).name : b.salon
    items.push({
      id: `booking-${b.id}`,
      type: 'booking_created',
      title: `Foglalás: ${b.customer_name}`,
      sub: `${salonName} · ${b.date} ${b.start_time}`,
      date: new Date(b.createdAt),
    })
  }

  const STATUS_LABELS: Record<string, string> = {
    trialing: 'Próbaidőszak', active: 'Aktív', past_due: 'Lejárt fizetés',
    canceled: 'Megszakítva', paused: 'Szüneteltetett',
  }
  for (const doc of subsResult.docs) {
    const s = doc as Subscription
    const salonName = typeof s.salon === 'object' ? (s.salon as Salon).name : String(s.salon)
    items.push({
      id: `sub-${s.id}`,
      type: 'subscription_changed',
      title: `Előfizetés módosult: ${salonName}`,
      sub: `${s.plan} · ${STATUS_LABELS[s.status] ?? s.status}`,
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

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-10">
      <div className="mb-8">
        <h1 className="text-zinc-900 dark:text-white font-black text-2xl tracking-tight">Aktivitás</h1>
        <p className="text-zinc-500 text-sm mt-1">Platformesemények az elmúlt 30 napból</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl px-6 py-12 text-center">
          <p className="text-zinc-400 dark:text-zinc-600 text-sm">Nincs aktivitás az elmúlt 30 napban.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([date, dayItems]) => (
            <div key={date}>
              <p className="text-zinc-400 dark:text-zinc-600 text-xs font-semibold uppercase tracking-wider mb-3">{date}</p>
              <div className="bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden">
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
