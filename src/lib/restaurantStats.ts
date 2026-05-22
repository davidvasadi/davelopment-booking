import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { hu } from 'date-fns/locale'
import { getPayloadClient } from './payload'
import { hhmmToMinutes, getDayName } from './utils'
import type { DayData, DowStat, HourStat } from './dashboardStats'
import type { Reservation, Restaurant, Table, OpeningHour } from '@/payload/payload-types'

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
  completionRate: number
  // grafikonok
  trend: DayData[]
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
 * a hely befogadóképessége (flat: max_pax, tables: aktív asztalok összkapacitása).
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

  const seats = restaurant.capacity_mode === 'flat'
    ? (restaurant.max_pax || 0)
    : (tablesRes.docs as Table[]).reduce((s, t) => s + (t.capacity ?? 0), 0)

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
  const trend: DayData[] = Array.from({ length: days }, (_, i) => {
    const d = format(subDays(today, days - 1 - i), 'yyyy-MM-dd')
    const dayDocs = active.filter(r => r.date === d)
    return {
      date: d,
      label: dayLabel(d, days),
      revenue: dayDocs.reduce((s, r) => s + paxOf(r), 0), // a "revenue" mezőt pax-ként használjuk
      bookings: dayDocs.length,
    }
  })

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
  const byHour: HourStat[] = Array.from({ length: 17 }, (_, i) => {
    const h = String(i + 7).padStart(2, '0')
    return { hour: `${h}:00`, bookings: hourCountMap[h] ?? 0 }
  })
  const bestHourKey = Object.entries(hourCountMap).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bestHour = bestHourKey ? `${bestHourKey}:00` : null

  const avgPartySize = periodDocs.length > 0 ? Math.round(periodPax / periodDocs.length) : 0

  const finalized = periodDocs.filter(r => r.status !== 'pending')
  const completed = finalized.filter(r => r.status === 'completed')
  const completionRate = finalized.length > 0 ? Math.round((completed.length / finalized.length) * 100) : 0

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
    completionRate,
    trend,
    byDayOfWeek,
    byHour,
    bestDay,
    bestHour,
  }
}
