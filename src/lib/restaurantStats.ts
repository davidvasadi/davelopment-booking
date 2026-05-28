import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { hu } from 'date-fns/locale'
import { getPayloadClient } from './payload'
import { hhmmToMinutes, getDayName } from './utils'
import type { DayData, DowStat, HourStat } from './dashboardStats'
import type { Reservation, Restaurant, Table, OpeningHour } from '@/payload/payload-types'

export interface RestaurantDayBreakdown {
  date: string
  label: string
  active: number
  cancelled: number
  completed: number
  walkIn: number
  pax: number
}

export interface RestaurantStats {
  period: number
  // ma
  reservationsToday: number
  reservationsTodayDiff: number
  paxToday: number
  paxTodayDiff: number
  occupancyToday: number
  // hónap
  reservationsMonth: number
  reservationsMonthDiff: number
  // időszak (period)
  periodReservations: number
  periodReservationsDiff: number
  periodPax: number
  periodPaxDiff: number
  avgPartySize: number
  onlineReservations: number
  completionRate: number
  // státusz-bontás (időszak)
  cancellationRate: number
  noShowRate: number
  walkInRate: number
  phoneRate: number
  // státusz-bontás nyers darabszámok (a kártyák fő értéke)
  cancelledCount: number
  noShowCount: number
  walkInCount: number
  phoneCount: number
  // grafikonok
  trend: DayData[]
  dailyBreakdown: RestaurantDayBreakdown[]
  /** Mindig legalább 30 napnyi bontás, hogy a napi-részletek sheet szabadon lapozható legyen
   *  rövid (pl. 1 napos) időszaknál is. A chart-oszlopok a dailyBreakdown-t használják. */
  dailyBreakdownFull: RestaurantDayBreakdown[]
  byDayOfWeek: DowStat[]
  byHour: HourStat[]
  bestDay: string | null
  bestHour: string | null
}

const ACTIVE_STATUSES = ['pending', 'confirmed', 'seated', 'completed']

