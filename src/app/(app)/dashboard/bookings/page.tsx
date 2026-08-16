import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getDayName, hhmmToMinutes } from '@/lib/utils'
import { parseISO } from 'date-fns'
import DateFilter, { type BookingsRange } from '@/components/dashboard/DateFilter'
import { SalonDailyView } from '@/components/dashboard/SalonDailyView'
import { SalonScheduleView } from '@/components/dashboard/SalonScheduleView'
import { PrintDayButton } from '@/components/dashboard/PrintDayButton'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import type { Booking, Service, StaffMember, Availability } from '@/payload/payload-types'

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A `dateStr`-t tartalmazó hét hétfője (Date objektumként, hogy tovább számolható legyen). */
function mondayOf(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7 // hétfő = 0
  dt.setDate(dt.getDate() - dow)
  return dt
}

/** A `dateStr`-t tartalmazó hónap összes napja `YYYY-MM-DD` tömbként. */
function daysOfMonth(dateStr: string): string[] {
  const [y, m] = dateStr.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => ymd(new Date(y, m - 1, i + 1)))
}

// Nélküle Next.js gyorsítótárazhatja ezt az oldalt — a "ma" alapértelmezett dátum a
// legutóbbi renderelés napján ragadhat, akkor is ha időközben elmúlt éjfél.
export const dynamic = 'force-dynamic'

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; booking?: string; range?: string }>
}) {
  const { date, booking: bookingParam, range: rawRange } = await searchParams
  const range: BookingsRange = rawRange === 'week' ? 'week' : rawRange === 'month' ? 'month' : 'day'

  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'bookings.view', '/dashboard')
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

  const canManage = can(capabilities, 'bookings.manage')
  const dateFilterEl = <DateFilter key="date-filter" currentDate={selectedDate} range={range} />

  if (range === 'day') {
    // ── NAPI nézet (változatlan viselkedés) ──
    const dayName = getDayName(parseISO(selectedDate))
    const [staffRes, servicesRes, bookingsRes, availRes] = await Promise.all([
      payload.find({
        collection: 'staff',
        where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
        sort: 'name',
        limit: 100,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'services',
        where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
        sort: 'name',
        limit: 200,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'bookings',
        where: { and: [{ salon: { equals: salon.id } }, { date: { equals: selectedDate } }] },
        sort: 'start_time',
        limit: 300,
        depth: 2, // service + staff kifejtve, a staff.avatar médiával
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

    const staff = staffRes.docs as StaffMember[]
    const services = servicesRes.docs as Service[]
    const bookings = bookingsRes.docs as Booking[]
    const rule = availRes.docs[0] as Availability | undefined

    // ── Idő-tengely: a szalon aznapi nyitvatartása, ésszerű alapértékkel, majd kiszélesítve
    //    a napi foglalásokra, hogy egy foglalás se essen a tengelyen kívülre. ──
    let openMin = 8 * 60
    let closeMin = 20 * 60
    if (rule?.is_available && rule.start_time && rule.end_time) {
      openMin = hhmmToMinutes(rule.start_time)
      closeMin = hhmmToMinutes(rule.end_time)
      // "00:00" záróra a NAP VÉGÉT jelenti (éjfélig nyitva), nem a nap elejét — enélkül
      // closeMin=0 lenne, ami <= openMin, és az egész idő-tengely (hourMarks, totalMin) összeomlana.
      if (closeMin <= openMin) closeMin += 24 * 60
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
          dateFilter={dateFilterEl}
          printButton={
            <PrintDayButton key="print-btn" date={selectedDate} salonName={salon.name} bookings={bookings} />
          }
          canManage={canManage}
          consentEnabled={!!salon.consent_settings?.enabled}
        />
        <WaitlistPanel salonId={salon.id} />
      </div>
    )
  }

  // ── HETI / HAVI nézet: közös SalonScheduleView, csak a `days` tartomány más. ──
  const days = range === 'week' ? Array.from({ length: 7 }, (_, i) => {
    const d = mondayOf(selectedDate)
    d.setDate(d.getDate() + i)
    return ymd(d)
  }) : daysOfMonth(selectedDate)
  const rangeStart = days[0]
  const rangeEnd = days[days.length - 1]

  const [staffRes, servicesRes, bookingsRes] = await Promise.all([
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      sort: 'name',
      limit: 100,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      sort: 'name',
      limit: 200,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { date: { greater_than_equal: rangeStart } },
          { date: { less_than_equal: rangeEnd } },
        ],
      },
      sort: 'start_time',
      limit: range === 'month' ? 5000 : 2000,
      depth: 2,
      overrideAccess: true,
    }),
  ])
  const staff = staffRes.docs as StaffMember[]
  const services = servicesRes.docs as Service[]
  const bookings = bookingsRes.docs as Booking[]

  // Idő-tengely: ésszerű alapérték, kiszélesítve a tartomány összes foglalására, hogy egy se
  // essen a tengelyen kívülre (ugyanaz a minta, mint a napi nézetnél).
  let rangeOpenMin = 8 * 60
  let rangeCloseMin = 20 * 60
  for (const b of bookings) {
    if (b.status === 'cancelled') continue
    rangeOpenMin = Math.min(rangeOpenMin, hhmmToMinutes(b.start_time))
    rangeCloseMin = Math.max(rangeCloseMin, hhmmToMinutes(b.end_time))
  }
  rangeOpenMin = Math.floor(rangeOpenMin / 60) * 60
  rangeCloseMin = Math.ceil(rangeCloseMin / 60) * 60

  return (
    <div className="p-5 lg:p-0 space-y-5">
      <SalonScheduleView
        days={days}
        title="Foglalások"
        subtitle={range === 'week' ? 'Heti áttekintés' : 'Havi áttekintés'}
        salonId={String(salon.id)}
        bookings={bookings}
        staff={staff}
        services={services}
        openMin={rangeOpenMin}
        closeMin={rangeCloseMin}
        dateFilter={dateFilterEl}
        canManage={canManage}
      />
      <WaitlistPanel salonId={salon.id} />
    </div>
  )
}
