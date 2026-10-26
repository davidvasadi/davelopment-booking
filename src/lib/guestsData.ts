// Vendégek adatréteg (szalon + étterem közös) — SZERVEROLDALI lapozáshoz.
//
// Korábban a Vendégek oldal minden vendég TELJES profilját (adatsorok, előzmények) egyben
// elküldte a böngészőnek, és csak 2000 foglalásból dolgozott (forgalmas helyen a régebbi
// látogatások kiestek). Most:
//  - a foglalások korlát nélkül, de csak a szükséges mezőkkel töltődnek be,
//  - a lista 20-as, könnyű sorokból áll (`listGuests`), szűrve/rendezve a szerveren,
//  - egy vendég teljes profilja csak igény szerint épül fel (`ctx.toVM`).
import { getPayloadClient } from '@/lib/payload'
import { aggregateGuests, withManualGuests, bucketByCountry, guestKeyOf, type Guest, type GuestSource, type CountryBucket } from '@/lib/guests'
import { buildGuestVMs, buildArrivals, returningPct, tierSegments, originSplit, reviewRowValue } from '@/lib/guestsView'
import { getGuestReviewMap } from '@/lib/reviews'
import type { GuestVM, ArrivalVM } from '@/components/dashboard/guests-view'
import type { Customer, Reservation, Booking } from '@/payload/payload-types'

export type GuestsKind = 'salon' | 'restaurant'

/** Egy lista-sor — csak ami a listához kell (a profil külön töltődik). */
export interface GuestListItem {
  key: string
  name: string
  country: string | null
  tier: Guest['tier']
  blocked: boolean
  visits: number
  lastVisit: string | null
}

export interface GuestsQuery {
  page?: number
  q?: string
  period?: 'all' | 'month' | 'day'
  month?: string // YYYY-MM
  day?: string // YYYY-MM-DD
  status?: 'all' | 'active' | 'blocked'
  tier?: 'all' | '1' | '2' | '3'
  sort?: 'last' | 'name' | 'visits' | 'spend'
}

export const GUESTS_PAGE_SIZE = 20

export interface GuestsContext {
  guests: Guest[]
  toVM: (g: Guest) => GuestVM
  blockedOf: (g: Guest) => boolean
  spendOf: (g: Guest) => number
  datesByKey: Map<string, string[]>
  // összesítők a fejléchez / térképhez / donuthoz — ezek NEM a teljes listát küldik le
  pills: ReturnType<typeof tierSegments>
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

/** Egyedi kérdések története: kérdés-AZONOSÍTÓNKÉNT a legfrissebb válasz (átfogalmazásnál sem szakad ketté). */
function latestCustomAnswers(own: GuestSource[]): { label: string; value: string }[] {
  const byQuestionId = new Map<string, { label: string; value: string }>()
  for (const s of [...own].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))) {
    const answers = (s as { customAnswers?: Record<string, { question: string; answer: string }> | null }).customAnswers
    if (!answers) continue
    for (const [qid, qa] of Object.entries(answers)) byQuestionId.set(qid, { label: qa.question, value: qa.answer })
  }
  return Array.from(byQuestionId.values())
}

