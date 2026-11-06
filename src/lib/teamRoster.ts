import { getPayloadClient } from '@/lib/payload'
import { num, rawQuery, shiftsSince, sql } from '@/lib/fastRead'
import { fixMediaUrl } from '@/lib/utils'
import type { TeamDoc, TeamMemberVM, TeamStatus } from '@/lib/teamTypes'
import type { Shift, StaffMember, Membership, Media, User, Restaurant, Role, Booking, Service } from '@/payload/payload-types'

/**
 * A Munkatársak oldal (design 10.x) adatai VALÓS adatból — szalon és étterem közösen.
 * Szalon = `staff` (foglalható profilok) + a párosított `memberships` (e-mail alapján: szerep, meghívó) + foglalások.
 * Étterem = `memberships` (HR-mezők a modellen), nem foglalható; a havi szám a ledolgozott óra és a borravaló.
 * Az órák a `shifts`-ből számolnak; ahol nincs adat, 0 (valós üres).
 */

type Variant = 'salon' | 'restaurant'

const relId = (rel: unknown): string | null => {
  if (rel == null) return null
  if (typeof rel === 'object') { const id = (rel as { id?: number | string }).id; return id != null ? String(id) : null }
  return String(rel)
}
const mediaUrl = (m: unknown): string | null => (m && typeof m === 'object' && (m as Media).url ? fixMediaUrl((m as Media).url) ?? null : null)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mins = (t?: string | null) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null }
const docsOf = (list: unknown): TeamDoc[] => (Array.isArray(list) ? list : []).map((d: { label?: string | null; file?: unknown }) => ({
  label: d.label ?? '', fileId: d.file && typeof d.file === 'object' ? Number((d.file as Media).id) : d.file != null ? Number(d.file) : null, url: mediaUrl(d.file),
}))
const roleName = (m: Membership | null | undefined): string => {
  if (!m) return '—'
  if (m.role === 'owner') return 'Tulajdonos'
  if (m.custom_role && typeof m.custom_role === 'object') return (m.custom_role as Role).name
  return m.role === 'manager' ? 'Vezető' : 'Nincs szerep'
}

/** Egy műszak órái: az explicit `hours`, különben start–end különbség. */
function shiftHours(sh: Shift): number {
  if (typeof sh.hours === 'number') return sh.hours
  const a = mins(sh.start_time), b = mins(sh.end_time)
  return a != null && b != null && b > a ? Math.round(((b - a) / 60) * 10) / 10 : 0
}

/** Per-fő műszak-számok: e hónap, előző hónap, e hét, az év havi órái. */
function shiftStats(shifts: Shift[], now: Date) {
  const thisYm = ymd(now).slice(0, 7)
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastYm = ymd(last).slice(0, 7)
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))))
  const year = String(now.getFullYear())
  let daysWorked = 0, vacationDays = 0, sickDays = 0, count = 0, hours = 0, hoursPrev = 0, weekHours = 0, weekMinutes = 0
  const weeks = [0, 0, 0, 0, 0]
  // a ledolgozott órák kártya görbéi: e hónap és az előző hónap napi órái (utána napról napra összeadva — gyűlő görbe;
  // heti összegekből egyenletes beosztásnál egyenes vonal lenne)
  const daysThis = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLast = new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  const dayThis = Array(daysThis).fill(0) as number[]
  const dayLast = Array(daysLast).fill(0) as number[]
  const series = Array(12).fill(0) as number[]
  for (const sh of shifts) {
    const date = (sh.date ?? '').slice(0, 10)
    const h = shiftHours(sh)
    if (sh.type === 'shift') {
      if (date.startsWith(thisYm)) dayThis[Number(date.slice(8, 10)) - 1] += h
      else if (date.startsWith(lastYm)) dayLast[Number(date.slice(8, 10)) - 1] += h
      if (date.startsWith(year)) series[Number(date.slice(5, 7)) - 1] += h
      if (weekKeys.has(date)) { weekHours += h; weekMinutes += h * 60 }
    }
    if (date.startsWith(thisYm)) {
      if (sh.type === 'shift') { daysWorked++; count++; hours += h; weeks[Math.min(4, Math.floor((Number(date.slice(8, 10)) - 1) / 7))] += h }
      else if (sh.type === 'vacation' || sh.type === 'leave') vacationDays++
      else if (sh.type === 'sick') sickDays++
    } else if (date.startsWith(lastYm) && sh.type === 'shift') hoursPrev += h
  }
  const cum = (a: number[]) => { let n = 0; return a.map((v) => Math.round((n += v))) }
  // e hónap a mai napig, az előző hónap végig
  const trend = cum(dayThis).slice(0, now.getDate())
  const trendPrev = cum(dayLast)
  return {
    daysWorked, vacationDays, sickDays, shifts: count, hours: Math.round(hours), hoursPrev: Math.round(hoursPrev),
    weeks: weeks.map(Math.round), trend, trendPrev, series: series.map(Math.round), weekHours: Math.round(weekHours), weekMinutes,
  }
}

