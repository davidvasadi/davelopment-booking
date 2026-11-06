// Vendégek adatréteg (szalon + étterem közös) — SZERVEROLDALI lapozáshoz.
//
// Korábban a Vendégek oldal minden vendég TELJES profilját (adatsorok, előzmények) egyben
// elküldte a böngészőnek, és csak 2000 foglalásból dolgozott (forgalmas helyen a régebbi
// látogatások kiestek). Most:
//  - a foglalások korlát nélkül, de csak a szükséges mezőkkel töltődnek be,
//  - a lista 20-as, könnyű sorokból áll (`listGuests`), szűrve/rendezve a szerveren,
//  - egy vendég teljes profilja csak igény szerint épül fel (`ctx.toVM`).
import { getPayloadClient } from '@/lib/payload'
import { customersOf, num, rawQuery, sql } from '@/lib/fastRead'
import { aggregateGuests, withManualGuests, bucketByCountry, guestKeyOf, countryName, type Guest, type GuestSource, type CountryBucket } from '@/lib/guests'
import { buildGuestVM, buildArrivals, returningPct, tierCounts, originSplit, todayYmd, gravatarUrl, type BuildOptions } from '@/lib/guestsView'
import { getGuestReviewMap } from '@/lib/reviews'
import type { ArrivalVM, GuestListRow, GuestVM } from '@/lib/guestsTypes'
import type { Customer, Reservation, Booking } from '@/payload/payload-types'

export type GuestsKind = 'salon' | 'restaurant'

export interface GuestsQuery {
  page?: number
  q?: string
  period?: 'all' | 'month' | 'day'
  month?: string // YYYY-MM
  day?: string // YYYY-MM-DD
  status?: 'all' | 'active' | 'blocked'
  tier?: 'all' | '1' | '2' | '3'
  sort?: 'last' | 'name' | 'visits' | 'spend' | 'tier' | 'pax'
  /** az irány (oszlopcímre kattintva fordítható); nélküle a rendezés természetes iránya (név A–Z, a többi csökkenő) */
  dir?: 'asc' | 'desc'
}

export const GUESTS_PAGE_SIZE = 10

export interface GuestsContext {
  kind: GuestsKind
  guests: Guest[]
  toVM: (g: Guest) => GuestVM
  blockedOf: (g: Guest) => boolean
  /** szalon: költés (Ft); étterem: összes létszám — a rendezéshez */
  spendOf: (g: Guest) => number
  datesByKey: Map<string, string[]>
  /** a következő foglalás napja vendégenként */
  nextByKey: Map<string, string>
  /** a vendég Customers-rekordja (export: megjegyzés, hírlevél, címke) */
  customerOf: (g: Guest) => Customer | null
  /** a foglalások exporthoz (7.6 „Foglalások”): nap, idő, vendég, mi, állapot */
  bookingRows: () => { date: string; time: string; key: string; name: string; email: string | null; phone: string | null; what: string; status: string; note: string }[]
  // összesítők a fejléchez / térképhez / donuthoz — ezek NEM a teljes listát küldik le
  counts: ReturnType<typeof tierCounts>
  arrivals: ArrivalVM[]
  buckets: CountryBucket[]
  total: number
  returningPct: number
  returningNum: number
  newNum: number
  domestic: number
  foreign: number
}

const fmtHuf = (n: number) => `${n.toLocaleString('hu-HU')} Ft`
const realVisit = (s: GuestSource) => s.status !== 'cancelled' && s.status !== 'no_show'

/** Customers-rekordok (tiltás + kézi felülírás + import-összesítő) kulcs szerinti kereséshez. */
function customerIndex(docs: Customer[]) {
  const byKey = new Map<string, Customer>()
  for (const c of docs) {
    for (const k of (c.match_index ?? '').split('\n')) if (k) byKey.set(k, c)
    if (c.customer_email) byKey.set(c.customer_email.trim().toLowerCase(), c)
    if (c.customer_phone) byKey.set(c.customer_phone.trim(), c)
  }
  return (g: { email?: string | null; phone?: string | null }): Customer | null =>
    (g.email && byKey.get(g.email.toLowerCase())) || (g.phone && byKey.get(g.phone.trim())) || null
}

