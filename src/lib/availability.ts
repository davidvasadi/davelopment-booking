import { parseISO } from 'date-fns'
import type { Where } from 'payload'
import { hhmmToMinutes, minutesToHHMM, getDayName } from './utils'
import { getPayloadClient } from './payload'

interface SlotParams {
  salonId: string
  staffId?: string
  serviceId: string
  date: string // YYYY-MM-DD
  /** Ha igaz, a már elmúlt mai időpontok is szerepelnek a listában — csak a tulaj saját,
   *  bejelentkezett foglalás-felületén használjuk (utólagos/telefonos rögzítéshez), a
   *  publikus foglaló widgetben SOSE (ott a vendég nem foglalhat múltbeli időpontra). */
  includePast?: boolean
}

export interface TimeSlot {
  start: string
  end: string
}

/**
 * Egy adott nap NYITVA van-e egy (opcionális) munkatársnak — prioritás: kivétel (dátum-
 * specifikus) > munkatárs saját ismétlődő heti mintája (ha van neki egyáltalán) > szalon-szintű
 * ismétlődő minta (fallback, ha a munkatársnak nincs saját beállítása). Ha `staffId` nincs
 * megadva, csak a szalon-szintű mintát nézi. Ezt használja mind az `getAvailableSlots` (konkrét
 * szolgáltatás-idővel), mind a beosztás-automatizáló cron (ami csak azt akarja tudni, dolgozna-e
 * aznap az illető, szolgáltatás-fogalom nélkül).
 */
export async function resolveStaffWorkHours(
  salonId: string,
  staffId: string | undefined,
  date: string,
): Promise<{ start: string; end: string } | null> {
  const payload = await getPayloadClient()
  const dateObj = parseISO(date)
  const dayName = getDayName(dateObj)

  const [allExceptionsRes, staffAllRecurring, salonAvail] = await Promise.all([
    // Összes kivétel erre a dátumra (mind a staff-specifikus, mind a szalon-szintű).
    // Client-oldali szűréssel különítjük el — a { staff: { exists: false } } Payload-operator
    // nem megbízható PostgreSQL/Drizzle alatt, véletlenszerűen visszaadhat staff-specifikus sorokat is.
    payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salonId } },
          { recurring: { equals: false } },
          { exception_date: { equals: date } },
        ],
      },
      depth: 1,
      overrideAccess: true,
      limit: 50,
    }),
    // A munkatárs összes ismétlődő beosztása (bármely napra) — kell tudni, van-e egyéni schedule
    staffId ? payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salonId } },
          { staff: { equals: staffId } },
          { recurring: { equals: true } },
        ],
      },
      depth: 0,
      overrideAccess: true,
      limit: 10,
    }) : Promise.resolve({ docs: [] }),
    // Szalon-szintű ismétlődő beosztás erre a napra (alap fallback)
    payload.find({
      collection: 'availability',
      where: {
        and: [
          { salon: { equals: salonId } },
          { day_of_week: { equals: dayName } },
          { recurring: { equals: true } },
        ],
      },
      depth: 1,
      overrideAccess: true,
    }),
  ])

  // Client-oldali szétválasztás: staff-specifikus vs. szalon-szintű kivétel
  const staffException = staffId
    ? allExceptionsRes.docs.find((e) => {
        if (!e.staff) return false
        const sid = typeof e.staff === 'object' ? (e.staff as { id: number | string }).id : e.staff
        return String(sid) === String(staffId)
      })
    : undefined
  // Szalon-szintű kivétel: ahol a staff mező null/undefined (az egész szalon zárva van aznap)
  const salonException = allExceptionsRes.docs.find((e) => !e.staff)
  const activeException = staffException ?? salonException

  // Staff-specific recurring record for this exact day
  const staffDayRecord = staffAllRecurring.docs.find(r => r.day_of_week === dayName)
  // If staff has any recurring records configured, missing days = closed (don't fall back to salon)
  const staffHasCustomSchedule = staffAllRecurring.docs.length > 0

  if (activeException) {
    if (!activeException.is_available) return null
    return { start: activeException.start_time, end: activeException.end_time }
  }
  if (staffDayRecord) {
    if (!staffDayRecord.is_available) return null
    return { start: staffDayRecord.start_time, end: staffDayRecord.end_time }
  }
  if (staffHasCustomSchedule) {
    // Staff has a schedule but this day isn't in it → closed for this day
    return null
  }
  // Csak a szalon-szintű ismétlődő beosztást nézzük fallbacknek (staff = null)
  const salonRule = salonAvail.docs.find((r) => !r.staff)
  if (!salonRule || !salonRule.is_available) return null
  return { start: salonRule.start_time, end: salonRule.end_time }
}

