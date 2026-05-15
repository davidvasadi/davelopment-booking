import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { hu } from 'date-fns/locale'
import { getPayloadClient } from './payload'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'

export interface DayData {
  date: string
  label: string
  revenue: number
  bookings: number
}

export interface ServiceStat {
  name: string
  revenue: number
  bookings: number
}

export interface StaffStat {
  name: string
  bookings: number
  revenue: number
}

export interface DowStat {
  day: string
  bookings: number
}

export interface HourStat {
  hour: string
  bookings: number
}

export interface DashboardStats {
  period: number
  revenueToday: number
  revenueTodayDiff: number
  revenueMonth: number
  revenueMonthDiff: number
  bookingsToday: number
  bookingsTodayDiff: number
  bookingsMonth: number
  bookingsMonthDiff: number
  periodRevenue: number
  periodRevenueDiff: number
  periodBookings: number
  periodBookingsDiff: number
  avgBookingValue: number
  completionRate: number
  trend: DayData[]
  byService: ServiceStat[]
  byStaff: StaffStat[]
  byDayOfWeek: DowStat[]
  byHour: HourStat[]
  bestDay: string | null
  bestHour: string | null
}

function getPrice(b: Booking): number {
  const s = b.service
  if (!s || typeof s !== 'object') return 0
  return (s as Service).price ?? 0
}

