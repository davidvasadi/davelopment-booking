import { parseISO } from 'date-fns'
import { hhmmToMinutes, minutesToHHMM, getDayName } from './utils'
import { getPayloadClient } from './payload'
import type { Restaurant, OpeningHour, Table, Reservation } from '@/payload/payload-types'

export interface RestaurantTimeSlot {
  start: string
  end: string
  /** Igaz, ha erre a slotra már csak kültéri (terasz) asztal foglalható — a beltéri megtelt. */
  onlyOutdoor?: boolean
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'seated', 'completed'] as const

type SeasonRoom = {
  id: string | number
  seasonal?: boolean | null
  season_start?: string | null
  season_end?: string | null
}

/** Igaz, ha a terem az adott napon (YYYY-MM-DD) foglalható a szezon szempontjából.
 *  Nem szezonális terem mindig elérhető. Szezonálisnál a [season_start, season_end]
 *  inkluzív tartományba kell esnie a dátumnak; támogatja az év-átfordulós tartományt is
 *  (pl. start=2024-11-01, end=2024-03-31 → tél). Hiányzó határ → nyitott azon az oldalon. */
export function isRoomAvailableOnDate(room: SeasonRoom, date: string): boolean {
  if (!room.seasonal) return true
  const start = room.season_start || null
  const end = room.season_end || null
  if (!start && !end) return true
  // Csak a hónap-napot hasonlítjuk (a tartomány év-független, évente ismétlődik).
  const md = (d: string) => d.slice(5) // "MM-DD"
  const day = md(date)
  const s = start ? md(start) : null
  const e = end ? md(end) : null
  if (s && e) {
    return s <= e ? day >= s && day <= e : day >= s || day <= e // év-átfordulós eset
  }
  if (s) return day >= s
  if (e) return day <= e
  return true
}

/** Azoknak a termeknek az ID-jei, amelyek az adott napon szezon miatt NEM foglalhatók. */
function unavailableRoomIds(rooms: SeasonRoom[], date: string): Set<string> {
  return new Set(rooms.filter((r) => !isRoomAvailableOnDate(r, date)).map((r) => String(r.id)))
}

/** Egy adott nap nyitvatartási ablaka (perc), a heti rend + kivétel figyelembevételével.
 *  null = zárva (vagy nincs beállítva nyitvatartás). A kivétel (opening-hours-exceptions)
 *  felülírja a heti rendet: is_closed → zárva, módosított idő → új ablak. */
