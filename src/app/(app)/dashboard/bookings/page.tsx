import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getDayName, hhmmToMinutes, fixMediaUrl } from '@/lib/utils'
import { parseISO } from 'date-fns'
import DateFilter, { type BookingsRange } from '@/components/dashboard/DateFilter'
import { SalonDailyView } from '@/components/dashboard/SalonDailyView'
import { SalonScheduleView } from '@/components/dashboard/SalonScheduleView'
import { PrintDayButton } from '@/components/dashboard/PrintDayButton'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import type { Booking, Service, StaffMember, Availability } from '@/payload/payload-types'
import { findMyStaffId } from '@/lib/myStaffLink'

/** Fallback-avatar EMAIL alapján (lásd `dashboard/schedule/page.tsx` azonos komment) — ha a
 *  tulaj sosem töltött fel külön staff-avatart, de a személy a SAJÁT profiljában igen, a
 *  Foglalások fejléce (StaffColumnsTimeline) enélkül sosem tudta megjeleníteni a fotót. */
async function withAvatarFallback(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  staff: StaffMember[],
): Promise<StaffMember[]> {
  const emails = staff.map((s) => s.email).filter((e): e is string => !!e)
  if (emails.length === 0) return staff
  const usersRes = await payload.find({
    collection: 'users',
    where: { email: { in: emails } },
    depth: 0, limit: 500, overrideAccess: true,
  })
  const avatarByEmail: Record<string, string> = {}
  for (const u of usersRes.docs as { email?: string | null; avatar_url?: string | null }[]) {
    const fixed = fixMediaUrl(u.avatar_url)
    if (u.email && fixed) avatarByEmail[u.email.toLowerCase()] = fixed
  }
  return staff.map((s) => {
    if (s.avatar || !s.email) return s
    const fallback = avatarByEmail[s.email.toLowerCase()]
    return fallback ? { ...s, avatar: { url: fallback } as unknown as StaffMember['avatar'] } : s
  })
}

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

  const { salon, capabilities, role, userId, userEmail } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['bookings.view', 'bookings.manage'], '/dashboard')
  const payload = await getPayloadClient()

  // Munkavállalói nézet: mindenki csak a SAJÁT foglalását látja, kivéve a tulajt (ő mindig
  // mindenkiét). A `findMyStaffId` elsődlegesen a `Staff.user` relációt nézi (megbízható —
  // ezt állítja be a meghívás-elfogadás automatikusan, vagy a tulaj a Munkatársak oldalon az
  // "Ez a saját fiókom" kapcsolóval), email-fallbackkel a régi, még nem linkelt rekordokra.
  // A sentinel `0` (NEM string, pl. '__none__') — a `staff_id` numerikus oszlop, egy nem-numerikus
  // sentinel NaN-re castolva eldobatta a lekérdezést Postgres alatt.
  const myStaffId = role !== 'owner' ? (await findMyStaffId(salon.id, userId, userEmail)) ?? 0 : null
  const scopeWhere = role !== 'owner' ? [{ staff: { equals: myStaffId ?? 0 } }] : []
  // A fejléc-avatarsor (szakember-oszlopok) is csak a SAJÁT oszlopot mutassa nem-tulajnak —
  // különben a foglalás-adat rejtve van, de mások neve/avatarja még mindig látszik a fejlécben.
  const staffScopeWhere = role !== 'owner' ? [{ id: { equals: myStaffId ?? 0 } }] : []

  // Meghívóra váró (még nem elfogadott) tagok — amíg nem fogadják el, nem oszthatók be
  // foglalásra sehol (BookingEditSheet lakat + UX infó a kártyájukon).
  const invitedRes = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'invited' } }] },
    depth: 0, limit: 500, overrideAccess: true,
  })
  const invitedEmails = new Set((invitedRes.docs as { email?: string | null }[]).map((m) => (m.email ?? '').toLowerCase()).filter(Boolean))

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
  const dateFilterEl = (
    <DateFilter key="date-filter" currentDate={selectedDate} range={range} hideRangeOnMobile={range === 'day'} />
  )

  if (range === 'day') {
    // ── NAPI nézet (változatlan viselkedés) ──
    const dayName = getDayName(parseISO(selectedDate))
    const [staffRes, servicesRes, bookingsRes, availRes] = await Promise.all([
      payload.find({
        collection: 'staff',
        where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }, ...staffScopeWhere] },
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
        where: { and: [{ salon: { equals: salon.id } }, { date: { equals: selectedDate } }, ...scopeWhere] },
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

    const staff = await withAvatarFallback(payload, staffRes.docs as StaffMember[])
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
          range={range}
          salonId={String(salon.id)}
          bookings={bookings}
          staff={staff}
          services={services}
          openMin={openMin}
          closeMin={closeMin}
          invitedEmails={invitedEmails}
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
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }, ...staffScopeWhere] },
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
          ...scopeWhere,
        ],
      },
      sort: 'start_time',
      limit: range === 'month' ? 5000 : 2000,
      depth: 2,
      overrideAccess: true,
    }),
  ])
  const staff = await withAvatarFallback(payload, staffRes.docs as StaffMember[])
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
        invitedEmails={invitedEmails}
        dateFilter={dateFilterEl}
        canManage={canManage}
      />
      <WaitlistPanel salonId={salon.id} />
    </div>
  )
}
