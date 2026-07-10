import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { getDayName, hhmmToMinutes } from '@/lib/utils'
import { parseISO } from 'date-fns'
import DateFilter from '@/components/dashboard/DateFilter'
import { SalonDailyView } from '@/components/dashboard/SalonDailyView'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import type { Booking, Service, StaffMember, Availability } from '@/payload/payload-types'

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; booking?: string }>
}) {
  const { date, booking: bookingParam } = await searchParams

  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  // Értesítésből érkezve (?booking=) a foglalás napjára ugrunk, hogy a sheet a megfelelő
  // napon nyíljon ki — a kliens a query alapján nyitja meg a szerkesztőt.
  let selectedDate = date ?? ymd(new Date())
  if (!date && bookingParam) {
    const b = await payload
      .findByID({ collection: 'bookings', id: bookingParam, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (b?.date) selectedDate = b.date
  }

  const dayName = getDayName(parseISO(selectedDate))

  const [bookingsRes, staffRes, servicesRes, availRes] = await Promise.all([
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { equals: selectedDate } }] },
      sort: 'start_time',
      limit: 300,
      depth: 2, // service + staff kifejtve, a staff.avatar médiával
      overrideAccess: true,
    }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      sort: 'name',
      limit: 100,
      depth: 1, // avatar média
      overrideAccess: true,
    }),
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      sort: 'name',
      limit: 200,
      depth: 0, // a service.staff id-ként elég a szűréshez
      overrideAccess: true,
    }),
    payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { staff: { exists: false } },
          { day_of_week: { equals: dayName } },
          { recurring: { equals: true } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    }),
  ])

  const bookings = bookingsRes.docs as Booking[]
  const staff = staffRes.docs as StaffMember[]
  const services = servicesRes.docs as Service[]
  const rule = availRes.docs[0] as Availability | undefined

  // ── Idő-tengely: a szalon aznapi nyitvatartása, ésszerű alapértékkel, majd kiszélesítve
  //    a napi foglalásokra, hogy egy foglalás se essen a tengelyen kívülre. ──
  let openMin = 8 * 60
  let closeMin = 20 * 60
  if (rule?.is_available && rule.start_time && rule.end_time) {
    openMin = hhmmToMinutes(rule.start_time)
    closeMin = hhmmToMinutes(rule.end_time)
  }
  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    openMin = Math.min(openMin, hhmmToMinutes(b.start_time))
    closeMin = Math.max(closeMin, hhmmToMinutes(b.end_time))
  }
  openMin = Math.floor(openMin / 60) * 60
  closeMin = Math.ceil(closeMin / 60) * 60

  return (
    <div className="p-5 lg:p-0 space-y-5">
      <SalonDailyView
        date={selectedDate}
        salonId={String(salon.id)}
        bookings={bookings}
        staff={staff}
        services={services}
        openMin={openMin}
        closeMin={closeMin}
        openBookingId={bookingParam}
        dateFilter={<DateFilter currentDate={selectedDate} />}
      />
      <WaitlistPanel salonId={salon.id} />
    </div>
  )
}
