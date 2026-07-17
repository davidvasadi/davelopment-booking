import { getOwnedSalon } from '@/lib/salonContext'
import { requireCapability } from '@/lib/requireCapability'
import { getPayloadClient } from '@/lib/payload'
import type { StaffMember, Shift } from '@/payload/payload-types'
import StaffManager from '@/components/dashboard/StaffManager'
import { getStaffStats } from '@/lib/staffStats'
import { getTeamRoster } from '@/lib/teamRoster'

export default async function StaffPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireCapability(capabilities, 'staff.view', '/dashboard')
  const payload = await getPayloadClient()

  const todayYmd = new Date().toISOString().slice(0, 10)

  const [staffResult, stats, shiftsRes, roster] = await Promise.all([
    payload.find({
      collection: 'staff',
      where: { salon: { equals: salon.id } },
      sort: 'name',
      depth: 1,
      limit: 100,
    }),
    getStaffStats(salon.id),
    payload.find({
      collection: 'shifts',
      where: { salon: { equals: salon.id }, type: { equals: 'shift' }, date: { greater_than_equal: todayYmd } },
      sort: 'date',
      depth: 0,
      limit: 2000,
      overrideAccess: true,
    }),
    getTeamRoster('salon', salon.id),
  ])

  // staffId → közelgő (legkorábbi jövőbeli) műszak címkéje. VALÓS a Shifts-ből.
  const upcomingShiftById: Record<string, string> = {}
  for (const sh of shiftsRes.docs as Shift[]) {
    if (sh.staff == null) continue
    const sid = String(typeof sh.staff === 'object' ? sh.staff.id : sh.staff)
    if (upcomingShiftById[sid]) continue
    const day = new Date(sh.date).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })
    const time = sh.start_time && sh.end_time ? `${sh.start_time}–${sh.end_time}` : sh.start_time ?? ''
    upcomingShiftById[sid] = time ? `${day} · ${time}` : day
  }

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <StaffManager
        salonId={salon.id}
        initialStaff={staffResult.docs as StaffMember[]}
        supportedLocales={salon.supported_locales ?? null}
        bookingsById={stats.bookingsById}
        servicesById={stats.servicesById}
        ratingById={stats.ratingById}
        totalBookings={stats.totalBookings}
        avgRating={stats.avgRating}
        upcomingShiftById={upcomingShiftById}
        employees={roster}
      />
    </div>
  )
}
