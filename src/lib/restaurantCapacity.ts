import { getPayloadClient } from '@/lib/payload'
import { getMaxPax } from '@/lib/restaurantBooking'
import type { Restaurant } from '@/payload/payload-types'

/**
 * Beállítások › Asztalok & termek (design 16.22) és › Foglalási szabályok (16.21) — étterem. A termek (asztal-szám,
 * férőhely, szezon, online foglalható-e), az online kiadható férőhely %, a legkisebb / legnagyobb online létszám és az
 * alap asztal-idő. A terem-rajz és az asztalok szerkesztése az Asztalok oldalon marad.
 */
export type CapacityRoom = { id: string; name: string; tables: number; seats: number; outdoor: boolean; seasonal: boolean; start: string | null; end: string | null; online: boolean }
export type CapacityVM = {
  rooms: CapacityRoom[]
  /** terem nélküli aktív asztalok */
  loose: { tables: number; seats: number }
  pct: number
  minPax: number
  maxPax: number | null
  /** amekkora társaságot az asztalok kiszolgálnak (a legnagyobb online létszám alapja, ha nincs megadva) */
  tablesMaxPax: number
  turnMinutes: number
}

export async function getCapacityVM(restaurant: Restaurant): Promise<CapacityVM> {
  const payload = await getPayloadClient()
  const [rooms, tables, tablesMaxPax] = await Promise.all([
    payload.find({ collection: 'rooms', where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { not_equals: false } }] }, sort: 'sort_order', limit: 100, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'tables', where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { not_equals: false } }] }, limit: 500, depth: 0, overrideAccess: true }),
    getMaxPax(restaurant.id),
  ])
  type T = { capacity?: number | null; room?: unknown }
  const roomOf = (t: T) => (t.room == null ? null : String(typeof t.room === 'object' ? (t.room as { id: unknown }).id : t.room))
  const ts = tables.docs as T[]
  const ids = new Set((rooms.docs as { id: unknown }[]).map((r) => String(r.id)))
  const loose = ts.filter((t) => { const r = roomOf(t); return r == null || !ids.has(r) })
  return {
    rooms: (rooms.docs as { id: unknown; name: string; is_outdoor?: boolean | null; seasonal?: boolean | null; season_start?: string | null; season_end?: string | null; online_bookable?: boolean | null }[]).map((r) => {
      const mine = ts.filter((t) => roomOf(t) === String(r.id))
      return { id: String(r.id), name: r.name, tables: mine.length, seats: mine.reduce((n, t) => n + (t.capacity ?? 0), 0), outdoor: !!r.is_outdoor, seasonal: !!r.seasonal, start: r.season_start ?? null, end: r.season_end ?? null, online: r.online_bookable !== false }
    }),
    loose: { tables: loose.length, seats: loose.reduce((n, t) => n + (t.capacity ?? 0), 0) },
    pct: restaurant.online_capacity_pct ?? 100,
    minPax: restaurant.min_online_pax ?? 1,
    maxPax: restaurant.max_online_pax ?? null,
    tablesMaxPax,
    turnMinutes: restaurant.turn_duration_minutes ?? 120,
  }
}
