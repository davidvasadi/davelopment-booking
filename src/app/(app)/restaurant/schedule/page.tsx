import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getPayloadClient } from '@/lib/payload'
import { ScheduleView, type StaffVM, type ShiftVM, type ShiftType } from '@/components/dashboard/ScheduleView'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { PageHeader } from '@/components/ui/page-header'
import { roleLabel } from '@/lib/permissions'
import type { Membership, Shift, User } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
function toYmd(iso: string): string {
  return iso.slice(0, 10)
}

/**
 * ÉTTEREM BEOSZTÁS — a csapat-tagok (memberships) havi műszakjai. A ScheduleView-t
 * étterem-variánsban használjuk: a „staff" itt a memberships-lista, a shift-CRUD
 * `member`+`restaurant` párral megy az /api/shifts-en. SMS sehol.
 */
export default async function RestaurantSchedulePage() {
  const { restaurant } = await getOwnedRestaurant()
  const payload = await getPayloadClient()

  const [membersRes, shiftsRes] = await Promise.all([
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
      depth: 0,
      limit: 5000,
      overrideAccess: true,
    }),
  ])

  const staff: StaffVM[] = (membersRes.docs as Membership[]).map((m) => {
    const u = typeof m.user === 'object' ? (m.user as User) : null
    const name = m.name || u?.name || m.email
    return {
      id: String(m.id),
      name,
      ini: initials(name),
      role: roleLabel(m.role) + (m.status !== 'active' ? ' · meghívva' : ''),
      birthday: null,
      join_date: m.createdAt ? toYmd(m.createdAt) : null,
      weekly_hours: null,
      phone: null,
      documents: [],
    }
  })

  const shifts: ShiftVM[] = (shiftsRes.docs as Shift[]).map((sh) => ({
    id: String(sh.id),
    staffId: String(typeof sh.member === 'object' && sh.member ? sh.member.id : sh.member),
    date: toYmd(sh.date),
    type: sh.type as ShiftType,
    start_time: sh.start_time ?? null,
    end_time: sh.end_time ?? null,
    hours: typeof sh.hours === 'number' ? sh.hours : null,
    note: sh.note ?? null,
  }))

  const now = new Date()

  // ── Havi KPI-k (valós adat a shift-ekből) — fejléc-pillérek animált számokkal ──
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthShifts = shifts.filter((s) => s.date.startsWith(ym))
  const workedHours = Math.round(monthShifts.filter((s) => s.type === 'shift').reduce((a, s) => a + (s.hours ?? 0), 0))
  const offDays = monthShifts.filter((s) => s.type === 'leave' || s.type === 'sick' || s.type === 'vacation').length

  // StatusPills: a havi beosztás típus-megoszlása (mint az Áttekintés/Statisztikák fejléce).
  const total = monthShifts.length || 1
  const pct = (n: number) => Math.round((n / total) * 100)
  const nShift = monthShifts.filter((s) => s.type === 'shift').length
  const nVac = monthShifts.filter((s) => s.type === 'leave' || s.type === 'vacation').length
  const nSick = monthShifts.filter((s) => s.type === 'sick').length
  const pills = [
    { label: 'Műszak', pct: pct(nShift), background: '#1D1C19', color: '#fff' },
    { label: 'Szabadság', pct: pct(nVac), background: '#F1CE45', color: '#1D1C19' },
    {
      label: 'Betegszab.',
      pct: pct(nSick),
      background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)',
      color: '#57564f',
      border: '1px solid var(--dav-line-strong)',
      align: 'end' as const,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="px-4 pt-4 lg:px-0 lg:pt-0">
        <div className="hidden lg:block">
          <PageHeader eyebrow="Csapat" title="Naptár" />
        </div>
        <div className="mt-0 flex flex-col gap-6 lg:mt-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills className="flex-1 lg:max-w-[620px]" segments={pills} />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="users" value={staff.length} label="Csapattag" />
            <CountUpKpi icon="clock" value={workedHours} label="Ledolgozott óra (hó)" />
            <CountUpKpi icon="off" value={offDays} label="Szabadság / hiányzás" />
          </div>
        </div>
      </div>
      <ScheduleView
        variant="restaurant"
        restaurantId={String(restaurant.id)}
        staff={staff}
        shifts={shifts}
        year={now.getFullYear()}
        month={now.getMonth()}
      />
    </div>
  )
}