/** Kézi felülírások SOURCE-szinten → az ország (telefonból) és minden nézet frissül. */
function applyOverrides(sources: GuestSource[], custFor: ReturnType<typeof customerIndex>) {
  for (const s of sources) {
    const c = custFor(s)
    if (!c) continue
    if (c.customer_name) s.name = c.customer_name
    if (c.customer_email) s.email = c.customer_email
    if (c.customer_phone) {
      s.phone = c.customer_phone
      s.country = null
    }
  }
}

/** A leggyakoribb érték (pl. kedvenc asztal). */
function mostFrequent(values: string[]): string | null {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: string | null = null; let bestN = 0
  for (const [v, n] of counts) if (n > bestN) ((bestN = n), (best = v))
  return best
}

function finish(kind: GuestsKind, guests: Guest[], sources: GuestSource[], opts: BuildOptions, spendOf: (g: Guest) => number): GuestsContext {
  const datesByKey = new Map<string, string[]>()
  const nextByKey = new Map<string, string>()
  const today = todayYmd()
  for (const s of sources) {
    if (!realVisit(s) || !s.date) continue
    const k = guestKeyOf(s)
    if (!k) continue
    const d = s.date.slice(0, 10)
    const list = datesByKey.get(k) ?? []
    list.push(d)
    datesByKey.set(k, list)
    if (d >= today && (!nextByKey.has(k) || d < nextByKey.get(k)!)) nextByKey.set(k, d)
  }
  const buckets = bucketByCountry(sources)
  const { domestic, foreign } = originSplit(buckets)
  const returningNum = guests.filter((g) => g.tier >= 2).length
  const blockedOf = (g: Guest) => !!opts.customerFor(g)?.blocked
  return {
    kind,
    guests,
    toVM: (g) => buildGuestVM(g, sources, opts),
    blockedOf,
    spendOf,
    datesByKey,
    nextByKey,
    customerOf: opts.customerFor,
    // minden foglalás (a beeső / névtelen is) — a Foglalások exportjához
    bookingRows: () => sources.filter((s) => s.date).map((s) => ({
      date: (s.date ?? '').slice(0, 10), time: opts.timeFor(s)?.slice(0, 5) ?? '', key: guestKeyOf(s) ?? '', name: s.name, email: s.email ?? null, phone: s.phone ?? null, what: opts.whatFor(s), status: s.status ?? '', note: opts.noteOf?.(s)?.trim() ?? '',
    })),
    counts: tierCounts(guests, blockedOf),
    arrivals: buildArrivals(guests, sources, opts),
    buckets,
    total: guests.length,
    returningPct: returningPct(guests),
    returningNum,
    newNum: guests.length - returningNum,
    domestic,
    foreign,
  }
}

// ── SZALON ──────────────────────────────────────────────────────────────────────

