import { parseISO } from 'date-fns'
import { hhmmToMinutes, minutesToHHMM, getDayName } from './utils'
import { getPayloadClient } from './payload'
import type { Restaurant, OpeningHour, Table, Reservation } from '@/payload/payload-types'

export interface RestaurantTimeSlot {
  start: string
  end: string
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'seated', 'completed'] as const

/** Egy adott napra szabad időpontokat ad vissza adott létszámra (pax). */
export async function getRestaurantSlots(params: {
  restaurantId: string | number
  date: string // YYYY-MM-DD
  pax: number
}): Promise<RestaurantTimeSlot[]> {
  const { restaurantId, date, pax } = params
  const payload = await getPayloadClient()

  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })) as Restaurant

  const turn = restaurant.turn_duration_minutes ?? 120
  const step = restaurant.slot_step_minutes ?? 30
  const leadHours = restaurant.lead_time_hours ?? 0
  const lastSeatingBuffer = restaurant.last_seating_buffer_minutes ?? 0

  // 1. Nyitvatartás az adott napra
  const dayName = getDayName(parseISO(date))
  const ohRes = await payload.find({
    collection: 'opening-hours',
    where: {
      and: [{ restaurant: { equals: restaurantId } }, { day_of_week: { equals: dayName } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  const oh = ohRes.docs[0] as OpeningHour | undefined
  if (!oh || !oh.is_open || !oh.open_time || !oh.close_time) return []

  let openMin = hhmmToMinutes(oh.open_time)
  let closeMin = hhmmToMinutes(oh.close_time)

  // 1b. Nyitvatartási kivétel: a `date`-et tartalmazó tartomány felülírja a heti rendet.
  // Zárva → nincs slot; módosított idő → felülírja a nyitás/zárást.
  const excRes = await payload.find({
    collection: 'opening-hours-exceptions',
    where: {
      and: [
        { restaurant: { equals: restaurantId } },
        { start_date: { less_than_equal: date } },
        { end_date: { greater_than_equal: date } },
      ],
    },
    limit: 1,
    overrideAccess: true,
  })
  const exc = excRes.docs[0] as
    | { is_closed?: boolean; open_time?: string | null; close_time?: string | null }
    | undefined
  if (exc) {
    if (exc.is_closed) return []
    if (exc.open_time && exc.close_time) {
      openMin = hhmmToMinutes(exc.open_time)
      closeMin = hhmmToMinutes(exc.close_time)
    }
  }

  // 2. Jelölt kezdési időpontok (lépésenként), úgy hogy a teljes turnus záróráig férjen
  // Az utolsó kezdő időpont a zárás - buffer (0 = zárásig lehet kezdeni).
  // A foglalás ettől még mindig `turn` percig tart (lásd end_time), akár a zárásba lóghat.
  const latestStart = closeMin - lastSeatingBuffer
  const candidates: number[] = []
  let cursor = openMin
  while (cursor <= latestStart) {
    candidates.push(cursor)
    cursor += step
  }

  // 3. Lead-time + múlt szűrés
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const earliestMin =
    date === todayStr ? now.getHours() * 60 + now.getMinutes() + leadHours * 60 : date < todayStr ? Infinity : 0

  // 4. Aktív foglalások a napra
  const resRes = await payload.find({
    collection: 'reservations',
    where: {
      and: [
        { restaurant: { equals: restaurantId } },
        { date: { equals: date } },
        { status: { in: ACTIVE_STATUSES.join(',') } },
      ],
    },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const reservations = resRes.docs as Reservation[]

  if (restaurant.capacity_mode === 'flat') {
    const maxPax = restaurant.max_pax ?? 0
    return candidates
      .filter((c) => c >= earliestMin)
      .filter((slotStart) => {
        const slotEnd = slotStart + turn
        const overlappingPax = reservations
          .filter((r) => {
            const rs = hhmmToMinutes(r.start_time)
            const re = hhmmToMinutes(r.end_time)
            return slotStart < re && slotEnd > rs
          })
          .reduce((s, r) => s + (r.pax ?? 0), 0)
        return overlappingPax + pax <= maxPax
      })
      .map((s) => ({ start: minutesToHHMM(s), end: minutesToHHMM(s + turn) }))
  }

  // tables mód — kell legyen szabad, megfelelő kapacitású asztal
  const tablesRes = await payload.find({
    collection: 'tables',
    where: {
      and: [{ restaurant: { equals: restaurantId } }, { is_active: { not_equals: false } }],
    },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const tables = tablesRes.docs as Table[]

  return candidates
    .filter((c) => c >= earliestMin)
    .filter((slotStart) => findAllocation(slotStart, slotStart + turn, tables, reservations, pax) !== null)
    .map((s) => ({ start: minutesToHHMM(s), end: minutesToHHMM(s + turn) }))
}

/** Egy foglalás által elfoglalt asztal-ID-k (string-re normalizálva). */
function reservedTableIds(r: Reservation): string[] {
  const list = r.tables ?? []
  return list.map((t) => String(typeof t === 'object' && t ? t.id : t))
}

/** Egy combinable_with-ből a kapcsolt asztal-ID-k. */
function combinableIds(t: Table): string[] {
  return (t.combinable_with ?? []).map((c) => String(typeof c === 'object' && c ? c.id : c))
}

/**
 * Szimmetrikus szomszédsági térkép a combinable_with élekből.
 * Ha A-nál be van jelölve B, akkor A↔B mindkét irányban összevonható,
 * függetlenül attól, hogy B-nél is be van-e jelölve A.
 */
function buildAdjacency(tables: Table[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  const ensure = (id: string) => {
    if (!adj.has(id)) adj.set(id, new Set())
    return adj.get(id)!
  }
  for (const t of tables) {
    const tid = String(t.id)
    ensure(tid)
    for (const nid of combinableIds(t)) {
      ensure(tid).add(nid)
      ensure(nid).add(tid)
    }
  }
  return adj
}

/**
 * Asztal-allokáció egy időablakra adott létszámra.
 * Először a legkisebb egyetlen, elég nagy szabad asztalt preferálja.
 * Ha egyetlen asztal sem elég, előre engedélyezett (combinable_with) összefüggő
 * asztalcsoportot keres, amelynek összkapacitása ≥ pax és minden tagja szabad.
 * Visszaad: a lefoglalandó asztal-ID-k tömbje, vagy null ha nincs megoldás.
 */
function findAllocation(
  slotStart: number,
  slotEnd: number,
  allTables: Table[],
  reservations: Reservation[],
  pax: number,
  excludeReservationId?: string | number,
): (string | number)[] | null {
  const free = freeTablesInWindow(slotStart, slotEnd, allTables, reservations, excludeReservationId)

  // 1. Egyetlen elég nagy asztal — a legkisebb ilyen (preferált).
  const single = [...free].filter((t) => t.capacity >= pax).sort((a, b) => a.capacity - b.capacity)[0]
  if (single) return [single.id]

  // 2. Combinable csoport keresése. Csak szabad asztalokat veszünk figyelembe.
  // A szomszédság az ÖSSZES asztal éleiből épül (szimmetrikus), de a bejárás
  // csak szabad asztalokon halad.
  const freeById = new Map(free.map((t) => [String(t.id), t]))
  const adj = buildAdjacency(allTables)
  const group = findCombinableGroup(free, freeById, adj, pax)
  if (group) return group.map((t) => t.id)

  return null
}

/**
 * Összefüggő, combinable_with-ben összekötött szabad asztalcsoportot keres,
 * amely összkapacitása ≥ pax. A legkisebb össz-felesleget adó csoportot adja vissza.
 * A "csak fizikailag szomszédos" feltételt úgy garantáljuk, hogy a csoport a
 * combinable gráf összefüggő komponense legyen (BFS a combinable_with éleken).
 */
function findCombinableGroup(
  free: Table[],
  freeById: Map<string, Table>,
  adj: Map<string, Set<string>>,
  pax: number,
): Table[] | null {
  let best: Table[] | null = null
  let bestWaste = Infinity

  for (const seed of free) {
    // BFS a seed-ből, a combinable éleken, csak szabad asztalok mentén,
    // kapacitás-sorrendben bővítve, amíg el nem érjük a pax-ot.
    const visited = new Set<string>([String(seed.id)])
    const group: Table[] = [seed]
    let cap = seed.capacity

    // Bővíthető szomszédok kapacitás szerint növekvő sorrendben.
    const expand = () => {
      const frontier: Table[] = []
      for (const member of group) {
        for (const nid of adj.get(String(member.id)) ?? []) {
          if (visited.has(nid)) continue
          const n = freeById.get(nid)
          if (n) frontier.push(n)
        }
      }
      return frontier.sort((a, b) => a.capacity - b.capacity)[0]
    }

    while (cap < pax) {
      const next = expand()
      if (!next) break
      visited.add(String(next.id))
      group.push(next)
      cap += next.capacity
    }

    if (cap >= pax) {
      const waste = cap - pax
      if (waste < bestWaste || (waste === bestWaste && (!best || group.length < best.length))) {
        best = [...group]
        bestWaste = waste
      }
    }
  }

  return best
}

/** Adott időablakban az ÖSSZES szabad asztal (kapacitás-szűrés nélkül). Egy foglalás kizárható (áthelyezésnél önmaga). */
function freeTablesInWindow(
  slotStart: number,
  slotEnd: number,
  tables: Table[],
  reservations: Reservation[],
  excludeReservationId?: string | number,
): Table[] {
  return tables.filter((t) => {
    const conflict = reservations.some((r) => {
      if (excludeReservationId != null && String(r.id) === String(excludeReservationId)) return false
      if (!reservedTableIds(r).includes(String(t.id))) return false
      const rs = hhmmToMinutes(r.start_time)
      const re = hhmmToMinutes(r.end_time)
      return slotStart < re && slotEnd > rs
    })
    return !conflict
  })
}

export interface MoveOption {
  id: string | number
  name: string
  room: string | null
  capacity: number
  fitsPax: boolean
}

export interface ComboOption {
  ids: (string | number)[]
  names: string[]
  totalCapacity: number
}

/**
 * Az étterem maximálisan foglalható létszáma.
 * flat módban a max_pax. tables módban a legnagyobb elérhető kapacitás:
 * a legnagyobb egyedi asztal, vagy a legnagyobb összevonható (combinable_with) asztalcsoport
 * összkapacitása — amelyik nagyobb.
 */
export async function getMaxPax(restaurantId: string | number): Promise<number> {
  const payload = await getPayloadClient()
  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })) as Restaurant

  if (restaurant.capacity_mode === 'flat') return restaurant.max_pax ?? 0

  const tablesRes = await payload.find({
    collection: 'tables',
    where: { and: [{ restaurant: { equals: restaurantId } }, { is_active: { not_equals: false } }] },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const tables = tablesRes.docs as Table[]
  if (tables.length === 0) return 0

  const byId = new Map(tables.map((t) => [String(t.id), t]))
  const adj = buildAdjacency(tables)
  let max = 0

  for (const seed of tables) {
    // Egyetlen asztal
    if (seed.capacity > max) max = seed.capacity
    // A seedből elérhető teljes összevonható komponens összkapacitása (BFS, szimmetrikus).
    const visited = new Set<string>([String(seed.id)])
    const queue = [seed]
    let cap = 0
    while (queue.length) {
      const t = queue.shift()!
      cap += t.capacity
      for (const nid of adj.get(String(t.id)) ?? []) {
        if (visited.has(nid)) continue
        const n = byId.get(nid)
        if (n) {
          visited.add(nid)
          queue.push(n)
        }
      }
    }
    if (cap > max) max = cap
  }

  return max
}

/**
 * Egy adott időablakra elérhető asztalok az áthelyezéshez/szerkesztéshez.
 * Visszaadja a szabad asztalokat (a megadott foglalást kizárva az ütközésből),
 * jelölve melyik elég nagy a pax-hoz. A jelenlegi asztal mindig benne van.
 */
export async function getMoveOptions(params: {
  restaurantId: string | number
  date: string
  start_time: string
  pax: number
  excludeReservationId?: string | number
}): Promise<{ end_time: string; tables: MoveOption[]; suggestedCombo: ComboOption | null }> {
  const { restaurantId, date, start_time, pax, excludeReservationId } = params
  const payload = await getPayloadClient()

  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })) as Restaurant

  const turn = restaurant.turn_duration_minutes ?? 120
  const slotStart = hhmmToMinutes(start_time)
  const slotEnd = slotStart + turn
  const end_time = minutesToHHMM(slotEnd)

  if (restaurant.capacity_mode === 'flat') return { end_time, tables: [], suggestedCombo: null }

  const [tablesRes, resRes] = await Promise.all([
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: restaurantId } }, { is_active: { not_equals: false } }] },
      depth: 1,
      limit: 500,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { date: { equals: date } },
          { status: { in: ACTIVE_STATUSES.join(',') } },
        ],
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
  ])
  const allTables = tablesRes.docs as Table[]
  const free = freeTablesInWindow(slotStart, slotEnd, allTables, resRes.docs as Reservation[], excludeReservationId)

  const tables: MoveOption[] = free
    .sort((a, b) => a.capacity - b.capacity)
    .map((t) => ({
      id: t.id,
      name: t.name,
      room: typeof t.room === 'object' && t.room ? t.room.name : null,
      capacity: t.capacity,
      fitsPax: t.capacity >= pax,
    }))

  // Ha egyetlen szabad asztal sem elég nagy, javaslunk egy összevonható csoportot.
  let suggestedCombo: ComboOption | null = null
  if (!tables.some((t) => t.fitsPax)) {
    const freeById = new Map(free.map((t) => [String(t.id), t]))
    const group = findCombinableGroup(free, freeById, buildAdjacency(allTables), pax)
    if (group) {
      suggestedCombo = {
        ids: group.map((t) => t.id),
        names: group.map((t) => t.name),
        totalCapacity: group.reduce((s, t) => s + t.capacity, 0),
      }
    }
  }

  return { end_time, tables, suggestedCombo }
}

