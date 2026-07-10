import { getPayloadClient } from '@/lib/payload'
import { getStaffStats } from '@/lib/staffStats'
import { roleLabel } from '@/lib/permissions'
import type { Employee } from '@/components/dashboard/HiringView'
import type { Shift, StaffMember, Membership, Media, User, Restaurant } from '@/payload/payload-types'

/**
 * VALÓS munkatárs-adatlap adat (a HiringView „Employee" VM-je) — a mock helyett.
 * Szalon = `staff` collection (teljes HR) + foglalás/szolgáltatás/értékelés (staffStats).
 * Étterem = `memberships` (HR-mezők a modellen) + műszak-statisztika. Étteremnél NINCS
 * per-fő foglalás/szolgáltatás (nem foglalható), ezért ott a tag-ek üresek.
 *
 * A műszak-statisztika (jelenlét %, ledolgozott/szabadság/beteg nap, havi órák, heti bontás)
 * a `shifts` collectionből számol; ahol nincs adat, 0 (valós üres, nem kamu).
 */

type Variant = 'salon' | 'restaurant'

function relId(rel: unknown): string | null {
  if (rel == null) return null
  if (typeof rel === 'object') {
    const id = (rel as { id?: number | string }).id
    return id != null ? String(id) : null
  }
  return String(rel)
}

function mediaUrl(m: unknown): string | null {
  if (m && typeof m === 'object') {
    const url = (m as Media).url
    return typeof url === 'string' && url ? url : null
  }
  return null
}

function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short' })
}

function contractLabel(weekly: number | null | undefined): string {
  if (weekly == null) return '—'
  return weekly >= 35 ? 'Teljes munkaidő' : 'Részmunkaidő'
}