export async function loadSalonGuests(salonId: number | string): Promise<GuestsContext> {
  const payload = await getPayloadClient()
  // Sebesség: a foglalások és a vendég-rekordok KÖZVETLEN SQL-lel (lib/fastRead, docs/sebesseg) — a Payload soronként
  // ~2 ms-ot tölt, itt az összes foglalás + az összes vendég ment rajta (3,5–4 mp). A kicsi listák maradnak Payloadon.
  const sid = Number(salonId)
  const [bookingRows, svcRes, staffRes, custDocs, reviewMap] = await Promise.all([
    rawQuery<{ customer_name: string; customer_email: string | null; customer_phone: string | null; customer_city: string | null; date: string; start_time: string | null; status: string; service_id: number | null; staff_id: number | null; price_snapshot: string | null; notes: string | null; custom_answers: unknown }>(sql`
      SELECT customer_name, customer_email, customer_phone, customer_city, date, start_time, status, service_id, staff_id, price_snapshot, notes, custom_answers
      FROM bookings WHERE salon_id = ${sid} ORDER BY date DESC, created_at DESC`),
    payload.find({ collection: 'services', where: { salon: { equals: salonId } }, depth: 0, pagination: false, select: { name: true, price: true }, overrideAccess: true }),
    payload.find({ collection: 'staff', where: { salon: { equals: salonId } }, depth: 0, pagination: false, select: { name: true }, overrideAccess: true }),
    customersOf({ salon: sid }),
    getGuestReviewMap('salon', salonId),
  ])
  const res = { docs: bookingRows.map((b) => ({ ...b, service: b.service_id, staff: b.staff_id, price_snapshot: num(b.price_snapshot) })) as unknown as Booking[] }
  const custRes = { docs: custDocs }

  const svcById = new Map((svcRes.docs as { id: number | string; name?: string; price?: number | null }[]).map((s) => [String(s.id), s]))
  const staffById = new Map((staffRes.docs as { id: number | string; name?: string }[]).map((s) => [String(s.id), s.name ?? '']))
  const relId = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v != null ? String(v) : '')

  type Src = GuestSource & { time?: string; svcName?: string; staffName?: string; price?: number | null; note?: string | null; answers?: Record<string, { question: string; answer: string }> | null }
  const sources: Src[] = (res.docs as Booking[]).map((b) => {
    const svc = svcById.get(relId(b.service))
    // a foglaláskori ár (price_snapshot) elsőbbséget kap a szolgáltatás mindenkori áránál
    const price = typeof b.price_snapshot === 'number' ? b.price_snapshot : typeof svc?.price === 'number' ? svc.price : null
    return {
      name: b.customer_name, email: b.customer_email, phone: b.customer_phone, date: b.date, city: b.customer_city,
      status: b.status, time: b.start_time, svcName: svc?.name ?? '', staffName: staffById.get(relId(b.staff)) ?? '',
      price, note: (b as { notes?: string | null }).notes ?? null, answers: (b.custom_answers ?? null) as Src['answers'],
    }
  })

  const custFor = customerIndex(custRes.docs as Customer[])
  applyOverrides(sources, custFor)
  const guests = withManualGuests(aggregateGuests(sources), custRes.docs as Customer[])
  const priceOf = (s: GuestSource) => (s as Src).price ?? 0

  // költés vendégenként (rendezéshez és a listához) — egy menetben, csak a múltbeli látogatások
  const spendByKey = new Map<string, number>()
  const today = todayYmd()
  for (const s of sources) {
    if (!realVisit(s) || (s.date ?? '') >= today) continue
    const k = guestKeyOf(s)
    if (k) spendByKey.set(k, (spendByKey.get(k) ?? 0) + priceOf(s))
  }
  const spendOf = (g: Guest) => custFor(g)?.total_revenue_huf || spendByKey.get(g.key) || 0

  const opts: BuildOptions = {
    whatFor: (s) => [(s as Src).svcName || 'Foglalás', (s as Src).staffName].filter(Boolean).join(' · '),
    amountFor: (s) => (typeof (s as Src).price === 'number' ? fmtHuf((s as Src).price as number) : null),
    timeFor: (s) => (s as Src).time ?? null,
    spendFor: (g) => { const v = spendOf(g); return v ? fmtHuf(v) : null },
    noteFor: (own) => ({ guest: [...own].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((s) => (s as Src).note?.trim()).find((v) => v) || null, internal: null }),
    noteOf: (s) => (s as Src).note ?? null,
    answersOf: (s) => (s as Src).answers ?? null,
    customerFor: custFor,
    rating: (g) => reviewMap.get(g.key) ?? null,
  }
  return finish('salon', guests, sources, opts, spendOf)
}

// ── ÉTTEREM ─────────────────────────────────────────────────────────────────────

