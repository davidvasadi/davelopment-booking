import 'server-only'
/**
 * BACKSTAGE metrikák — az üzemeltető (platform-admin) számára aggregált, FIÓK-központú
 * adatréteg. Egy fiók (user/owner) = egy előfizetés = több üzlete (szalon + étterem) lehet.
 * Minden backstage-oldal (Áttekintő, Előfizetők, Bevétel, Kockázat) ebből a közös
 * loaderből dolgozik, hogy a számok MINDENHOL konzisztensek legyenek (korábban oldalanként
 * duplikálva, eltérő eredménnyel számoltuk).
 */
import type { Salon, Restaurant, User, Subscription, EmailLogEntry } from '@/payload/payload-types'
import { getPayloadClient } from '@/lib/payload'
import { authQuery, sql } from '@/lib/authDb'
import { subAmountHuf, ownerIdOfSubscription } from '@/lib/backstagePlaces'
import { resolveTier, type Tier } from '@/lib/tier'

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
  /** A fiók csomagja — a legkorábban létrehozott üzlete alapján (a legtöbb fióknak csak 1
   *  üzlete van; több üzletnél az elsőé az irányadó, a `places[].tier` mindegyiket megadja). */
  tier: Tier | null
  places: { kind: 'salon' | 'restaurant'; id: string; name: string; slug: string; is_active: boolean; city: string | null; tier: Tier; customFee: number | null; total: number; recent: number; createdAt: string }[]
}

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

  // Foglalás-számok üzletenként (összes + 30 napos) KÉT összesítő lekérdezéssel — korábban üzletenként 2 külön
  // lekérdezés futott, ami sok üzletnél (és dev módban) nagyon lassú volt.
  const countRows = (q: ReturnType<typeof sql>) => authQuery<{ id: number; total: number; recent: number }>(q).catch(() => [])
  const [
    salonsRes, restaurantsRes, subsRes, usersRes,
    monthBookingsRes, monthReservationsRes, salonCounts, restaurantCounts,
  ] = await Promise.all([
    payload.find({ collection: 'salons', limit: 1000, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'restaurants', limit: 1000, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'subscriptions', limit: 1000, depth: 1, overrideAccess: true }),
    payload.find({ collection: 'users', where: { role: { in: ['salon_owner', 'restaurant_owner'] } }, limit: 2000, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'bookings', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    payload.find({ collection: 'reservations', where: { createdAt: { greater_than: monthStart.toISOString() } }, limit: 0, overrideAccess: true }),
    countRows(sql`SELECT salon_id AS id, COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE created_at > ${ago30.toISOString()}))::int AS recent FROM bookings WHERE salon_id IS NOT NULL GROUP BY salon_id`),
    countRows(sql`SELECT restaurant_id AS id, COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE created_at > ${ago30.toISOString()}))::int AS recent FROM reservations WHERE restaurant_id IS NOT NULL GROUP BY restaurant_id`),
  ])

  const salons = salonsRes.docs as Salon[]
  const restaurants = restaurantsRes.docs as Restaurant[]
  const subs = subsRes.docs as Subscription[]
  const users = usersRes.docs as User[]

  const salonBookings = salonCounts.map((r) => [String(r.id), { total: Number(r.total), recent: Number(r.recent) }] as const)
  const restaurantBookings = restaurantCounts.map((r) => [String(r.id), { total: Number(r.total), recent: Number(r.recent) }] as const)
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
        tier: null,
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
    const tier = resolveTier(doc.tier)
    if (!acc.firstPlaceCreatedAt || new Date(doc.createdAt) < new Date(acc.firstPlaceCreatedAt)) {
      acc.firstPlaceCreatedAt = doc.createdAt
      acc.tier = tier
    }
    acc.places.push({
      kind, id: String(doc.id), name: doc.name, slug: doc.slug,
      is_active: doc.is_active ?? false, city: doc.city ?? null, tier,
      customFee: doc.custom_monthly_fee_huf ?? null, total: bk?.total ?? 0, recent: bk?.recent ?? 0, createdAt: doc.createdAt,
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
  const totalBookings = [...salonBookings, ...restaurantBookings].reduce((n, [, v]) => n + v.total, 0)
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

/** `month`: „YYYY-MM”; `mrr`: az abban a hónapban indult (ma aktív) előfizetések díja; `total`: a halmozott havi bevétel a hónap végén. */
export type MonthlyRevenue = { month: string; mrr: number; newCount: number; total: number }

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
  const monthKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
  const monthMap = new Map<string, { mrr: number; newCount: number; order: number }>()
  for (const s of activeSubs) {
    const key = monthKey(s.createdAt)
    const order = new Date(s.createdAt).getFullYear() * 12 + new Date(s.createdAt).getMonth()
    const cur = monthMap.get(key) ?? { mrr: 0, newCount: 0, order }
    cur.mrr += subAmountHuf(s); cur.newCount += 1
    monthMap.set(key, cur)
  }
  let running = 0
  const monthlyRevenue: MonthlyRevenue[] = [...monthMap.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([month, v]) => { running += v.mrr; return { month, mrr: v.mrr, newCount: v.newCount, total: running } })
    .slice(-8)

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
  /** az elmúlt 30 nap foglalásai */
  monthBookings: number
  tier: Tier
  customFee: number | null
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

  // „hónap” = az elmúlt 30 nap (a fiók-lista „Foglalás · 30 nap” oszlopával egyezően)
  const monthStart = new Date(Date.now() - 30 * MS_DAY)

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
    places.push({ kind: 'salon', id: String(s.id), name: s.name, slug: s.slug, city: s.city ?? null, is_active: s.is_active ?? false, createdAt: s.createdAt, totalBookings: total.totalDocs, monthBookings: month.totalDocs, tier: resolveTier(s.tier), customFee: s.custom_monthly_fee_huf ?? null })
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
    places.push({ kind: 'restaurant', id: String(r.id), name: r.name, slug: r.slug, city: r.city ?? null, is_active: r.is_active ?? false, createdAt: r.createdAt, totalBookings: total.totalDocs, monthBookings: month.totalDocs, tier: resolveTier(r.tier), customFee: r.custom_monthly_fee_huf ?? null })
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

/* ── Üzemeltetési egészség: email-kézbesítés (a /backstage/revenue oldal "Üzemeltetés" panelje) ── */

export type EmailHealth = {
  /** Kiküldött emailek száma az elmúlt 30 napban. */
  total30d: number
  /** Ebből sikertelen (ok: false). */
  failed30d: number
  /** Sikeresség aránya %-ban (0 kiküldésnél 100 — nincs mit riasztani). */
  successRatePct: number
  /** A legutóbbi sikertelen küldések (max 5), típussal + hibaüzenettel, gyors diagnózishoz. */
  recentFailures: { type: string; to: string; error: string | null; createdAt: string }[]
  /** Ha a lekérdezés maga hibázott (nem a küldés) — a hívó ekkor NE mutasson hamis "100% sikeres"
   *  zöld jelzést, hanem explicit "nem sikerült betölteni" állapotot. */
  loadFailed?: boolean
}

/** Email-kézbesítési egészség az elmúlt 30 napra — riasztási küszöbhöz (`successRatePct < 95` → figyelmeztetés). */
export async function loadEmailHealth(): Promise<EmailHealth> {
  const payload = await getPayloadClient()
  const since = new Date(Date.now() - 30 * MS_DAY).toISOString()

  const [totalRes, failedRes] = await Promise.all([
    payload.count({ collection: 'email-log', where: { createdAt: { greater_than_equal: since } }, overrideAccess: true }),
    payload.find({
      collection: 'email-log',
      where: { and: [{ createdAt: { greater_than_equal: since } }, { ok: { equals: false } }] },
      sort: '-createdAt',
      limit: 5,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const total30d = totalRes.totalDocs
  const failed30d = failedRes.totalDocs
  const successRatePct = total30d > 0 ? Math.round(((total30d - failed30d) / total30d) * 1000) / 10 : 100

  const recentFailures = (failedRes.docs as EmailLogEntry[])
    .map(f => ({ type: f.type ?? '—', to: f.to ?? '—', error: f.error ?? null, createdAt: f.createdAt }))

  return { total30d, failed30d, successRatePct, recentFailures }
}

/* ── Regisztrációs tölcsér (a /backstage/accounts oldal tetejére) ─────────────── */

export type FunnelStage = { key: string; label: string; count: number }

/**
 * Hol esnek ki a jelöltek a signup → fizetőssé válás úton. A "látogatás" lépés szándékosan
 * hiányzik — nincs anonim látogató-követés, csak a ténylegesen regisztrált userekből tudunk
 * kiindulni. Az `accounts` a `loadBackstageData()` már betöltött listája (owner + üzlet-
 * aggregátum) — nem kérdezzük le újra, csak a "regisztrált"/"emailt megerősítette" lépéshez
 * kell egy KÜLÖN, üzlet nélküli users-lekérdezés (az `accounts` csak azokat tartalmazza, akiknek
 * MÁR van legalább egy üzlete).
 */
export async function loadRegistrationFunnel(accounts: AccountSummary[]): Promise<FunnelStage[]> {
  const payload = await getPayloadClient()
  const usersRes = await payload.find({
    collection: 'users',
    where: { role: { in: ['salon_owner', 'restaurant_owner'] } },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const owners = usersRes.docs as User[]
  const registered = owners.length
  const verified = owners.filter((u) => (u as unknown as { _verified?: boolean })._verified).length
  const hasBusiness = accounts.length
  const hasBooking = accounts.filter((a) => a.totalBookings > 0).length
  const paying = accounts.filter((a) => a.status === 'active').length

  return [
    { key: 'registered', label: 'Regisztráció elindítva', count: registered },
    { key: 'verified', label: 'Email megerősítve', count: verified },
    { key: 'business', label: 'Első üzlet létrehozva', count: hasBusiness },
    { key: 'booking', label: 'Első foglalás beérkezett', count: hasBooking },
    { key: 'paying', label: 'Fizetőssé vált', count: paying },
  ]
}

/* ── Kimenő e-mailek összesítése (Backstage › Bevétel, „Kimenő e-mailek”) ─────────── */

export type EmailStats = {
  month: number; last30: number; all: number; failed30: number
  /** napi darab az elmúlt 30 napban (a legrégebbi elöl) és az azt megelőző 30 napban */
  daily: { day: string; n: number }[]; prevDaily: number[]
  /** típusonként az elmúlt 30 napban, csökkenő sorrendben */
  byType: { type: string; n: number }[]
  /** kézbesítési állapot az elmúlt 30 napban (Resend webhook alapján) */
  delivered: number; opened: number; bounced: number
}

/** Összes kimenő e-mail az email-logból — néhány összesítő lekérdezés (nem tölti be a sorokat). */
export async function loadEmailStats(): Promise<EmailStats> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const ago30 = new Date(now.getTime() - 30 * MS_DAY)
  const ago60 = new Date(now.getTime() - 60 * MS_DAY).toISOString()
  const [tot] = await authQuery<{ month: number; last30: number; total: number; failed30: number; delivered: number; opened: number; bounced: number }>(sql`
    SELECT (COUNT(*) FILTER (WHERE created_at >= ${monthStart}))::int AS month,
           (COUNT(*) FILTER (WHERE created_at >= ${ago30.toISOString()}))::int AS last30,
           COUNT(*)::int AS total,
           (COUNT(*) FILTER (WHERE created_at >= ${ago30.toISOString()} AND ok = false))::int AS failed30,
           (COUNT(*) FILTER (WHERE created_at >= ${ago30.toISOString()} AND status IN ('delivered', 'opened', 'clicked')))::int AS delivered,
           (COUNT(*) FILTER (WHERE created_at >= ${ago30.toISOString()} AND status IN ('opened', 'clicked')))::int AS opened,
           (COUNT(*) FILTER (WHERE created_at >= ${ago30.toISOString()} AND status IN ('bounced', 'complained')))::int AS bounced
    FROM email_log`)
  const days = await authQuery<{ d: string; n: number }>(sql`
    SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*)::int AS n
    FROM email_log WHERE created_at >= ${ago60} GROUP BY 1`)
  const types = await authQuery<{ type: string; n: number }>(sql`
    SELECT type, COUNT(*)::int AS n FROM email_log WHERE created_at >= ${ago30.toISOString()} GROUP BY type ORDER BY n DESC`)
  const byDay = new Map(days.map((r) => [r.d, Number(r.n)]))
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const daily: { day: string; n: number }[] = []
  const prevDaily: number[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    daily.push({ day: key(d), n: byDay.get(key(d)) ?? 0 })
    const p = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i - 30)
    prevDaily.push(byDay.get(key(p)) ?? 0)
  }
  return {
    month: Number(tot?.month ?? 0), last30: Number(tot?.last30 ?? 0), all: Number(tot?.total ?? 0), failed30: Number(tot?.failed30 ?? 0),
    daily, prevDaily, byType: types.map((t) => ({ type: t.type, n: Number(t.n) })),
    delivered: Number(tot?.delivered ?? 0), opened: Number(tot?.opened ?? 0), bounced: Number(tot?.bounced ?? 0),
  }
}
