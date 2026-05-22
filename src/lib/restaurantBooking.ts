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
  if (!oh || !oh.is_open) return []

  const openMin = hhmmToMinutes(oh.open_time)
  const closeMin = hhmmToMinutes(oh.close_time)

  // 2. Jelölt kezdési időpontok (lépésenként), úgy hogy a teljes turnus záróráig férjen
  const candidates: number[] = []
  let cursor = openMin
  while (cursor + turn <= closeMin) {
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
  const tables = (tablesRes.docs as Table[]).filter((t) => t.capacity >= pax)

  return candidates
    .filter((c) => c >= earliestMin)
    .filter((slotStart) => allocatableTable(slotStart, slotStart + turn, tables, reservations) !== null)
    .map((s) => ({ start: minutesToHHMM(s), end: minutesToHHMM(s + turn) }))
}

/** A legkisebb, az adott időablakban szabad, pax-ra elég asztal id-ja, vagy null. */
function allocatableTable(
  slotStart: number,
  slotEnd: number,
  candidateTables: Table[],
  reservations: Reservation[],
): number | string | null {
  const byCapacity = [...candidateTables].sort((a, b) => a.capacity - b.capacity)
  for (const t of byCapacity) {
    const conflict = reservations.some((r) => {
      const rTableId = typeof r.table === 'object' && r.table ? r.table.id : r.table
      if (String(rTableId) !== String(t.id)) return false
      const rs = hhmmToMinutes(r.start_time)
      const re = hhmmToMinutes(r.end_time)
      return slotStart < re && slotEnd > rs
    })
    if (!conflict) return t.id
  }
  return null
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
  | { ok: true; tableId: number | string | null; end_time: string }
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
    return { ok: true, tableId: null, end_time }
  }

  // tables mód — konkrét asztal lefoglalása
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
  const tables = (tablesRes.docs as Table[]).filter((t) => t.capacity >= pax)
  const tableId = allocatableTable(slotStart, slotEnd, tables, resRes.docs as Reservation[])
  if (tableId === null) return { ok: false, error: 'Nincs szabad asztal erre az időpontra' }

  return { ok: true, tableId, end_time }
}
