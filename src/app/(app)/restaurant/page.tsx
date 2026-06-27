import Link from 'next/link'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { formatDate } from '@/lib/utils'
import { RestaurantKpiCard } from '@/components/dashboard/RestaurantKpiCard'
import { ReservationTrendChart } from '@/components/dashboard/DashboardCharts'
import { ReservationActions } from '@/components/restaurant/ReservationActions'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'
import { EmptyState } from '@/components/ui/empty-state'
import { Zap, MessageSquare, Users, ChevronRight, CalendarDays } from 'lucide-react'
import type { Reservation } from '@/payload/payload-types'

const statusDot: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-500',
  seated: 'bg-blue-500',
  completed: 'bg-zinc-400',
  no_show: 'bg-red-400',
  cancelled: 'bg-red-500',
}
const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár',
  confirmed: 'Megerősítve',
  seated: 'Leültetve',
  completed: 'Befejezett',
  no_show: 'Nem jött meg',
  cancelled: 'Lemondva',
}

export default async function RestaurantDashboardPage() {
  const { restaurant } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'

  const [stats, todayReservations] = await Promise.all([
    getRestaurantStats(restaurant.id),
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurant.id } },
          { date: { equals: today } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      sort: 'start_time',
      depth: 1,
      limit: 100,
      overrideAccess: true,
    }),
  ])

  const reservations = todayReservations.docs as Reservation[]
  return (
    <div className="p-5 lg:p-8 space-y-6">

      <PageHeader eyebrow={formatDate(today)} title={`${greeting}!`} />

      {/* Insight bar */}
      {(stats.bestDay || stats.bestHour) && (
        <DashboardCard className="flex items-center gap-3">
          <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-zinc-500 dark:text-white/50">
            {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> a legerősebb napja.</>}
            {stats.bestDay && stats.bestHour && ' '}
            {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
            {stats.avgPartySize > 0 && <> Átlagos társaság: <span className="text-zinc-900 dark:text-white font-bold">{stats.avgPartySize} fő</span>.</>}
          </p>
        </DashboardCard>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <RestaurantKpiCard
          sub="Ma" label="foglalás" value={String(stats.reservationsToday)} diff={stats.reservationsTodayDiff}
          title="Mai foglalások" period={stats.period} trend={stats.trend}
          description="A mai napra leadott (nem lemondott) foglalások száma."
        />
        <RestaurantKpiCard
          sub="Ma" label="vendég összesen" value={`${stats.paxToday} fő`} diff={stats.paxTodayDiff}
          title="Mai vendégszám" period={stats.period} trend={stats.trend}
          description="A mai foglalásokhoz tartozó vendégek (pax) összege."
        />
        <RestaurantKpiCard
          sub="Mai kihasználtság" label="kapacitáshoz mérten" value={`${stats.occupancyToday}%`}
          title="Mai kihasználtság" period={stats.period} trend={stats.trend}
          description="A mai vendégszám a nyitvatartásba férő turnusok × férőhely arányában."
        />
        <RestaurantKpiCard
          sub="30 nap" label="előző időszakhoz képest" value={String(stats.periodReservations)} diff={stats.periodReservationsDiff}
          title="Foglalások (30 nap)" period={stats.period} trend={stats.trend}
          description="Az elmúlt 30 nap foglalásai az azt megelőző 30 naphoz mérve."
        />
      </div>

      {/* Trend chart */}
      <ReservationTrendChart data={stats.trend} period={stats.period} />

      {/* Today's schedule */}
      <DashboardCard noPadding className="overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Mai foglalások</h2>
          <span className="flex items-center gap-1.5 text-sm text-zinc-400 dark:text-white/30">
            <Users className="h-3.5 w-3.5" />{stats.paxToday} fő · {reservations.length} foglalás
          </span>
        </div>
        {reservations.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Ma nincs foglalás" />
        ) : (
          <div>
            {reservations.map((r, i) => {
              const tableNames = (r.tables ?? [])
                .map((t) => (typeof t === 'object' && t ? t.name : null))
                .filter((n): n is string => !!n)
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 px-4 lg:px-6 py-3.5 ${i < reservations.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
                >
                  <span className="text-xs font-mono font-bold text-zinc-400 dark:text-white/30 w-12 lg:w-20 shrink-0 leading-tight">
                    {r.start_time}<br /><span className="text-zinc-300 dark:text-white/20">{r.end_time}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-2 min-w-0 font-semibold text-sm text-zinc-800 dark:text-white/80">
                      <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                      <span className="truncate">{r.customer_name}</span>
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-white/40 truncate">
                      {r.pax} fő
                      {tableNames.length > 0 ? ` · ${tableNames.join(' + ')}${tableNames.length > 1 ? ' (összevont)' : ''}` : ''}
                    </p>
                    {r.notes && (
                      <p className="flex items-center gap-1 text-xs text-zinc-400 dark:text-white/30 mt-0.5 truncate">
                        <MessageSquare className="h-3 w-3 shrink-0" />{r.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center shrink-0">
                    <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                      <span className="text-xs text-zinc-500 dark:text-white/40 truncate">{statusLabel[r.status]}</span>
                    </span>
                    <div className="flex items-center justify-end w-10 shrink-0">
                      <ReservationActions reservationId={r.id} status={r.status} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </DashboardCard>

      <div className="flex justify-center">
        <Link
          href="/restaurant/bookings"
          className="group inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm font-semibold text-zinc-700 dark:text-white/80 hover:border-zinc-400 dark:hover:border-white/[0.2] transition-colors"
        >
          Összes foglalás megtekintése
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
