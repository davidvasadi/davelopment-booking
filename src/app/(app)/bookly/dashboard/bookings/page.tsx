import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { formatDate } from '@/lib/utils'
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { hu } from 'date-fns/locale'
import DateFilter from '@/components/dashboard/DateFilter'
import BookingViewToggle from '@/components/dashboard/BookingViewToggle'
import BookingListFilters from '@/components/dashboard/BookingListFilters'
import BookingActions from '@/components/dashboard/BookingActions'
import type { Salon, Booking, Service, StaffMember } from '@/payload/payload-types'
import type { Where } from 'payload'
import { MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const statusLabel: Record<string, string> = {
  pending: 'Függő',
  confirmed: 'Megerősített',
  cancelled: 'Lemondott',
  completed: 'Befejezett',
}
const statusDot: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
  cancelled: 'bg-red-400',
  completed: 'bg-zinc-400',
}

function getRangeDates(range: string): { from: string; to: string } {
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  if (range === 'week') {
    const mon = startOfWeek(today, { weekStartsOn: 1 })
    return { from: format(mon, 'yyyy-MM-dd'), to: todayStr }
  }
  if (range === 'month') return { from: format(startOfMonth(today), 'yyyy-MM-dd'), to: todayStr }
  if (range === '30') return { from: format(subDays(today, 29), 'yyyy-MM-dd'), to: todayStr }
  if (range === '90') return { from: format(subDays(today, 89), 'yyyy-MM-dd'), to: todayStr }
  return { from: '2020-01-01', to: todayStr }
}

