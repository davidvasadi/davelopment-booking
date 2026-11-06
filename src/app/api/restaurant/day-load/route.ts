import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getClosedDays } from '@/lib/closedDays'
import type { Reservation } from '@/payload/payload-types'

const ACTIVE_STATUSES = ['pending', 'confirmed', 'seated', 'completed']

/**
 * GET /api/restaurant/day-load?month=YYYY-MM — az aktív étterem adott havi napi terheltsége
 * (aznapi, aktív foglalások száma), a dátumválasztó naptár színezéséhez.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = req.nextUrl.searchParams.get('month')
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Érvénytelen hónap' }, { status: 400 })
  }

  const { active } = await getActiveBusiness(user)
  if (!active || active.type !== 'restaurant') {
    return NextResponse.json({ error: 'Nincs aktív étterem' }, { status: 403 })
  }

  const [y, m] = month.split('-').map(Number)
  const monthStart = `${month}-01`
  const nextMonth = new Date(y, m, 1) // m már 1-alapú → a KÖVETKEZŐ hónap 1-je
  const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reservations',
    where: {
      and: [
        { restaurant: { equals: active.id } },
        { date: { greater_than_equal: monthStart } },
        { date: { less_than: monthEnd } },
        { status: { in: ACTIVE_STATUSES.join(',') } },
      ],
    },
    limit: 3000,
    depth: 0,
    overrideAccess: true,
  })

  const counts: Record<string, number> = {}
  for (const r of res.docs as Reservation[]) {
    counts[r.date] = (counts[r.date] ?? 0) + 1
  }

  // a hónap zárt napjai (a dátumválasztó csíkozza őket — design 6.9)
  const { closedDates, closedWeekdays } = await getClosedDays(payload, 'restaurant', active.id)
  return NextResponse.json({ counts, closedDates: closedDates.filter((d) => d.startsWith(month)), closedWeekdays })
}