export async function loadRestaurantGuests(restaurantId: number | string): Promise<GuestsContext> {
  const payload = await getPayloadClient()
  // Sebesség: a foglalások (asztalokkal) és a vendég-rekordok KÖZVETLEN SQL-lel (lib/fastRead, docs/sebesseg).
  const rid = Number(restaurantId)
  const [resRows, relRows, tablesRes, custDocs, reviewMap] = await Promise.all([
    rawQuery<{ id: number; customer_name: string; customer_email: string | null; customer_phone: string | null; customer_city: string | null; country: string | null; date: string; start_time: string | null; status: string; pax: string | null; occasion: string | null; occasion_icon: string | null; notes: string | null; internal_notes: string | null; custom_answers: unknown }>(sql`
      SELECT id, customer_name, customer_email, customer_phone, customer_city, country, date, start_time, status, pax, occasion, occasion_icon, notes, internal_notes, custom_answers
      FROM reservations WHERE restaurant_id = ${rid} ORDER BY date DESC, created_at DESC`),
    rawQuery<{ parent_id: number; tables_id: number }>(sql`
      SELECT rr.parent_id, rr.tables_id FROM reservations_rels rr JOIN reservations r ON r.id = rr.parent_id
      WHERE r.restaurant_id = ${rid} AND rr.path = 'tables' AND rr.tables_id IS NOT NULL ORDER BY rr.parent_id, rr."order"`),
    payload.find({ collection: 'tables', where: { restaurant: { equals: restaurantId } }, depth: 0, limit: 500, select: { name: true }, overrideAccess: true }),
    customersOf({ restaurant: rid }),
    getGuestReviewMap('restaurant', restaurantId),
  ])
  const tablesByRes = new Map<number, number[]>()
  for (const r of relRows) tablesByRes.set(r.parent_id, [...(tablesByRes.get(r.parent_id) ?? []), r.tables_id])
  const res = { docs: resRows.map((r) => ({ ...r, pax: num(r.pax), tables: tablesByRes.get(r.id) ?? [] })) as unknown as Reservation[] }
  const custRes = { docs: custDocs }

  const tableName = new Map<number, string>()
  for (const t of tablesRes.docs as Array<{ id: number; name?: string | null }>) if (t.name) tableName.set(t.id, t.name)
  const tablesOf = (raw: Reservation['tables']): string[] =>
    (Array.isArray(raw) ? raw : [])
      .map((t) => (typeof t === 'object' && t ? (t as { name?: string | null }).name ?? null : tableName.get(Number(t)) ?? null))
      .filter((v): v is string => !!v)

  type Src = GuestSource & { time?: string; occasion?: string | null; occasionIcon?: string | null; note?: string | null; internal?: string | null; tables?: string[]; answers?: Record<string, { question: string; answer: string }> | null }
  const sources: Src[] = (res.docs as Reservation[]).map((r) => ({
    name: r.customer_name, email: r.customer_email, phone: r.customer_phone, date: r.date, pax: r.pax, country: r.country,
    city: r.customer_city, status: r.status, time: r.start_time, occasion: r.occasion ?? null, occasionIcon: r.occasion_icon ?? null,
    note: r.notes, internal: r.internal_notes, tables: tablesOf(r.tables), answers: (r.custom_answers ?? null) as Src['answers'],
  }))

  const custFor = customerIndex(custRes.docs as Customer[])
  applyOverrides(sources, custFor)
  const guests = withManualGuests(aggregateGuests(sources), custRes.docs as Customer[])
  const latest = (own: GuestSource[], pick: (s: Src) => string | null | undefined): string | null =>
    [...own].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((s) => pick(s as Src)?.trim()).find((v) => v) || null

  const opts: BuildOptions = {
    whatFor: (s) => [((s as Src).tables ?? []).join(' + '), `${s.pax ?? 0} fő`].filter(Boolean).join(' · '),
    amountFor: () => null,
    timeFor: (s) => (s as Src).time ?? null,
    avgPaxFor: (_g, past) => {
      if (!past.length) return null
      const v = past.reduce((a, s) => a + (s.pax ?? 0), 0) / past.length
      return `${String(Math.round(v * 10) / 10).replace('.', ',')} fő`
    },
    favTableFor: (own) => mostFrequent(own.flatMap((s) => (s as Src).tables ?? [])),
    occasionOf: (s) => ((s as Src).occasion ? { label: (s as Src).occasion as string, icon: (s as Src).occasionIcon ?? null } : null),
    noteFor: (own) => ({ guest: latest(own, (s) => s.note), internal: latest(own, (s) => s.internal) }),
    noteOf: (s) => (s as Src).note ?? null,
    answersOf: (s) => (s as Src).answers ?? null,
    customerFor: custFor,
    rating: (g) => reviewMap.get(g.key) ?? null,
  }
  return finish('restaurant', guests, sources, opts, (g) => g.totalPax)
}

export function loadGuests(kind: GuestsKind, businessId: number | string): Promise<GuestsContext> {
  return kind === 'salon' ? loadSalonGuests(businessId) : loadRestaurantGuests(businessId)
}

// ── LISTA: szűrés · rendezés · lapozás (a szerveren) ─────────────────────────────

