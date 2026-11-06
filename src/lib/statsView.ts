import { getPayloadClient } from '@/lib/payload'
import { bookingsFor, reservationsFor, shiftsSince } from '@/lib/fastRead'
import { fixMediaUrl } from '@/lib/utils'
import { guestKeyOf, flagEmoji, countryName } from '@/lib/guests'
import { isoFromPhone } from '@/lib/phoneCountry'
import { MONTHS, MONTHS_SHORT } from '@/lib/schedule'
import type { DayBar, Share, StatsVM, Strip } from '@/lib/statsTypes'
import type { Booking, Reservation, Service, StaffMember, Shift, Media, Review, Salon, Restaurant, Table, Room, OpeningHour, Availability, GiftVoucher } from '@/payload/payload-types'

/**
 * A Statisztikák (design 5.1–5.4) adatai VALÓS foglalásokból, egy lekérdezés-körrel: a kiválasztott időszak és az előző,
 * ugyanolyan hosszú időszak (az összevetés mindig ez). Szalon = bookings (+ beosztás a kihasználtsághoz, utalvány-eladás a
 * bevételhez); étterem = reservations (+ asztalok, nyitvatartás a telítettséghez). Ahol nincs adat, null / 0 (valós üres).
 */

const DAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const DAY_LONG = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
const DOW_KEY = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (s: string, n: number) => { const d = toDate(s); d.setDate(d.getDate() + n); return ymd(d) }
const diffDays = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)
/** hétfő = 0 */
const dowOf = (s: string) => (toDate(s).getDay() + 6) % 7
const mins = (t?: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null }
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
const pctDelta = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : null)
const relId = (v: unknown) => (v == null ? null : typeof v === 'object' ? String((v as { id: unknown }).id) : String(v))
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} e` : String(Math.round(n)))
/** a foglalás leadásának órája budapesti idő szerint */
const huHour = (iso: string) => Number(new Intl.DateTimeFormat('hu-HU', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Budapest' }).format(new Date(iso)))
const dayLabel = (s: string) => { const d = toDate(s); return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.` }
const rangeText = (a: string, b: string) => { const x = toDate(a), y = toDate(b); return `${MONTHS[x.getMonth()]} ${x.getDate()}. – ${MONTHS[y.getMonth()]} ${y.getDate()}.` }

/** Az időszak: előre beállított (7 / 30 / 90 / 365 nap, a mai napig) vagy egyedi -tól / -ig. */
export function resolvePeriod(period?: string, from?: string, to?: string) {
  const today = ymd(new Date())
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
  let f: string, t: string
  if (ok(from) && ok(to) && from! <= to!) { f = from!; t = to! > today ? today : to! }
  else { const days = [7, 30, 90, 365].includes(Number(period)) ? Number(period) : 30; t = today; f = addDays(today, -(days - 1)) }
  const days = diffDays(f, t) + 1
  return { from: f, to: t, prevTo: addDays(f, -1), prevFrom: addDays(f, -days), days, preset: ok(from) && ok(to) ? null : days }
}

type Row = { date: string; start: number | null; end: number | null; status: string; source: string; createdAt: string; key: string | null; name: string; phone: string | null; city: string | null; country: string | null; what: string; price: number; staff: string | null; pax: number; tables: string[] }

/** A grafikon-pontok: rövid időszaknál napok, közepesnél hetek, hosszúnál hónapok. */
function buckets(from: string, days: number) {
  if (days <= 31) return Array.from({ length: days }, (_, i) => { const d = addDays(from, i); return { from: d, to: d, label: dayLabel(d) } })
  if (days <= 120) { const n = Math.ceil(days / 7); return Array.from({ length: n }, (_, i) => ({ from: addDays(from, i * 7), to: addDays(from, Math.min(days - 1, i * 7 + 6)), label: dayLabel(addDays(from, i * 7)) })) }
  const out: { from: string; to: string; label: string }[] = []
  let cur = from
  const end = addDays(from, days - 1)
  while (cur <= end) {
    const d = toDate(cur)
    const last = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))
    out.push({ from: cur, to: last < end ? last : end, label: MONTHS_SHORT[d.getMonth()] })
    cur = addDays(last, 1)
  }
  return out
}

/** Napszak-sávok, a foglalt és a nyitott percek a sávba eső része alapján. */
const PARTS: [string, number, number][] = [['Délelőtt (–12)', 0, 12 * 60], ['Délután (12–16)', 12 * 60, 16 * 60], ['Késő délután (16–)', 16 * 60, 24 * 60]]
const overlap = (a: number, b: number, c: number, d: number) => Math.max(0, Math.min(b, d) - Math.max(a, c))