/**
 * Foglalás validálása + asztal-hozzárendelés (race-condition guard a létrehozás előtt).
 * Visszaad: { ok, tableId?, end_time, error? }.
 */
export async function validateAndAllocate(params: {
  restaurantId: string | number
  date: string
  start_time: string
  pax: number
}): Promise<
  | { ok: true; tableIds: (number | string)[]; end_time: string }
  | { ok: false; error: string }
> {
  const { restaurantId, date, start_time, pax } = params
  const payload = await getPayloadClient()

  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })) as Restaurant

  if (restaurant.is_active === false) return { ok: false, error: 'Ez az étterem jelenleg nem fogad foglalást' }

  const turn = restaurant.turn_duration_minutes ?? 120
  const slotStart = hhmmToMinutes(start_time)
  const slotEnd = slotStart + turn
  const end_time = minutesToHHMM(slotEnd)

  // Múlt + nyitvatartás-ellenőrzés a slot-listán keresztül (egyetlen forrás az igazságra)
  const slots = await getRestaurantSlots({ restaurantId, date, pax })
  if (!slots.some((s) => s.start === start_time)) {
    return { ok: false, error: 'Ez az időpont már nem foglalható' }
  }

  if (restaurant.capacity_mode === 'flat') {
    return { ok: true, tableIds: [], end_time }
  }

  // tables mód — konkrét asztal(ok) lefoglalása
  const [tablesRes, resRes] = await Promise.all([
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: restaurantId } }, { is_active: { not_equals: false } }] },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { date: { equals: date } },
          { status: { in: ACTIVE_STATUSES.join(',') } },
        ],
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
  ])
  const tables = tablesRes.docs as Table[]
  const tableIds = findAllocation(slotStart, slotEnd, tables, resRes.docs as Reservation[], pax)
  if (tableIds === null) return { ok: false, error: 'Nincs szabad asztal erre az időpontra' }

  return { ok: true, tableIds, end_time }
}