export function listGuests(ctx: GuestsContext, query: GuestsQuery): { total: number; page: number; pageCount: number; items: GuestListRow[] } {
  const q = (query.q ?? '').trim().toLowerCase()
  const period = query.period ?? 'all'
  let list = ctx.guests
  if (!q && period === 'day' && query.day) list = list.filter((g) => (ctx.datesByKey.get(g.key) ?? []).includes(query.day!))
  else if (!q && period === 'month' && query.month) list = list.filter((g) => (g.lastVisit ?? '').slice(0, 7) === query.month)
  if (query.status === 'blocked') list = list.filter((g) => ctx.blockedOf(g))
  else if (query.status === 'active') list = list.filter((g) => !ctx.blockedOf(g))
  if (query.tier && query.tier !== 'all') list = list.filter((g) => String(g.tier) === query.tier)
  // a kereső az ország nevére (pl. „Ausztria”, „magyar”) és 2 betűs kódjára („AT”) is szűr
  const countryHit = (g: Guest) => {
    const iso = g.country?.trim().toUpperCase()
    if (!iso) return false
    if (q.length === 2 && iso.toLowerCase() === q) return true
    return (countryName(iso) ?? '').toLowerCase().includes(q)
  }
  if (q) list = list.filter((g) => g.name.toLowerCase().includes(q) || (g.email ?? '').toLowerCase().includes(q) || (g.phone ?? '').includes(q) || countryHit(g))

  const sorted = [...list]
  if (query.sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  else if (query.sort === 'visits') sorted.sort((a, b) => b.visits - a.visits)
  else if (query.sort === 'spend') sorted.sort((a, b) => ctx.spendOf(b) - ctx.spendOf(a))
  else if (query.sort === 'tier') sorted.sort((a, b) => b.tier - a.tier || b.visits - a.visits)
  // étterem: átlagos létszám (az összes létszám / látogatás)
  else if (query.sort === 'pax') sorted.sort((a, b) => ctx.spendOf(b) / Math.max(1, b.visits) - ctx.spendOf(a) / Math.max(1, a.visits))
  else sorted.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
  // a kért irány, ha eltér a természetestől (név: A–Z, a többi: csökkenő)
  const natural = query.sort === 'name' ? 'asc' : 'desc'
  if (query.dir && query.dir !== natural) sorted.reverse()

  const pageCount = Math.max(1, Math.ceil(sorted.length / GUESTS_PAGE_SIZE))
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount)
  const items: GuestListRow[] = sorted.slice((page - 1) * GUESTS_PAGE_SIZE, page * GUESTS_PAGE_SIZE).map((g) => ({
    key: g.key,
    name: g.name,
    avatarUrl: gravatarUrl(g.email),
    country: g.country?.trim().toUpperCase() || null,
    tier: g.tier,
    blocked: ctx.blockedOf(g),
    visits: g.visits,
    lastVisit: g.lastVisit,
    spend: ctx.kind === 'salon' ? ctx.spendOf(g) || null : null,
    avgPax: ctx.kind === 'restaurant' && g.visits ? Math.round((g.totalPax / g.visits) * 10) / 10 : null,
    next: ctx.nextByKey.get(g.key) ?? null,
  }))
  return { total: sorted.length, page, pageCount, items }
}

/** A lekérdezés-paraméterek beolvasása (API + oldal közös). */
export function parseGuestsQuery(sp: URLSearchParams): GuestsQuery {
  const pick = <T extends string>(v: string | null, allowed: readonly T[], def: T): T => (v && (allowed as readonly string[]).includes(v) ? (v as T) : def)
  return {
    page: Number(sp.get('page')) || 1,
    q: sp.get('q') ?? '',
    period: pick(sp.get('period'), ['all', 'month', 'day'] as const, 'all'),
    month: sp.get('month') ?? undefined,
    day: sp.get('day') ?? undefined,
    status: pick(sp.get('status'), ['all', 'active', 'blocked'] as const, 'all'),
    tier: pick(sp.get('tier'), ['all', '1', '2', '3'] as const, 'all'),
    sort: pick(sp.get('sort'), ['last', 'name', 'visits', 'spend', 'tier', 'pax'] as const, 'last'),
    dir: sp.get('dir') === 'asc' ? 'asc' : sp.get('dir') === 'desc' ? 'desc' : undefined,
  }
}