const PER_PAGE = 25

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    date?: string
    status?: string
    range?: string
    search?: string
    page?: string
  }>
}) {
  const { view, date: dateParam, status = 'all', range = '30', search = '', page = '1' } = await searchParams
  const isListView = view === 'list'

  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon

  // ── DAY VIEW ─────────────────────────────────────────────────
  if (!isListView) {
    const date = dateParam ?? new Date().toISOString().split('T')[0]
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { date: { equals: date } },
        ],
      },
      sort: 'start_time',
      depth: 2,
      limit: 100,
    })

    return (
      <div className="p-5 lg:p-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Foglalások</p>
            <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Napi nézet</h1>
          </div>
          <BookingViewToggle current="day" />
        </div>

        <div className="mb-6">
          <DateFilter currentDate={date} />
        </div>

        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">{formatDate(date)}</h2>
            <span className="text-sm text-zinc-400 dark:text-white/30">{bookings.totalDocs} foglalás</span>
          </div>

          {bookings.docs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-zinc-400 dark:text-white/30 text-sm">Nincs foglalás ezen a napon</p>
            </div>
          ) : (
            <div>
              {bookings.docs.map((b, i) => {
                const booking = b as Booking
                const service = booking.service as Service
                const staff = booking.staff as StaffMember
                return (
                  <div
                    key={booking.id}
                    className={`flex items-center justify-between px-6 py-4 ${i < bookings.docs.length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono font-bold text-zinc-400 dark:text-white/30 w-24 shrink-0">
                        {booking.start_time}–{booking.end_time}
                      </span>
                      <div>
                        <p className="font-semibold text-sm text-zinc-800 dark:text-white/80">{booking.customer_name}</p>
                        <p className="text-xs text-zinc-500 dark:text-white/40">
                          {typeof service === 'object' ? service.name : '—'}
                          {typeof staff === 'object' ? ` · ${staff.name}` : ''}
                        </p>
                        {booking.customer_phone && (
                          <p className="text-xs text-zinc-400 dark:text-white/30">{booking.customer_phone}</p>
                        )}
                        {booking.notes && (
                          <p className="flex items-start gap-1 text-xs text-zinc-400 dark:text-white/30 mt-1">
                            <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{booking.notes}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${statusDot[booking.status] ?? 'bg-zinc-300 dark:bg-white/20'}`} />
                        <span className="text-xs text-zinc-500 dark:text-white/40">{statusLabel[booking.status]}</span>
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

  // ── LIST VIEW ────────────────────────────────────────────────
  const { from, to } = getRangeDates(range)
  const currentPage = Math.max(1, parseInt(page) || 1)

  const where: Where[] = [
    { salon: { equals: salon.id } },
    { date: { greater_than_equal: from } },
    { date: { less_than_equal: to } },
  ]
  if (status !== 'all') where.push({ status: { equals: status } })
  if (search.trim()) where.push({ customer_name: { contains: search.trim() } })

  const bookings = await payload.find({
    collection: 'bookings',
    where: { and: where },
    sort: '-date',
    depth: 2,
    limit: PER_PAGE,
    page: currentPage,
  })

  const totalPages = bookings.totalPages ?? 1

  // Group by date for display
  const grouped: Record<string, Booking[]> = {}
  for (const b of bookings.docs as Booking[]) {
    if (!grouped[b.date]) grouped[b.date] = []
    grouped[b.date].push(b)
  }
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const pageUrl = (p: number) => {
    const params = new URLSearchParams({ view: 'list', status, range, search, page: String(p) })
    return `/bookly/dashboard/bookings?${params}`
  }

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Foglalások</p>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Lista nézet</h1>
        </div>
        <BookingViewToggle current="list" />
      </div>

      <div className="mb-6">
        <BookingListFilters status={status} range={range} search={search} />
      </div>

      {/* Results count */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-zinc-400 dark:text-white/30">
          {bookings.totalDocs} foglalás
          {totalPages > 1 && ` · ${currentPage}/${totalPages}. oldal`}
        </p>
      </div>

      {bookings.docs.length === 0 ? (
        <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl px-6 py-16 text-center">
          <p className="text-zinc-400 dark:text-white/30 text-sm">Nincs találat a megadott szűrőkre</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map(date => (
            <div key={date} className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl overflow-hidden">
              <div className="px-6 py-3 border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-white/40">
                  {format(new Date(date + 'T00:00:00'), 'yyyy. MMMM d., EEEE', { locale: hu })}
                </p>
              </div>
              {grouped[date].map((booking, i) => {
                const service = booking.service as Service
                const staff = booking.staff as StaffMember
                return (
                  <div
                    key={booking.id}
                    className={`flex items-center justify-between px-6 py-4 ${i < grouped[date].length - 1 ? 'border-b border-zinc-100 dark:border-white/[0.04]' : ''}`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-xs font-mono font-bold text-zinc-400 dark:text-white/30 w-24 shrink-0">
                        {booking.start_time}–{booking.end_time}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-zinc-800 dark:text-white/80 truncate">{booking.customer_name}</p>
                        <p className="text-xs text-zinc-500 dark:text-white/40 truncate">
                          {typeof service === 'object' ? service.name : '—'}
                          {typeof staff === 'object' ? ` · ${staff.name}` : ''}
                        </p>
                        {booking.customer_phone && (
                          <p className="text-xs text-zinc-400 dark:text-white/30">{booking.customer_phone}</p>
                        )}
                        {booking.notes && (
                          <p className="flex items-start gap-1 text-xs text-zinc-400 dark:text-white/30 mt-1">
                            <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{booking.notes}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${statusDot[booking.status] ?? 'bg-zinc-300 dark:bg-white/20'}`} />
                        <span className="hidden sm:block text-xs text-zinc-500 dark:text-white/40">{statusLabel[booking.status]}</span>
                      </div>
                      <BookingActions bookingId={booking.id} status={booking.status} />
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={pageUrl(currentPage - 1)} className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] flex items-center justify-center text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <div className="h-9 w-9 rounded-xl border border-zinc-100 dark:border-white/[0.06] flex items-center justify-center text-zinc-300 dark:text-white/20">
              <ChevronLeft className="h-4 w-4" />
            </div>
          )}
          <span className="text-sm font-semibold text-zinc-700 dark:text-white/70 px-2">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link href={pageUrl(currentPage + 1)} className="h-9 w-9 rounded-xl border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] flex items-center justify-center text-zinc-500 dark:text-white/40 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-400 transition-colors">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className="h-9 w-9 rounded-xl border border-zinc-100 dark:border-white/[0.06] flex items-center justify-center text-zinc-300 dark:text-white/20">
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
