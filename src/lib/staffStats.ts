import { getPayloadClient } from '@/lib/payload'

/** Idei (jelen év) foglalás-statisztika munkatársanként — VALÓS adatból, a `bookings`
 *  collectionből. Lemondott (cancelled) foglalás nem számít. Az avg-rating a
 *  `reviews` → `booking` → `staff` láncon keresztül számolódik (közvetett, de valós
 *  kötés; ha egy staffhoz nincs értékelés, nem szerepel a map-ben). */
export interface StaffStats {
  /** staffId → idei, nem-lemondott foglalások száma */
  bookingsById: Record<string, number>
  /** staffId → nevéhez tartozó szolgáltatás-nevek (tag-ek) */
  servicesById: Record<string, string[]>
  /** staffId → átlagértékelés (1–5, egy tizedes) ha van staffhoz köthető review */
  ratingById: Record<string, number>
  /** összes idei, nem-lemondott foglalás */
  totalBookings: number
  /** teljes szalon átlagértékelés (staffhoz köthető review-kból) vagy null */
  avgRating: number | null
}

function toId(rel: unknown): string | null {
  if (rel == null) return null
  if (typeof rel === 'object') {
    const id = (rel as { id?: number | string }).id
    return id != null ? String(id) : null
  }
  return String(rel)
}

export async function getStaffStats(salonId: string | number): Promise<StaffStats> {
  const payload = await getPayloadClient()
  const year = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  // Idei, nem-lemondott foglalások (a `date` szöveges: ÉÉÉÉ-HH-NN, így string-tartomány OK).
  const bookings = await payload.find({
    collection: 'bookings',
    where: {
      salon: { equals: salonId },
      date: { greater_than_equal: yearStart, less_than_equal: yearEnd },
      status: { not_equals: 'cancelled' },
    },
    depth: 0,
    limit: 5000,
    pagination: false,
  })

  const bookingsById: Record<string, number> = {}
  const bookingStaffMap: Record<string, string> = {} // bookingId → staffId
  for (const b of bookings.docs) {
    const staffId = toId((b as { staff?: unknown }).staff)
    if (!staffId) continue
    bookingsById[staffId] = (bookingsById[staffId] ?? 0) + 1
    bookingStaffMap[String((b as { id: number | string }).id)] = staffId
  }
  const totalBookings = bookings.docs.reduce(
    (n, b) => (toId((b as { staff?: unknown }).staff) ? n + 1 : n),
    0,
  )

  // Szolgáltatás-tag-ek: a services collection `staff` (hasMany) mezőjéből fordítva.
  const services = await payload.find({
    collection: 'services',
    where: { salon: { equals: salonId } },
    depth: 0,
    limit: 1000,
    pagination: false,
  })
  const servicesById: Record<string, string[]> = {}
  for (const s of services.docs) {
    const name = (s as { name?: string }).name
    if (!name) continue
    const rel = (s as { staff?: unknown }).staff
    const staffIds = Array.isArray(rel) ? rel.map(toId) : [toId(rel)]
    for (const sid of staffIds) {
      if (!sid) continue
      ;(servicesById[sid] ??= []).push(name)
    }
  }

  // Átlagértékelés: reviews → booking → staff. Csak staffhoz köthető review számít.
  const reviews = await payload.find({
    collection: 'reviews',
    where: { salon: { equals: salonId }, booking: { exists: true } },
    depth: 0,
    limit: 5000,
    pagination: false,
  })
  const ratingAgg: Record<string, { sum: number; n: number }> = {}
  let allSum = 0
  let allN = 0
  for (const r of reviews.docs) {
    const bookingId = toId((r as { booking?: unknown }).booking)
    const rating = (r as { rating?: number }).rating
    if (!bookingId || typeof rating !== 'number') continue
    const staffId = bookingStaffMap[bookingId]
    if (!staffId) continue
    ;(ratingAgg[staffId] ??= { sum: 0, n: 0 })
    ratingAgg[staffId].sum += rating
    ratingAgg[staffId].n += 1
    allSum += rating
    allN += 1
  }
  const ratingById: Record<string, number> = {}
  for (const [sid, { sum, n }] of Object.entries(ratingAgg)) {
    ratingById[sid] = Math.round((sum / n) * 10) / 10
  }
  const avgRating = allN > 0 ? Math.round((allSum / allN) * 10) / 10 : null

  return { bookingsById, servicesById, ratingById, totalBookings, avgRating }
}
