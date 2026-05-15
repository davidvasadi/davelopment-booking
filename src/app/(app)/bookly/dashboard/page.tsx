import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { formatDate, formatPrice } from '@/lib/utils'
import { getDashboardStats } from '@/lib/dashboardStats'
import { TrendChart, DowChart, ServiceChart, StaffChart } from '@/components/dashboard/DashboardCharts'
import BookingActions from '@/components/dashboard/BookingActions'
import type { Salon, Booking, Service, StaffMember } from '@/payload/payload-types'
import { TrendingUp, TrendingDown, Minus, Zap, ArrowUpRight, MessageSquare } from 'lucide-react'
import Link from 'next/link'

const statusDot: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
  cancelled: 'bg-red-400',
  completed: 'bg-zinc-400',
}
const statusLabel: Record<string, string> = {
  pending: 'Függő',
  confirmed: 'Megerősített',
  cancelled: 'Lemondott',
  completed: 'Befejezett',
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff > 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-[#00bb88]">
      <TrendingUp className="h-3 w-3" />+{diff}%
    </span>
  )
  if (diff < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-400">
      <TrendingDown className="h-3 w-3" />{diff}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-zinc-400 dark:text-white/30"><Minus className="h-3 w-3" />0%</span>
}

function KpiCard({ label, sub, value, diff }: {
  label: string; sub: string; value: string; diff?: number
}) {
  return (
    <Link
      href="/bookly/dashboard/analytics"
      className="group rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none hover:border-zinc-300 dark:hover:border-white/[0.16] transition-colors block"
    >
      <div className="flex items-start justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">{sub}</p>
        <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30 group-hover:text-zinc-700 dark:group-hover:text-white/60 transition-colors shrink-0 mt-0.5" />
      </div>
      <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
      <div className="flex items-center justify-between gap-1 flex-wrap">
        <p className="text-xs text-zinc-500 dark:text-white/40">{label}</p>
        {diff !== undefined && <DiffBadge diff={diff} />}
      </div>
    </Link>
  )
}

export default async function DashboardPage() {
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  const today = new Date().toISOString().split('T')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'

  const [stats, todayBookings] = await Promise.all([
    getDashboardStats(salon.id),
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { date: { equals: today } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      sort: 'start_time',
      depth: 2,
      limit: 50,
    }),
  ])

  return (
    <div className="p-5 lg:p-8 space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">{formatDate(today)}</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{greeting}!</h1>
      </div>

      {/* Insight bar */}
      {(stats.bestDay || stats.bestHour) && (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl px-5 py-4 flex items-center gap-3">
          <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-zinc-500 dark:text-white/50">
            {stats.bestDay && <><span className="text-zinc-900 dark:text-white font-bold">{stats.bestDay}</span> az Ön legerősebb napja.</>}
            {stats.bestDay && stats.bestHour && ' '}
            {stats.bestHour && <>A csúcsidő: <span className="text-zinc-900 dark:text-white font-bold">{stats.bestHour}</span>.</>}
            {stats.avgBookingValue > 0 && <> Átlagos foglalás: <span className="text-zinc-900 dark:text-white font-bold">{formatPrice(stats.avgBookingValue, 'HUF')}</span>.</>}
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 lg:gap-3">
        <KpiCard sub="Ma" label="Bevétel" value={formatPrice(stats.revenueToday, 'HUF')} diff={stats.revenueTodayDiff} />
        <KpiCard sub="E hónap" label="Bevétel" value={formatPrice(stats.revenueMonth, 'HUF')} diff={stats.revenueMonthDiff} />
        <KpiCard sub="Ma" label="Foglalás" value={String(stats.bookingsToday)} diff={stats.bookingsTodayDiff} />
        <KpiCard sub="E hónap" label="Foglalás" value={String(stats.bookingsMonth)} diff={stats.bookingsMonthDiff} />
        <KpiCard sub="Teljesítési arány" label="befejezett / lezárt" value={`${stats.completionRate}%`} />
        <KpiCard sub="Átl. foglalás értéke" label="foglalásonként" value={formatPrice(stats.avgBookingValue, 'HUF')} />
      </div>

      {/* Trend chart */}
      <TrendChart data={stats.trend} period={stats.period} />

      {/* DoW + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DowChart data={stats.byDayOfWeek} period={stats.period} />
        {stats.byService.length > 0 && <ServiceChart data={stats.byService} period={stats.period} />}
      </div>

      {stats.byStaff.length > 0 && (
        <StaffChart data={stats.byStaff} period={stats.period} />
      )}

      {/* Today's schedule */}
      <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
        <div className="px-4 lg:px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Mai program</h2>
          <span className="text-sm text-zinc-400 dark:text-white/30">{todayBookings.totalDocs} foglalás</span>
        </div>
        {todayBookings.docs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-zinc-400 dark:text-white/30 text-sm">Ma nincs foglalás</p>
          </div>
        ) : (
          <div>
            {todayBookings.docs.map((b, i) => {
              const booking = b as Booking
              const service = booking.service as Service
              const staff = booking.staff as StaffMember
              return (
                <div
                  key={booking.id}
                  className={`flex items-center gap-3 px-4 lg:px-6 py-3.5 ${i < todayBookings.docs.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
                >
                  <span className="text-xs font-mono font-bold text-zinc-400 dark:text-white/30 w-12 lg:w-20 shrink-0 leading-tight">
                    {booking.start_time}<br /><span className="text-zinc-300 dark:text-white/20">{booking.end_time}</span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-zinc-800 dark:text-white/80 truncate">{booking.customer_name}</p>
                    <p className="text-xs text-zinc-500 dark:text-white/40 truncate">
                      {typeof service === 'object' ? service.name : '—'}
                      {typeof staff === 'object' ? ` · ${staff.name}` : ''}
                    </p>
                    {booking.notes && (
                      <p className="flex items-center gap-1 text-xs text-zinc-400 dark:text-white/30 mt-0.5 truncate">
                        <MessageSquare className="h-3 w-3 shrink-0" />{booking.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot[booking.status] ?? 'bg-zinc-300'}`} />
                    <span className="hidden sm:block text-xs text-zinc-500 dark:text-white/40">{statusLabel[booking.status]}</span>
                    <BookingActions bookingId={booking.id} status={booking.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
