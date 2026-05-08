import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { formatDate, formatPrice } from '@/lib/utils'
import { getDashboardStats } from '@/lib/dashboardStats'
import { TrendChart, DowChart, ServiceChart, StaffChart } from '@/components/dashboard/DashboardCharts'
import BookingActions from '@/components/dashboard/BookingActions'
import type { Salon, Booking, Service, StaffMember } from '@/payload/payload-types'
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react'

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
    <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
      <TrendingUp className="h-3 w-3" />+{diff}%
    </span>
  )
  if (diff < 0) return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-red-500">
      <TrendingDown className="h-3 w-3" />{diff}%
    </span>
  )
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-zinc-400"><Minus className="h-3 w-3" />0%</span>
}

function KpiCard({ label, sub, value, diff, dark }: {
  label: string; sub: string; value: string; diff: number; dark?: boolean
}) {
  return (
    <div className={`rounded-2xl p-6 ${dark ? 'bg-zinc-950' : 'bg-white shadow-sm'}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest mb-1 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</p>
      <p className={`text-4xl font-black tracking-tight leading-none mb-2 ${dark ? 'text-white' : 'text-zinc-900'}`}>{value}</p>
      <div className="flex items-center justify-between">
        <p className={`text-sm ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</p>
        <DiffBadge diff={diff} />
      </div>
    </div>
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
    <div className="p-5 lg:p-8 max-w-4xl space-y-6">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">{formatDate(today)}</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">{greeting}!</h1>
      </div>

      {/* Insight bar */}
      {(stats.bestDay || stats.bestHour) && (
        <div className="bg-zinc-950 rounded-2xl px-5 py-4 flex items-center gap-3">
          <Zap className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-zinc-300">
            {stats.bestDay && <><span className="text-white font-bold">{stats.bestDay}</span> az Ön legerősebb napja.</>}
            {stats.bestDay && stats.bestHour && ' '}
            {stats.bestHour && <>A csúcsidő: <span className="text-white font-bold">{stats.bestHour}</span>.</>}
            {stats.avgBookingValue > 0 && <> Átlagos foglalás: <span className="text-white font-bold">{formatPrice(stats.avgBookingValue, 'HUF')}</span>.</>}
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          sub="Ma"
          label="Bevétel"
          value={formatPrice(stats.revenueToday, 'HUF')}
          diff={stats.revenueTodayDiff}
        />
        <KpiCard
          sub="E hónap"
          label="Bevétel"
          value={formatPrice(stats.revenueMonth, 'HUF')}
          diff={stats.revenueMonthDiff}
          dark
        />
        <KpiCard
          sub="Ma"
          label="Foglalás"
          value={String(stats.bookingsToday)}
          diff={stats.bookingsTodayDiff}
        />
        <KpiCard
          sub="E hónap"
          label="Foglalás"
          value={String(stats.bookingsMonth)}
          diff={stats.bookingsMonthDiff}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <span className="text-xl font-black text-zinc-400">%</span>
          </div>
          <div>
            <p className="text-2xl font-black text-zinc-900">{stats.completionRate}%</p>
            <p className="text-xs text-zinc-500">Teljesítési arány (30 nap)</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
            <span className="text-xl font-black text-zinc-400">Ø</span>
          </div>
          <div>
            <p className="text-2xl font-black text-zinc-900">{formatPrice(stats.avgBookingValue, 'HUF')}</p>
            <p className="text-xs text-zinc-500">Átlagos foglalás értéke</p>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      <TrendChart data={stats.last30Days} />

      {/* DoW + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DowChart data={stats.byDayOfWeek} />
        {stats.byService.length > 0 && <ServiceChart data={stats.byService} />}
      </div>

      {stats.byStaff.length > 0 && (
        <StaffChart data={stats.byStaff} />
      )}

      {/* Today's schedule */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-900">Mai program</h2>
          <span className="text-sm text-zinc-400">{todayBookings.totalDocs} foglalás</span>
        </div>
        {todayBookings.docs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-zinc-400 text-sm">Ma nincs foglalás</p>
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
                  className={`flex items-center justify-between px-6 py-4 ${i < todayBookings.docs.length - 1 ? 'border-b border-zinc-100' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-mono font-bold text-zinc-400 w-24 shrink-0">
                      {booking.start_time}–{booking.end_time}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900">{booking.customer_name}</p>
                      <p className="text-xs text-zinc-500">
                        {typeof service === 'object' ? service.name : '—'}
                        {typeof staff === 'object' ? ` · ${staff.name}` : ''}
                      </p>
                      {booking.notes && (
                        <p className="text-xs text-amber-600 mt-1 line-clamp-1">💬 {booking.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${statusDot[booking.status] ?? 'bg-zinc-300'}`} />
                      <span className="text-xs text-zinc-500">{statusLabel[booking.status]}</span>
                    </div>
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