function pctDiff(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function dayLabel(d: string, days: number): string {
  const date = new Date(d + 'T00:00:00')
  if (days <= 90) return format(date, 'MMM d.', { locale: hu })
  return format(date, 'MMM', { locale: hu })
}

export async function getDashboardStats(salonId: string | number, days = 30): Promise<DashboardStats> {
  const payload = await getPayloadClient()

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')
  const monthStartStr = format(startOfMonth(today), 'yyyy-MM-dd')
  const lastMonthStartStr = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const lastMonthEndStr = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const periodStartStr = format(subDays(today, days - 1), 'yyyy-MM-dd')
  const prevPeriodStartStr = format(subDays(today, days * 2 - 1), 'yyyy-MM-dd')

  // Query from the earliest needed date
  const queryFrom = prevPeriodStartStr < lastMonthStartStr ? prevPeriodStartStr : lastMonthStartStr

  const [revenueBookings, allBookingsPeriod] = await Promise.all([
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salonId } },
          { date: { greater_than_equal: queryFrom } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      depth: 2,
      limit: 5000,
    }),
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salonId } },
          { date: { greater_than_equal: periodStartStr } },
        ],
      },
      depth: 0,
      limit: 5000,
    }),
  ])

  const docs = revenueBookings.docs as Booking[]

  const todayDocs = docs.filter(b => b.date === todayStr)
  const yesterdayDocs = docs.filter(b => b.date === yesterdayStr)
  const monthDocs = docs.filter(b => b.date >= monthStartStr)
  const lastMonthDocs = docs.filter(b => b.date >= lastMonthStartStr && b.date <= lastMonthEndStr)
  const periodDocs = docs.filter(b => b.date >= periodStartStr)
  const prevPeriodDocs = docs.filter(b => b.date >= prevPeriodStartStr && b.date < periodStartStr)

  const revenueToday = todayDocs.reduce((s, b) => s + getPrice(b), 0)
  const revenueYesterday = yesterdayDocs.reduce((s, b) => s + getPrice(b), 0)
  const revenueMonth = monthDocs.reduce((s, b) => s + getPrice(b), 0)
  const revenueLastMonth = lastMonthDocs.reduce((s, b) => s + getPrice(b), 0)
  const periodRevenue = periodDocs.reduce((s, b) => s + getPrice(b), 0)
  const prevPeriodRevenue = prevPeriodDocs.reduce((s, b) => s + getPrice(b), 0)
  const periodBookings = periodDocs.length
  const prevPeriodBookings = prevPeriodDocs.length

  // Trend: one entry per day
  const trend: DayData[] = Array.from({ length: days }, (_, i) => {
    const d = format(subDays(today, days - 1 - i), 'yyyy-MM-dd')
    const dayDocs = docs.filter(b => b.date === d)
    return {
      date: d,
      label: dayLabel(d, days),
      revenue: dayDocs.reduce((s, b) => s + getPrice(b), 0),
      bookings: dayDocs.length,
    }
  })

  // By service (current period)
  const serviceMap: Record<string, ServiceStat> = {}
  for (const b of periodDocs) {
    const svc = b.service as Service | string
    if (!svc || typeof svc !== 'object') continue
    const id = String(svc.id)
    if (!serviceMap[id]) serviceMap[id] = { name: svc.name, revenue: 0, bookings: 0 }
    serviceMap[id].revenue += svc.price ?? 0
    serviceMap[id].bookings += 1
  }
  const byService = Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6)

  // By staff (current period)
  const staffMap: Record<string, StaffStat> = {}
  for (const b of periodDocs) {
    const st = b.staff as StaffMember | string
    if (!st || typeof st !== 'object') continue
    const id = String(st.id)
    if (!staffMap[id]) staffMap[id] = { name: st.name, bookings: 0, revenue: 0 }
    staffMap[id].bookings += 1
    staffMap[id].revenue += getPrice(b)
  }
  const byStaff = Object.values(staffMap).sort((a, b) => b.bookings - a.bookings)

  // By day of week (current period)
  const DOW = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
  const dowCount = [0, 0, 0, 0, 0, 0, 0]
  for (const b of periodDocs) {
    const dow = (new Date(b.date + 'T00:00:00').getDay() + 6) % 7
    dowCount[dow]++
  }
  const byDayOfWeek: DowStat[] = DOW.map((day, i) => ({ day, bookings: dowCount[i] }))

  const maxDow = dowCount.indexOf(Math.max(...dowCount))
  const bestDay = dowCount[maxDow] > 0 ? DOW[maxDow] : null

  // By hour (current period, 07:00–21:00)
  const hourCountMap: Record<string, number> = {}
  for (const b of periodDocs) {
    if (!b.start_time) continue
    const h = b.start_time.split(':')[0]
    hourCountMap[h] = (hourCountMap[h] ?? 0) + 1
  }
  const byHour: HourStat[] = Array.from({ length: 15 }, (_, i) => {
    const h = String(i + 7).padStart(2, '0')
    return { hour: `${h}:00`, bookings: hourCountMap[h] ?? 0 }
  })

  const bestHourKey = Object.entries(hourCountMap).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bestHour = bestHourKey ? `${bestHourKey}:00` : null

  const avgBookingValue = periodDocs.length > 0 ? Math.round(periodRevenue / periodDocs.length) : 0

  const finalized = allBookingsPeriod.docs.filter(b => b.status !== 'pending')
  const completed = finalized.filter(b => b.status === 'completed')
  const completionRate = finalized.length > 0 ? Math.round((completed.length / finalized.length) * 100) : 0

  return {
    period: days,
    revenueToday,
    revenueTodayDiff: pctDiff(revenueToday, revenueYesterday),
    revenueMonth,
    revenueMonthDiff: pctDiff(revenueMonth, revenueLastMonth),
    bookingsToday: todayDocs.length,
    bookingsTodayDiff: pctDiff(todayDocs.length, yesterdayDocs.length),
    bookingsMonth: monthDocs.length,
    bookingsMonthDiff: pctDiff(monthDocs.length, lastMonthDocs.length),
    periodRevenue,
    periodRevenueDiff: pctDiff(periodRevenue, prevPeriodRevenue),
    periodBookings,
    periodBookingsDiff: pctDiff(periodBookings, prevPeriodBookings),
    avgBookingValue,
    completionRate,
    trend,
    byService,
    byStaff,
    byDayOfWeek,
    byHour,
    bestDay,
    bestHour,
  }
}
