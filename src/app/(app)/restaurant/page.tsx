import Link from 'next/link'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getPayloadClient } from '@/lib/payload'
import { StoreSwitcher } from '@/components/dashboard/StoreSwitcher'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { RestaurantKpiCard } from '@/components/dashboard/RestaurantKpiCard'
import { HomeTrendChart } from '@/components/dashboard/HomeTrendChart'
import { ReservationActions } from '@/components/restaurant/ReservationActions'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquare, ChevronRight, CalendarDays } from 'lucide-react'
import type { Reservation, Media } from '@/payload/payload-types'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Függőben', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' },
  confirmed: { label: 'Megerősítve', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' },
  seated: { label: 'Leültetve', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300' },
  completed: { label: 'Befejezett', cls: 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-white/50' },
}

export default async function RestaurantDashboardPage() {
  const [{ restaurant }, user] = await Promise.all([getOwnedRestaurant(), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'
  const firstName = (user?.name ?? '').trim().split(' ')[0] || restaurant.name
  const weekday = now.toLocaleDateString('hu-HU', { weekday: 'long' })
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const nowHM = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const logoUrl = restaurant.logo && typeof restaurant.logo === 'object' ? (restaurant.logo as Media).url ?? null : null
  const { active, businesses } = user ? await getActiveBusiness(user) : { active: null, businesses: [] }

  const [stats, todayAll] = await Promise.all([
    getRestaurantStats(restaurant.id),
    payload.find({
      collection: 'reservations',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { date: { equals: today } }] },
      sort: 'start_time',
      depth: 1,
      limit: 100,
      overrideAccess: true,
    }),
  ])

  const all = todayAll.docs as Reservation[]
  const activeRes = all.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')
  const cancelledToday = all.length - activeRes.length
  // Soron következő: a mai aktív foglalások mostantól; ha nincs, a teljes mai lista.
  const fromNow = activeRes.filter((r) => (r.start_time ?? '') >= nowHM)
  const upcoming = (fromNow.length > 0 ? fromNow : activeRes).slice(0, 6)

  return (
    <div className="font-geist p-5 lg:p-8 space-y-6">

      {/* Mobil köszönő hero — egyben üzletváltó */}
      <div className="lg:hidden">
        <StoreSwitcher
          name={restaurant.name}
          logoUrl={logoUrl}
          businesses={businesses}
          activeKey={active ? `${active.type}:${active.id}` : null}
          hero={{ greeting: `${greeting}, ${firstName}`, subtitle: `${weekdayCap} · ${stats.reservationsToday} foglalás ma` }}
        />
      </div>

      {/* Desktop fejléc */}
      <div className="hidden lg:block">
        <PageHeader
          eyebrow={`${greeting}, ${firstName}`}
          title="Áttekintés"
          description="A mai nap egy pillantásra — foglalások, kihasználtság és a legfontosabb számok."
        />
      </div>

      {/* 4 KPI kártya */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <RestaurantKpiCard
          sub="Ma" label="foglalás" value={String(stats.reservationsToday)} diff={stats.reservationsTodayDiff}
          icon="reservations" title="Mai foglalások" period={stats.period} trend={stats.trend}
          description="A mai napra leadott (nem lemondott) foglalások száma."
        />
        <RestaurantKpiCard
          sub="Mai kihasználtság" label="kapacitáshoz mérten" value={`${stats.occupancyToday}%`}
          icon="occupancy" title="Mai kihasználtság" period={stats.period} trend={stats.trend}
          description="A mai vendégszám a nyitvatartásba férő turnusok × férőhely arányában."
        />
        <RestaurantKpiCard
          sub="Vendégek ma" label="összesen" value={`${stats.paxToday} fő`} diff={stats.paxTodayDiff}
          icon="pax" title="Mai vendégszám" period={stats.period} trend={stats.trend}
          description="A mai foglalásokhoz tartozó vendégek (pax) összege."
        />
        <RestaurantKpiCard
          sub="Ma" label="lemondva / nem jött" value={String(cancelledToday)}
          icon="cancelled" title="Mai lemondások" period={stats.period} trend={stats.trend}
          description="A mai napra lemondott vagy meg nem jelent foglalások száma."
        />
      </div>

      {/* Chart (2/3) + Következő foglalások (1/3) */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 items-start">
        <div className="lg:col-span-2">
          <HomeTrendChart trend={stats.trend} />
        </div>

        <DashboardCard noPadding className="overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
            <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Következő foglalások</h2>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nincs több mai foglalás" />
          ) : (
            <div>
              {upcoming.map((r, i) => {
                const tableNames = (r.tables ?? [])
                  .map((t) => (typeof t === 'object' && t ? t.name : null))
                  .filter((n): n is string => !!n)
                const badge = STATUS_BADGE[r.status]
                return (
                  <div key={r.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < upcoming.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}>
                    <span className="text-sm font-mono font-bold text-zinc-400 dark:text-white/30 w-12 shrink-0">{r.start_time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{r.customer_name}</p>
                      <p className="text-xs text-zinc-500 dark:text-white/40 truncate">
                        {r.pax} fő{tableNames.length > 0 ? ` · ${tableNames.join(' + ')}` : ''}
                      </p>
                      {r.notes && (
                        <p className="flex items-center gap-1 text-xs text-zinc-400 dark:text-white/30 mt-0.5 truncate">
                          <MessageSquare className="h-3 w-3 shrink-0" />{r.notes}
                        </p>
                      )}
                    </div>
                    {badge && (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    )}
                    <ReservationActions reservationId={r.id} status={r.status} />
                  </div>
                )
              })}
            </div>
          )}
          {/* Összes foglalás — a panel alján */}
          <Link
            href="/restaurant/bookings"
            className="group flex items-center justify-center gap-1.5 px-5 py-3.5 border-t border-zinc-100 dark:border-white/[0.06] text-sm font-semibold text-zinc-700 dark:text-white/80 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            Összes foglalás megtekintése
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </DashboardCard>
      </div>
    </div>
  )
}