export async function getStatsVM(kind: 'salon' | 'restaurant', businessId: string | number, period: ReturnType<typeof resolvePeriod>, opts: { staffId?: string | number } = {}): Promise<StatsVM> {
  const payload = await getPayloadClient()
  const { from, to, prevFrom, prevTo, days } = period
  const today = ymd(new Date())
  const rest = kind === 'restaurant'

  // ── nyers adatok ──
  let rows: Row[] = []
  let biz: Salon | Restaurant | null = null
  let staff: StaffMember[] = []
  let shifts: Shift[] = []
  let openByDow: ([number, number] | null)[] = Array(7).fill(null)
  let tables: Table[] = []
  let rooms: Room[] = []
  let vouchers = 0
  let history = new Map<string, string>() // vendég → első látogatás (az időszak előtt)
  let noShowsEver: Row[] = []

  const scope = { [kind]: { equals: businessId } }
  if (!rest) {
    const [bRes, svcRes, stRes, shRes, avRes, bizRes, vRes, histRes, nsRes] = await Promise.all([
      // Sebesség: a sok soros foglalás- és beosztás-listák KÖZVETLEN SQL-lel (lib/fastRead, docs/sebesseg)
      bookingsFor(businessId, { from: prevFrom, to, staffId: opts.staffId }).then((docs) => ({ docs })),
      payload.find({ collection: 'services', where: scope, depth: 0, limit: 500, overrideAccess: true, select: { name: true, price: true } }),
      payload.find({ collection: 'staff', where: scope, depth: 1, populate: { salons: { name: true } }, limit: 200, overrideAccess: true }),
      shiftsSince({ salon: businessId }, prevFrom, { to, type: 'shift' }).then((docs) => ({ docs })),
      payload.find({ collection: 'availability', where: { and: [scope, { recurring: { equals: true } }] }, depth: 0, limit: 300, overrideAccess: true }),
      payload.findByID({ collection: 'salons', id: businessId, depth: 0, overrideAccess: true }).catch(() => null),
      opts.staffId != null ? Promise.resolve(null) : payload.find({ collection: 'gift-vouchers', where: { and: [scope, { createdAt: { greater_than_equal: `${from}T00:00:00` } }, { createdAt: { less_than_equal: `${to}T23:59:59` } }, { status: { not_equals: 'refunded' } }] }, depth: 0, pagination: false, overrideAccess: true, select: { amount_huf: true } }),
      bookingsFor(businessId, { before: prevFrom, statusNotIn: ['cancelled', 'no_show'], staffId: opts.staffId }).then((docs) => ({ docs })),
      bookingsFor(businessId, { statusIn: ['no_show'], staffId: opts.staffId }).then((docs) => ({ docs })),
    ])
    biz = bizRes as Salon | null
    const svc = new Map((svcRes.docs as Service[]).map((s) => [String(s.id), s]))
    const toRow = (b: Booking): Row => {
      const s = svc.get(relId(b.service) ?? '')
      return {
        date: (b.date ?? '').slice(0, 10), start: mins(b.start_time), end: mins(b.end_time), status: b.status, source: b.source ?? 'online', createdAt: b.createdAt,
        key: guestKeyOf({ email: b.customer_email, phone: b.customer_phone, name: b.customer_name }), name: b.customer_name, phone: b.customer_phone ?? null,
        city: b.customer_city ?? null, country: isoFromPhone(b.customer_phone), what: s?.name ?? '', price: typeof b.price_snapshot === 'number' ? b.price_snapshot : s?.price ?? 0,
        staff: relId(b.staff), pax: 1, tables: [],
      }
    }
    rows = (bRes.docs as unknown as Booking[]).map(toRow)
    noShowsEver = (nsRes.docs as unknown as Booking[]).map(toRow)
    staff = stRes.docs as StaffMember[]
    shifts = (shRes.docs as unknown as Shift[]).filter((s) => opts.staffId == null || relId(s.staff) === String(opts.staffId))
    for (const a of (avRes.docs as Availability[]).filter((x) => !x.staff && !x.exception_date)) {
      const i = DOW_KEY.indexOf(a.day_of_week)
      const s = mins(a.start_time), e = mins(a.end_time)
      if (i >= 0 && a.is_available !== false && s != null && e != null && e > s) openByDow[i] = [s, e]
    }
    vouchers = ((vRes?.docs ?? []) as GiftVoucher[]).reduce((n, v) => n + (v.amount_huf ?? 0), 0)
    for (const b of histRes.docs as unknown as Booking[]) { const k = guestKeyOf({ email: b.customer_email, phone: b.customer_phone, name: b.customer_name }); if (k && !history.has(k)) history.set(k, b.date) }
  } else {
    const [rRes, tRes, roomRes, ohRes, bizRes, histRes, nsRes] = await Promise.all([
      // Sebesség: a sok soros foglalás-listák KÖZVETLEN SQL-lel (lib/fastRead, docs/sebesseg)
      reservationsFor(businessId, { from: prevFrom, to }).then((docs) => ({ docs })),
      payload.find({ collection: 'tables', where: { and: [scope, { is_active: { equals: true } }] }, depth: 0, limit: 500, overrideAccess: true }),
      payload.find({ collection: 'rooms', where: scope, depth: 0, limit: 100, overrideAccess: true }),
      payload.find({ collection: 'opening-hours', where: scope, depth: 0, limit: 14, overrideAccess: true }),
      payload.findByID({ collection: 'restaurants', id: businessId, depth: 0, overrideAccess: true }).catch(() => null),
      reservationsFor(businessId, { before: prevFrom, statusNotIn: ['cancelled', 'no_show'] }).then((docs) => ({ docs })),
      reservationsFor(businessId, { statusIn: ['no_show'] }).then((docs) => ({ docs })),
    ])
    biz = bizRes as Restaurant | null
    const toRow = (r: Reservation): Row => ({
      date: (r.date ?? '').slice(0, 10), start: mins(r.start_time), end: mins(r.end_time), status: r.status, source: r.source ?? 'online', createdAt: r.createdAt,
      key: guestKeyOf({ email: r.customer_email, phone: r.customer_phone, name: r.customer_name }), name: r.customer_name, phone: r.customer_phone ?? null,
      city: r.customer_city ?? null, country: r.country?.toUpperCase() || isoFromPhone(r.customer_phone), what: `${r.pax ?? 0} fő`, price: 0, staff: null, pax: r.pax ?? 0,
      tables: (r.tables ?? []).map((t) => relId(t)!).filter(Boolean),
    })
    rows = (rRes.docs as unknown as Reservation[]).map(toRow)
    noShowsEver = (nsRes.docs as unknown as Reservation[]).map(toRow)
    tables = tRes.docs as Table[]
    rooms = roomRes.docs as Room[]
    for (const o of ohRes.docs as OpeningHour[]) {
      const i = DOW_KEY.indexOf(o.day_of_week)
      const s = mins(o.open_time), e = mins(o.close_time)
      if (i >= 0 && o.is_open && s != null && e != null) openByDow[i] = [s, e > s ? e : e + 24 * 60]
    }
    for (const r of histRes.docs as unknown as Reservation[]) { const k = guestKeyOf({ email: r.customer_email, phone: r.customer_phone, name: r.customer_name }); if (k && !history.has(k)) history.set(k, r.date) }
  }

  const inCur = (r: Row) => r.date >= from && r.date <= to
  const inPrev = (r: Row) => r.date >= prevFrom && r.date <= prevTo
  const cur = rows.filter(inCur), prev = rows.filter(inPrev)
  const live = (r: Row) => r.status !== 'cancelled' && r.status !== 'no_show'
  const act = cur.filter(live), actPrev = prev.filter(live)
  const dur = (r: Row) => (r.start != null && r.end != null && r.end > r.start ? r.end - r.start : 0)

  // ── fejléc ──
  const all = cur.length || 1
  const doneN = cur.filter((r) => r.status === 'completed' || r.status === 'seated' || (r.status === 'confirmed' && r.date < today)).length
  const pendN = cur.filter((r) => r.status === 'pending' || (r.status === 'confirmed' && r.date >= today)).length
  const cancN = cur.filter((r) => r.status === 'cancelled').length
  const nsN = cur.filter((r) => r.status === 'no_show').length
  const revenue = act.reduce((n, r) => n + r.price, 0)
  const revenuePrev = actPrev.reduce((n, r) => n + r.price, 0)
  const keys = [...new Set(act.map((r) => r.key).filter((k): k is string => !!k))]
  // visszatérő: járt már az időszak előtt, vagy az időszakban többször
  const visits = new Map<string, number>()
  for (const r of act) if (r.key) visits.set(r.key, (visits.get(r.key) ?? 0) + 1)
  const prevKeys = new Set([...history.keys(), ...actPrev.map((r) => r.key).filter(Boolean) as string[]])
  const returning = keys.filter((k) => prevKeys.has(k) || (visits.get(k) ?? 0) > 1).length
  const paxSum = act.reduce((n, r) => n + r.pax, 0)

  // ── nyitvatartás / beosztás percekben (kihasználtság, telítettség) ──
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
  const prevDates = Array.from({ length: days }, (_, i) => addDays(prevFrom, i))
  const seats = tables.reduce((n, t) => n + (t.capacity ?? 0), 0)
  // szalon: a beosztott munkaidő; ha nincs beosztás, a szalon nyitvatartása × a foglalható munkatársak
  const bookable = staff.filter((s) => s.is_active !== false && !s.import_review)
  const shiftMin = (sh: Shift) => { const a = mins(sh.start_time), b = mins(sh.end_time); return a != null && b != null && b > a ? [a, b] as [number, number] : null }
  const openSpans = (ds: string[]) => {
    // dátum → [kezdés, vége, súly] (szalon: munkatársanként; étterem: az ülőhelyek száma)
    const out: { date: string; s: number; e: number; w: number; staff: string | null }[] = []
    if (!rest && shifts.length) {
      for (const sh of shifts) { const d = (sh.date ?? '').slice(0, 10); const sp = shiftMin(sh); if (sp && ds.includes(d)) out.push({ date: d, s: sp[0], e: sp[1], w: 1, staff: relId(sh.staff) }) }
      return out
    }
    for (const d of ds) { const o = openByDow[dowOf(d)]; if (o) out.push({ date: d, s: o[0], e: o[1], w: rest ? seats : opts.staffId != null ? 1 : Math.max(1, bookable.length), staff: null }) }
    return out
  }
  const spans = openSpans(dates), spansPrev = openSpans(prevDates)
  const openMin = spans.reduce((n, x) => n + (x.e - x.s) * x.w, 0)
  const bookedMin = act.reduce((n, r) => n + dur(r) * (rest ? r.pax : 1), 0)
  const openPrev = spansPrev.reduce((n, x) => n + (x.e - x.s) * x.w, 0)
  const bookedPrev = actPrev.reduce((n, r) => n + dur(r) * (rest ? r.pax : 1), 0)
  const utilPct = openMin > 0 ? Math.min(100, pct(bookedMin, openMin)) : null
  const utilPrev = openPrev > 0 ? Math.min(100, pct(bookedPrev, openPrev)) : null

  const byDowUtil = Array.from({ length: 7 }, (_, i) => {
    const o = spans.filter((x) => dowOf(x.date) === i).reduce((n, x) => n + (x.e - x.s) * x.w, 0)
    const b = act.filter((r) => dowOf(r.date) === i).reduce((n, r) => n + dur(r) * (rest ? r.pax : 1), 0)
    return o > 0 ? Math.min(100, pct(b, o)) : null
  })
  // a napcsík: egymás melletti, azonos jellegű napok egy sávban
  // a napcsík: minden nap külön sáv, a hét legjobb napjához mérve (különben alacsony telítettségnél minden egyforma csíkos)
  const utilMax = Math.max(0, ...byDowUtil.map((v) => v ?? 0))
  const strip: Strip = {
    cols: byDowUtil.map((v, i) => [DAY_SHORT[i], v == null ? '—' : `${v}%`]),
    blocks: byDowUtil.map((v) => v == null ? { span: 1, tone: 'off' as const, text: 'zárva' }
      : v > 0 && v === utilMax ? { span: 1, tone: 'yellow' as const, text: 'legtelibb' }
      : utilMax > 0 && v >= utilMax * 0.6 ? { span: 1, tone: 'dark' as const, text: 'erős' }
      : { span: 1, tone: 'hatch' as const, text: 'van hely' }),
  }
  const parts: Share[] = PARTS.map(([name, a, b]) => {
    const o = spans.reduce((n, x) => n + overlap(x.s, x.e, a, b) * x.w, 0)
    const bk = act.reduce((n, r) => n + (r.start != null && r.end != null ? overlap(r.start, r.end, a, b) : 0) * (rest ? r.pax : 1), 0)
    const p = o > 0 ? Math.min(100, pct(bk, o)) : 0
    return { name, value: o > 0 ? `${p}%` : '—', pct: p }
  }).filter((p) => p.value !== '—')
  const staffUtil: Share[] = rest ? [] : staff.filter((s) => opts.staffId == null || String(s.id) === String(opts.staffId)).map((s) => {
    const o = spans.filter((x) => x.staff === String(s.id)).reduce((n, x) => n + (x.e - x.s), 0)
    const b = act.filter((r) => r.staff === String(s.id)).reduce((n, r) => n + dur(r), 0)
    const p = o > 0 ? Math.min(100, pct(b, o)) : 0
    return { name: s.name, value: `${p}%`, pct: p, img: s.avatar && typeof s.avatar === 'object' ? fixMediaUrl((s.avatar as Media).url) : null, o }
  }).filter((x) => x.o > 0).sort((a, b) => b.pct - a.pct).map(({ o: _o, ...x }) => x) // eslint-disable-line @typescript-eslint/no-unused-vars

  // ── heti eloszlás ──
  const perDow = Array.from({ length: 7 }, (_, i) => act.filter((r) => dowOf(r.date) === i).length)
  // a napok egy átlagos hétre vetítve (a nagy szám, az átlagos heti foglalás, ezek összege) — az adott hét-napok száma szerint
  const dowCount = Array.from({ length: 7 }, (_, i) => dates.filter((d) => dowOf(d) === i).length || 1)
  const avgDow = perDow.map((v, i) => Math.round(v / dowCount[i]))
  const avgMax = Math.max(...avgDow)
  const weekDays: DayBar[] = avgDow.map((v, i) => ({ d: DAY_SHORT[i], v, peak: v > 0 && v === avgMax, closed: v === 0 && !openByDow[i] }))
  const perWeek = days >= 7 ? avgDow.reduce((a, b) => a + b, 0) : act.length
  const perWeekPrev = Math.round((actPrev.length / days) * 7)
  const byDay = perDow.map((total, i) => ({
    d: DAY_LONG[i], total,
    rows: act.filter((r) => dowOf(r.date) === i).sort((a, b) => (b.date + pad(b.start ?? 0)).localeCompare(a.date + pad(a.start ?? 0))).slice(0, 6)
      .map((r) => ({ time: r.start != null ? `${pad(Math.floor(r.start / 60))}:${pad(r.start % 60)}` : '—', name: r.name, what: r.what, date: r.date })),
  }))

  // ── mikor foglalnak (nap × óra) és mikor adják le ──
  const starts = act.map((r) => r.start).filter((x): x is number => x != null)
  const h0 = starts.length ? Math.max(0, Math.min(rest ? 12 : 9, Math.floor(Math.min(...starts) / 60))) : rest ? 12 : 9
  const h1 = starts.length ? Math.min(23, Math.max(rest ? 23 : 19, Math.floor(Math.max(...starts) / 60))) : rest ? 23 : 19
  const hours = Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i)
  const counts = Array.from({ length: 7 }, (_, d) => hours.map((h) => act.filter((r) => dowOf(r.date) === d && r.start != null && Math.floor(r.start / 60) === h).length))
  const cmax = Math.max(1, ...counts.flat())
  let best = -1, peak: string | null = null
  counts.forEach((row, d) => row.forEach((v, i) => { const two = v + (row[i + 1] ?? 0); if (two > best && two > 0) { best = two; peak = `${DAY_LONG[d]} ${hours[i]}–${hours[i] + 2}` } }))
  const online = act.filter((r) => r.source === 'online')
  const createdParts: [string, (h: number) => boolean][] = [['Reggel (6–10)', (h) => h >= 6 && h < 10], ['Napközben (10–18)', (h) => h >= 10 && h < 18], ['Este (18–23)', (h) => h >= 18 && h < 23], ['Éjjel (23–6)', (h) => h >= 23 || h < 6]]
  const createdH = online.map((r) => ({ h: huHour(r.createdAt), dow: (new Date(r.createdAt).getDay() + 6) % 7 }))
  const created: Share[] = createdParts.map(([name, f]) => { const p = pct(createdH.filter((x) => f(x.h)).length, createdH.length); return { name, value: `${p}%`, pct: p } })
  const createdMax = Math.max(...created.map((c) => c.pct))
  created.forEach((c) => { if (c.pct === createdMax && c.pct > 0) c.lead = 'hi' })
  const closed = createdH.filter((x) => { const o = openByDow[x.dow]; return !o || x.h * 60 < o[0] || x.h * 60 >= o[1] }).length
  const anyOpen = openByDow.some(Boolean)

  // ── vendégforrás ──
  const srcPct = (rs: Row[], s: string) => pct(rs.filter((r) => r.source === s).length, rs.length)
  const leads = online.map((r) => diffDays(r.createdAt.slice(0, 10), r.date)).filter((n) => n >= 0)
  const avgTable = act.filter((r) => dur(r) > 0)
  const tableTime = rest && avgTable.length ? Math.round(avgTable.reduce((n, r) => n + dur(r), 0) / avgTable.length) : null

  // ── bevétel ──
  const bks = buckets(from, days), bksPrev = buckets(prevFrom, days)
  const sumIn = (rs: Row[], a: string, b: string) => rs.filter((r) => r.date >= a && r.date <= b).reduce((n, r) => n + r.price, 0)
  const revNow = bks.map((b) => sumIn(act, b.from, b.to)), revPrev = bksPrev.map((b) => sumIn(actPrev, b.from, b.to))
  const tickIdx = bks.length <= 5 ? bks.map((_, i) => i) : [0, 1, 2, 3, 4].map((k) => Math.round((k / 4) * (bks.length - 1)))

  // ── top szolgáltatás és a gyakran együtt foglaltak ──
  const svcAgg = new Map<string, { n: number; rev: number }>()
  const svcPrev = new Map<string, number>()
  for (const r of act) { if (!r.what) continue; const x = svcAgg.get(r.what) ?? { n: 0, rev: 0 }; x.n++; x.rev += r.price; svcAgg.set(r.what, x) }
  for (const r of actPrev) if (r.what) svcPrev.set(r.what, (svcPrev.get(r.what) ?? 0) + 1)
  const svcList = [...svcAgg.entries()]
  const byCountRaw = svcList.sort((a, b) => b[1].n - a[1].n)
  const topN = byCountRaw[0]?.[1].n ?? 1
  const byCount: Share[] = byCountRaw.slice(0, 8).map(([name, x]) => ({ name, value: String(x.n), pct: pct(x.n, topN) }))
  const byRevRaw = [...svcAgg.entries()].sort((a, b) => b[1].rev - a[1].rev)
  const topRev = byRevRaw[0]?.[1].rev || 1
  const byRevenue: Share[] = byRevRaw.slice(0, 8).map(([name, x]) => ({ name, value: `${short(x.rev)} Ft`, pct: pct(x.rev, topRev) }))
  const sameDay = new Map<string, Set<string>>()
  for (const r of act) { if (!r.key || !r.what) continue; const k = `${r.key}|${r.date}`; (sameDay.get(k) ?? sameDay.set(k, new Set()).get(k)!).add(r.what) }
  const pairCount = new Map<string, number>()
  for (const set of sameDay.values()) { const l = [...set].sort(); for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const t = `${l[i]} + ${l[j]}`; pairCount.set(t, (pairCount.get(t) ?? 0) + 1) } }
  const pairs = [...pairCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, count]) => ({ title, count }))
  const topName = byCountRaw[0]?.[0]

  // ── no-show ──
  const nsPrevPct = prev.length ? (prev.filter((r) => r.status === 'no_show').length / prev.length) * 100 : null
  const nsPct = cur.length ? (nsN / cur.length) * 100 : 0
  const nsBy = new Map<string, Row[]>()
  for (const r of noShowsEver) if (r.key) (nsBy.get(r.key) ?? nsBy.set(r.key, []).get(r.key)!).push(r)
  const repeat = [...nsBy.values()].filter((l) => l.length >= 2).sort((a, b) => b.length - a.length).slice(0, 5).map((l) => {
    const last = l.reduce((a, b) => (a.date > b.date ? a : b))
    return { name: last.name, meta: `utoljára ${dayLabel(last.date)}${last.what ? ` · ${last.what}` : ''}`, count: l.length }
  })

  // ── vendégek ──
  const guestRows = new Map<string, Row>()
  for (const r of act) if (r.key && !guestRows.has(r.key)) guestRows.set(r.key, r)
  const g = [...guestRows.values()]
  const withCountry = g.filter((r) => r.country)
  const cc = new Map<string, number>()
  for (const r of withCountry) cc.set(r.country!, (cc.get(r.country!) ?? 0) + 1)
  const hu = cc.get('HU') ?? 0
  const domestic = withCountry.length ? pct(hu, withCountry.length) : 0
  const ccList = [...cc.entries()].sort((a, b) => b[1] - a[1])
  const countries: Share[] = ccList.slice(0, 4).map(([iso, n]) => ({ name: countryName(iso) ?? iso, value: String(n), pct: pct(n, withCountry.length), lead: flagEmoji(iso) }))
  if (ccList.length > 4) { const rest4 = ccList.slice(4).reduce((n, [, v]) => n + v, 0); countries.push({ name: `Egyéb (${ccList.length - 4} ország)`, value: String(rest4), pct: pct(rest4, withCountry.length), lead: '🌍' }) }
  const cities = new Map<string, { n: number; iso: string | null }>()
  for (const r of g) { const c = r.city?.trim(); if (!c) continue; const k = c.charAt(0).toUpperCase() + c.slice(1); const x = cities.get(k) ?? { n: 0, iso: r.country }; x.n++; cities.set(k, x) }
  const cityList = [...cities.entries()].sort((a, b) => b[1].n - a[1].n)
  const cityTotal = cityList.reduce((n, [, x]) => n + x.n, 0)
  const citiesOut: Share[] = cityList.slice(0, 4).map(([name, x]) => ({ name, value: String(x.n), pct: pct(x.n, cityTotal), lead: x.iso ? flagEmoji(x.iso) : null }))
  if (cityList.length > 4) { const r5 = cityList.slice(4).reduce((n, [, x]) => n + x.n, 0); citiesOut.push({ name: `Egyéb (${cityList.length - 4} város)`, value: String(r5), pct: pct(r5, cityTotal) }) }
  const fresh = keys.filter((k) => !prevKeys.has(k)).length

  // ── értékelések ──
  const reviews = (await payload.find({ collection: 'reviews', where: scope, depth: 0, pagination: false, overrideAccess: true, select: { rating: true, createdAt: true } })).docs as Review[]
  const dist = [5, 4, 3, 2, 1].map((st) => pct(reviews.filter((r) => Math.round(r.rating) === st).length, reviews.length))
  const avgOf = (rs: Review[]) => (rs.length ? Math.round((rs.reduce((n, r) => n + r.rating, 0) / rs.length) * 10) / 10 : null)
  const before = reviews.filter((r) => r.createdAt.slice(0, 10) < from)
  const gb = biz as (Salon & { google_rating?: number | null; google_rating_count?: number | null }) | null
  const google = !!gb?.google_rating && !!gb.google_rating_count
  const own = avgOf(reviews)
  const rawUrl = (biz as { feature_modules?: { google_review_url?: string | null } } | null)?.feature_modules?.google_review_url?.trim() ?? ''
  // csak valódi (http/https) cím — egy elírt / teszt-érték relatív linkként az admin egy nem létező oldalára vinne
  const reviewUrl = /^https?:\/\/\S+\.\S+/.test(rawUrl) ? rawUrl : null

  // ── étterem: asztalok, termek, létszám ──
  let restVM: StatsVM['rest'] = null
  if (rest) {
    const openDays = dates.filter((d) => openByDow[dowOf(d)]).length || 1
    const turnsBy = new Map<string, number>()
    for (const r of act) for (const t of r.tables) turnsBy.set(t, (turnsBy.get(t) ?? 0) + 1)
    const tlist = tables.slice().sort((a, b) => a.name.localeCompare(b.name, 'hu', { numeric: true }))
    const tMax = Math.max(0, ...tlist.map((t) => turnsBy.get(String(t.id)) ?? 0))
    const tableBars: DayBar[] = tlist.slice(0, 12).map((t) => { const v = Math.round(((turnsBy.get(String(t.id)) ?? 0) / openDays) * 10); return { d: t.name, v, peak: v > 0 && (turnsBy.get(String(t.id)) ?? 0) === tMax } })
    const totalTurns = [...turnsBy.values()].reduce((a, b) => a + b, 0)
    const turns = tlist.length ? Math.round((totalTurns / tlist.length / openDays) * 10) / 10 : null
    const setTime = (biz as Restaurant | null)?.turn_duration_minutes || 120
    // egy asztal nyitott percei az időszakban (a nyitvatartás napjai összesen) × az asztalok száma
    const openDayMin = spans.reduce((n, x) => n + (x.e - x.s), 0)
    const roomShares: Share[] = rooms.filter((r) => r.is_active !== false).map((room) => {
      const ids = new Set(tlist.filter((t) => relId(t.room) === String(room.id)).map((t) => String(t.id)))
      const o = openDayMin * ids.size
      const b = act.filter((r) => r.tables.some((t) => ids.has(t))).reduce((n, r) => n + dur(r), 0)
      const p = o > 0 ? Math.min(100, pct(b, o)) : 0
      return { name: room.name, value: `${p}%`, pct: p }
    }).filter((x) => x.pct > 0 || rooms.length <= 4).sort((a, b) => b.pct - a.pct)
    if (roomShares[0]) roomShares[0].lead = 'hi'
    const groups: [string, (p: number) => boolean, (c: number) => boolean][] = [['2 fő', (p) => p <= 2, (c) => c <= 2], ['3–4 fő', (p) => p >= 3 && p <= 4, (c) => c >= 3 && c <= 4], ['5–6 fő', (p) => p >= 5 && p <= 6, (c) => c >= 5 && c <= 6], ['7+ fő', (p) => p >= 7, (c) => c >= 7]]
    const partyRows = groups.map(([title, fp, fc]) => {
      const share = pct(act.filter((r) => fp(r.pax)).length, act.length)
      const ts = tlist.filter((t) => fc(t.capacity ?? 0))
      const ids = new Set(ts.map((t) => String(t.id)))
      const o = openDayMin * ids.size
      const b = act.filter((r) => r.tables.some((t) => ids.has(t))).reduce((n, r) => n + dur(r), 0)
      const occ = o > 0 ? Math.min(100, pct(b, o)) : 0
      return { title, share, n: ts.length, cap: ts[0]?.capacity ?? null, occ, tone: 'hatch' as 'yellow' | 'dark' | 'hatch' }
    })
    // minden létszám külön sáv: a legfoglaltabb asztal-méret sárga („szűk”), a hozzá közeli sötét, a többi csíkos; ilyen asztal nélkül halvány
    const occMax = Math.max(0, ...partyRows.map((p) => (p.n ? p.occ : 0)))
    partyRows.forEach((p) => { p.tone = !p.n || occMax === 0 ? 'hatch' : p.occ === occMax ? 'yellow' : p.occ >= occMax * 0.6 ? 'dark' : 'hatch' })
    const party: Strip = {
      cols: partyRows.map((p) => [p.title, `${p.share}%`]),
      blocks: partyRows.map((p) => ({ span: 1, tone: !p.n ? 'off' as const : p.tone, text: '' })),
      // a sávok szélessége a társaságok aránya szerint (a 0% is látszik, keskenyen)
      weights: partyRows.map((p) => Math.max(6, p.share)),
    }
    const avgParty = act.length ? Math.round((paxSum / act.length) * 10) / 10 : null
    const avgPartyPrev = actPrev.length ? Math.round((actPrev.reduce((n, r) => n + r.pax, 0) / actPrev.length) * 10) / 10 : null
    restVM = {
      turns, tables: tableBars, tableTime, setTime, idle: tableTime != null ? Math.max(0, setTime - tableTime) : null, rooms: roomShares,
      avgParty, partyDelta: avgParty != null && avgPartyPrev != null ? Math.round((avgParty - avgPartyPrev) * 10) / 10 : null, party,
      partyRows: partyRows.map((p) => ({ title: p.title, meta: `${p.share}% a társaságokból · ${p.n ? `${p.n} db ilyen asztal` : 'nincs ilyen asztal'}`, value: p.n ? `${p.occ}% foglalt` : '—', tone: p.tone })),
    }
  }

  return {
    restaurant: rest, from, to, prevFrom, prevTo, days, label: rangeText(from, to),
    status: { done: pct(doneN, all), pending: pct(pendN, all), cancelled: pct(cancN, all), noShow: pct(nsN, all) },
    kpis: { bookings: act.length, revenue, returningPct: keys.length ? pct(returning, keys.length) : null, guests: paxSum, saturation: utilPct },
    empty: cur.length === 0,
    week: { perWeek, days: weekDays, delta: pctDelta(perWeek, perWeekPrev), byDay },
    util: { pct: utilPct, booked: Math.round(bookedMin / 60), open: Math.round(openMin / 60), delta: utilPct != null && utilPrev != null ? utilPct - utilPrev : null, strip, parts, staff: staffUtil },
    hours: { hours, grid: counts.map((row) => row.map((v) => v / cmax)), peak, created, closedPct: anyOpen && createdH.length ? pct(closed, createdH.length) : null },
    source: { online: srcPct(act, 'online'), phone: srcPct(act, 'phone'), walkIn: srcPct(act, 'walk_in'), delta: actPrev.length ? srcPct(act, 'online') - srcPct(actPrev, 'online') : null, leadDays: leads.length ? Math.round((leads.reduce((a, b) => a + b, 0) / leads.length) * 10) / 10 : null, avgValue: act.length && !rest ? Math.round(revenue / act.length) : null, cancelPct: pct(cancN, all), tableTime },
    revenue: rest ? null : {
      total: revenue + vouchers, delta: pctDelta(revenue, revenuePrev), now: revNow, prev: revPrev,
      ticks: tickIdx.map((i) => bks[i].label), points: bks.map((b) => (b.from === b.to ? dayLabel(b.from) : `${dayLabel(b.from)} – ${dayLabel(b.to)}`)),
      parts: [{ name: 'Szolgáltatás', value: `${short(revenue)} Ft`, pct: pct(revenue, revenue + vouchers || 1), lead: 'hi' }, ...(vouchers ? [{ name: 'Utalvány-eladás', value: `${short(vouchers)} Ft`, pct: pct(vouchers, revenue + vouchers) }] : [])],
    },
    paxTrend: !rest ? null : (() => {
      const paxIn = (rs: Row[], a: string, b: string) => rs.filter((r) => r.date >= a && r.date <= b).reduce((n, r) => n + r.pax, 0)
      const prevPax = actPrev.reduce((n, r) => n + r.pax, 0)
      const bySrc = (s: string) => act.filter((r) => r.source === s).reduce((n, r) => n + r.pax, 0)
      const parts = ([['Online', 'online'], ['Telefon', 'phone'], ['Beeső', 'walk_in']] as const).map(([name, k]) => ({ name, value: `${bySrc(k).toLocaleString('hu-HU')} fő`, pct: pct(bySrc(k), paxSum || 1) }))
      const mx = Math.max(...parts.map((p) => p.pct)); parts.forEach((p) => { if (p.pct === mx && mx > 0) (p as Share).lead = 'hi' })
      return {
        total: paxSum, delta: pctDelta(paxSum, prevPax), now: bks.map((b) => paxIn(act, b.from, b.to)), prev: bksPrev.map((b) => paxIn(actPrev, b.from, b.to)),
        ticks: tickIdx.map((i) => bks[i].label), points: bks.map((b) => (b.from === b.to ? dayLabel(b.from) : `${dayLabel(b.from)} – ${dayLabel(b.to)}`)), parts,
      }
    })(),
    top: rest ? null : { byCount, byRevenue, delta: topName ? pctDelta(svcAgg.get(topName)!.n, svcPrev.get(topName) ?? 0) : null, pairs },
    noShow: {
      pct: Math.round(nsPct * 10) / 10, count: nsN, deltaPt: nsPrevPct != null ? Math.round((nsPct - nsPrevPct) * 10) / 10 : null, repeat,
      trend: { now: bks.map((b) => cur.filter((r) => r.status === 'no_show' && r.date >= b.from && r.date <= b.to).length), prev: bksPrev.map((b) => prev.filter((r) => r.status === 'no_show' && r.date >= b.from && r.date <= b.to).length), ticks: tickIdx.map((i) => bks[i].label), points: bks.map((b) => (b.from === b.to ? dayLabel(b.from) : `${dayLabel(b.from)} – ${dayLabel(b.to)}`)) },
      byDay: (() => { const v = Array.from({ length: 7 }, (_, i) => cur.filter((r) => r.status === 'no_show' && dowOf(r.date) === i).length); const m = Math.max(...v); return v.map((n, i) => ({ d: DAY_SHORT[i], v: n, peak: n > 0 && n === m })) })(),
      bySource: ([['Online', 'online'], ['Telefon', 'phone'], ['Beeső', 'walk_in']] as const).map(([name, k]) => { const all = cur.filter((r) => r.source === k).length; const ns = cur.filter((r) => r.source === k && r.status === 'no_show').length; const p = all ? Math.round((ns / all) * 1000) / 10 : 0; return { name, value: all ? `${String(p).replace('.', ',')}% · ${ns} / ${all}` : '—', pct: Math.min(100, p * 5) } }),
    },
    guests: {
      total: keys.length, fresh, domestic, foreign: withCountry.length ? 100 - domestic : 0, countries, cities: citiesOut,
      // új vendég: az első látogatása ebbe a napba / hétbe esik (előtte sosem járt)
      trend: (() => {
        const firstIn = (rs: Row[], known: Set<string>) => { const m = new Map<string, string>(); for (const r of rs.slice().sort((a, b) => a.date.localeCompare(b.date))) if (r.key && !known.has(r.key) && !m.has(r.key)) m.set(r.key, r.date); return [...m.values()] }
        const curFirst = firstIn(act, prevKeys), prevFirst = firstIn(actPrev, new Set(history.keys()))
        const cnt = (ds: string[], a: string, b: string) => ds.filter((d) => d >= a && d <= b).length
        return { now: bks.map((b) => cnt(curFirst, b.from, b.to)), prev: bksPrev.map((b) => cnt(prevFirst, b.from, b.to)), ticks: tickIdx.map((i) => bks[i].label), points: bks.map((b) => (b.from === b.to ? dayLabel(b.from) : `${dayLabel(b.from)} – ${dayLabel(b.to)}`)) }
      })(),
    },
    reviews: { avg: google ? gb!.google_rating! : own, count: google ? gb!.google_rating_count! : reviews.length, google, dist, fresh: reviews.filter((r) => r.createdAt.slice(0, 10) >= from).length, delta: own != null && avgOf(before) != null ? Math.round((own - avgOf(before)!) * 10) / 10 : null, url: reviewUrl },
    rest: restVM,
  }
}
