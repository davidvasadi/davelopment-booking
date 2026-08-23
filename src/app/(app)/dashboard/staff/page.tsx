import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import type { StaffMember, Shift, Service, User } from '@/payload/payload-types'
import StaffManager from '@/components/dashboard/StaffManager'
import { getStaffStats } from '@/lib/staffStats'
import { getTeamRoster } from '@/lib/teamRoster'
import { fixMediaUrl } from '@/lib/utils'

export default async function StaffPage() {
  const { salon, capabilities, userEmail } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['staff.view', 'staff.manage'], '/dashboard')
  const payload = await getPayloadClient()

  const now = new Date()
  const todayYmd = now.toISOString().slice(0, 10)
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const ownerUserId = salon.owner && typeof salon.owner === 'object' ? (salon.owner as { id: string | number }).id : salon.owner as string | number | null
  const ownerUserRaw = ownerUserId ? await payload.findByID({ collection: 'users', id: ownerUserId, depth: 0, overrideAccess: true }).catch(() => null) : null
  const ownerUser = ownerUserRaw ? { name: (ownerUserRaw as { name?: string }).name ?? null, email: (ownerUserRaw as { email?: string }).email ?? null, avatar_url: (ownerUserRaw as { avatar_url?: string }).avatar_url ?? null, join_date: (ownerUserRaw as { join_date?: string }).join_date ?? null, createdAt: (ownerUserRaw as { createdAt?: string }).createdAt ?? null, role_title: (ownerUserRaw as { role_title?: string }).role_title ?? null } : null

  const [staffResult, stats, shiftsRes, roster, servicesRes, invitedRes, rolesRes] = await Promise.all([
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
      where: { and: [{ salon: { equals: salon.id } }, { date: { greater_than_equal: monthStart } }] },
      sort: 'date',
      depth: 0,
      limit: 5000,
      overrideAccess: true,
    }),
    getTeamRoster('salon', salon.id),
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { equals: true } }] },
      sort: 'name',
      depth: 0,
      limit: 200,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'memberships',
      where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'invited' } }] },
      depth: 0,
      limit: 200,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'roles',
      where: { salon: { equals: salon.id } },
      depth: 0,
      limit: 100,
      overrideAccess: true,
    }),
  ])

  const allMonthShifts = shiftsRes.docs as Shift[]
  const invitedEmails = new Set(invitedRes.docs.map((m) => (m as { email?: string }).email?.toLowerCase() ?? '').filter(Boolean))
  const salonRoles = rolesRes.docs.map((r) => ({ id: String(r.id), name: (r as { name?: string }).name ?? '' }))

  // Fallback-avatar a STAFF-hoz EMAIL alapján (a `staff` collectionnak nincs `user` relációja,
  // csak email-mező) — ha a tulaj sosem töltött fel külön staff-avatart, de a személy a SAJÁT
  // profiljában igen (`Users.avatar_url`), azt mutatjuk. Az étteremi Munkatársak oldal ezt már
  // tudta (`userAvatarByEmail`), a szalon oldalról hiányzott.
  const staffEmails = (staffResult.docs as StaffMember[]).map((s) => s.email).filter((e): e is string => !!e)
  const avatarUrlByEmail: Record<string, string> = {}
  if (staffEmails.length > 0) {
    const usersRes = await payload.find({
      collection: 'users',
      where: { email: { in: staffEmails } },
      depth: 0, limit: 500, overrideAccess: true,
    })
    for (const u of usersRes.docs as User[]) {
      const fixed = fixMediaUrl(u.avatar_url)
      if (u.email && fixed) avatarUrlByEmail[u.email.toLowerCase()] = fixed
    }
  }

  // staffId → közelgő (legkorábbi jövőbeli) műszak címkéje.
  const upcomingShiftById: Record<string, string> = {}
  for (const sh of allMonthShifts) {
    if (sh.staff == null || sh.date.slice(0, 10) < todayYmd || sh.type !== 'shift') continue
    const sid = String(typeof sh.staff === 'object' ? sh.staff.id : sh.staff)
    if (upcomingShiftById[sid]) continue
    const day = new Date(sh.date).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })
    const time = sh.start_time && sh.end_time ? `${sh.start_time}–${sh.end_time}` : sh.start_time ?? ''
    upcomingShiftById[sid] = time ? `${day} · ${time}` : day
  }

  // staffId → szabad napok száma e hónapban (daysInMonth − beosztott napok).
  const freeDaysById: Record<string, number> = {}
  for (const s of staffResult.docs as StaffMember[]) {
    const sid = String(s.id)
    const scheduled = new Set(
      allMonthShifts
        .filter((sh) => sh.staff != null && String(typeof sh.staff === 'object' ? sh.staff.id : sh.staff) === sid)
        .map((sh) => sh.date.slice(0, 10))
    )
    freeDaysById[sid] = daysInMonth - scheduled.size
  }

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <StaffManager
        salonId={salon.id}
        initialStaff={staffResult.docs as StaffMember[]}
        salonServices={servicesRes.docs as Service[]}
        supportedLocales={salon.supported_locales ?? null}
        bookingsById={stats.bookingsById}
        servicesById={stats.servicesById}
        ratingById={stats.ratingById}
        totalBookings={stats.totalBookings}
        avgRating={stats.avgRating}
        upcomingShiftById={upcomingShiftById}
        freeDaysById={freeDaysById}
        employees={roster}
        ownerUser={ownerUser}
        ownerUserId={ownerUserId != null ? String(ownerUserId) : null}
        avatarUrlByEmail={avatarUrlByEmail}
        invitedEmails={invitedEmails}
        salonRoles={salonRoles}
        canManage={can(capabilities, 'staff.manage')}
        canViewOthersSalary={can(capabilities, 'staff.salary')}
        viewerEmail={userEmail}
      />
    </div>
  )
}