function finish(
  guests: Guest[],
  sources: GuestSource[],
  toVM: (g: Guest) => GuestVM,
  blockedOf: (g: Guest) => boolean,
  spendOf: (g: Guest) => number,
  arrivals: ArrivalVM[],
): GuestsContext {
  const datesByKey = new Map<string, string[]>()
  for (const s of sources) {
    if (!realVisit(s) || !s.date) continue
    const k = guestKeyOf(s)
    if (!k) continue
    const list = datesByKey.get(k) ?? []
    list.push(s.date.slice(0, 10))
    datesByKey.set(k, list)
  }
  const buckets = bucketByCountry(sources)
  const { domestic, foreign } = originSplit(buckets)
  const returningNum = guests.filter((g) => g.tier >= 2).length
  return {
    guests,
    toVM,
    blockedOf,
    spendOf,
    datesByKey,
    pills: tierSegments(guests),
    arrivals,
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
  const [res, svcRes, staffRes, custRes, reviewMap] = await Promise.all([
    payload.find({
      collection: 'bookings',
      where: { salon: { equals: salonId } },
      sort: '-date',
      depth: 0,
      pagination: false, // MIND (korábban 2000 → forgalmas helyen kiestek a régi látogatások)
      select: {
        customer_name: true, customer_email: true, customer_phone: true, customer_city: true,
        date: true, start_time: true, status: true, service: true, staff: true,
        price_snapshot: true, notes: true, custom_answers: true,
      },
      overrideAccess: true,
    }),
    payload.find({ collection: 'services', where: { salon: { equals: salonId } }, depth: 0, pagination: false, select: { name: true, price: true }, overrideAccess: true }),
    payload.find({ collection: 'staff', where: { salon: { equals: salonId } }, depth: 0, pagination: false, select: { name: true }, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { salon: { equals: salonId } }, depth: 0, pagination: false, overrideAccess: true }),
    getGuestReviewMap('salon', salonId),
  ])

  const svcById = new Map((svcRes.docs as { id: number | string; name?: string; price?: number | null }[]).map((s) => [String(s.id), s]))
  const staffById = new Map((staffRes.docs as { id: number | string; name?: string }[]).map((s) => [String(s.id), s.name ?? '']))
  const relId = (v: unknown) => (v && typeof v === 'object' ? String((v as { id: unknown }).id) : v != null ? String(v) : '')

  type Src = GuestSource & { time?: string; svcName?: string; staffName?: string; price?: number | null; note?: string | null; customAnswers?: Record<string, { question: string; answer: string }> | null }
  const sources: Src[] = (res.docs as Booking[]).map((b) => {
    const svc = svcById.get(relId(b.service))
    // a foglaláskori ár (price_snapshot) elsőbbséget kap a szolgáltatás mindenkori áránál
    const price = typeof b.price_snapshot === 'number' ? b.price_snapshot : typeof svc?.price === 'number' ? svc.price : null
    return {
      name: b.customer_name, email: b.customer_email, phone: b.customer_phone, date: b.date, city: b.customer_city,
      status: b.status, time: b.start_time, svcName: svc?.name ?? '', staffName: staffById.get(relId(b.staff)) ?? '',
      price, note: (b as { notes?: string | null }).notes ?? null, customAnswers: b.custom_answers ?? null,
    }
  })

  const custFor = customerIndex(custRes.docs as Customer[])
  applyOverrides(sources, custFor)
  const guests = withManualGuests(aggregateGuests(sources), custRes.docs as Customer[])

  const latestNote = (own: GuestSource[]): string | null =>
    [...own].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((s) => (s as Src).note?.trim()).find((v) => v) || null
  const priceOf = (s: GuestSource) => (s as Src).price ?? 0
  const mostFrequent = (own: GuestSource[], pick: (s: Src) => string | undefined) => {
    const counts = new Map<string, number>()
    for (const s of own) { const n = pick(s as Src); if (n) counts.set(n, (counts.get(n) ?? 0) + 1) }
    let best = ''; let bestN = 0
    for (const [n, c] of counts) if (c > bestN) ((bestN = c), (best = n))
    return best || '—'
  }
  const byDate = (own: GuestSource[], dir: 1 | -1) => [...own.filter(realVisit)].sort((a, b) => dir * (a.date ?? '').localeCompare(b.date ?? ''))

  const opts: Parameters<typeof buildGuestVMs>[2] = {
    salon: true,
    labelFor: (s) => (s as Src).svcName || 'Foglalás',
    amountFor: (s) => (typeof (s as Src).price === 'number' ? fmtHuf((s as Src).price as number) : null),
    favFor: (_g, own) => mostFrequent(own, (s) => s.svcName),
    rowsFor: (g, { past, upcoming }) => {
      const allOwn = [...past, ...upcoming]
      const pastSpend = past.reduce((a, s) => a + priceOf(s), 0)
      const note = latestNote(allOwn)
      const review = reviewMap.get(g.key)
      // import-összesítő (pl. Salonic) — ahol kitöltve, elsőbbséget kap a számolt értékkel szemben
      const cust = custFor(g)
      const visitCount = cust?.visit_count ?? past.length
      const cancelN = cust?.cancellation_count ?? allOwn.filter((s) => s.status === 'cancelled').length
      const noShowN = cust?.no_show_count ?? allOwn.filter((s) => s.status === 'no_show').length
      const totalSpend = cust?.total_revenue_huf || (pastSpend > 0 ? pastSpend : null)
      return [
        { label: 'Látogatás', value: String(visitCount) },
        { label: 'Összes költés eddig', value: totalSpend ? fmtHuf(totalSpend) : '—' },
        { label: 'Közelgő foglalás', value: upcoming.length > 0 ? `${upcoming.length} foglalás` : '—' },
        { label: 'Kedvenc', value: mostFrequent(allOwn, (s) => s.svcName) },
        { label: 'Első szolgáltatás', value: (byDate(allOwn, 1)[0] as Src | undefined)?.svcName || '—' },
        { label: 'Utolsó szolgáltatás', value: (byDate(allOwn, -1)[0] as Src | undefined)?.svcName || '—' },
        { label: 'Kedvenc munkatárs', value: mostFrequent(allOwn.filter(realVisit), (s) => s.staffName) },
        ...(cancelN > 0 ? [{ label: 'Lemondások száma', value: String(cancelN) }] : []),
        ...(noShowN > 0 ? [{ label: 'Nem jött el', value: String(noShowN) }] : []),
        ...(cust?.last_cancellation_reason ? [{ label: 'Utolsó lemondás oka', value: cust.last_cancellation_reason }] : []),
        ...(review ? [{ label: 'Értékelés', value: reviewRowValue(review.average, review.count) }] : []),
        ...(note ? [{ label: 'Megjegyzés', value: note }] : []),
        ...(review?.latestComment ? [{ label: 'Vendég értékelése', value: review.latestComment }] : []),
        ...latestCustomAnswers(allOwn),
      ]
    },
    noteFor: (own) => ({ guest: latestNote(own), internal: null }),
    historyDetailFor: (s) => {
      const src = s as Src
      const rows: Array<{ label: string; value: string }> = []
      if (src.time) rows.push({ label: 'Időpont', value: src.time.slice(0, 5) })
      if (src.svcName) rows.push({ label: 'Szolgáltatás', value: src.svcName })
      if (src.staffName) rows.push({ label: 'Munkatárs', value: src.staffName })
      if (typeof src.price === 'number') rows.push({ label: 'Ár', value: fmtHuf(src.price) })
      return { rows, note: src.note?.trim() || null }
    },
    blockedFor: (g) => !!custFor(g)?.blocked,
    blockReasonFor: (g) => custFor(g)?.block_reason ?? null,
  }

  // költés vendégenként (rendezéshez) — egy menetben
  const spendByKey = new Map<string, number>()
  for (const s of sources) {
    if (!realVisit(s) || (s.date ?? '') > new Date().toISOString().slice(0, 10)) continue
    const k = guestKeyOf(s)
    if (k) spendByKey.set(k, (spendByKey.get(k) ?? 0) + priceOf(s))
  }

  const arrivals = buildArrivals(guests, sources, { salon: true, timeFor: (s) => (s as Src).time ?? null })
  return finish(
    guests,
    sources,
    (g) => buildGuestVMs([g], sources, opts)[0],
    (g) => !!custFor(g)?.blocked,
    (g) => custFor(g)?.total_revenue_huf || spendByKey.get(g.key) || 0,
    arrivals,
  )
}

// ── ÉTTEREM ─────────────────────────────────────────────────────────────────────

const DAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

export async function loadRestaurantGuests(restaurantId: number | string): Promise<GuestsContext> {
  const payload = await getPayloadClient()
  const [res, tablesRes, custRes, reviewMap] = await Promise.all([
    payload.find({
      collection: 'reservations',
      where: { restaurant: { equals: restaurantId } },
      sort: '-date',
      depth: 0,
      pagination: false, // MIND (korábban 2000)
      select: {
        customer_name: true, customer_email: true, customer_phone: true, customer_city: true, country: true,
        date: true, start_time: true, status: true, pax: true, occasion: true, occasion_icon: true,
        notes: true, internal_notes: true, tables: true, custom_answers: true,
      },
      overrideAccess: true,
    }),
    payload.find({ collection: 'tables', where: { restaurant: { equals: restaurantId } }, depth: 0, limit: 500, select: { name: true }, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { restaurant: { equals: restaurantId } }, depth: 0, pagination: false, overrideAccess: true }),
    getGuestReviewMap('restaurant', restaurantId),
  ])

  const tableName = new Map<number, string>()
  for (const t of tablesRes.docs as Array<{ id: number; name?: string | null }>) if (t.name) tableName.set(t.id, t.name)
  const tablesOf = (raw: Reservation['tables']): string[] =>
    (Array.isArray(raw) ? raw : [])
      .map((t) => (typeof t === 'object' && t ? (t as { name?: string | null }).name ?? null : tableName.get(Number(t)) ?? null))
      .filter((v): v is string => !!v)

  type Src = GuestSource & { time?: string; occasion?: string | null; occasionIcon?: string | null; note?: string | null; internal?: string | null; tables?: string[]; customAnswers?: Record<string, { question: string; answer: string }> | null }
  const sources: Src[] = (res.docs as Reservation[]).map((r) => ({
    name: r.customer_name, email: r.customer_email, phone: r.customer_phone, date: r.date, pax: r.pax, country: r.country,
    city: r.customer_city, status: r.status, time: r.start_time, occasion: r.occasion ?? null, occasionIcon: r.occasion_icon ?? null,
    note: r.notes, internal: r.internal_notes, tables: tablesOf(r.tables), customAnswers: r.custom_answers ?? null,
  }))

  const custFor = customerIndex(custRes.docs as Customer[])
  applyOverrides(sources, custFor)
  const guests = withManualGuests(aggregateGuests(sources), custRes.docs as Customer[])

  const latestNote = (own: GuestSource[], pick: (s: Src) => string | null | undefined): string | null =>
    [...own].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((s) => pick(s as Src)?.trim()).find((v) => v) || null
  const favDay = (own: GuestSource[]): string => {
    const counts = new Map<number, number>()
    for (const s of own) { if (!s.date) continue; const d = new Date(s.date).getDay(); counts.set(d, (counts.get(d) ?? 0) + 1) }
    let best = -1; let bestN = 0
    for (const [d, n] of counts) if (n > bestN) ((bestN = n), (best = d))
    return best >= 0 ? DAYS[best] : '—'
  }

  const opts: Parameters<typeof buildGuestVMs>[2] = {
    labelFor: (s) => `${s.pax ?? 0} fő foglalás`,
    amountFor: () => null,
    favFor: (_g, own) => favDay(own),
    rowsFor: (g, { past, upcoming }) => {
      const upPax = upcoming.reduce((a, s) => a + (s.pax ?? 0), 0)
      const allOwn = [...past, ...upcoming]
      const tables = Array.from(new Set(allOwn.flatMap((s) => (s as Src).tables ?? [])))
      const note = latestNote(allOwn, (s) => s.note)
      const review = reviewMap.get(g.key)
      const cust = custFor(g)
      const cancelCount = cust?.cancellation_count ?? allOwn.filter((s) => s.status === 'cancelled').length
      const noShowCount = cust?.no_show_count ?? allOwn.filter((s) => s.status === 'no_show').length
      const visitCount = cust?.visit_count ?? past.length
      return [
        { label: 'Látogatás', value: String(visitCount) },
        { label: 'Összes létszám', value: `${g.totalPax} fő` },
        { label: 'Közelgő foglalás', value: upcoming.length > 0 ? `${upcoming.length} · ${upPax} fő` : '—' },
        { label: 'Asztalok', value: tables.length > 0 ? tables.join(', ') : '—' },
        { label: 'Kedvenc nap', value: favDay(allOwn) },
        ...(cancelCount > 0 ? [{ label: 'Lemondások száma', value: String(cancelCount) }] : []),
        ...(noShowCount > 0 ? [{ label: 'Nem jött el', value: String(noShowCount) }] : []),
        ...(cust?.last_cancellation_reason ? [{ label: 'Utolsó lemondás oka', value: cust.last_cancellation_reason }] : []),
        ...(review ? [{ label: 'Értékelés', value: reviewRowValue(review.average, review.count) }] : []),
        ...(note ? [{ label: 'Megjegyzés', value: note }] : []),
        ...(review?.latestComment ? [{ label: 'Vendég értékelése', value: review.latestComment }] : []),
        ...latestCustomAnswers(allOwn),
      ]
    },
    birthdayDateFor: (own) => {
      const bd = [...own].filter((s) => (s as Src).occasion && s.date).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0]
      return bd?.date ?? null
    },
    noteFor: (own) => ({ guest: latestNote(own, (s) => s.note), internal: latestNote(own, (s) => s.internal) }),
    historyDetailFor: (s) => {
      const src = s as Src
      const rows: Array<{ label: string; value: string }> = []
      if (src.time) rows.push({ label: 'Időpont', value: src.time.slice(0, 5) })
      rows.push({ label: 'Létszám', value: `${src.pax ?? 0} fő` })
      if (src.tables && src.tables.length > 0) rows.push({ label: 'Asztal', value: src.tables.join(', ') })
      if (src.occasion) rows.push({ label: 'Alkalom', value: src.occasion })
      return { rows, note: src.note?.trim() || null }
    },
    blockedFor: (g) => !!custFor(g)?.blocked,
    blockReasonFor: (g) => custFor(g)?.block_reason ?? null,
  }

  const arrivals = buildArrivals(guests, sources, { timeFor: (s) => (s as Src).time ?? null })
  return finish(
    guests,
    sources,
    (g) => buildGuestVMs([g], sources, opts)[0],
    (g) => !!custFor(g)?.blocked,
    (g) => g.totalPax,
    arrivals,
  )
}