type Stats = ReturnType<typeof shiftStats>
const base = (s: Stats) => ({
  weekHours: s.weekHours,
  month: { bookings: 0, revenue: 0, noShow: 0, tips: 0, hours: s.hours, hoursPrev: s.hoursPrev, daysWorked: s.daysWorked, sickDays: s.sickDays, vacationDays: s.vacationDays, shifts: s.shifts, weeks: s.weeks, trend: s.trend, trendPrev: s.trendPrev },
})

/** A fiókból (Users) épülő tulaj-sor — ha nincs foglalható profilja (étteremben mindig így). */
function ownerRow(owner: User | null, s: Stats): TeamMemberVM {
  const o = (owner ?? {}) as User & { join_date?: string | null; createdAt?: string; role_title?: string | null }
  return {
    id: 'owner', owner: true, name: o.name || o.email || 'Tulajdonos', img: fixMediaUrl(o.avatar_url) ?? null,
    position: o.role_title || 'Tulajdonos', email: o.email || '', phone: o.phone || '',
    joinDate: (o.join_date ?? o.createdAt ?? '').slice(0, 10) || null,
    role: 'Tulajdonos', roleKey: 'owner', customRoleId: null, membershipId: null, status: 'active', review: false, bookable: false,
    weeklyTarget: o.weekly_hours ?? null, weekUtil: null, serviceIds: [], bio: o.bio || '', socialLinks: [],
    birthday: o.birthday ?? null, address: o.address ?? null, taxId: o.tax_id ?? null, taxNumber: o.tax_number ?? null,
    payType: 'daily', payRate: null, tipEligible: false, buffer: null, breaks: [], minLead: null, documents: [],
    series: s.series, ...base(s),
  }
}

