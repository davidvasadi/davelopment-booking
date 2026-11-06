import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { CalendarView } from '@/components/dashboard/CalendarView'
import type { StaffVM, ShiftVM, ShiftType } from '@/lib/schedule'
import type { StaffMember, Shift, Media, Availability } from '@/payload/payload-types'
import { fixMediaUrl } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function toYmd(iso: string): string {
  return iso.slice(0, 10)
}
function sizeLabel(m: Media | null): string {
  if (!m || typeof m.filesize !== 'number') return ''
  const kb = m.filesize / 1024
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} kb`
}
function mediaUrl(m: unknown): string | null {
  return m && typeof m === 'object' && typeof (m as Media).url === 'string' ? fixMediaUrl((m as Media).url as string) : null
}

export default async function SalonSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams
  const initialDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined
  const [{ salon, capabilities }, user] = await Promise.all([getOwnedSalon(), getCurrentUser()])
  requireAnyCapability(capabilities, ['schedule.manage', 'schedule.manage.own', 'schedule.view.own'], '/dashboard')
  const canManage = can(capabilities, 'schedule.manage')
  // schedule.manage.own: saját műszak szerkesztése (szalon-stylist önálló időbeosztás)
  const canManageOwn = can(capabilities, 'schedule.manage.own')
  const payload = await getPayloadClient()

  const [staffRes, shiftsRes, exceptionsRes, weeklyClosedRes] = await Promise.all([
    payload.find({
      collection: 'staff',
      where: { salon: { equals: salon.id }, is_active: { equals: true } },
      sort: 'name',
      depth: 1,
      limit: 500,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'shifts',
      where: { salon: { equals: salon.id } },
      sort: 'date',
      // depth 1: a táppénzes papír neve / mérete (a munkatárs is objektumként jön — a staffId ezt kezeli)
      depth: 1,
      limit: 5000,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }, { exception_date: { exists: true } }, { is_available: { equals: false } }] },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
    // Heti visszatérő zárvatartás (pl. "minden vasárnap zárva") — a szalon-szintű alap-mintában
    // MINDEN naphoz van rekord (nyitva/zárva), ezért a zárt napokat is directben lekérdezhetjük.
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }, { recurring: { equals: true } }, { is_available: { equals: false } }] },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    }),
  ])

  const closedDates = (exceptionsRes.docs as Availability[])
    .map((e) => e.exception_date)
    .filter((d): d is string => !!d)
  const DOW_NUM: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const closedWeekdays = Array.from(new Set((weeklyClosedRes.docs as Availability[]).map((e) => DOW_NUM[e.day_of_week ?? '']).filter((n): n is number => n != null)))

  // Meghívóra váró (még nem elfogadott) tagok — amíg nem fogadják el, nem oszthatók be
  // műszakra (lakat + UX infó a szakember-választón, ld. ShiftEditor).
  const invitedRes = await payload.find({
    collection: 'memberships',
    where: { and: [{ salon: { equals: salon.id } }, { status: { equals: 'invited' } }] },
    depth: 0, limit: 500, overrideAccess: true,
  })
  const invitedEmails = new Set((invitedRes.docs as { email?: string | null }[]).map((m) => (m.email ?? '').toLowerCase()).filter(Boolean))

  // Fallback-avatar EMAIL alapján (lásd `dashboard/staff/page.tsx` azonos komment) — ha a
  // tulaj sosem töltött fel külön staff-avatart, de a személy a SAJÁT profiljában igen.
  const scheduleStaffEmails = (staffRes.docs as StaffMember[]).map((s) => s.email).filter((e): e is string => !!e)
  const scheduleAvatarByEmail: Record<string, string> = {}
  if (scheduleStaffEmails.length > 0) {
    const usersRes = await payload.find({
      collection: 'users',
      where: { email: { in: scheduleStaffEmails } },
      depth: 0, limit: 500, overrideAccess: true,
    })
    for (const u of usersRes.docs as { email?: string | null; avatar_url?: string | null }[]) {
      const fixed = fixMediaUrl(u.avatar_url)
      if (u.email && fixed) scheduleAvatarByEmail[u.email.toLowerCase()] = fixed
    }
  }

  const allStaff: StaffVM[] = (staffRes.docs as StaffMember[]).map((s) => ({
    id: String(s.id),
    name: s.name,
    ini: initials(s.name),
    avatarUrl: mediaUrl(s.avatar) ?? (s.email ? (scheduleAvatarByEmail[s.email.toLowerCase()] ?? null) : null),
    role: s.role_title ?? '',
    pending: invitedEmails.has((s.email ?? '').toLowerCase()),
    birthday: s.birthday ? toYmd(s.birthday) : null,
    join_date: s.join_date ? toYmd(s.join_date) : null,
    weekly_hours: typeof s.weekly_hours === 'number' ? s.weekly_hours : null,
    annual_leave_days: typeof s.annual_leave_days === 'number' ? s.annual_leave_days : null,
    phone: s.phone ?? null,
    documents: (s.documents ?? []).map((d) => ({
      label: d.label ?? 'Dokumentum',
      sizeLabel: sizeLabel(d.file && typeof d.file === 'object' ? (d.file as Media) : null),
    })),
  }))

  const allShifts: ShiftVM[] = (shiftsRes.docs as Shift[])
    .filter((sh) => sh.staff != null)
    .map((sh) => ({
    id: String(sh.id),
    staffId: String(typeof sh.staff === 'object' && sh.staff !== null ? sh.staff.id : sh.staff),
    date: toYmd(sh.date),
    type: sh.type as ShiftType,
    start_time: sh.start_time ?? null,
    end_time: sh.end_time ?? null,
    hours: typeof sh.hours === 'number' ? sh.hours : null,
    breaks: sh.breaks ?? [],
    note: sh.note ?? null,
    left_early_at: sh.left_early_at ?? null,
    left_early_reason: (sh.left_early_reason ?? null) as 'sick' | 'personal' | null,
    paid: !!sh.paid,
    sickNote: sh.sick_note && typeof sh.sick_note === 'object' ? { filename: sh.sick_note.filename ?? 'táppénzes papír', mimeType: sh.sick_note.mimeType ?? null, filesize: sh.sick_note.filesize ?? null } : null,
  }))

  // A bejelentkezett user staff-rekordjának megkeresése email alapján.
  const myStaffRaw = user?.email ? (staffRes.docs as StaffMember[]).find((s) => s.email === user.email) : null
  const myStaffId = myStaffRaw ? String(myStaffRaw.id) : undefined

  // Saját-nézet: view.own VAGY manage.own (mindkét esetben csak saját adat, nincs csapatlista).
  // manage.own esetén a CalendarView-ban canManage=true, mert csak saját embert lát → szerkeszthet.
  const isOwnOnly = !canManage
  const staff = canManage ? allStaff : (myStaffRaw ? [allStaff.find((s) => s.id === myStaffId)!].filter(Boolean) : allStaff)
  const shifts = canManage ? allShifts : allShifts.filter((s) => s.staffId === myStaffId)

  // bérköltség: a munkatárs havi bére
  const pay = Object.fromEntries((staffRes.docs as StaffMember[]).filter((s) => typeof s.salary === 'number' && s.salary > 0).map((s) => [String(s.id), { type: 'monthly' as const, rate: s.salary as number }]))

  return (
    <div>
      <CalendarView
        variant="salon"
        staffPageHref={can(capabilities, 'staff.view') || can(capabilities, 'staff.manage') ? '/dashboard/staff' : null}
        salonId={String(salon.id)}
        staff={staff}
        shifts={shifts}
        // a bér csak a csapatot kezelőnek megy le a böngészőbe
        pay={canManage ? pay : {}}
        // a bér- és borravaló-összesítő (11.3) egyelőre rejtve — még nincs eldöntve, hová kerül
        showPayroll={false}
        closedDates={closedDates}
        closedWeekdays={closedWeekdays}
        canManage={canManage || (isOwnOnly && canManageOwn)}
        myStaffId={myStaffId}
        initialDate={initialDate}
      />
    </div>
  )
}
