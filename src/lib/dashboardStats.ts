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

export interface DashboardStats {
  revenueToday: number
  revenueTodayDiff: number
  revenueMonth: number
  revenueMonthDiff: number
  bookingsToday: number
  bookingsTodayDiff: number
  bookingsMonth: number
  bookingsMonthDiff: number
  avgBookingValue: number
  completionRate: number
  last30Days: DayData[]
  byService: ServiceStat[]
  byStaff: StaffStat[]
  byDayOfWeek: DowStat[]
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

export async function getDashboardStats(salonId: string | number): Promise<DashboardStats> {
  const payload = await getPayloadClient()

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd')
  const monthStartStr = format(startOfMonth(today), 'yyyy-MM-dd')
  const lastMonthStartStr = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const lastMonthEndStr = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
  const thirtyDaysAgoStr = format(subDays(today, 29), 'yyyy-MM-dd')

  // Single query: all non-cancelled bookings from last month start
  const [revenueBookings, allBookings30] = await Promise.all([
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salonId } },
          { date: { greater_than_equal: lastMonthStartStr } },
          { status: { not_equals: 'cancelled' } },
        ],
      },
      depth: 2,
      limit: 2000,
    }),
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          { salon: { equals: salonId } },
          { date: { greater_than_equal: thirtyDaysAgoStr } },
        ],
      },
      depth: 0,
      limit: 2000,
    }),
  ])

  const docs = revenueBookings.docs as Booking[]

  // Segment by period
  const todayDocs = docs.filter(b => b.date === todayStr)
  const yesterdayDocs = docs.filter(b => b.date === yesterdayStr)
  const monthDocs = docs.filter(b => b.date >= monthStartStr)
  const lastMonthDocs = docs.filter(b => b.date >= lastMonthStartStr && b.date <= lastMonthEndStr)
  const last30Docs = docs.filter(b => b.date >= thirtyDaysAgoStr)

  // KPIs
  const revenueToday = todayDocs.reduce((s, b) => s + getPrice(b), 0)
  const revenueYesterday = yesterdayDocs.reduce((s, b) => s + getPrice(b), 0)
  const revenueMonth = monthDocs.reduce((s, b) => s + getPrice(b), 0)
  const revenueLastMonth = lastMonthDocs.reduce((s, b) => s + getPrice(b), 0)

  // Last 30 days chart
  const last30Days: DayData[] = Array.from({ length: 30 }, (_, i) => {
    const d = format(subDays(today, 29 - i), 'yyyy-MM-dd')
    const dayDocs = docs.filter(b => b.date === d)
    return {
      date: d,
      label: format(new Date(d + 'T00:00:00'), 'MMM d.', { locale: hu }),
      revenue: dayDocs.reduce((s, b) => s + getPrice(b), 0),
      bookings: dayDocs.length,
    }
  })

  // By service (last 30 days)
  const serviceMap: Record<string, ServiceStat> = {}
  for (const b of last30Docs) {
    const svc = b.service as Service | string
    if (!svc || typeof svc !== 'object') continue
    const id = String(svc.id)
    if (!serviceMap[id]) serviceMap[id] = { name: svc.name, revenue: 0, bookings: 0 }
    serviceMap[id].revenue += svc.price ?? 0
    serviceMap[id].bookings += 1
  }
  const byService = Object.values(serviceMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6)

  // By staff (last 30 days)
  const staffMap: Record<string, StaffStat> = {}
  for (const b of last30Docs) {
    const st = b.staff as StaffMember | string
    if (!st || typeof st !== 'object') continue
    const id = String(st.id)
    if (!staffMap[id]) staffMap[id] = { name: st.name, bookings: 0, revenue: 0 }
    staffMap[id].bookings += 1
    staffMap[id].revenue += getPrice(b)
  }
  const byStaff = Object.values(staffMap).sort((a, b) => b.bookings - a.bookings)

  // By day of week (Mon–Sun, last 30 days)
  const DOW = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
  const dowCount = [0, 0, 0, 0, 0, 0, 0]
  for (const b of last30Docs) {
    const dow = (new Date(b.date + 'T00:00:00').getDay() + 6) % 7
    dowCount[dow]++
  }
  const byDayOfWeek: DowStat[] = DOW.map((day, i) => ({ day, bookings: dowCount[i] }))

  // Best day
  const maxDow = dowCount.indexOf(Math.max(...dowCount))
  const bestDay = dowCount[maxDow] > 0 ? DOW[maxDow] : null

  // Best hour (from start_time)
  const hourCount: Record<string, number> = {}
  for (const b of last30Docs) {
    if (!b.start_time) continue
    const h = b.start_time.split(':')[0]
    hourCount[h] = (hourCount[h] ?? 0) + 1
  }
  const bestHourKey = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  const bestHour = bestHourKey ? `${bestHourKey}:00` : null

  // Avg booking value (last 30 days)
  const totalRev30 = last30Docs.reduce((s, b) => s + getPrice(b), 0)
  const avgBookingValue = last30Docs.length > 0 ? Math.round(totalRev30 / last30Docs.length) : 0

  // Completion rate (last 30 days, excluding pending)
  const finalized = allBookings30.docs.filter(b => b.status !== 'pending')
  const completed = finalized.filter(b => b.status === 'completed')
  const completionRate = finalized.length > 0 ? Math.round((completed.length / finalized.length) * 100) : 0

  return {
    revenueToday,
    revenueTodayDiff: pctDiff(revenueToday, revenueYesterday),
    revenueMonth,
    revenueMonthDiff: pctDiff(revenueMonth, revenueLastMonth),
    bookingsToday: todayDocs.length,
    bookingsTodayDiff: pctDiff(todayDocs.length, yesterdayDocs.length),
    bookingsMonth: monthDocs.length,
    bookingsMonthDiff: pctDiff(monthDocs.length, lastMonthDocs.length),
    avgBookingValue,
    completionRate,
    last30Days,
    byService,
    byStaff,
    byDayOfWeek,
    bestDay,
    bestHour,
  }
}
