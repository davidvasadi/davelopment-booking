import 'server-only'
/**
 * BACKSTAGE metrikák — az üzemeltető (platform-admin) számára aggregált, FIÓK-központú
 * adatréteg. Egy fiók (user/owner) = egy előfizetés = több üzlete (szalon + étterem) lehet.
 * Minden backstage-oldal (Áttekintő, Előfizetők, Bevétel, Kockázat) ebből a közös
 * loaderből dolgozik, hogy a számok MINDENHOL konzisztensek legyenek (korábban oldalanként
 * duplikálva, eltérő eredménnyel számoltuk).
 */
import type { Salon, Restaurant, User, Subscription } from '@/payload/payload-types'
import { getPayloadClient } from '@/lib/payload'
import { subAmountHuf, ownerIdOfSubscription } from '@/lib/backstagePlaces'

export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'

const MS_DAY = 86_400_000

/** Egy fiók (owner) teljes, backstage-hez aggregált profilja. */
export type AccountSummary = {
  ownerId: string
  owner: User
  /** A fiók előfizetése (fiók-szintű, egy user = egy sub). */
  sub: Subscription | null
  status: SubStatus | null
  /** Effektív havidíj (MRR-hozzájárulás) forintban — trial alatt 0. */
  mrr: number
  /** A fiók tárolt teljes havidíja (potenciál, trial alatt is a számolt díj). */
  potentialFee: number
  salonCount: number
  restaurantCount: number
  placeCount: number
  /** Összes foglalás a fiók összes helyén (bookings + reservations). */
  totalBookings: number
  /** Az elmúlt 30 napban keletkezett foglalások a fiók összes helyén. */
  recentBookings: number
  /** A fiók legrégebbi üzletének létrehozása — a fiók „kora". */
  firstPlaceCreatedAt: string | null
  createdAt: string
  places: { kind: 'salon' | 'restaurant'; id: string; name: string; slug: string; is_active: boolean; city: string | null }[]
}

/** Egy nap egy idősorban. */
export type TrendPoint = { label: string; value: number }

export type BackstageData = {
  accounts: AccountSummary[]
  // Platform-szintű összegzők
  mrr: number
  arr: number
  arpa: number // átlagos bevétel / fizető fiók (Average Revenue Per Account)
  activeCount: number
  trialingCount: number
  pastDueCount: number
  canceledCount: number
  pausedCount: number
  totalAccounts: number
  payingAccounts: number
  conversionRate: number // trial→paid, %
  churnRate: number // canceled / összes, %
  // Üzlet-szintű
  totalPlaces: number
  activePlaces: number
  totalSalons: number
  totalRestaurants: number
  totalBookings: number
  monthBookings: number
  activePlaceRate: number // aktív helyek aránya, %
  // Kimenő emailek (email-log)
  totalEmails: number
  monthEmails: number
  emailsTrend: TrendPoint[] // 30 napos NAPI kimenő email-darab (nem kumulált)
  // Idősorok (30 nap, kumulált)
  mrrTrend: TrendPoint[]
  accountsTrend: TrendPoint[]
  bookingsTrend: TrendPoint[]
  placesTrend: TrendPoint[]
  // Bevétel-bontás
  salonMrr: number
  restaurantMrr: number
  salonUnits: number
  restaurantUnits: number
  // Kockázat
  expiringTrials: AccountSummary[] // 14 napon belül lejáró trial
  pastDueAccounts: AccountSummary[]
  dormantPlaces: BackstagePlaceRisk[] // 30 napja nincs foglalás (volt valaha)
  neverBookedPlaces: BackstagePlaceRisk[] // soha nem volt foglalás (14+ napos)
  inactivePlaces: BackstagePlaceRisk[]
}

export type BackstagePlaceRisk = {
  kind: 'salon' | 'restaurant'
  id: string
  name: string
  slug: string
  city: string | null
  is_active: boolean
  createdAt: string
  ownerId: string | null
  ownerEmail: string | null
  totalBookings: number
  status: SubStatus | null
}

const TREND_DAYS = 30

/**
 * ISO-createdAt lista → 30 napos NAPI DARAB idősor (az adott napon keletkezett elemek száma,
 * nem kumulált). Pl. napi kimenő emailek számához.
 */