/** Egy műszak órái: az explicit `hours`, különben start–end különbség, végül 0. */
function shiftHours(sh: Shift): number {
  if (typeof sh.hours === 'number') return sh.hours
  if (sh.start_time && sh.end_time) {
    const [sh1, sm1] = sh.start_time.split(':').map(Number)
    const [sh2, sm2] = sh.end_time.split(':').map(Number)
    const mins = (sh2 * 60 + sm2) - (sh1 * 60 + sm1)
    if (mins > 0) return Math.round((mins / 60) * 10) / 10
  }
  return 0
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Per-fő műszak-statisztika egy hónapra + az aktuális/előző hét napi óráira. */
function computeShiftStats(shifts: Shift[], now: Date = new Date()) {
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastYm = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`

  // Hét eleje (hétfő, helyi idő szerint) + előző hét eleje.
  const dow = (now.getDay() + 6) % 7 // 0 = hétfő
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
  const lastMonday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7)
  const weekKeys = Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)))
  const lastWeekKeys = Array.from({ length: 7 }, (_, i) => ymd(new Date(lastMonday.getFullYear(), lastMonday.getMonth(), lastMonday.getDate() + i)))

  let daysWorked = 0, vacationDays = 0, sickDays = 0, shiftsCount = 0, hoursThisMonth = 0, hoursLastMonth = 0
  const recent = Array(7).fill(0) as number[]
  const previous = Array(7).fill(0) as number[]
  const monthWeeks = Array(5).fill(0) as number[] // e hónap heti (1.-5.) óra-összegei
  const prevMonthWeeks = Array(5).fill(0) as number[] // előző hónap heti óra-összegei
  const calendar: Record<string, 'shift' | 'leave' | 'sick' | 'vacation'> = {}

  for (const sh of shifts) {
    const date = (sh.date ?? '').slice(0, 10)
    const hrs = shiftHours(sh)
    if (date && (!(date in calendar) || sh.type === 'shift')) calendar[date] = sh.type as 'shift' | 'leave' | 'sick' | 'vacation'
    if (date.startsWith(thisYm)) {
      if (sh.type === 'shift') {
        daysWorked += 1; shiftsCount += 1; hoursThisMonth += hrs
        monthWeeks[Math.min(4, Math.floor((Number(date.slice(8, 10)) - 1) / 7))] += hrs
      } else if (sh.type === 'vacation' || sh.type === 'leave') vacationDays += 1
      else if (sh.type === 'sick') sickDays += 1
    } else if (date.startsWith(lastYm)) {
      if (sh.type === 'shift') {
        hoursLastMonth += hrs
        prevMonthWeeks[Math.min(4, Math.floor((Number(date.slice(8, 10)) - 1) / 7))] += hrs
      }
    }
    if (sh.type === 'shift') {
      const wi = weekKeys.indexOf(date)
      if (wi >= 0) recent[wi] += hrs
      const li = lastWeekKeys.indexOf(date)
      if (li >= 0) previous[li] += hrs
    }
  }

  const denom = daysWorked + sickDays + vacationDays
  const attendance = denom > 0 ? Math.round((daysWorked / denom) * 100) : 0
  const todayYmd = ymd(now)
  const weeklyHours = Math.round(recent.reduce((a, b) => a + b, 0)) // e heti VALÓS órák a naptárból
  const onVacation = calendar[todayYmd] === 'vacation' || calendar[todayYmd] === 'leave'
  return {
    attendance, daysWorked, vacationDays, sickDays, shifts: shiftsCount,
    hoursThisMonth: Math.round(hoursThisMonth), hoursLastMonth: Math.round(hoursLastMonth),
    recent, previous, calendar, weeklyHours, onVacation,
    monthWeeks: monthWeeks.map((v) => Math.round(v)),
    prevMonthWeeks: prevMonthWeeks.map((v) => Math.round(v)),
  }
}

export async function getTeamRoster(variant: Variant, businessId: string | number): Promise<Employee[]> {
  const payload = await getPayloadClient()
  const now = new Date() // egyetlen „most" az egész roszterre → a havi számok (bér, órák, borravaló) ugyanarra a hónapra esnek

  // ── Műszakok az üzletre (mindkét variánsnál a shifts collection; a reláció más mezőn). ──
  const shiftsRes = await payload.find({
    collection: 'shifts',
    where: variant === 'salon' ? { salon: { equals: businessId } } : { restaurant: { equals: businessId } },
    depth: 0,
    limit: 5000,
    pagination: false,
    overrideAccess: true,
  })
  const shiftsByPerson: Record<string, Shift[]> = {}
  for (const sh of shiftsRes.docs as Shift[]) {
    const pid = relId(variant === 'salon' ? sh.staff : sh.member)
    if (!pid) continue
    ;(shiftsByPerson[pid] ??= []).push(sh)
  }

  if (variant === 'salon') {
    const [staffRes, stats] = await Promise.all([
      payload.find({ collection: 'staff', where: { salon: { equals: businessId } }, sort: 'name', depth: 1, limit: 500, overrideAccess: true }),
      getStaffStats(businessId),
    ])
    return (staffRes.docs as StaffMember[]).map((s): Employee => {
      const id = String(s.id)
      const st = computeShiftStats(shiftsByPerson[id] ?? [], now)
      return {
        id,
        name: s.name,
        avatarUrl: mediaUrl(s.avatar),
        position: s.role_title || s.department || '',
        roleTone: 'staff',
        email: s.email || '',
        phone: s.phone || '',
        since: fmtMonth(s.join_date),
        contract: contractLabel(s.weekly_hours),
        tags: stats.servicesById[id] ?? [],
        note: s.bio || '',
        status: s.is_active === false ? 'suspended' : 'active',
        ...st,
      }
    })
  }

  // ── Étterem: [tulaj-sor] + memberships. A LISTÁVAL AZONOS sorrend (tulaj elöl, majd a
  //    nem-owner tagok createdAt szerint) — hogy a sorra-kattintás indexe a jó embert nyissa. ──
  const [restRes, memRes] = await Promise.all([
    payload.findByID({ collection: 'restaurants', id: businessId, depth: 1, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'memberships', where: { restaurant: { equals: businessId } }, sort: 'createdAt', depth: 1, limit: 500, overrideAccess: true }),
  ])

  // ── Havi borravaló: a napi KÖZPONTI összeg / az aznap dolgozó JOGOSULTAK száma, e hónapra összegezve. ──
  const thisYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const rest = restRes as Restaurant | null
  const dailyTips: Record<string, number> = {}
  for (const t of rest?.daily_tips ?? []) {
    const d = (t.date ?? '').slice(0, 10)
    if (d && typeof t.amount === 'number') dailyTips[d] = t.amount
  }
  const eligibleIds = new Set(
    (memRes.docs as Membership[]).filter((m) => m.tip_eligible && m.role !== 'owner').map((m) => String(m.id)),
  )
  // Per nap: MELY jogosultak dolgoztak (type 'shift') — a Set miatt egy fő/nap egyszer számít.
  const eligibleByDate: Record<string, Set<string>> = {}
  for (const pid of eligibleIds) {
    for (const sh of shiftsByPerson[pid] ?? []) {
      if (sh.type !== 'shift') continue
      const d = (sh.date ?? '').slice(0, 10)
      if (d) (eligibleByDate[d] ??= new Set()).add(pid)
    }
  }
  const monthlyTips = (pid: string): number => {
    if (!eligibleIds.has(pid)) return 0
    const seen = new Set<string>()
    let sum = 0
    for (const sh of shiftsByPerson[pid] ?? []) {
      if (sh.type !== 'shift') continue
      const d = (sh.date ?? '').slice(0, 10)
      if (!d || seen.has(d) || !d.startsWith(thisYm)) continue
      seen.add(d)
      const amt = dailyTips[d]
      const cnt = eligibleByDate[d]?.size ?? 0
      if (amt && cnt > 0) sum += amt / cnt
    }
    return Math.round(sum)
  }

  const ownerRel = (restRes as Restaurant | null)?.owner
  const owner = ownerRel && typeof ownerRel === 'object' ? (ownerRel as User) : null
  // A tulaj coverage-műszakjai (owner_shift; nincs member) — csak fedettség-statisztika, bér/borravaló nélkül.
  const ownerShifts = (shiftsRes.docs as Shift[]).filter((sh) => sh.owner_shift)
  const ownerEmp: Employee = {
    id: 'owner',
    name: owner?.name || owner?.email || 'Tulajdonos',
    avatarUrl: owner?.avatar_url ?? null,
    position: 'Tulajdonos',
    roleTone: 'owner',
    email: owner?.email || '',
    phone: owner?.phone || '',
    since: fmtMonth(owner?.join_date),
    contract: contractLabel(owner?.weekly_hours),
    tags: [],
    note: owner?.bio || '',
    status: 'active',
    tipsThisMonth: 0,
    // Fiók-szintű adatlap (szerkeszthető) — a tulajnak nincs membershipje; bér/borravaló SOHA.
    hr: {
      birthday: owner?.birthday ?? null,
      address: owner?.address ?? null,
      tax_id: owner?.tax_id ?? null,
      emergency_contact: owner?.emergency_contact ?? null,
      weekly_hours: owner?.weekly_hours ?? null,
      join_date: owner?.join_date ?? null,
      salary: null,
      pay_type: 'daily',
      pay_rate: null,
      tip_eligible: false,
      suspended_at: null,
      position_history: [],
    },
    ...computeShiftStats(ownerShifts, now),
  }
  const members: Employee[] = (memRes.docs as Membership[])
    .filter((m) => m.role !== 'owner') // a tulaj-membershipet a külön owner-sor jeleníti meg
    .map((m) => {
      const id = String(m.id)
      const st = computeShiftStats(shiftsByPerson[id] ?? [], now)
      const user = typeof m.user === 'object' && m.user ? (m.user as User) : null
      return {
        id,
        name: m.name || user?.name || m.email,
        avatarUrl: mediaUrl(m.avatar) ?? (user?.avatar_url ?? null),
        position: m.position || roleLabel(m.role),
        roleTone: m.role,
        email: m.email || user?.email || '',
        phone: m.phone || '',
        since: fmtMonth(m.join_date ?? m.createdAt),
        contract: contractLabel(m.weekly_hours),
        tags: [],
        note: m.bio || '',
        status: (m.status ?? 'invited') as 'active' | 'invited' | 'suspended',
        tipsThisMonth: monthlyTips(id),
        hr: {
          birthday: m.birthday ?? null,
          address: m.address ?? null,
          tax_id: m.tax_id ?? null,
          emergency_contact: m.emergency_contact ?? null,
          weekly_hours: m.weekly_hours ?? null,
          join_date: m.join_date ?? null,
          salary: m.salary ?? null,
          pay_type: (m.pay_type ?? 'daily') as 'daily' | 'hourly',
          pay_rate: m.pay_rate ?? null,
          tip_eligible: !!m.tip_eligible,
          suspended_at: m.suspended_at ?? null,
          position_history: (m.position_history ?? [])
            .map((h) => ({ position: h.position ?? '', changed_at: (h.changed_at ?? '').slice(0, 10) }))
            .filter((h) => h.position),
        },
        ...st,
      }
    })
  return [ownerEmp, ...members]
}
