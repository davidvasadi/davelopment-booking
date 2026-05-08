import { requireAuth } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { formatDate } from '@/lib/utils'
import DateFilter from '@/components/dashboard/DateFilter'
import BookingActions from '@/components/dashboard/BookingActions'
import type { Salon, Booking, Service, StaffMember } from '@/payload/payload-types'

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

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams
  const user = await requireAuth('salon_owner')
  const payload = await getPayloadClient()

  const salonResult = await payload.find({
    collection: 'salons',
    where: { owner: { equals: user.id } },
    limit: 1,
  })
  const salon = salonResult.docs[0] as Salon
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
    <div className="p-5 lg:p-8 max-w-3xl">
      <div className="mb-8">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Napi nézet</p>
        <h1 className="text-3xl font-black tracking-tight text-zinc-900">Foglalások</h1>
      </div>

      <div className="mb-6">
        <DateFilter currentDate={date} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-900">{formatDate(date)}</h2>
          <span className="text-sm text-zinc-400">{bookings.totalDocs} foglalás</span>
        </div>

        {bookings.docs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-zinc-400 text-sm">Nincs foglalás ezen a napon</p>
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
                  className={`flex items-center justify-between px-6 py-4 ${i < bookings.docs.length - 1 ? 'border-b border-zinc-100' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold text-zinc-400 w-24 shrink-0">
                      {booking.start_time}–{booking.end_time}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-zinc-900">{booking.customer_name}</p>
                      <p className="text-xs text-zinc-500">
                        {typeof service === 'object' ? service.name : '—'}
                        {typeof staff === 'object' ? ` · ${staff.name}` : ''}
                      </p>
                      {booking.customer_phone && (
                        <p className="text-xs text-zinc-400">{booking.customer_phone}</p>
                      )}
                      {booking.notes && (
                        <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                          <span className="shrink-0">💬</span>
                          <span className="line-clamp-2">{booking.notes}</span>
                        </p>
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