export async function getOpeningWindow(
  restaurantId: string | number,
  date: string,
): Promise<{ openMin: number; closeMin: number } | null> {
  const payload = await getPayloadClient()
  const dayName = getDayName(parseISO(date))
  const ohRes = await payload.find({
    collection: 'opening-hours',
    where: { and: [{ restaurant: { equals: restaurantId } }, { day_of_week: { equals: dayName } }] },
    limit: 1,
    overrideAccess: true,
  })
  const oh = ohRes.docs[0] as OpeningHour | undefined
  if (!oh || !oh.is_open || !oh.open_time || !oh.close_time) return null
  let openMin = hhmmToMinutes(oh.open_time)
  let closeMin = hhmmToMinutes(oh.close_time)

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
    if (exc.is_closed) return null
    if (exc.open_time && exc.close_time) {
      openMin = hhmmToMinutes(exc.open_time)
      closeMin = hhmmToMinutes(exc.close_time)
    }
  }
  return { openMin, closeMin }
}

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

  // 1. Nyitvatartás az adott napra (heti rend + kivétel). Zárva → nincs slot.
  const window = await getOpeningWindow(restaurantId, date)
  if (!window) return []
  const { openMin, closeMin } = window

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

  // Kell legyen szabad, megfelelő kapacitású asztal
  const tablesRes = await payload.find({
    collection: 'tables',
    where: {
      and: [{ restaurant: { equals: restaurantId } }, { is_active: { not_equals: false } }],
    },
    depth: 0,
    limit: 500,
    overrideAccess: true,
  })
  const allActiveTables = tablesRes.docs as Table[]

  // Kültéri termek azonosítása, hogy slot-onként jelezhessük: csak kültéri maradt-e.
  const roomsRes = await payload.find({
    collection: 'rooms',
    where: { restaurant: { equals: restaurantId } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })

  // Szezonális szűrés: az adott napon szezonon kívüli termek asztalai kiesnek
  // a foglalható kapacitásból (a landing így kevesebb asztallal számol).
  const offSeason = unavailableRoomIds(roomsRes.docs as SeasonRoom[], date)
  const tables = allActiveTables.filter((t) => {
    const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
    return rid == null || !offSeason.has(String(rid))
  })
  const outdoorRoomIds = new Set(
    roomsRes.docs.filter((r) => (r as { is_outdoor?: boolean }).is_outdoor).map((r) => String(r.id)),
  )
  const isIndoorTable = (t: Table) => {
    const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
    return rid == null || !outdoorRoomIds.has(String(rid))
  }
  const indoorTables = tables.filter(isIndoorTable)
  const hasOutdoor = outdoorRoomIds.size > 0 && tables.length > indoorTables.length

  return candidates
    .filter((c) => c >= earliestMin)
    .filter((slotStart) => findAllocation(slotStart, slotStart + turn, tables, reservations, pax) !== null)
    .map((s) => {
      // A turnus nem lóghat túl a záráson — a vége a zárásig vágódik.
      const slotEnd = Math.min(s + turn, closeMin)
      // Csak kültéri marad, ha a beltériek közt nincs allokáció, de összességében van.
      const onlyOutdoor =
        hasOutdoor && findAllocation(s, slotEnd, indoorTables, reservations, pax) === null
      return { start: minutesToHHMM(s), end: minutesToHHMM(slotEnd), onlyOutdoor }
    })
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

/**
 * A megadott seed asztal(ok)ból kiindulva bővít a szabad, összetolható (combinable_with)
 * szomszédokkal — kapacitás szerint növekvő sorrendben —, amíg az összkapacitás eléri a
 * pax-ot. A seed maga is benne van a csoportban. null, ha így sem érhető el a pax.
 * A drag & drop auto-összevonáshoz: a host egy (esetleg kicsi) asztalra ejti a foglalást,
 * a rendszer köré vonja a szabad szomszédokat.
 */
function expandFromSeed(
  seed: Table[],
  freeById: Map<string, Table>,
  adj: Map<string, Set<string>>,
  pax: number,
): Table[] | null {
  const visited = new Set<string>(seed.map((t) => String(t.id)))
  const group: Table[] = [...seed]
  let cap = seed.reduce((s, t) => s + t.capacity, 0)

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
  return cap >= pax ? group : null
}

/**
 * Az adott időablakban ténylegesen leültethető LEGNAGYOBB létszám a SZABAD asztalokból:
 * a legnagyobb szabad egyedi asztal, vagy a legnagyobb szabad, összetolható komponens
 * összkapacitása. Ez a foglalás-felvevő számlálójának felső korlátja (mennyit lehet még
 * felvenni erre az időpontra). 0, ha nincs szabad asztal.
 */
function maxAllocatableInWindow(free: Table[], allTables: Table[]): number {
  if (free.length === 0) return 0
  const freeById = new Map(free.map((t) => [String(t.id), t]))
  const adj = buildAdjacency(allTables)
  let max = 0
  for (const seed of free) {
    if (seed.capacity > max) max = seed.capacity
    // A seedből elérhető teljes SZABAD, összefüggő combinable-komponens összkapacitása.
    const visited = new Set<string>([String(seed.id)])
    const queue = [seed]
    let cap = 0
    while (queue.length) {
      const t = queue.shift()!
      cap += t.capacity
      for (const nid of adj.get(String(t.id)) ?? []) {
        if (visited.has(nid)) continue
        const n = freeById.get(nid)
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
 * Az étterem maximálisan foglalható létszáma: a legnagyobb elérhető kapacitás —
 * a legnagyobb egyedi asztal, vagy a legnagyobb összevonható (combinable_with)
 * asztalcsoport összkapacitása, amelyik nagyobb.
 */
export async function getMaxPax(restaurantId: string | number): Promise<number> {
  const payload = await getPayloadClient()

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
}): Promise<{ end_time: string; tables: MoveOption[]; suggestedCombo: ComboOption | null; maxPax: number }> {
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

  // A számláló felső korlátja: mennyi fér még el (egyedi vagy összevont) erre az időpontra.
  const maxPax = maxAllocatableInWindow(free, allTables)

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

  return { end_time, tables, suggestedCombo, maxPax }
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

  const slotStart = hhmmToMinutes(start_time)

  // Múlt + nyitvatartás-ellenőrzés a slot-listán keresztül (egyetlen forrás az igazságra).
  // A slot már a záráshoz vágott end-et adja — onnan vesszük az end_time-ot, hogy a
  // turnus ne lóghasson túl a záráson (pl. 21:00 + 2ó, 22:00 zárás → 22:00).
  const slots = await getRestaurantSlots({ restaurantId, date, pax })
  const slot = slots.find((s) => s.start === start_time)
  if (!slot) {
    return { ok: false, error: 'Ez az időpont már nem foglalható' }
  }
  const end_time = slot.end
  const slotEnd = hhmmToMinutes(end_time)

  // Konkrét asztal(ok) lefoglalása
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
  /** Drag & drop: ha a ledobott asztal önmagában kicsi, a rendszer megpróbálja a szabad,
   *  összetolható szomszédokkal kiegészíteni a pax-ig ahelyett, hogy elutasítaná. */
  autoCombine?: boolean
}): Promise<
  | { ok: true; tableIds: (number | string)[]; end_time: string }
  | { ok: false; error: string }
> {
  const { restaurantId, date, start_time, pax, preferredTableIds, excludeReservationId, durationMinutes, autoCombine } = params
  const payload = await getPayloadClient()

  const restaurant = (await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })) as Restaurant

  const turn = durationMinutes && durationMinutes > 0 ? durationMinutes : restaurant.turn_duration_minutes ?? 120
  const slotStart = hhmmToMinutes(start_time)

  // Kemény nyitvatartás-korlát: a host sem foglalhat a nyitvatartáson kívülre.
  // A kezdésnek a nyitás és a zárás közé kell esnie. Zárva → elutasít.
  const window = await getOpeningWindow(restaurantId, date)
  if (!window) return { ok: false, error: 'Ezen a napon az étterem zárva tart' }
  if (slotStart < window.openMin || slotStart > window.closeMin) {
    return {
      ok: false,
      error: `A megadott időpont a nyitvatartáson kívül esik (${minutesToHHMM(window.openMin)}–${minutesToHHMM(window.closeMin)})`,
    }
  }

  // A turnus nem lóghat túl a záráson: a vége a zárásig vágódik. Pl. 21:00 + 2ó,
  // de 22:00-kor zár → a foglalás vége 22:00 (nem 23:00), mert akkor már zárva.
  const slotEnd = Math.min(slotStart + turn, window.closeMin)
  const end_time = minutesToHHMM(slotEnd)

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

    // Auto-összevonás (drag & drop): a ledobott asztal önmagában kicsi, de a szabad,
    // összetolható szomszédokkal kiegészítve elérheti a pax-ot. A seed(ek)nek szabadnak kell lennie.
    if (totalCap < pax && autoCombine) {
      const free = freeTablesInWindow(slotStart, slotEnd, allTables, reservations, excludeReservationId)
      const freeById = new Map(free.map((t) => [String(t.id), t]))
      const seedFree = chosen.every((t) => freeById.has(String(t.id)))
      if (seedFree) {
        const combo = expandFromSeed(chosen, freeById, buildAdjacency(allTables), pax)
        if (combo) return { ok: true, tableIds: combo.map((t) => t.id), end_time }
      }
      return { ok: false, error: `Erre az asztalra max ${totalCap} fő fér — a szabad szomszédokkal sem jön ki ${pax} fő` }
    }

    if (totalCap < pax) return { ok: false, error: `A választott asztal(ok) csak ${totalCap} főre elég(ek)` }
    const free = freeTablesInWindow(slotStart, slotEnd, chosen, reservations, excludeReservationId)
    if (free.length < chosen.length) return { ok: false, error: 'A választott asztal(ok) erre az időpontra már foglaltak' }
    return { ok: true, tableIds: chosen.map((t) => t.id), end_time }
  }

  // Auto-allokáció — a szezonon kívüli termek asztalai kiesnek (a host konkrét asztalt
  // a fenti ágon még szándékosan választhat, de a rendszer nem allokál szezonon kívülre).
  const roomsRes = await payload.find({
    collection: 'rooms',
    where: { restaurant: { equals: restaurantId } },
    depth: 0,
    limit: 100,
    overrideAccess: true,
  })
  const offSeason = unavailableRoomIds(roomsRes.docs as SeasonRoom[], date)
  const inSeasonTables = allTables.filter((t) => {
    const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
    return rid == null || !offSeason.has(String(rid))
  })
  const tableIds = findAllocation(slotStart, slotEnd, inSeasonTables, reservations, pax, excludeReservationId)
  if (tableIds === null) return { ok: false, error: 'Nincs szabad asztal erre az időpontra' }
  return { ok: true, tableIds, end_time }
}
