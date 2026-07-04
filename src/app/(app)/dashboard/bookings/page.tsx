import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { formatDate } from '@/lib/utils'
import { format, subDays, startOfWeek, startOfMonth } from 'date-fns'
import { hu } from 'date-fns/locale'
import DateFilter from '@/components/dashboard/DateFilter'
import BookingViewToggle from '@/components/dashboard/BookingViewToggle'
import BookingListFilters from '@/components/dashboard/BookingListFilters'
import BookingActions from '@/components/dashboard/BookingActions'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'
import type { Where } from 'payload'
import { MessageSquare, ChevronLeft, ChevronRight, CalendarDays, Repeat } from 'lucide-react'
import Link from 'next/link'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'

const statusLabel: Record<string, string> = {
  pending: 'Függő',
  confirmed: 'Megerősített',
  cancelled: 'Lemondott',
  completed: 'Befejezett',
}
const statusDot: Record<string, string> = {
  pending: 'bg-gold',
  confirmed: 'bg-ink-dark',
  cancelled: 'bg-bad',
  completed: 'bg-[#1D9D63]',
}

/** Fehér davelopment kártya. */
const CARD = 'rounded-[22px] bg-white border border-line shadow-dav-card'

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

/** Egy foglalás-sor (napi + lista nézet közös prezentáció). */
function BookingRow({
  booking,
  notesClamp,
  isLast,
}: {
  booking: Booking
  notesClamp: string
  isLast: boolean
}) {
  const service = booking.service as Service
  const staff = booking.staff as StaffMember
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-4 sm:gap-4 sm:px-6 ${isLast ? '' : 'border-b border-line'}`}>
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <span className="w-14 shrink-0 font-mono text-xs font-bold leading-tight text-ink-soft sm:w-24">
          <span className="block sm:inline">{booking.start_time}</span>
          <span className="hidden sm:inline">–</span>
          <span className="block text-ink-soft2 sm:inline sm:text-ink-soft">{booking.end_time}</span>
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-ink">{booking.customer_name}</p>
            {booking.series_id && (
              // Ismétlődő sorozat tagja — csak jelölés, a viselkedést nem érinti.
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#F0E7CF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9A7B12]">
                <Repeat className="h-3 w-3" /> Sorozat
              </span>
            )}
          </div>
          <p className="truncate text-xs text-ink-soft">
            {typeof service === 'object' ? service.name : '—'}
            {typeof staff === 'object' ? ` · ${staff.name}` : ''}
          </p>
          {booking.customer_phone && (
            <p className="text-xs text-ink-soft">{booking.customer_phone}</p>
          )}
          {booking.notes && (
            <p className="mt-1 flex items-start gap-1 text-xs text-ink-soft">
              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0" />
              <span className={notesClamp}>{booking.notes}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusDot[booking.status] ?? 'bg-line-strong'}`} />
          <span className="hidden text-xs text-ink-soft sm:block">{statusLabel[booking.status]}</span>
        </div>
        <BookingActions bookingId={booking.id} status={booking.status} />
      </div>
    </div>
  )
}

/** Hero-fejléc: eyebrow + cím + nézetváltó. */
function Hero({ title, current }: { title: string; current: 'day' | 'list' }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="text-[13px] font-medium text-ink-soft">Foglalások</p>
        <h1 className="mt-0.5 text-4xl font-light tracking-[-0.02em] text-ink lg:text-[42px]">{title}</h1>
      </div>
      <BookingViewToggle current={current} />
    </div>
  )
}

function EmptyCard({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <CalendarDays className="h-8 w-8 text-ink-soft" strokeWidth={1.6} />
      <p className="text-sm text-ink-soft">{title}</p>
    </div>
  )
}

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

  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

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

    const docs = bookings.docs as Booking[]
    const active = docs.filter((b) => b.status !== 'cancelled')
    const completed = docs.filter((b) => b.status === 'completed').length
    const cancelled = docs.filter((b) => b.status === 'cancelled').length
    const pending = docs.filter((b) => b.status === 'pending').length

    const kpis = [
      { label: 'Aktív foglalás', value: String(active.length), accent: true },
      { label: 'Befejezett', value: String(completed) },
      { label: 'Lemondott', value: String(cancelled) },
      { label: 'Függő', value: String(pending), dot: true },
    ]

    return (
      <div className="space-y-6 p-5 lg:p-0">
        <Hero title="Napi nézet" current="day" />

        <DateFilter currentDate={date} />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k, i) =>
            k.accent ? (
              <div key={i} className="rounded-[20px] bg-ink-dark px-[18px] py-4">
                <div className="text-xs font-medium text-white/55">{k.label}</div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[30px] font-light tracking-[-0.02em] text-white">{k.value}</span>
                  <span className="text-xs font-medium text-gold">ma</span>
                </div>
              </div>
            ) : (
              <div key={i} className={`${CARD} px-[18px] py-4`}>
                <div className="text-xs font-medium text-ink-soft">{k.label}</div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[30px] font-light tracking-[-0.02em] text-ink">{k.value}</span>
                  {k.dot && <span className="h-2 w-2 rounded-[3px] bg-gold" />}
                </div>
              </div>
            )
          )}
        </div>

        <div className={CARD}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-4 sm:px-6">
            <h2 className="min-w-0 truncate text-base font-medium text-ink">{formatDate(date)}</h2>
            <span className="shrink-0 text-sm text-ink-soft">{bookings.totalDocs} foglalás</span>
          </div>

          {docs.length === 0 ? (
            <EmptyCard title="Nincs foglalás ezen a napon" />
          ) : (
            <div>
              {docs.map((booking, i) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  notesClamp="line-clamp-2"
                  isLast={i === docs.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        <WaitlistPanel salonId={salon.id} />
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
    return `/dashboard/bookings?${params}`
  }

  const arrowBox = 'flex h-9 w-9 items-center justify-center rounded-xl transition-colors'

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <Hero title="Lista nézet" current="list" />

      <BookingListFilters status={status} range={range} search={search} />

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-soft">
          {bookings.totalDocs} foglalás
          {totalPages > 1 && ` · ${currentPage}/${totalPages}. oldal`}
        </p>
      </div>

      {bookings.docs.length === 0 ? (
        <div className={CARD}>
          <EmptyCard title="Nincs találat a megadott szűrőkre" />
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map(date => (
            <div key={date} className={CARD}>
              <div className="border-b border-line px-4 py-3 sm:px-6">
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
                  {format(new Date(date + 'T00:00:00'), 'yyyy. MMMM d., EEEE', { locale: hu })}
                </p>
              </div>
              {grouped[date].map((booking, i) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  notesClamp="line-clamp-1"
                  isLast={i === grouped[date].length - 1}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {currentPage > 1 ? (
            <Link href={pageUrl(currentPage - 1)} className={`${arrowBox} border border-line bg-white text-ink-soft2 hover:border-line-strong hover:text-ink`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <div className={`${arrowBox} border border-line text-ink-soft/40`}>
              <ChevronLeft className="h-4 w-4" />
            </div>
          )}
          <span className="px-2 text-sm font-semibold text-ink">
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link href={pageUrl(currentPage + 1)} className={`${arrowBox} border border-line bg-white text-ink-soft2 hover:border-line-strong hover:text-ink`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <div className={`${arrowBox} border border-line text-ink-soft/40`}>
              <ChevronRight className="h-4 w-4" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