export async function getAvailableSlots(params: SlotParams): Promise<TimeSlot[]> {
  const { salonId, staffId, serviceId, date, includePast = false } = params
  const payload = await getPayloadClient()

  // 1. Fetch service to get duration
  const service = await payload.findByID({ collection: 'services', id: serviceId })
  const durationMinutes = service.duration_minutes

  // 2. Fetch salon to get buffer
  const salon = await payload.findByID({ collection: 'salons', id: salonId })
  const bufferMinutes = salon.booking_buffer_minutes ?? 15

  // 3b. Ha a munkatársnak van erre a napra "szabadság/beteg/fizetett szabadság" beosztás-
  // rekordja (Shifts), aznap egyáltalán nem foglalható — üres slot-listát adunk vissza, ami
  // pontosan ugyanúgy jelenik meg a vendégnek, mint egy teljesen betelt nap (nincs külön UI-t
  // kellett hozzá építeni). Korábban a Shifts (HR-beosztás) és ez a foglalási számítás teljesen
  // független volt egymástól — beteg/szabadságos munkatársnál is lehetett foglalni.
  // 3c. Az aznapi Shift-rekord szünete(i) — mintha foglalt lenne, semmilyen külön UI-jelzés
  // nincs a vendégnek, csak az érintett időpontok tűnnek el a listából. Egy nap TÖBB szünetet
  // is tarthat (pl. ebéd + délutáni pihenő) — mindegyiket blokkoljuk.
  const dayBreaks: { start: number; end: number }[] = []
  if (staffId) {
    const leaveShift = await payload.find({
      collection: 'shifts',
      where: {
        and: [
          { staff: { equals: staffId } },
          { date: { equals: `${date}T12:00:00.000Z` } },
        ],
      },
      depth: 0,
      overrideAccess: true,
      limit: 1,
    })
    const todayShift = leaveShift.docs[0]
    if (todayShift && ['sick', 'vacation', 'leave'].includes(todayShift.type)) return []
    for (const w of todayShift?.breaks ?? []) {
      if (w.start_time && w.end_time) dayBreaks.push({ start: hhmmToMinutes(w.start_time), end: hhmmToMinutes(w.end_time) })
    }
  }

  // 4. Nyitvatartás ma erre a munkatársra (kivétel > saját minta > szalon-fallback)
  const hours = await resolveStaffWorkHours(salonId, staffId, date)
  if (!hours) return []
  const workStart = hours.start
  const workEnd = hours.end

  const openMin = hhmmToMinutes(workStart)
  const closeMin = hhmmToMinutes(workEnd)

  // 5. Generate candidate slots — 15 PERCES rácson (NEM a szolgáltatás-hosszal léptetve).
  // Duration-lépéssel a rács igazodása miatt egy a nyitástól "elcsúszó" foglalás
  // (pl. 09:30–10:30, 60 perces szolgáltatásnál) az ÖSSZES ráeső jelölt slotot (09:00, 10:00)
  // kitakarja, miközben ténylegesen szabad idő marad köztük (pl. 10:30-tól) — ezt a fix
  // 15 perces rács elkerüli, mert minden lehetséges kezdő-időpontot jelöltnek tekint.
  const STEP_MIN = 15
  const candidates: number[] = []
  let cursor = openMin
  while (cursor + durationMinutes <= closeMin) {
    candidates.push(cursor)
    cursor += STEP_MIN
  }

  // 6. Fetch existing bookings for this staff on this date
  const bookingWhere: Where = staffId
    ? { and: [{ staff: { equals: staffId } }, { date: { equals: date } }, { status: { not_equals: 'cancelled' } }] }
    : { and: [{ salon: { equals: salonId } }, { date: { equals: date } }, { status: { not_equals: 'cancelled' } }] }
  // overrideAccess: a slot-számítás publikus (bejelentkezetlen vendég) — a szigorított
  // Bookings.read máskülönben üres listát adna, és minden időpont szabadnak látszana.
  const existing = await payload.find({ collection: 'bookings', where: bookingWhere, overrideAccess: true })

  // 7. Filter out conflicting slots + past slots for today
  const occupied = existing.docs.map((b) => ({
    start: hhmmToMinutes(b.start_time),
    end: hhmmToMinutes(b.end_time) + bufferMinutes,
  }))
  occupied.push(...dayBreaks)

  const todayStr = new Date().toISOString().split('T')[0]
  const nowMinutes = date === todayStr
    ? new Date().getHours() * 60 + new Date().getMinutes()
    : 0

  const free = candidates.filter((slotStart) => {
    if (!includePast && slotStart <= nowMinutes && date === todayStr) return false
    const slotEnd = slotStart + durationMinutes
    return !occupied.some((o) => slotStart < o.end && slotEnd > o.start)
  })

  return free.map((start) => ({
    start: minutesToHHMM(start),
    end: minutesToHHMM(start + durationMinutes),
  }))
}