export function dailyCountTrend(isoDates: string[]): TrendPoint[] {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (TREND_DAYS - 1))
  const perDay = new Map<string, number>()
  for (const iso of isoDates) {
    const d = new Date(iso); d.setHours(0, 0, 0, 0)
    if (d < start) continue
    const key = d.toISOString().slice(0, 10)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }
  const days: TrendPoint[] = []
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    days.push({ label: d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }), value: perDay.get(key) ?? 0 })
  }
  return days
}

/**
 * ISO-createdAt lista → 30 napos KUMULÁLT napi idősor (az adott napig létező összes elem).
 * Az ablak előtti elemek adják a kezdő alapszintet, így az összlétszám alakulását mutatja.
 */
export function cumulativeTrend(isoDates: string[]): TrendPoint[] {
  const days: TrendPoint[] = []
  const start = new Date(); start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (TREND_DAYS - 1))

  let baseBefore = 0
  const perDay = new Map<string, number>()
  for (const iso of isoDates) {
    const d = new Date(iso); d.setHours(0, 0, 0, 0)
    if (d < start) { baseBefore += 1; continue }
    const key = d.toISOString().slice(0, 10)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  let running = baseBefore
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    running += perDay.get(key) ?? 0
    days.push({ label: d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }), value: running })
  }
  return days
}

/**
 * MRR-idősor: minden aktív előfizetés a saját havidíjával, a `createdAt` napjától kezdve
 * hozzáadva (közelítés — a valós számlázási eseményeket nem tároljuk). Az összeg egy adott
 * napig aktivált előfizetések díjának summája.
 */
function mrrCumulativeTrend(activeSubs: Subscription[]): TrendPoint[] {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (TREND_DAYS - 1))

  let baseBefore = 0
  const perDay = new Map<string, number>()
  for (const s of activeSubs) {
    const amt = subAmountHuf(s)
    if (amt <= 0) continue
    const d = new Date(s.createdAt); d.setHours(0, 0, 0, 0)
    if (d < start) { baseBefore += amt; continue }
    const key = d.toISOString().slice(0, 10)
    perDay.set(key, (perDay.get(key) ?? 0) + amt)
  }

  const days: TrendPoint[] = []
  let running = baseBefore
  for (let i = 0; i < TREND_DAYS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    running += perDay.get(key) ?? 0
    days.push({ label: d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }), value: running })
  }
  return days
}

type PayloadClient = Awaited<ReturnType<typeof getPayloadClient>>

async function createdAtList(
  payload: PayloadClient,
  collection: 'salons' | 'restaurants' | 'users' | 'bookings' | 'reservations',
  where?: Record<string, unknown>,
): Promise<string[]> {
  const res = await payload.find({ collection, where, limit: 5000, depth: 0, overrideAccess: true, select: { createdAt: true } } as Parameters<typeof payload.find>[0])
  return (res.docs as unknown as { createdAt: string }[]).map(d => d.createdAt)
}

/**
 * A TELJES backstage adatréteg egyetlen loaderben. Beolvassa a fiókokat, üzleteket,
 * előfizetéseket és foglalás-számokat, majd fiók-központú összegzést + platform-metrikákat
 * + kockázati listákat + idősorokat számol. Az összes backstage-oldal ezt hívja.
 */
