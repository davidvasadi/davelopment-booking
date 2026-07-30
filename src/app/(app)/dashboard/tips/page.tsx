import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getDashboardStats } from '@/lib/dashboardStats'
import { getPayloadClient } from '@/lib/payload'
import { buildSalonAdvisor, type SetupFlags } from '@/lib/tipsAdvisor'
import { TipsAdvisorView } from '@/components/dashboard/TipsAdvisorView'

export const metadata = { title: 'Tippek' }

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function SalonTipsPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'tips.view', '/dashboard')
  const payload = await getPayloadClient()

  const todayStr = ymd(new Date())
  const in14 = new Date()
  in14.setDate(in14.getDate() + 14)
  const in14Str = ymd(in14)

  const [stats, availRes, servicesRes, shiftsAheadRes, pendingBookRes] = await Promise.all([
    getDashboardStats(salon.id, 30),
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }, { exception_date: { exists: false } }] },
      limit: 1, depth: 0, overrideAccess: true,
    }),
    payload.find({
      collection: 'services',
      where: { salon: { equals: salon.id } },
      limit: 1, depth: 0, overrideAccess: true,
    }),
    // Csak schedule.manage joggal rendelkezőknek kérdezzük le
    can(capabilities, 'schedule.manage')
      ? payload.find({
          collection: 'shifts',
          where: { and: [{ salon: { equals: salon.id } }, { date: { greater_than_equal: todayStr } }, { date: { less_than_equal: in14Str } }] },
          limit: 1, depth: 0, overrideAccess: true,
        })
      : null,
    // Csak bookings.manage joggal rendelkezőknek
    can(capabilities, 'bookings.manage')
      ? payload.find({
          collection: 'bookings',
          where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'pending' } }] },
          limit: 1, depth: 0, overrideAccess: true,
        })
      : null,
  ])

  const setup: SetupFlags = {
    openingHours: availRes.totalDocs > 0,
    catalog: servicesRes.totalDocs > 0,
    scheduleFilledAhead: shiftsAheadRes ? shiftsAheadRes.totalDocs > 0 : undefined,
    hasPendingBookings: pendingBookRes ? pendingBookRes.totalDocs > 0 : undefined,
  }

  const data = buildSalonAdvisor(salon, setup, stats, capabilities)

  return <TipsAdvisorView variant="salon" data={data} apiBase={`/api/salons/${salon.id}`} />
}