export function loadGuests(kind: GuestsKind, businessId: number | string): Promise<GuestsContext> {
  return kind === 'salon' ? loadSalonGuests(businessId) : loadRestaurantGuests(businessId)
}

// ── LISTA: szűrés · rendezés · lapozás (a szerveren) ─────────────────────────────

export function listGuests(ctx: GuestsContext, query: GuestsQuery): { total: number; page: number; pageCount: number; items: GuestListItem[] } {
  const q = (query.q ?? '').trim().toLowerCase()
  const period = query.period ?? 'all'
  let list = ctx.guests
  if (!q && period === 'day' && query.day) list = list.filter((g) => (ctx.datesByKey.get(g.key) ?? []).includes(query.day!))
  else if (!q && period === 'month' && query.month) list = list.filter((g) => (g.lastVisit ?? '').slice(0, 7) === query.month)
  if (query.status === 'blocked') list = list.filter((g) => ctx.blockedOf(g))
  else if (query.status === 'active') list = list.filter((g) => !ctx.blockedOf(g))
  if (query.tier && query.tier !== 'all') list = list.filter((g) => String(g.tier) === query.tier)
  if (q) list = list.filter((g) => g.name.toLowerCase().includes(q) || (g.email ?? '').toLowerCase().includes(q) || (g.phone ?? '').includes(q))

  const sorted = [...list]
  if (query.sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'hu'))
  else if (query.sort === 'visits') sorted.sort((a, b) => b.visits - a.visits)
  else if (query.sort === 'spend') sorted.sort((a, b) => ctx.spendOf(b) - ctx.spendOf(a))
  else sorted.sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))

  const pageCount = Math.max(1, Math.ceil(sorted.length / GUESTS_PAGE_SIZE))
  const page = Math.min(Math.max(1, query.page ?? 1), pageCount)
  const items = sorted.slice((page - 1) * GUESTS_PAGE_SIZE, page * GUESTS_PAGE_SIZE).map((g) => ({
    key: g.key,
    name: g.name,
    country: g.country?.trim().toUpperCase() || null,
    tier: g.tier,
    blocked: ctx.blockedOf(g),
    visits: g.visits,
    lastVisit: g.lastVisit,
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
    sort: pick(sp.get('sort'), ['last', 'name', 'visits', 'spend'] as const, 'last'),
  }
}