export async function loadBackstageData(): Promise<BackstageData> {
  const payload = await getPayloadClient()

  const now = new Date()
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const ago30 = new Date(now.getTime() - 30 * MS_DAY)
  const ago14 = new Date(now.getTime() - 14 * MS_DAY)
  const in14 = new Date(now.getTime() + 14 * MS_DAY)

  const [
    salonsRes, restaurantsRes, subsRes, usersRes,
    salonDates, restaurantDates, userDates, bookingDates, reservationDates,
    monthBookingsRes, monthReservationsRes, emailDatesRes,
  ] = await Promise.all([
    payload.find({ collection: 'salons', limit: 1000, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 1000, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', limit: 1000, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'users', where: { role: { in: ['salon_owner', 'restaurant_owner'] } }, limit: 2000, depth: 0, overrideAccess: true }),
    createdAtList(payload, 'salons'),
    createdAtList(payload, 'restaurants'),
    createdAtList(payload, 'users', { role: { in: ['salon_owner', 'restaurant_owner'] } }),
    createdAtList(payload, 'bookings'),
    createdAtList(payload, 'reservations'),
    payload.find({ collection: 'bookings', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    // Kimenő emailek — csak a sikeresek (ok=true), createdAt-tel a napi trendhez.
    payload.find({ collection: 'email-log', where: { ok: { equals: true } }, limit: 20000, depth: 0, overrideAccess: true, select: { createdAt: true } as never }).catch(() => ({ docs: [] as { createdAt: string }[] })),
  ])

  const salons = salonsRes.docs as Salon[]
  const restaurants = restaurantsRes.docs as Restaurant[]
  const subs = subsRes.docs as Subscription[]
  const users = usersRes.docs as User[]

  // Foglalás-számok helyenként (szalon → bookings, étterem → reservations). Total + 30 napos.
  const [salonBookings, restaurantBookings] = await Promise.all([
    Promise.all(salons.map(async (s) => {
      const [total, recent] = await Promise.all([
        payload.find({ collection: 'bookings', where: { salon: { equals: s.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection: 'bookings', where: { salon: { equals: s.id }, createdAt: { greater_than: ago30.toISOString() } }, limit: 0, overrideAccess: true }),
      ])
      return [String(s.id), { total: total.totalDocs, recent: recent.totalDocs }] as const
    })),
    Promise.all(restaurants.map(async (r) => {
      const [total, recent] = await Promise.all([
        payload.find({ collection: 'reservations', where: { restaurant: { equals: r.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection: 'reservations', where: { restaurant: { equals: r.id }, createdAt: { greater_than: ago30.toISOString() } }, limit: 0, overrideAccess: true }),
      ])
      return [String(r.id), { total: total.totalDocs, recent: recent.totalDocs }] as const
    })),
  ])
  const salonBookingMap = new Map(salonBookings)
  const restaurantBookingMap = new Map(restaurantBookings)

  // Sub owner-id → sub (fiók-szintű; egy owner egy sub).
  const subByOwner = new Map<string, Subscription>()
  for (const s of subs) {
    const oid = ownerIdOfSubscription(s)
    if (oid) subByOwner.set(oid, s)
  }

  const ownerOf = (doc: Salon | Restaurant): User | null =>
    doc.owner && typeof doc.owner === 'object' ? (doc.owner as User) : null

  // Fiókok felépítése: minden owner-user, hozzá a helyei + előfizetése + foglalás-aggregátumok.
  const accountMap = new Map<string, AccountSummary>()
  const ensureAccount = (owner: User): AccountSummary => {
    const key = String(owner.id)
    let acc = accountMap.get(key)
    if (!acc) {
      const sub = subByOwner.get(key) ?? null
      acc = {
        ownerId: key,
        owner,
        sub,
        status: (sub?.status as SubStatus) ?? null,
        mrr: sub ? subAmountHuf(sub) : 0,
        potentialFee: sub?.amount_huf ?? 0,
        salonCount: 0,
        restaurantCount: 0,
        placeCount: 0,
        totalBookings: 0,
        recentBookings: 0,
        firstPlaceCreatedAt: null,
        createdAt: owner.createdAt,
        places: [],
      }
      accountMap.set(key, acc)
    }
    return acc
  }
  // Minden owner-user kap fiókot (akkor is, ha nincs még üzlete).
  for (const u of users) ensureAccount(u)

  const addPlace = (kind: 'salon' | 'restaurant', doc: Salon | Restaurant, bk: { total: number; recent: number } | undefined) => {
    const owner = ownerOf(doc)
    if (!owner) return
    const acc = ensureAccount(owner)
    if (kind === 'salon') acc.salonCount += 1; else acc.restaurantCount += 1
    acc.placeCount += 1
    acc.totalBookings += bk?.total ?? 0
    acc.recentBookings += bk?.recent ?? 0
    if (!acc.firstPlaceCreatedAt || new Date(doc.createdAt) < new Date(acc.firstPlaceCreatedAt)) {
      acc.firstPlaceCreatedAt = doc.createdAt
    }
    acc.places.push({
      kind, id: String(doc.id), name: doc.name, slug: doc.slug,
      is_active: doc.is_active ?? false, city: doc.city ?? null,
    })
  }
  for (const s of salons) addPlace('salon', s, salonBookingMap.get(String(s.id)))
  for (const r of restaurants) addPlace('restaurant', r, restaurantBookingMap.get(String(r.id)))

  // ELŐFIZETŐ = akinek van legalább 1 ÜZLETE VAGY 1 ELŐFIZETÉSE. A csak-staff / félbehagyott
  // regisztrációk (owner-role, de 0 üzlet + 0 sub) NEM előfizetők — ezeket kiszűrjük, hogy ne
  // jelenjenek meg „Nincs előfizetés" üres sorokként az áttekintőn.
  const accounts = [...accountMap.values()]
    .filter(a => a.placeCount > 0 || a.sub != null)
    .sort((a, b) => b.mrr - a.mrr || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Platform-szintű összegzők (a fiók-subokból).
  const activeSubs = subs.filter(s => s.status === 'active')
  const trialingSubs = subs.filter(s => s.status === 'trialing')
  const pastDueSubs = subs.filter(s => s.status === 'past_due')
  const canceledSubs = subs.filter(s => s.status === 'canceled')
  const pausedSubs = subs.filter(s => s.status === 'paused')

  const mrr = activeSubs.reduce((sum, s) => sum + subAmountHuf(s), 0)
  const payingAccounts = activeSubs.length
  const arpa = payingAccounts > 0 ? Math.round(mrr / payingAccounts) : 0
  const payingVsTrial = activeSubs.length + trialingSubs.length
  const conversionRate = payingVsTrial > 0 ? Math.round((activeSubs.length / payingVsTrial) * 100) : 0
  const churnRate = subs.length > 0 ? Number(((canceledSubs.length / subs.length) * 100).toFixed(1)) : 0

  // Üzlet-bevétel bontás: az aktív subok salon_count / restaurant_count mezőiből.
  const salonUnits = activeSubs.reduce((n, s) => n + (s.salon_count ?? 0), 0)
  const restaurantUnits = activeSubs.reduce((n, s) => n + (s.restaurant_count ?? 0), 0)
  // Az MRR fiók-szintű; közelítő üzlet-bontás a fiók MRR-jét a helyszám arányában osztja.
  let salonMrr = 0, restaurantMrr = 0
  for (const acc of accounts) {
    if (acc.status !== 'active' || acc.mrr <= 0 || acc.placeCount === 0) continue
    salonMrr += Math.round(acc.mrr * (acc.salonCount / acc.placeCount))
    restaurantMrr += Math.round(acc.mrr * (acc.restaurantCount / acc.placeCount))
  }

  const totalSalons = salons.length
  const totalRestaurants = restaurants.length
  const totalPlaces = totalSalons + totalRestaurants
  const activePlaces = salons.filter(s => s.is_active).length + restaurants.filter(r => r.is_active).length
  const activePlaceRate = totalPlaces > 0 ? Math.round((activePlaces / totalPlaces) * 100) : 0
  const totalBookings = bookingDates.length + reservationDates.length
  const monthBookings = monthBookingsRes.totalDocs + monthReservationsRes.totalDocs

  // Kockázati listák.
  const expiringTrials = accounts.filter(acc => {
    if (acc.status !== 'trialing' || !acc.sub?.trial_ends_at) return false
    const end = new Date(acc.sub.trial_ends_at)
    return end >= now && end <= in14
  })
  const pastDueAccounts = accounts.filter(acc => acc.status === 'past_due')

  // Hely-szintű kockázat (dormant / never / inactive) — a listákhoz.
  const allPlaceRisks: BackstagePlaceRisk[] = []
  const pushRisk = (kind: 'salon' | 'restaurant', doc: Salon | Restaurant, bk: { total: number; recent: number } | undefined) => {
    const owner = ownerOf(doc)
    const oid = owner?.id != null ? String(owner.id) : null
    const acc = oid ? accountMap.get(oid) : undefined
    allPlaceRisks.push({
      kind, id: String(doc.id), name: doc.name, slug: doc.slug, city: doc.city ?? null,
      is_active: doc.is_active ?? false, createdAt: doc.createdAt,
      ownerId: oid, ownerEmail: owner?.email ?? null,
      totalBookings: bk?.total ?? 0,
      status: acc?.status ?? null,
    })
  }
  for (const s of salons) pushRisk('salon', s, salonBookingMap.get(String(s.id)))
  for (const r of restaurants) pushRisk('restaurant', r, restaurantBookingMap.get(String(r.id)))

  const bookingRecentOf = (risk: BackstagePlaceRisk): number => {
    const map = risk.kind === 'salon' ? salonBookingMap : restaurantBookingMap
    return map.get(risk.id)?.recent ?? 0
  }
  const dormantPlaces = allPlaceRisks.filter(p => p.is_active && p.totalBookings > 0 && bookingRecentOf(p) === 0)
  const neverBookedPlaces = allPlaceRisks.filter(p => new Date(p.createdAt) <= ago14 && p.totalBookings === 0)
  const inactivePlaces = allPlaceRisks.filter(p => !p.is_active)

  // Kimenő emailek (email-log): összes + e havi + napi trend.
  const emailDates = (emailDatesRes.docs as { createdAt: string }[]).map(d => d.createdAt)
  const totalEmails = emailDates.length
  const monthEmails = emailDates.filter(iso => new Date(iso) >= monthStart).length
  const emailsTrend = dailyCountTrend(emailDates)

  return {
    accounts,
    mrr, arr: mrr * 12, arpa,
    activeCount: activeSubs.length,
    trialingCount: trialingSubs.length,
    pastDueCount: pastDueSubs.length,
    canceledCount: canceledSubs.length,
    pausedCount: pausedSubs.length,
    totalAccounts: accounts.length,
    payingAccounts,
    conversionRate, churnRate,
    totalPlaces, activePlaces, totalSalons, totalRestaurants,
    totalBookings, monthBookings, activePlaceRate,
    totalEmails, monthEmails, emailsTrend,
    mrrTrend: mrrCumulativeTrend(activeSubs),
    accountsTrend: cumulativeTrend(userDates),
    bookingsTrend: cumulativeTrend([...bookingDates, ...reservationDates]),
    placesTrend: cumulativeTrend([...salonDates, ...restaurantDates]),
    salonMrr, restaurantMrr, salonUnits, restaurantUnits,
    expiringTrials, pastDueAccounts, dormantPlaces, neverBookedPlaces, inactivePlaces,
  }
}

/** Napok egy adott ISO-időpontig (pozitív = jövő, negatív = múlt). */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / MS_DAY)
}

/* ── Bevétel-mélyítés: kohorsz-retenció, MRR-mozgás, LTV (a /backstage/revenue oldalhoz) ── */

export type MonthlyRevenue = { month: string; mrr: number; newCount: number }

export type CohortRow = {
  /** A kohorsz hónapja (pl. „2026. jan"). */
  month: string
  /** Ebben a hónapban regisztrált fiókok száma. */
  size: number
  /** Ebből jelenleg még aktív (fizető). */
  retained: number
  /** Retenciós arány, %. */
  retentionPct: number
}

export type RevenueBreakdown = {
  mrr: number
  arr: number
  potentialMrr: number
  arpa: number
  ltv: number // becsült élettartam-érték (ARPA / churn-ráta)
  conversionRate: number
  churnRate: number
  activeCount: number
  trialingCount: number
  canceledCount: number
  pastDueCount: number
  totalSubs: number
  salonMrr: number
  restaurantMrr: number
  salonUnits: number
  restaurantUnits: number
  monthlyRevenue: MonthlyRevenue[]
  cohorts: CohortRow[]
  mrrTrend: TrendPoint[]
}

/** Bevétel-oldal adatréteg — a fiók-subokból kohorsz-retenció + MRR-idősor + LTV. */
export async function loadRevenueBreakdown(): Promise<RevenueBreakdown> {
  const payload = await getPayloadClient()
  const subsRes = await payload.find({ collection: 'subscriptions', limit: 2000, depth: 1, overrideAccess: true })
  const subs = subsRes.docs as Subscription[]

  const activeSubs = subs.filter(s => s.status === 'active')
  const trialingSubs = subs.filter(s => s.status === 'trialing')
  const canceledSubs = subs.filter(s => s.status === 'canceled')
  const pastDueSubs = subs.filter(s => s.status === 'past_due')

  const mrr = activeSubs.reduce((sum, s) => sum + subAmountHuf(s), 0)
  const potentialMrr = [...activeSubs, ...trialingSubs].reduce((sum, s) => sum + (s.amount_huf ?? 0), 0)
  const payingVsTrial = activeSubs.length + trialingSubs.length
  const conversionRate = payingVsTrial > 0 ? Math.round((activeSubs.length / payingVsTrial) * 100) : 0
  const churnRatePct = subs.length > 0 ? (canceledSubs.length / subs.length) * 100 : 0
  const churnRate = Number(churnRatePct.toFixed(1))
  const arpa = activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0
  // LTV becslés: ARPA / havi churn-arány. Ha nincs churn, konzervatív 24 hónapos becslés.
  const monthlyChurn = churnRatePct / 100
  const ltv = monthlyChurn > 0 ? Math.round(arpa / monthlyChurn) : arpa * 24

  const salonUnits = activeSubs.reduce((n, s) => n + (s.salon_count ?? 0), 0)
  const restaurantUnits = activeSubs.reduce((n, s) => n + (s.restaurant_count ?? 0), 0)
  let salonMrr = 0, restaurantMrr = 0
  for (const s of activeSubs) {
    const amt = subAmountHuf(s)
    const total = (s.salon_count ?? 0) + (s.restaurant_count ?? 0)
    if (amt <= 0 || total === 0) continue
    salonMrr += Math.round(amt * ((s.salon_count ?? 0) / total))
    restaurantMrr += Math.round(amt * ((s.restaurant_count ?? 0) / total))
  }

  // Havi bevétel: aktív subok belépési hónapja szerint (közelítés — nincs számla-esemény tábla).
  const monthKey = (iso: string) => new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
  const monthMap = new Map<string, { mrr: number; newCount: number; order: number }>()
  for (const s of activeSubs) {
    const key = monthKey(s.createdAt)
    const order = new Date(s.createdAt).getFullYear() * 12 + new Date(s.createdAt).getMonth()
    const cur = monthMap.get(key) ?? { mrr: 0, newCount: 0, order }
    cur.mrr += subAmountHuf(s); cur.newCount += 1
    monthMap.set(key, cur)
  }
  const monthlyRevenue: MonthlyRevenue[] = [...monthMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .slice(-8)
    .map(([month, v]) => ({ month, mrr: v.mrr, newCount: v.newCount }))

  // Kohorsz-retenció: a regisztráció hónapja szerinti csoportok, ki maradt aktív ma.
  const cohortMap = new Map<string, { size: number; retained: number; order: number }>()
  for (const s of subs) {
    const key = monthKey(s.createdAt)
    const order = new Date(s.createdAt).getFullYear() * 12 + new Date(s.createdAt).getMonth()
    const cur = cohortMap.get(key) ?? { size: 0, retained: 0, order }
    cur.size += 1
    if (s.status === 'active') cur.retained += 1
    cohortMap.set(key, cur)
  }
  const cohorts: CohortRow[] = [...cohortMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .slice(-8)
    .map(([month, v]) => ({ month, size: v.size, retained: v.retained, retentionPct: v.size > 0 ? Math.round((v.retained / v.size) * 100) : 0 }))

  return {
    mrr, arr: mrr * 12, potentialMrr, arpa, ltv,
    conversionRate, churnRate,
    activeCount: activeSubs.length, trialingCount: trialingSubs.length,
    canceledCount: canceledSubs.length, pastDueCount: pastDueSubs.length,
    totalSubs: subs.length,
    salonMrr, restaurantMrr, salonUnits, restaurantUnits,
    monthlyRevenue, cohorts,
    mrrTrend: mrrCumulativeTrend(activeSubs),
  }
}

/* ── Egy FIÓK részletes profilja (a /backstage/accounts/[id] oldalhoz) ────────── */

export type AccountPlaceDetail = {
  kind: 'salon' | 'restaurant'
  id: string
  name: string
  slug: string
  city: string | null
  is_active: boolean
  createdAt: string
  totalBookings: number
  monthBookings: number
}

export type AccountBookingRow = {
  id: string
  placeName: string
  kind: 'salon' | 'restaurant'
  customerName: string
  detail: string
  date: string
  time: string
  status: string
  createdAt: string
}

export type AccountProfile = {
  owner: User
  sub: Subscription | null
  status: SubStatus | null
  mrr: number
  places: AccountPlaceDetail[]
  totalBookings: number
  monthBookings: number
  recentBookings: AccountBookingRow[]
} | null

/** Egy fiók (owner) teljes, backstage profilja — a 360°-os nézethez. `null`, ha a user nem létezik. */
export async function loadAccountProfile(ownerId: string): Promise<AccountProfile> {
  const payload = await getPayloadClient()

  const owner = (await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null
  if (!owner) return null

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

  const [salonsRes, restaurantsRes, subRes] = await Promise.all([
    payload.find({ collection: 'salons', where: { owner: { equals: ownerId } }, limit: 200, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'restaurants', where: { owner: { equals: ownerId } }, limit: 200, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', where: { owner: { equals: ownerId } }, limit: 1, depth: 0, overrideAccess: true }),
  ])
  const salons = salonsRes.docs as Salon[]
  const restaurants = restaurantsRes.docs as Restaurant[]
  const sub = (subRes.docs[0] as Subscription) ?? null

  const places: AccountPlaceDetail[] = []
  const recentBookings: AccountBookingRow[] = []
  let totalBookings = 0, monthBookings = 0

  for (const s of salons) {
    const [total, month, recent] = await Promise.all([
      payload.find({ collection: 'bookings', where: { salon: { equals: s.id } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { salon: { equals: s.id }, createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { salon: { equals: s.id } }, sort: '-createdAt', limit: 5, depth: 1, overrideAccess: true }),
    ])
    totalBookings += total.totalDocs; monthBookings += month.totalDocs
    places.push({ kind: 'salon', id: String(s.id), name: s.name, slug: s.slug, city: s.city ?? null, is_active: s.is_active ?? false, createdAt: s.createdAt, totalBookings: total.totalDocs, monthBookings: month.totalDocs })
    for (const b of recent.docs) {
      const svc = b.service && typeof b.service === 'object' ? (b.service as { name?: string }) : null
      recentBookings.push({ id: String(b.id), placeName: s.name, kind: 'salon', customerName: b.customer_name ?? '—', detail: svc?.name ?? '—', date: b.date ?? '', time: b.start_time ?? '', status: b.status ?? '', createdAt: b.createdAt })
    }
  }
  for (const r of restaurants) {
    const [total, month, recent] = await Promise.all([
      payload.find({ collection: 'reservations', where: { restaurant: { equals: r.id } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'reservations', where: { restaurant: { equals: r.id }, createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'reservations', where: { restaurant: { equals: r.id } }, sort: '-createdAt', limit: 5, depth: 1, overrideAccess: true }),
    ])
    totalBookings += total.totalDocs; monthBookings += month.totalDocs
    places.push({ kind: 'restaurant', id: String(r.id), name: r.name, slug: r.slug, city: r.city ?? null, is_active: r.is_active ?? false, createdAt: r.createdAt, totalBookings: total.totalDocs, monthBookings: month.totalDocs })
    for (const b of recent.docs) {
      const rec = b as { customer_name?: string; pax?: number; date?: string; start_time?: string; status?: string; id: string | number; createdAt: string }
      recentBookings.push({ id: String(rec.id), placeName: r.name, kind: 'restaurant', customerName: rec.customer_name ?? '—', detail: rec.pax != null ? `${rec.pax} fő` : '—', date: rec.date ?? '', time: rec.start_time ?? '', status: rec.status ?? '', createdAt: rec.createdAt })
    }
  }

  recentBookings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  places.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return {
    owner, sub,
    status: (sub?.status as SubStatus) ?? null,
    mrr: sub ? subAmountHuf(sub) : 0,
    places, totalBookings, monthBookings,
    recentBookings: recentBookings.slice(0, 12),
  }
}