function pctDiff(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function dayLabel(d: string, days: number): string {
  const date = new Date(d + 'T00:00:00')
  if (days <= 90) return format(date, 'MMM d.', { locale: hu })
  return format(date, 'MMM', { locale: hu })
}

function paxOf(r: Reservation): number {
  return r.pax ?? 0
}

/**
 * Egy nap elérhető pax-kapacitása: hány turnus fér bele a nyitvatartásba ×
 * a hely befogadóképessége (aktív asztalok összkapacitása).
 * Csak a mai kihasználtsághoz, durva becslés a foglaltság kontextusba helyezésére.
 */
function dailyCapacity(
  restaurant: Restaurant,
  dayOpeningHour: OpeningHour | undefined,
  seats: number,
): number {
  if (!dayOpeningHour || !dayOpeningHour.is_open || !dayOpeningHour.open_time || !dayOpeningHour.close_time) {
    return 0
  }
  const openMin = hhmmToMinutes(dayOpeningHour.open_time)
  const closeMin = hhmmToMinutes(dayOpeningHour.close_time)
  const turn = restaurant.turn_duration_minutes || 120
  const turns = Math.max(1, Math.floor((closeMin - openMin) / turn))
  return turns * seats
}

export async function getRestaurantStats(
  restaurantId: string | number,
  days = 30,
): Promise<RestaurantStats> {
  const payload = await getPayloadClient()

  const restaurant = await payload.findByID({
    collection: 'restaurants',
    id: restaurantId,
    overrideAccess: true,
  })

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')
  const monthStartStr = format(startOfMonth(today), 'yyyy-MM-dd')
  const lastMonthStartStr = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const lastMonthEndStr = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const periodStartStr = format(subDays(today, days - 1), 'yyyy-MM-dd')
  const prevPeriodStartStr = format(subDays(today, days * 2 - 1), 'yyyy-MM-dd')

  const queryFrom = prevPeriodStartStr < lastMonthStartStr ? prevPeriodStartStr : lastMonthStartStr

  const [reservationsRes, tablesRes, openingHoursRes] = await Promise.all([
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurantId } },
          { date: { greater_than_equal: queryFrom } },
        ],
      },
      depth: 0,
      limit: 5000,
      // Csak a számításhoz használt mezők – kevesebb adat a DB-ből és a hidratálásból.
      select: { date: true, status: true, source: true, pax: true, start_time: true },
      overrideAccess: true,
    }),
    payload.find({
      collection: 'tables',
      where: { and: [{ restaurant: { equals: restaurantId } }, { is_active: { equals: true } }] },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'opening-hours',
      where: { restaurant: { equals: restaurantId } },
      depth: 0,
      limit: 14,
      overrideAccess: true,
    }),
  ])

  const all = reservationsRes.docs as Reservation[]
  const active = all.filter(r => ACTIVE_STATUSES.includes(r.status))

  const seats = (tablesRes.docs as Table[]).reduce((s, t) => s + (t.capacity ?? 0), 0)

  const todayDayName = getDayName(today)
  const todayOpening = (openingHoursRes.docs as OpeningHour[]).find(o => o.day_of_week === todayDayName)
  const capacityToday = dailyCapacity(restaurant as Restaurant, todayOpening, seats)

  // ── Ma / tegnap / hónap ──────────────────────────────────────────
  const todayDocs = active.filter(r => r.date === todayStr)
  const yesterdayDocs = active.filter(r => r.date === yesterdayStr)
  const monthDocs = active.filter(r => r.date >= monthStartStr)
  const lastMonthDocs = active.filter(r => r.date >= lastMonthStartStr && r.date <= lastMonthEndStr)
  const periodDocs = active.filter(r => r.date >= periodStartStr)
  const prevPeriodDocs = active.filter(r => r.date >= prevPeriodStartStr && r.date < periodStartStr)

  const paxToday = todayDocs.reduce((s, r) => s + paxOf(r), 0)
  const paxYesterday = yesterdayDocs.reduce((s, r) => s + paxOf(r), 0)
  const periodPax = periodDocs.reduce((s, r) => s + paxOf(r), 0)
  const prevPeriodPax = prevPeriodDocs.reduce((s, r) => s + paxOf(r), 0)

  const occupancyToday = capacityToday > 0
    ? Math.min(100, Math.round((paxToday / capacityToday) * 100))
    : 0

  // ── Trend (period) ───────────────────────────────────────────────
  // Dátum szerint egyszer csoportosítunk, hogy a napi bontás lineáris legyen
  // (korábban minden nap végigszűrte a teljes `all` tömböt → O(napok × foglalások)).
  const allByDate = new Map<string, Reservation[]>()
  const activeByDate = new Map<string, Reservation[]>()
  for (const r of all) {
    ;(allByDate.get(r.date) ?? allByDate.set(r.date, []).get(r.date)!).push(r)
  }
  for (const r of active) {
    ;(activeByDate.get(r.date) ?? activeByDate.set(r.date, []).get(r.date)!).push(r)
  }

  const breakdownFor = (d: string): RestaurantDayBreakdown => {
    const activeDay = activeByDate.get(d) ?? []
    const allDay = allByDate.get(d) ?? []
    return {
      date: d,
      label: dayLabel(d, days),
      active: activeDay.length,
      cancelled: allDay.filter(r => r.status === 'cancelled' || r.status === 'no_show').length,
      completed: allDay.filter(r => r.status === 'completed').length,
      walkIn: allDay.filter(r => r.source === 'walk_in').length,
      pax: activeDay.reduce((s, r) => s + paxOf(r), 0),
    }
  }

  const trend: DayData[] = []
  const dailyBreakdown: RestaurantDayBreakdown[] = []
  for (let i = 0; i < days; i++) {
    const d = format(subDays(today, days - 1 - i), 'yyyy-MM-dd')
    const bd = breakdownFor(d)
    trend.push({
      date: d,
      label: bd.label,
      revenue: bd.pax, // a "revenue" mezőt pax-ként használjuk
      bookings: bd.active,
    })
    dailyBreakdown.push(bd)
  }

  // Mindig legalább 30 napnyi bontás a sheet lapozásához (rövid időszaknál is).
  const breakdownDays = Math.max(days, 30)
  const dailyBreakdownFull: RestaurantDayBreakdown[] = []
  for (let i = 0; i < breakdownDays; i++) {
    dailyBreakdownFull.push(breakdownFor(format(subDays(today, breakdownDays - 1 - i), 'yyyy-MM-dd')))
  }

  // ── Heti eloszlás ────────────────────────────────────────────────
  const DOW = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
  const dowCount = [0, 0, 0, 0, 0, 0, 0]
  for (const r of periodDocs) {
    const dow = (new Date(r.date + 'T00:00:00').getDay() + 6) % 7
    dowCount[dow]++
  }
  const byDayOfWeek: DowStat[] = DOW.map((day, i) => ({ day, bookings: dowCount[i] }))
  const maxDow = dowCount.indexOf(Math.max(...dowCount))
  const bestDay = dowCount[maxDow] > 0 ? DOW[maxDow] : null

  // ── Óránkénti forgalom ───────────────────────────────────────────
  const hourCountMap: Record<string, number> = {}
  for (const r of periodDocs) {
    if (!r.start_time) continue
    const h = r.start_time.split(':')[0]
    hourCountMap[h] = (hourCountMap[h] ?? 0) + 1
  }
  // Teljes 24 órás kör, hogy a hajnali/éjszakai nyitvatartás (pl. bár) is lefedett legyen.
  // A HourChart a tényleges adat alapján vágja le az üres széleket.
  const byHour: HourStat[] = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0')
    return { hour: `${h}:00`, bookings: hourCountMap[h] ?? 0 }
  })
  const bestHourKey = Object.entries(hourCountMap).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bestHour = bestHourKey ? `${bestHourKey}:00` : null

  const avgPartySize = periodDocs.length > 0 ? Math.round(periodPax / periodDocs.length) : 0
  const onlineReservations = periodDocs.filter(r => r.source === 'online').length

  const finalized = periodDocs.filter(r => r.status !== 'pending')
  const completed = finalized.filter(r => r.status === 'completed')
  const completionRate = finalized.length > 0 ? Math.round((completed.length / finalized.length) * 100) : 0

  // ── Státusz-bontás (cancelled/no_show nincs az active-ban, ezért all-ból) ──
  const allPeriod = all.filter(r => r.date >= periodStartStr)
  const cancelledCount = allPeriod.filter(r => r.status === 'cancelled').length
  const noShowCount = allPeriod.filter(r => r.status === 'no_show').length
  const walkInCount = allPeriod.filter(r => r.source === 'walk_in').length
  const phoneCount = allPeriod.filter(r => r.source === 'phone').length
  const cancellationRate = allPeriod.length > 0 ? Math.round((cancelledCount / allPeriod.length) * 100) : 0
  const noShowRate = allPeriod.length > 0 ? Math.round((noShowCount / allPeriod.length) * 100) : 0
  const walkInRate = allPeriod.length > 0 ? Math.round((walkInCount / allPeriod.length) * 100) : 0
  const phoneRate = allPeriod.length > 0 ? Math.round((phoneCount / allPeriod.length) * 100) : 0

  return {
    period: days,
    reservationsToday: todayDocs.length,
    reservationsTodayDiff: pctDiff(todayDocs.length, yesterdayDocs.length),
    paxToday,
    paxTodayDiff: pctDiff(paxToday, paxYesterday),
    occupancyToday,
    reservationsMonth: monthDocs.length,
    reservationsMonthDiff: pctDiff(monthDocs.length, lastMonthDocs.length),
    periodReservations: periodDocs.length,
    periodReservationsDiff: pctDiff(periodDocs.length, prevPeriodDocs.length),
    periodPax,
    periodPaxDiff: pctDiff(periodPax, prevPeriodPax),
    avgPartySize,
    onlineReservations,
    completionRate,
    cancellationRate,
    noShowRate,
    walkInRate,
    phoneRate,
    cancelledCount,
    noShowCount,
    walkInCount,
    phoneCount,
    trend,
    dailyBreakdown,
    dailyBreakdownFull,
    byDayOfWeek,
    byHour,
    bestDay,
    bestHour,
  }
}
