import { getPayloadClient } from '@/lib/payload'
import { bookingsFor, reservationsFor, shiftsSince } from '@/lib/fastRead'
import type { Availability, OpeningHour, StaffMember, Table } from '@/payload/payload-types'

/**
 * Napi kihasználtság egy hónapra (a lenyíló naptár foglaltság-színezéséhez, design 6.20) — ugyanaz a számítás, mint a
 * Statisztika „Kihasználtság / Telítettség” kártyáján (lib/statsView), csak naponként:
 *  - szalon: a foglalások összideje / a foglalható idő. Foglalható idő: a beosztott műszakok ideje; ha a hónapban nincs
 *    beosztás, a szalon nyitvatartása × a foglalható munkatársak száma.
 *  - étterem: foglalt ülőhely-perc (időtartam × fő) / (nyitvatartás × az aktív asztalok összes helye).
 * A lemondott és a meg nem jelent foglalás nem számít. Ahol nincs foglalható idő, ott nincs százalék (null).
 */
const DOW_KEY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] // Date.getDay() sorrend
const mins = (t?: string | null) => { if (!t) return null; const [h, m] = String(t).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null }
const span = (a?: string | null, b?: string | null) => { const s = mins(a), e = mins(b); return s != null && e != null && e > s ? e - s : 0 }
const dowOf = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d).getDay() }

export async function dayUtilization(kind: 'salon' | 'restaurant', businessId: string | number, from: string, to: string): Promise<Record<string, number>> {
  const payload = await getPayloadClient()
  const scope = { [kind]: { equals: businessId } }
  const booked = new Map<string, number>()
  const capacity = new Map<string, number>()
  const openByDow: number[] = Array(7).fill(0)
  const dates: string[] = []
  for (let d = new Date(`${from}T00:00:00`); d <= new Date(`${to}T00:00:00`); d.setDate(d.getDate() + 1)) dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  const live = (s: unknown) => s !== 'cancelled' && s !== 'no_show'

  if (kind === 'salon') {
    // közvetlen SQL a sok soros listákra (lib/fastRead, docs/sebesseg)
    const [rows, shifts, staffRes, avRes] = await Promise.all([
      bookingsFor(businessId, { from, to }),
      shiftsSince({ salon: businessId }, from, { to, type: 'shift' }),
      payload.find({ collection: 'staff', where: scope, depth: 0, limit: 200, overrideAccess: true, select: { is_active: true, import_review: true } }),
      payload.find({ collection: 'availability', where: { and: [scope, { recurring: { equals: true } }] }, depth: 0, limit: 300, overrideAccess: true }),
    ])
    for (const b of rows as { date: string; start_time: string | null; end_time: string | null; status: string }[]) {
      if (live(b.status)) booked.set(b.date.slice(0, 10), (booked.get(b.date.slice(0, 10)) ?? 0) + span(b.start_time, b.end_time))
    }
    if (shifts.length) {
      for (const sh of shifts as { date: string | null; start_time: string | null; end_time: string | null }[]) {
        const d = (sh.date ?? '').slice(0, 10)
        capacity.set(d, (capacity.get(d) ?? 0) + span(sh.start_time, sh.end_time))
      }
    } else {
      const bookable = (staffRes.docs as StaffMember[]).filter((s) => s.is_active !== false && !s.import_review).length
      for (const a of (avRes.docs as Availability[]).filter((x) => !x.staff && !x.exception_date && x.is_available !== false)) {
        const i = DOW_KEY.indexOf(a.day_of_week)
        if (i >= 0) openByDow[i] = span(a.start_time, a.end_time)
      }
      for (const d of dates) capacity.set(d, openByDow[dowOf(d)] * Math.max(1, bookable))
    }
  } else {
    const [rows, tRes, ohRes] = await Promise.all([
      reservationsFor(businessId, { from, to }),
      payload.find({ collection: 'tables', where: { and: [scope, { is_active: { equals: true } }] }, depth: 0, limit: 500, overrideAccess: true, select: { capacity: true } }),
      payload.find({ collection: 'opening-hours', where: scope, depth: 0, limit: 14, overrideAccess: true }),
    ])
    for (const r of rows as { date: string; start_time: string | null; end_time: string | null; status: string; pax: number | null }[]) {
      if (live(r.status)) booked.set(r.date.slice(0, 10), (booked.get(r.date.slice(0, 10)) ?? 0) + span(r.start_time, r.end_time) * (r.pax ?? 0))
    }
    const seats = (tRes.docs as Table[]).reduce((n, t) => n + (t.capacity ?? 0), 0)
    for (const o of (ohRes.docs as OpeningHour[]).filter((x) => x.is_open !== false)) {
      const i = DOW_KEY.indexOf(o.day_of_week)
      if (i >= 0) openByDow[i] += span(o.open_time, o.close_time) // ebéd + vacsora külön sorban → összeadva
    }
    for (const d of dates) capacity.set(d, openByDow[dowOf(d)] * seats)
  }

  const out: Record<string, number> = {}
  for (const d of dates) {
    const cap = capacity.get(d) ?? 0
    if (cap > 0) out[d] = Math.min(100, Math.round(((booked.get(d) ?? 0) / cap) * 100))
  }
  return out
}