/**
 * Dashboard-oldali foglalás-mentés validálása (szerkesztés vagy új rögzítés a tulajdonos által).
 * A publikus úttal szemben engedi a múltat/lead-time-on belüli időpontot, és kizárja a
 * szerkesztett foglalást az ütközésből. tables módban konkrét asztal kérhető (preferredTableId);
 * ha nincs megadva, auto-allokál. Visszaadja a véglegesített tableId-t és end_time-ot.
 */
export async function validateManualReservation(params: {
  restaurantId: string | number
  date: string
  start_time: string
  pax: number
  preferredTableIds?: (string | number)[] | null
  excludeReservationId?: string | number
  /** Egyedi ülésidő (perc). Ha nincs megadva, az étterem alap turnusa (turn_duration_minutes ?? 120). */
  durationMinutes?: number | null
}): Promise<
  | { ok: true; tableIds: (number | string)[]; end_time: string }
  | { ok: false; error: string }
> {
  const { restaurantId, date, start_time, pax, preferredTableIds, excludeReservationId, durationMinutes } = params
  const payload = await getPayloadClient()

  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })) as Restaurant

  const turn = durationMinutes && durationMinutes > 0 ? durationMinutes : restaurant.turn_duration_minutes ?? 120
  const slotStart = hhmmToMinutes(start_time)
  const slotEnd = slotStart + turn
  const end_time = minutesToHHMM(slotEnd)

  if (restaurant.capacity_mode === 'flat') {
    const maxPax = restaurant.max_pax ?? 0
    const resRes = await payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { date: { equals: date } },
          { status: { in: ACTIVE_STATUSES.join(',') } },
        ],
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    })
    const overlappingPax = (resRes.docs as Reservation[])
      .filter((r) => String(r.id) !== String(excludeReservationId))
      .filter((r) => slotStart < hhmmToMinutes(r.end_time) && slotEnd > hhmmToMinutes(r.start_time))
      .reduce((s, r) => s + (r.pax ?? 0), 0)
    if (overlappingPax + pax > maxPax) return { ok: false, error: 'Ez az időablak már megtelt' }
    return { ok: true, tableIds: [], end_time }
  }

  const [tablesRes, resRes] = await Promise.all([
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: restaurantId } }, { is_active: { not_equals: false } }] },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { date: { equals: date } },
          { status: { in: ACTIVE_STATUSES.join(',') } },
        ],
      },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
  ])
  const allTables = tablesRes.docs as Table[]
  const reservations = resRes.docs as Reservation[]

  // Konkrét asztal(ok) kérve — ellenőrizzük, hogy léteznek, együtt elég nagyok és szabadok
  if (preferredTableIds != null && preferredTableIds.length > 0) {
    const wanted = preferredTableIds.map((id) => allTables.find((t) => String(t.id) === String(id)))
    if (wanted.some((t) => !t)) return { ok: false, error: 'A választott asztal nem elérhető' }
    const chosen = wanted as Table[]
    const totalCap = chosen.reduce((s, t) => s + t.capacity, 0)
    if (totalCap < pax) return { ok: false, error: `A választott asztal(ok) csak ${totalCap} főre elég(ek)` }
    const free = freeTablesInWindow(slotStart, slotEnd, chosen, reservations, excludeReservationId)
    if (free.length < chosen.length) return { ok: false, error: 'A választott asztal(ok) erre az időpontra már foglaltak' }
    return { ok: true, tableIds: chosen.map((t) => t.id), end_time }
  }

  // Auto-allokáció — egyetlen asztal preferálva, szükség esetén összevonás
  const tableIds = findAllocation(slotStart, slotEnd, allTables, reservations, pax, excludeReservationId)
  if (tableIds === null) return { ok: false, error: 'Nincs szabad asztal erre az időpontra' }
  return { ok: true, tableIds, end_time }
}