export async function getTeamRoster(variant: Variant, businessId: string | number): Promise<TeamMemberVM[]> {
  const payload = await getPayloadClient()
  const now = new Date()
  // Sebesség: a beosztások és (lent) a foglalások KÖZVETLEN SQL-lel (lib/fastRead, docs/sebesseg) — a Payload soronként
  // ~2 ms; itt az év összes beosztása + összes foglalása ment rajta, és közben az oldal többi lekérdezése is várt.
  // az év eleje (januárban a december is), de legalább 9 hét
  const shiftsFrom = ymd(new Date(Math.min(new Date(now.getFullYear(), Math.min(0, now.getMonth() - 1), 1).getTime(), now.getTime() - 63 * 86_400_000)))
  const shiftsRes = { docs: await shiftsSince(variant === 'salon' ? { salon: businessId } : { restaurant: businessId }, shiftsFrom) }
  const shifts = shiftsRes.docs as unknown as Shift[]
  const byPerson: Record<string, Shift[]> = {}
  for (const sh of shifts) { const pid = relId(variant === 'salon' ? sh.staff : sh.member); if (pid) (byPerson[pid] ??= []).push(sh) }
  const ownerShifts = shifts.filter((sh) => sh.owner_shift)

  if (variant === 'salon') {
    const year = now.getFullYear()
    const monthYm = ymd(now).slice(0, 7)
    const [salonRes, staffRes, memRes, bookingsRes, servicesRes] = await Promise.all([
      payload.findByID({ collection: 'salons', id: businessId, depth: 1, overrideAccess: true }).catch(() => null),
      payload.find({ collection: 'staff', where: { salon: { equals: businessId } }, sort: 'name', depth: 1, populate: { salons: { name: true } }, limit: 500, overrideAccess: true }),
      payload.find({ collection: 'memberships', where: { salon: { equals: businessId } }, depth: 1, populate: { salons: { name: true } }, limit: 500, overrideAccess: true }),
      rawQuery<{ staff_id: number | null; date: string; status: string; start_time: string | null; end_time: string | null; price_snapshot: string | null; service_id: number | null }>(sql`
        SELECT staff_id, date, status, start_time, end_time, price_snapshot, service_id FROM bookings
        WHERE salon_id = ${Number(businessId)} AND date >= ${`${year}-01-01`} AND status <> 'cancelled'`)
        .then((rows) => ({ docs: rows.map((r) => ({ staff: r.staff_id, date: r.date, status: r.status, start_time: r.start_time, end_time: r.end_time, price_snapshot: num(r.price_snapshot), service: r.service_id })) })),
      payload.find({ collection: 'services', where: { salon: { equals: businessId } }, depth: 0, limit: 500, overrideAccess: true, select: { staff: true, price: true } }),
    ])
    const staff = staffRes.docs as StaffMember[]
    const memByEmail = new Map((memRes.docs as Membership[]).map((m) => [(m.email ?? '').toLowerCase(), m]))
    const services = servicesRes.docs as Service[]
    const priceOf = new Map(services.map((s) => [String(s.id), s.price ?? 0]))
    const servicesOf = (id: string) => services.filter((s) => (s.staff ?? []).some((x) => relId(x) === id)).map((s) => String(s.id))

    // foglalások munkatársanként: az év havi száma, e hónap (bevétel, elmaradt), e heti foglalt percek
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    const weekFrom = ymd(monday), weekTo = ymd(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6))
    const bk: Record<string, { series: number[]; bookings: number; revenue: number; noShow: number; weekMinutes: number }> = {}
    for (const b of bookingsRes.docs as unknown as Booking[]) {
      const sid = relId(b.staff)
      if (!sid) continue
      const d = (b.date ?? '').slice(0, 10)
      const r = (bk[sid] ??= { series: Array(12).fill(0), bookings: 0, revenue: 0, noShow: 0, weekMinutes: 0 })
      if (b.status === 'no_show') { if (d.startsWith(monthYm)) r.noShow++; continue }
      r.series[Number(d.slice(5, 7)) - 1]++
      if (d.startsWith(monthYm)) { r.bookings++; r.revenue += typeof b.price_snapshot === 'number' ? b.price_snapshot : priceOf.get(relId(b.service) ?? '') ?? 0 }
      if (d >= weekFrom && d <= weekTo) { const a = mins(b.start_time), e = mins(b.end_time); if (a != null && e != null && e > a) r.weekMinutes += e - a }
    }

    const ownerRel = (salonRes as { owner?: unknown } | null)?.owner
    const owner = ownerRel && typeof ownerRel === 'object' ? (ownerRel as User) : null
    const ownerId = owner?.id != null ? String(owner.id) : null
    const linkedOwner = ownerId ? staff.find((s) => relId(s.user) === ownerId) : undefined

    const rows = staff.map((s): TeamMemberVM => {
      const id = String(s.id)
      const st = shiftStats(byPerson[id] ?? [], now)
      const b = bk[id]
      const isOwner = linkedOwner?.id === s.id
      const mem = s.email ? memByEmail.get(s.email.toLowerCase()) : undefined
      const status: TeamStatus = mem?.status === 'invited' ? 'invited' : mem?.status === 'suspended' || s.is_active === false ? 'suspended' : 'active'
      const userAvatar = mem?.user && typeof mem.user === 'object' ? fixMediaUrl((mem.user as User).avatar_url) : null
      return {
        id, owner: isOwner, name: s.name, img: mediaUrl(s.avatar) ?? userAvatar ?? (isOwner ? fixMediaUrl(owner?.avatar_url) ?? null : null),
        position: s.role_title || s.department || (isOwner ? 'Tulajdonos' : ''), email: s.email || '', phone: s.phone || '',
        joinDate: (s.join_date ?? s.createdAt ?? '').slice(0, 10) || null,
        role: isOwner ? 'Tulajdonos' : roleName(mem), roleKey: isOwner ? 'owner' : mem?.role ?? null,
        customRoleId: relId(mem?.custom_role), membershipId: mem ? String(mem.id) : null, status, review: !!s.import_review, bookable: s.is_active !== false,
        weeklyTarget: s.weekly_hours ?? null, weekUtil: st.weekMinutes > 0 ? Math.min(100, Math.round(((b?.weekMinutes ?? 0) / st.weekMinutes) * 100)) : null,
        serviceIds: servicesOf(id), bio: s.bio || '', socialLinks: (s.social_links ?? []).map((l) => l.url),
        birthday: s.birthday ?? null, address: s.address ?? null, taxId: s.tax_id ?? null, taxNumber: s.tax_number ?? null,
        payType: 'daily', payRate: s.salary ?? null, tipEligible: false, buffer: s.booking_buffer_minutes ?? null, breaks: (s.default_breaks ?? []).map((b) => ({ start: b.start_time, end: b.end_time })), minLead: s.min_lead_hours ?? null,
        documents: docsOf(s.documents), series: b?.series ?? Array(12).fill(0), ...base(st),
        month: { ...base(st).month, bookings: b?.bookings ?? 0, revenue: b?.revenue ?? 0, noShow: b?.noShow ?? 0 },
      }
    })
    return linkedOwner ? rows : [ownerRow(owner, shiftStats(ownerShifts, now)), ...rows]
  }

  // ── étterem ──
  const [restRes, memRes] = await Promise.all([
    payload.findByID({ collection: 'restaurants', id: businessId, depth: 1, overrideAccess: true }).catch(() => null),
    payload.find({ collection: 'memberships', where: { restaurant: { equals: businessId } }, sort: 'createdAt', depth: 1, populate: { restaurants: { name: true } }, limit: 500, overrideAccess: true }),
  ])
  const rest = restRes as Restaurant | null
  const thisYm = ymd(now).slice(0, 7)
  const members = (memRes.docs as Membership[]).filter((m) => m.role !== 'owner')

  // havi borravaló: a napi központi összeg / az aznap dolgozó jogosultak száma (design 11.3)
  const dailyTips: Record<string, number> = {}
  for (const t of rest?.daily_tips ?? []) { const d = (t.date ?? '').slice(0, 10); if (d && typeof t.amount === 'number') dailyTips[d] = t.amount }
  const eligible = new Set(members.filter((m) => m.tip_eligible).map((m) => String(m.id)))
  const workingByDate: Record<string, Set<string>> = {}
  for (const pid of eligible) for (const sh of byPerson[pid] ?? []) if (sh.type === 'shift') (workingByDate[(sh.date ?? '').slice(0, 10)] ??= new Set()).add(pid)
  const tipsOf = (pid: string) => {
    if (!eligible.has(pid)) return 0
    let sum = 0
    const seen = new Set<string>()
    for (const sh of byPerson[pid] ?? []) {
      const d = (sh.date ?? '').slice(0, 10)
      if (sh.type !== 'shift' || seen.has(d) || !d.startsWith(thisYm)) continue
      seen.add(d)
      const n = workingByDate[d]?.size ?? 0
      if (dailyTips[d] && n) sum += dailyTips[d] / n
    }
    return Math.round(sum)
  }

  const ownerRel = rest?.owner
  const owner = ownerRel && typeof ownerRel === 'object' ? (ownerRel as User) : null
  const rows = members.map((m): TeamMemberVM => {
    const id = String(m.id)
    const st = shiftStats(byPerson[id] ?? [], now)
    const user = m.user && typeof m.user === 'object' ? (m.user as User) : null
    const custom = m.custom_role && typeof m.custom_role === 'object' ? (m.custom_role as Role) : null
    return {
      id, owner: false, name: m.name || user?.name || m.email, img: mediaUrl(m.avatar) ?? fixMediaUrl(user?.avatar_url) ?? null,
      position: m.position || custom?.name || '', email: m.email || user?.email || '', phone: m.phone || '',
      joinDate: (m.join_date ?? m.createdAt ?? '').slice(0, 10) || null,
      role: roleName(m), roleKey: m.role, customRoleId: relId(m.custom_role), membershipId: id, status: m.status ?? 'invited',
      review: false, bookable: false, weeklyTarget: m.weekly_hours ?? null, weekUtil: null, serviceIds: [], bio: m.bio || '', socialLinks: [],
      birthday: m.birthday ?? null, address: m.address ?? null, taxId: m.tax_id ?? null, taxNumber: m.tax_number ?? null,
      payType: m.pay_type === 'hourly' ? 'hourly' : 'daily', payRate: m.pay_rate ?? null, tipEligible: !!m.tip_eligible, buffer: null, breaks: [], minLead: null,
      documents: docsOf((m as unknown as { documents?: unknown }).documents), series: st.series, ...base(st),
      month: { ...base(st).month, tips: tipsOf(id) },
    }
  })
  return [ownerRow(owner, shiftStats(ownerShifts, now)), ...rows]
}
