import { getPayloadClient } from '@/lib/payload'
import { DAYS_OF_WEEK, type DayOfWeek } from '@/lib/restaurantTemplates'
import type { Availability } from '@/payload/payload-types'

/**
 * Beállítások › Nyitvatartás (design 16.8) — szalonnál és étteremnél ugyanaz a nézet-modell:
 *  - a heti rend (naponta egy nyitás–zárás; szalon: `availability` staff és dátum nélkül, étterem: `opening-hours`),
 *  - a kivételek (szalon: egy-egy nap az `availability`-ben, étterem: dátum-tartomány megnevezéssel),
 *  - az e heti foglaltság: a nyitvatartás hány %-a foglalt, naponta (szalon: a foglalások ideje / (nyitva × aktív
 *    munkatárs), étterem: vendég × asztal-idő / (nyitva × összes férőhely)).
 */

export type HoursDay = { dow: DayOfWeek; id: string | null; open: boolean; from: string; to: string }
export type HoursException = { id: string; label: string | null; from: string; to: string; closed: boolean; openTime: string | null; closeTime: string | null }
export type OpeningHoursVM = {
  kind: 'salon' | 'restaurant'
  businessId: string
  days: HoursDay[]
  exceptions: HoursException[]
  occupancy: { pct: number; perDay: { d: string; v: number; closed: boolean }[] }
  bufferMinutes: number | null
  /** az utolsó kezdés ennyivel a zárás előtt (perc) — szalon: `last_booking_buffer_minutes`, étterem: `last_seating_buffer_minutes` */
  lastBuffer: number
}

const SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
const span = (from: string, to: string) => { const a = mins(from); let b = mins(to); if (b <= a) b = 24 * 60; return Math.max(0, b - a) }
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function getOpeningHoursVM(kind: 'salon' | 'restaurant', business: { id: string | number; booking_buffer_minutes?: number | null; turn_duration_minutes?: number | null; last_booking_buffer_minutes?: number | null; last_seating_buffer_minutes?: number | null }): Promise<OpeningHoursVM> {
  const payload = await getPayloadClient()
  const id = business.id
  let days: HoursDay[]
  let exceptions: HoursException[]
  if (kind === 'salon') {
    const [weekly, exc] = await Promise.all([
      payload.find({ collection: 'availability', where: { and: [{ salon: { equals: id } }, { staff: { exists: false } }, { exception_date: { exists: false } }] }, limit: 100, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'availability', where: { and: [{ salon: { equals: id } }, { staff: { exists: false } }, { exception_date: { exists: true } }] }, sort: 'exception_date', limit: 200, depth: 0, overrideAccess: true }),
    ])
    const by = new Map((weekly.docs as Availability[]).map((h) => [h.day_of_week, h]))
    days = DAYS_OF_WEEK.map((d) => { const h = by.get(d); return { dow: d, id: h ? String(h.id) : null, open: h?.is_available ?? false, from: h?.start_time ?? '09:00', to: h?.end_time ?? '18:00' } })
    exceptions = (exc.docs as Availability[]).filter((e) => e.exception_date).map((e) => {
      const day = String(e.exception_date).slice(0, 10)
      return { id: String(e.id), label: null, from: day, to: day, closed: !(e.is_available ?? false), openTime: e.start_time ?? null, closeTime: e.end_time ?? null }
    })
  } else {
    const [weekly, exc] = await Promise.all([
      payload.find({ collection: 'opening-hours', where: { restaurant: { equals: id } }, limit: 100, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'opening-hours-exceptions', where: { restaurant: { equals: id } }, sort: 'start_date', limit: 200, depth: 0, overrideAccess: true }),
    ])
    type OH = { id: string | number; day_of_week: DayOfWeek; is_open?: boolean | null; open_time?: string | null; close_time?: string | null }
    type EX = { id: string | number; label?: string | null; start_date: string; end_date: string; is_closed?: boolean | null; open_time?: string | null; close_time?: string | null }
    const by = new Map((weekly.docs as unknown as OH[]).map((h) => [h.day_of_week, h]))
    days = DAYS_OF_WEEK.map((d) => { const h = by.get(d); return { dow: d, id: h ? String(h.id) : null, open: h?.is_open ?? false, from: h?.open_time ?? '11:00', to: h?.close_time ?? '22:00' } })
    exceptions = (exc.docs as unknown as EX[]).map((e) => ({ id: String(e.id), label: e.label ?? null, from: String(e.start_date).slice(0, 10), to: String(e.end_date).slice(0, 10), closed: e.is_closed ?? true, openTime: e.open_time ?? null, closeTime: e.close_time ?? null }))
  }

  // ── e heti foglaltság (hétfőtől vasárnapig) ──
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const dates = Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)))
  const used = Array(7).fill(0) as number[]
  let capacity = 1
  if (kind === 'salon') {
    const [bk, staff] = await Promise.all([
      payload.find({ collection: 'bookings', where: { and: [{ salon: { equals: id } }, { date: { greater_than_equal: dates[0] } }, { date: { less_than_equal: dates[6] } }, { status: { not_in: ['cancelled', 'no_show'] } }] }, limit: 5000, depth: 0, overrideAccess: true, select: { date: true, start_time: true, end_time: true } as never }),
      payload.find({ collection: 'staff', where: { and: [{ salon: { equals: id } }, { is_active: { not_equals: false } }] }, limit: 0, depth: 0, overrideAccess: true }),
    ])
    capacity = Math.max(1, staff.totalDocs)
    for (const b of bk.docs as { date?: string; start_time?: string; end_time?: string }[]) {
      const i = dates.indexOf(String(b.date ?? '').slice(0, 10))
      if (i >= 0 && b.start_time && b.end_time) used[i] += span(b.start_time, b.end_time)
    }
  } else {
    const [rs, tables] = await Promise.all([
      payload.find({ collection: 'reservations', where: { and: [{ restaurant: { equals: id } }, { date: { greater_than_equal: dates[0] } }, { date: { less_than_equal: dates[6] } }, { status: { not_in: ['cancelled', 'no_show'] } }] }, limit: 5000, depth: 0, overrideAccess: true, select: { date: true, pax: true, start_time: true, end_time: true } as never }),
      payload.find({ collection: 'tables', where: { restaurant: { equals: id } }, limit: 500, depth: 0, overrideAccess: true, select: { capacity: true } as never }),
    ])
    capacity = Math.max(1, (tables.docs as { capacity?: number | null }[]).reduce((n, t) => n + (t.capacity ?? 0), 0))
    const turn = business.turn_duration_minutes ?? 90
    for (const r of rs.docs as { date?: string; pax?: number | null; start_time?: string; end_time?: string }[]) {
      const i = dates.indexOf(String(r.date ?? '').slice(0, 10))
      if (i >= 0) used[i] += (r.pax ?? 1) * (r.start_time && r.end_time ? span(r.start_time, r.end_time) : turn)
    }
  }
  const perDay = days.map((d, i) => {
    const open = d.open ? span(d.from, d.to) * capacity : 0
    return { d: SHORT[i], v: open ? Math.min(100, Math.round((used[i] / open) * 100)) : 0, closed: !d.open }
  })
  const openTotal = days.reduce((n, d) => n + (d.open ? span(d.from, d.to) * capacity : 0), 0)
  const pct = openTotal ? Math.min(100, Math.round((used.reduce((a, b) => a + b, 0) / openTotal) * 100)) : 0

  return {
    kind, businessId: String(id), days, exceptions, occupancy: { pct, perDay }, bufferMinutes: business.booking_buffer_minutes ?? null,
    lastBuffer: (kind === 'salon' ? business.last_booking_buffer_minutes : business.last_seating_buffer_minutes) ?? 0,
  }
}
