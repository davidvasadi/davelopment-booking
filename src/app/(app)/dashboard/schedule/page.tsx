import { getOwnedSalon } from '@/lib/salonContext'
import { getPayloadClient } from '@/lib/payload'
import { ScheduleView, type StaffVM, type ShiftVM, type ShiftType } from '@/components/dashboard/ScheduleView'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { PageHeader } from '@/components/ui/page-header'
import type { StaffMember, Shift, Media } from '@/payload/payload-types'

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
  return m && typeof m === 'object' && typeof (m as Media).url === 'string' ? ((m as Media).url as string) : null
}

export default async function SalonSchedulePage() {
  const { salon } = await getOwnedSalon()
  const payload = await getPayloadClient()

  const [staffRes, shiftsRes] = await Promise.all([
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
      depth: 0,
      limit: 5000,
      overrideAccess: true,
    }),
  ])

  const staff: StaffVM[] = (staffRes.docs as StaffMember[]).map((s) => ({
    id: String(s.id),
    name: s.name,
    ini: initials(s.name),
    avatarUrl: mediaUrl(s.avatar),
    role: s.role_title ?? '',
    birthday: s.birthday ? toYmd(s.birthday) : null,
    join_date: s.join_date ? toYmd(s.join_date) : null,
    weekly_hours: typeof s.weekly_hours === 'number' ? s.weekly_hours : null,
    phone: s.phone ?? null,
    documents: (s.documents ?? []).map((d) => ({
      label: d.label ?? 'Dokumentum',
      sizeLabel: sizeLabel(d.file && typeof d.file === 'object' ? (d.file as Media) : null),
    })),
  }))

  const shifts: ShiftVM[] = (shiftsRes.docs as Shift[])
    .filter((sh) => sh.staff != null)
    .map((sh) => ({
    id: String(sh.id),
    staffId: String(typeof sh.staff === 'object' && sh.staff !== null ? sh.staff.id : sh.staff),
    date: toYmd(sh.date),
    type: sh.type as ShiftType,
    start_time: sh.start_time ?? null,
    end_time: sh.end_time ?? null,
    hours: typeof sh.hours === 'number' ? sh.hours : null,
    note: sh.note ?? null,
    left_early_at: sh.left_early_at ?? null,
    left_early_reason: (sh.left_early_reason ?? null) as 'sick' | 'personal' | null,
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
          <StatusPills eager className="flex-1 lg:max-w-[620px]" segments={pills} />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="users" value={staff.length} label="Csapattag" />
            <CountUpKpi icon="clock" value={workedHours} label="Ledolgozott óra (hó)" />
            <CountUpKpi icon="off" value={offDays} label="Szabadság / hiányzás" />
          </div>
        </div>
      </div>
      <ScheduleView
        variant="salon"
        salonId={String(salon.id)}
        staff={staff}
        shifts={shifts}
        year={now.getFullYear()}
        month={now.getMonth()}
      />
    </div>
  )
}
