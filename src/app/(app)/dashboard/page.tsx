import Link from 'next/link'
import { getOwnedSalon } from '@/lib/salonContext'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/utils'
import { getDashboardStats } from '@/lib/dashboardStats'
import { HomeTrendChart } from '@/components/dashboard/HomeTrendChart'
import { KpiCardWithDetails } from '@/components/dashboard/KpiCardWithDetails'
import { StoreSwitcher } from '@/components/dashboard/StoreSwitcher'
import BookingActions from '@/components/dashboard/BookingActions'
import { PageHeader } from '@/components/ui/page-header'
import { DashboardCard } from '@/components/ui/dashboard-card'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageSquare, ChevronRight, CalendarDays } from 'lucide-react'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Függőben', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' },
  confirmed: { label: 'Megerősítve', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' },
  completed: { label: 'Befejezett', cls: 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.06] dark:text-white/50' },
}

export default async function DashboardPage() {
  const [{ salon }, user] = await Promise.all([getOwnedSalon(), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'
  const firstName = (user?.name ?? '').trim().split(' ')[0] || salon.name
  const weekday = now.toLocaleDateString('hu-HU', { weekday: 'long' })
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const nowHM = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const logoUrl = salon.logo && typeof salon.logo === 'object' ? (salon.logo as Media).url ?? null : null
  const { active, businesses } = user ? await getActiveBusiness(user) : { active: null, businesses: [] }

  const [stats, todayAll] = await Promise.all([
    getDashboardStats(salon.id),
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { equals: today } }] },
      sort: 'start_time',
      depth: 2,
      limit: 100,
      overrideAccess: true,
    }),
  ])

  const all = todayAll.docs as Booking[]
  const activeBookings = all.filter((b) => b.status !== 'cancelled')
  const fromNow = activeBookings.filter((b) => (b.start_time ?? '') >= nowHM)
  const upcoming = (fromNow.length > 0 ? fromNow : activeBookings).slice(0, 6)

  return (
    <div className="font-geist p-5 lg:p-8 space-y-6">

      {/* Mobil köszönő hero — egyben üzletváltó */}
      <div className="lg:hidden">
        <StoreSwitcher
          name={salon.name}
          logoUrl={logoUrl}
          businesses={businesses}
          activeKey={active ? `${active.type}:${active.id}` : null}
          hero={{ greeting: `${greeting}, ${firstName}`, subtitle: `${weekdayCap} · ${stats.bookingsToday} foglalás ma` }}
        />
      </div>

      {/* Desktop fejléc */}
      <div className="hidden lg:block">
        <PageHeader
          eyebrow={`${greeting}, ${firstName}`}
          title="Áttekintés"
          description="A mai nap egy pillantásra — foglalások, bevétel és a legfontosabb számok."
        />
      </div>

      {/* 4 KPI kártya */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardWithDetails
          sub="Ma" label="foglalás" value={String(stats.bookingsToday)} diff={stats.bookingsTodayDiff}
          metric="bookings" title="Mai foglalások" period={stats.period} data={stats.trend}
        />
        <KpiCardWithDetails
          sub="Ma" label="bevétel" value={formatPrice(stats.revenueToday, 'HUF')} diff={stats.revenueTodayDiff}
          metric="revenue" title="Mai bevétel" period={stats.period} data={stats.trend}
        />
        <KpiCardWithDetails
          sub="Teljesítési arány" label="befejezett / lezárt" value={`${stats.completionRate}%`}
          metric="completion" title="Teljesítési arány" period={stats.period} data={stats.trend}
        />
        <KpiCardWithDetails
          sub="Átl. érték" label="foglalásonként" value={formatPrice(stats.avgBookingValue, 'HUF')}
          metric="avg_value" title="Átlagos foglalás értéke" period={stats.period} data={stats.trend}
        />
      </div>

      {/* Chart (2/3) + Következő foglalások (1/3) */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 items-start">
        <div className="lg:col-span-2">
          <HomeTrendChart trend={stats.trend} moneyless={false} />
        </div>

        <DashboardCard noPadding className="overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
            <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Következő foglalások</h2>
          </div>
          {upcoming.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nincs több mai foglalás" />
          ) : (
            <div>
              {upcoming.map((b, i) => {
                const service = b.service as Service | null
                const staff = b.staff as StaffMember | null
                const badge = STATUS_BADGE[b.status]
                return (
                  <div key={b.id} className={`flex items-center gap-3 px-5 py-3.5 ${i < upcoming.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}>
                    <span className="text-sm font-mono font-bold text-zinc-400 dark:text-white/30 w-12 shrink-0">{b.start_time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate">{b.customer_name}</p>
                      <p className="text-xs text-zinc-500 dark:text-white/40 truncate">
                        {typeof service === 'object' && service ? service.name : '—'}
                        {typeof staff === 'object' && staff ? ` · ${staff.name}` : ''}
                      </p>
                      {b.notes && (
                        <p className="flex items-center gap-1 text-xs text-zinc-400 dark:text-white/30 mt-0.5 truncate">
                          <MessageSquare className="h-3 w-3 shrink-0" />{b.notes}
                        </p>
                      )}
                    </div>
                    {badge && (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                    )}
                    <BookingActions bookingId={b.id} status={b.status} />
                  </div>
                )
              })}
            </div>
          )}
          <Link
            href="/dashboard/bookings"
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