/**
 * A service.staff kapcsolat alapján állítja elő a jelölt-készletet — ha a szolgáltatáshoz NINCS
 * staff rendelve, a jelölt-készlet ÜRES (a szolgáltatás nem foglalható, amíg a tulaj hozzá nem
 * rendel legalább egy munkatársat a Beállításokban). Ezt használja mind a `resolveAnyStaff`
 * (végső, konkrét foglaláskor), mind a `getAvailableSlotsAnyStaff` (a dátum/idő-választó lista
 * megjelenítésekor) — a publikus wizard (ProfileCard.tsx) már a listából is kiszűri ezeket a
 * szolgáltatásokat, ez itt a szerver-oldali védőháló ugyanarra a szabályra.
 */
async function resolveEligibleStaffPool(salonId: string, serviceId: string) {
  const payload = await getPayloadClient()
  const [service, staffRes] = await Promise.all([
    payload.findByID({ collection: 'services', id: serviceId, overrideAccess: true, depth: 0 }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salonId } }, { is_active: { equals: true } }] },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    }),
  ])
  const eligibleIds = (service.staff ?? []).map((s: string | number | { id: string | number }) => String(typeof s === 'object' ? s.id : s))
  return staffRes.docs.filter((s) => eligibleIds.includes(String(s.id)))
}

/**
 * "Bármelyik szakember" foglalásnál a wizard `staffId: null`-t küld — a foglalás VÉGSŐ
 * mentésekor viszont a `Booking.staff` mező kötelező relációs mező, tehát valakit ekkor
 * KONKRÉTAN ki kell választani. Ezt eddig senki nem oldotta meg (a Zod-séma hibásan
 * `"null"` szöveggé koerciálta a JS null-t, ami egy nem-létező staff-id-ként 404-et dobott).
 *
 * Az eligible pool a `resolveEligibleStaffPool`-ból jön; a szabadságot staff-onként egyenként
 * vizsgálva döntjük el — az első szabad jelöltet választjuk (nincs elosztási logika, ez egy
 * egyszerű, de helyes első lépés).
 */
export async function resolveAnyStaff(params: {
  salonId: string
  serviceId: string
  date: string
  startTime: string
  durationMinutes: number
}): Promise<string | null> {
  const { salonId, serviceId, date, startTime, durationMinutes } = params
  const pool = await resolveEligibleStaffPool(salonId, serviceId)

  const slotStart = hhmmToMinutes(startTime)
  const slotEnd = slotStart + durationMinutes

  for (const candidate of pool) {
    const candidateId = String(candidate.id)
    const slots = await getAvailableSlots({ salonId, staffId: candidateId, serviceId, date })
    if (slots.some((s) => hhmmToMinutes(s.start) === slotStart && hhmmToMinutes(s.end) === slotEnd)) {
      return candidateId
    }
  }
  return null
}

/**
 * A "Bármelyik szakember" dátum/idő-választóban megjelenő slot-lista — az eligible staff-pool
 * MINDEGYIK tagjának saját (staff-specifikus kivétel > staff-recurring > szalon-fallback)
 * nyitvatartását és saját foglaltságát nézve, staffId-vel meghívott `getAvailableSlots`-szal,
 * majd a kapott slot-halmazokat UNIÓBA véve (kezdő-időpont szerint dedup).
 *
 * Korábban ez a lista egyetlen staffId NÉLKÜLI `getAvailableSlots`-hívásból jött, ami két okból
 * hibás volt: (1) staffId nélkül a staff-recurring lekérdezés ki van hagyva, ezért mindig a
 * szalon-szintű fallback nyitvatartás érvényesült — ha egy munkatárs a szalon-alapértelmezettnél
 * KÉSŐBB dolgozik (pl. este 8-ig, míg a szalon-alapértelmezett 18:00-kor zár), az a későbbi
 * időpont sosem jelent meg jelöltként; (2) a foglaltság-ellenőrzés a teljes szalonra nézett, nem
 * staffenként, ezért egy MÁSIK munkatárs foglalása is feleslegesen kitakart egy olyan időpontot,
 * amit egy harmadik, ténylegesen szabad munkatárs el tudott volna vállalni.
 */
export async function getAvailableSlotsAnyStaff(params: {
  salonId: string
  serviceId: string
  date: string
  includePast?: boolean
}): Promise<TimeSlot[]> {
  const { salonId, serviceId, date, includePast } = params
  const pool = await resolveEligibleStaffPool(salonId, serviceId)
  if (pool.length === 0) return []

  const perStaffSlots = await Promise.all(
    pool.map((candidate) => getAvailableSlots({ salonId, staffId: String(candidate.id), serviceId, date, includePast })),
  )

  const merged = new Map<string, TimeSlot>()
  for (const slots of perStaffSlots) {
    for (const slot of slots) {
      if (!merged.has(slot.start)) merged.set(slot.start, slot)
    }
  }
  return Array.from(merged.values()).sort((a, b) => hhmmToMinutes(a.start) - hhmmToMinutes(b.start))
}
