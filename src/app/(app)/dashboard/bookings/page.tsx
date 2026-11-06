import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getDayName, hhmmToMinutes, fixMediaUrl } from '@/lib/utils'
import { parseISO } from 'date-fns'
import { BookingsDateNav, type BookingsRange } from '@/components/shared/BookingsDateNav'
import { SalonDailyView } from '@/components/dashboard/SalonDailyView'
import { SalonScheduleView } from '@/components/dashboard/SalonScheduleView'
import { BookingsMoreMenu } from '@/components/shared/BookingsMoreMenu'
import WaitlistPanel from '@/components/dashboard/WaitlistPanel'
import type { Booking, Service, StaffMember, Availability } from '@/payload/payload-types'
import { findMyStaffId } from '@/lib/myStaffLink'
import { APP_URL } from '@/lib/brand'
import { getClosedDays } from '@/lib/closedDays'
import { withAvatarFallback, withBookingStaffAvatars } from '@/lib/staffAvatars'
import { onsiteSettingsOf } from '@/lib/onsiteSettings'

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
  // A tulaj SAJÁT (ha van) linkelt staff-rekordja is kell — nem a szűkítéshez (a tulaj mindig
  // mindenkit lát), hanem hogy a mobil idővonalon a SAJÁT szabadnapja/szünete elsődleges helyen
  // jelenjen meg akkor is, ha egyébként a kevert (mindenkit mutató) nézetet nézi.
  const resolvedOwnStaffId = await findMyStaffId(salon.id, userId, userEmail)
  const myStaffId = role !== 'owner' ? resolvedOwnStaffId ?? 0 : null
  const scopeWhere = role !== 'owner' ? [{ staff: { equals: myStaffId ?? 0 } }] : []
  // A fejléc-avatarsor (szakember-oszlopok) is csak a SAJÁT oszlopot mutassa nem-tulajnak —
  // különben a foglalás-adat rejtve van, de mások neve/avatarja még mindig látszik a fejlécben.
  const staffScopeWhere = role !== 'owner' ? [{ id: { equals: myStaffId ?? 0 } }] : []
  const viewerStaffId = resolvedOwnStaffId != null ? String(resolvedOwnStaffId) : undefined

  // Meghívóra váró (még nem elfogadott) tagok — amíg nem fogadják el, nem oszthatók be
  // foglalásra sehol (BookingEditSheet lakat + UX infó a kártyájukon).
  const invitedRes = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'invited' } }] },
    depth: 0, limit: 500, overrideAccess: true,
  })
  const invitedEmails = new Set((invitedRes.docs as { email?: string | null }[]).map((m) => (m.email ?? '').toLowerCase()).filter(Boolean))

  // Zárva-napok — ugyanaz a forrás, mint a Naptár oldalon és a dátumválasztón (lib/closedDays).
  const { closedDates, closedWeekdays } = await getClosedDays(payload, 'salon', salon.id)

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
    <BookingsDateNav key="date-filter" base="/dashboard" currentDate={selectedDate} range={range} loadEndpoint="/api/salon/day-load" />
  )

  if (range === 'day') {
    // ── NAPI nézet (változatlan viselkedés) ──
    const dayName = getDayName(parseISO(selectedDate))
    const [staffRes, servicesRes, bookingsRes, availRes, shiftsRes] = await Promise.all([
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
        // service + staff kifejtve (depth 1); a munkatárs fotóját a withBookingStaffAvatars pótolja a staff-listából.
        // A szalonból csak a név — korábban depth 2: foglalásonként a szalon teljes adatlapja (sebesség, docs/sebesseg)
        depth: 1, populate: { salons: { name: true } },
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
      payload.find({
        collection: 'shifts',
        where: { and: [{ salon: { equals: salon.id } }, { date: { equals: `${selectedDate}T12:00:00.000Z` } }, ...(role !== 'owner' ? [{ staff: { equals: myStaffId ?? 0 } }] : [])] },
        depth: 0,
        limit: 200,
        overrideAccess: true,
      }),
    ])

    const staff = await withAvatarFallback(payload, staffRes.docs as StaffMember[])
    const services = servicesRes.docs as Service[]
    const bookings = withBookingStaffAvatars(bookingsRes.docs as Booking[], staff)
    // Üres napon (design 6.3) a következő foglalás — egy kattintással odaugrik.
    const nextRaw = bookings.some((b) => b.status !== 'cancelled') ? null : (await payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { greater_than: selectedDate } }, { status: { not_in: ['cancelled', 'no_show'] } }, ...scopeWhere] },
      sort: ['date', 'start_time'], limit: 1, depth: 1, overrideAccess: true,
    })).docs[0] as Booking | undefined
    const nextBooking = nextRaw ? { date: String(nextRaw.date).slice(0, 10), time: nextRaw.start_time, title: [nextRaw.customer_name, typeof nextRaw.service === 'object' && nextRaw.service ? nextRaw.service.name : null].filter(Boolean).join(', ') } : null
    const rule = availRes.docs[0] as Availability | undefined
    // staffId → napi szünet (Shifts.breaks) — vizuálisan a "zárva" stílussal jelenik meg. Egy nap
    // TÖBB szünetet is tarthat, de ez a timeline-nézet (egyelőre) csak az ELSŐT jeleníti meg —
    // a tényleges foglalás-tiltás (lib/availability.ts) mindegyiket helyesen figyelembe veszi.
    const staffBreaks: Record<string, { start: string; end: string }> = {}
    // staffId → aznap szabadnapos/szabadságon/beteg (Shifts.type) — a teljes oszlopa ez alapján
    // jelenik meg, nem az üres/beosztatlan hatch-mintával.
    const staffOffType: Record<string, 'leave' | 'sick' | 'vacation'> = {}
    for (const sh of shiftsRes.docs as { staff?: unknown; type?: string; start_time?: string | null; end_time?: string | null; breaks?: { start_time: string; end_time: string }[] | null }[]) {
      const sid = sh.staff != null ? String(typeof sh.staff === 'object' ? (sh.staff as { id: string | number }).id : sh.staff) : null
      if (!sid) continue
      const firstBreak = sh.breaks?.[0]
      if (firstBreak) staffBreaks[sid] = { start: firstBreak.start_time, end: firstBreak.end_time }
      if (sh.type === 'leave' || sh.type === 'sick' || sh.type === 'vacation') staffOffType[sid] = sh.type
    }

    // ── Idő-tengely: a szalon aznapi nyitvatartása, ésszerű alapértékkel, majd kiszélesítve
    //    a napi foglalásokra ÉS a ténylegesen beosztott munkatársak műszak-idejére, hogy egy
    //    foglalás vagy egy tovább nyitva lévő szakember se essen a tengelyen kívülre. ──
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
    for (const sh of shiftsRes.docs as { type?: string; start_time?: string | null; end_time?: string | null }[]) {
      if (sh.type !== 'shift' || !sh.start_time || !sh.end_time) continue
      openMin = Math.min(openMin, hhmmToMinutes(sh.start_time))
      closeMin = Math.max(closeMin, hhmmToMinutes(sh.end_time))
    }
    openMin = Math.floor(openMin / 60) * 60
    closeMin = Math.ceil(closeMin / 60) * 60

    const isClosedToday = closedDates.includes(selectedDate) || (selectedDate >= ymd(new Date()) && closedWeekdays.includes(parseISO(selectedDate).getDay()))

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
            <BookingsMoreMenu key="print-btn" days={[selectedDate]} />
          }
          canManage={canManage}
          consentEnabled={!!salon.consent_settings?.enabled}
          onsite={onsiteSettingsOf(salon)}
          staffBreaks={staffBreaks}
          staffOffType={staffOffType}
          viewerStaffId={viewerStaffId}
          isClosedToday={isClosedToday}
          nextBooking={nextBooking}
          publicUrl={salon.slug ? `${APP_URL}/${salon.slug}` : null}
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

  const [staffRes, servicesRes, bookingsRes, shiftsRes] = await Promise.all([
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
      // depth 1 + a szalonból csak a név (lásd a napi nézetet) — havi nézetben akár több ezer foglalás
      depth: 1, populate: { salons: { name: true } },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'shifts',
      where: {
        and: [
          { salon: { equals: salon.id } },
          { date: { greater_than_equal: `${rangeStart}T00:00:00.000Z` } },
          { date: { less_than_equal: `${rangeEnd}T23:59:59.999Z` } },
          { type: { in: ['leave', 'sick', 'vacation'] } },
          ...(role !== 'owner' ? [{ staff: { equals: myStaffId ?? 0 } }] : []),
        ],
      },
      depth: 0,
      limit: range === 'month' ? 5000 : 1000,
      overrideAccess: true,
    }),
  ])
  const staff = await withAvatarFallback(payload, staffRes.docs as StaffMember[])
  const services = servicesRes.docs as Service[]
  const bookings = withBookingStaffAvatars(bookingsRes.docs as Booking[], staff)

  // Szakember-id → nap (`YYYY-MM-DD`) → teljes napos távollét-típus, a heti/havi rácshoz
  // (ugyanaz a Shifts.type forrás, mint a napi nézet staffOffType-ja, csak a teljes tartományra).
  const staffOffType: Record<string, Record<string, 'leave' | 'sick' | 'vacation'>> = {}
  for (const sh of shiftsRes.docs as { staff?: unknown; type?: string; date?: string | null }[]) {
    const sid = sh.staff != null ? String(typeof sh.staff === 'object' ? (sh.staff as { id: string | number }).id : sh.staff) : null
    const day = sh.date ? String(sh.date).slice(0, 10) : null
    if (!sid || !day || (sh.type !== 'leave' && sh.type !== 'sick' && sh.type !== 'vacation')) continue
    if (!staffOffType[sid]) staffOffType[sid] = {}
    staffOffType[sid][day] = sh.type
  }

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
        onsite={onsiteSettingsOf(salon)}
        days={days}
        range={range}
        date={selectedDate}
        salonId={String(salon.id)}
        bookings={bookings}
        staff={staff}
        services={services}
        openMin={rangeOpenMin}
        closeMin={rangeCloseMin}
        invitedEmails={invitedEmails}
        staffOffType={staffOffType}
        closedDates={closedDates}
        closedWeekdays={closedWeekdays}
        dateFilter={dateFilterEl}
        printButton={
          <BookingsMoreMenu key="print-btn" days={days} />
        }
        canManage={canManage}
      />
      <WaitlistPanel salonId={salon.id} />
    </div>
  )
}
