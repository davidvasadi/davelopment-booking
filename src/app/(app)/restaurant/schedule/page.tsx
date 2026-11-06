import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { CalendarView } from '@/components/dashboard/CalendarView'
import type { StaffVM, ShiftVM, ShiftType } from '@/lib/schedule'
import { roleLabel } from '@/lib/permissions'
import { fixMediaUrl } from '@/lib/utils'
import type { Membership, Shift, User, Role, OpeningHoursException } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function toYmd(iso: string): string {
  return iso.slice(0, 10)
}
function mediaUrl(m: unknown): string | null {
  return m && typeof m === 'object' && 'url' in m && typeof (m as { url?: unknown }).url === 'string' ? fixMediaUrl((m as { url: string }).url) : null
}

/**
 * ÉTTEREM BEOSZTÁS — a csapat-tagok (memberships) havi műszakjai. A Naptár nézetet (CalendarView)
 * étterem-variánsban használjuk: a „staff" itt a memberships-lista, a shift-CRUD
 * `member`+`restaurant` párral megy az /api/shifts-en. SMS sehol.
 */
export default async function RestaurantSchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: dateParam } = await searchParams
  const initialDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined
  const { restaurant, capabilities } = await getOwnedRestaurant()
  // Naptár: `schedule.view.own` elegendő a megtekintéshez; `schedule.manage` kell a szerkesztéshez.
  requireAnyCapability(capabilities, ['schedule.manage', 'schedule.manage.own', 'schedule.view.own'], '/restaurant')
  const canManage = can(capabilities, 'schedule.manage')
  const payload = await getPayloadClient()

  const [membersRes, shiftsRes, exceptionsRes, weeklyClosedRes] = await Promise.all([
    payload.find({
      // AKTÍV + MEGHÍVOTT tagok is: a meghívottakat is be lehessen osztani (különben üres a lista,
      // amíg senki nem fogadta el a meghívót → a Beosztás használhatatlan).
      collection: 'memberships',
      where: { restaurant: { equals: restaurant.id }, status: { in: ['active', 'invited'] } },
      sort: 'createdAt',
      depth: 1,
      limit: 500,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'shifts',
      where: { restaurant: { equals: restaurant.id } },
      sort: 'date',
      // depth 1: a táppénzes papír neve / mérete (a tag is objektumként jön — a staffId ezt kezeli)
      depth: 1,
      limit: 5000,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'opening-hours-exceptions',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { is_closed: { equals: true } }] },
      depth: 0,
      limit: 500,
      overrideAccess: true,
    }),
    // Heti visszatérő zárvatartás (pl. "minden vasárnap zárva") — a szalon oldalihoz hasonlóan.
    payload.find({
      collection: 'opening-hours',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { is_open: { equals: false } }] },
      depth: 0,
      limit: 20,
      overrideAccess: true,
    }),
  ])

  // Tartomány → egyedi napok listája
  const closedDates: string[] = (exceptionsRes.docs as OpeningHoursException[]).flatMap((e) => {
    const dates: string[] = []
    const cur = new Date(e.start_date)
    const end = new Date(e.end_date)
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  })
  const DOW_NUM: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
  const closedWeekdays = Array.from(new Set((weeklyClosedRes.docs as { day_of_week?: string | null }[]).map((e) => DOW_NUM[e.day_of_week ?? '']).filter((n): n is number => n != null)))

  const members: StaffVM[] = (membersRes.docs as Membership[]).map((m) => {
    const u = typeof m.user === 'object' ? (m.user as User) : null
    const name = m.name || u?.name || m.email
    // Egységes: a megjelenített szerep a megadott (egyedi) szerep NEVE, ha van; különben a régi mezők.
    const custom = m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role) : null
    return {
      id: String(m.id),
      name,
      ini: initials(name),
      avatarUrl: mediaUrl(m.avatar) ?? fixMediaUrl(u?.avatar_url),
      role: (custom?.name || m.position || roleLabel(m.role)) + (m.status !== 'active' ? ' · meghívva' : ''),
      birthday: m.birthday ? toYmd(m.birthday) : null,
      join_date: m.join_date ? toYmd(m.join_date) : m.createdAt ? toYmd(m.createdAt) : null,
      weekly_hours: typeof m.weekly_hours === 'number' ? m.weekly_hours : null,
      annual_leave_days: typeof m.annual_leave_days === 'number' ? m.annual_leave_days : null,
      phone: m.phone ?? null,
      documents: [],
      pending: m.status !== 'active',
      tipEligible: !!m.tip_eligible,
    }
  })

  // A TULAJDONOS is beosztható (fedettség): a lista élére, id='owner'. Bér/borravaló NEKI nincs.
  const ownerId = restaurant.owner && typeof restaurant.owner === 'object' ? (restaurant.owner as User).id : restaurant.owner
  const ownerUser = ownerId ? ((await payload.findByID({ collection: 'users', id: ownerId, depth: 0, overrideAccess: true }).catch(() => null)) as User | null) : null
  const ownerName = ownerUser?.name || ownerUser?.email || 'Tulajdonos'
  const ownerStaff: StaffVM = { id: 'owner', name: ownerName, ini: initials(ownerName), avatarUrl: fixMediaUrl(ownerUser?.avatar_url), role: 'Tulajdonos', birthday: ownerUser?.birthday ? toYmd(ownerUser.birthday) : null, join_date: ownerUser?.join_date ? toYmd(ownerUser.join_date) : null, weekly_hours: ownerUser?.weekly_hours ?? null, phone: ownerUser?.phone ?? null, documents: [] }
  const staff: StaffVM[] = [ownerStaff, ...members]
  // bérköltség: a tag napidíja vagy órabére (a tulajdonosnak nincs)
  const pay = Object.fromEntries((membersRes.docs as Membership[]).filter((m) => typeof m.pay_rate === 'number' && m.pay_rate > 0).map((m) => [String(m.id), { type: (m.pay_type === 'hourly' ? 'hourly' : 'daily') as 'hourly' | 'daily', rate: m.pay_rate as number }]))

  const shifts: ShiftVM[] = (shiftsRes.docs as Shift[]).map((sh) => ({
    id: String(sh.id),
    staffId: sh.owner_shift ? 'owner' : String(typeof sh.member === 'object' && sh.member ? sh.member.id : sh.member),
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

  // Napi központi borravaló: dátum → összeg (a nap-szerkesztő bevitele + a profil havi összegzése).
  const dailyTips: Record<string, number> = {}
  for (const t of restaurant.daily_tips ?? []) {
    const d = (t.date ?? '').slice(0, 10)
    if (d && typeof t.amount === 'number') dailyTips[d] = t.amount
  }

  return (
    <div>
      <CalendarView
        variant="restaurant"
        staffPageHref={can(capabilities, 'staff.view') || can(capabilities, 'staff.manage') ? '/restaurant/staff' : null}
        restaurantId={String(restaurant.id)}
        staff={staff}
        shifts={shifts}
        dailyTips={dailyTips}
        // a bér csak a csapatot kezelőnek megy le a böngészőbe
        pay={canManage ? pay : {}}
        // a bér- és borravaló-összesítő (11.3) egyelőre rejtve — még nincs eldöntve, hová kerül
        showPayroll={false}
        closedDates={closedDates}
        closedWeekdays={closedWeekdays}
        canManage={canManage}
        initialDate={initialDate}
      />
    </div>
  )
}
