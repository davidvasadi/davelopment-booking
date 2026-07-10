import { getOwnedSalon } from '@/lib/salonContext'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice } from '@/lib/utils'
import { getDashboardStats } from '@/lib/dashboardStats'
import { StoreSwitcher } from '@/components/dashboard/StoreSwitcher'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { OccupancyDonut, WeekBarChart } from '@/components/restaurant/OverviewCharts'
import { OverviewAccordion, type AccItem } from '@/components/restaurant/OverviewPanels'
import { OverviewTasksPanel } from '@/components/restaurant/OverviewTasksPanel'
import { DetailSheet } from '@/components/restaurant/DetailSheet'
import { OverviewTimeline, type TimelineBlock, type TimelineRow } from '@/components/restaurant/OverviewTimeline'
import { CARD, HeroKpi } from '@/components/dashboard/overview-ui'
import { CalendarDays, Banknote, CheckCircle2, Plus } from 'lucide-react'
import Link from 'next/link'
import type { Booking, Service, StaffMember, Media, Task, Availability } from '@/payload/payload-types'

// Idő-függő tartalom (naptár + header-pillek) → mindig frissüljön.
export const dynamic = 'force-dynamic'

const DOW_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DOW_HU: Record<string, string> = {
  monday: 'Hétfő', tuesday: 'Kedd', wednesday: 'Szerda', thursday: 'Csütörtök',
  friday: 'Péntek', saturday: 'Szombat', sunday: 'Vasárnap',
}
// JS getDay() (0=Vasárnap) → day_of_week kulcs.
const JS_TO_DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DOW_SHORT = ['Vas', 'Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo']

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}
const minOfDay = (t: string | null | undefined) => { const [h, m] = (t ?? '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export default async function DashboardPage() {
  const [{ salon }, user] = await Promise.all([getOwnedSalon(), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = ymd(now)
  const hour = now.getHours()
  const greeting = hour < 10 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'
  const todayDow = JS_TO_DOW[now.getDay()]

  const logoUrl = salon.logo && typeof salon.logo === 'object' ? (salon.logo as Media).url ?? null : null
  // Profil-kép a nagy kártyára: a fiók avatarja (Google-nál nagyobb méret), fallback a logó, végül monogram.
  const rawAvatar = user?.avatar_url ?? null
  const userAvatar = rawAvatar && rawAvatar.includes('googleusercontent') ? rawAvatar.replace(/=s\d+-c/, '=s512-c') : rawAvatar
  const profileImg = userAvatar ?? logoUrl
  // A szerep a fiókból jön (lehet restaurant_owner akkor is, ha épp szalonban vagyunk), ezért
  // nem az üzlet-típust írjuk ki, csak a semleges „Tulajdonos"-t (admin kivétel).
  const roleLabel = user?.role === 'admin' ? 'Adminisztrátor' : 'Tulajdonos'
  const { active, businesses } = user ? await getActiveBusiness(user) : { active: null, businesses: [] }

  const [stats, todayAll, tasksRes, availRes, staffRes, servicesRes] = await Promise.all([
    getDashboardStats(salon.id),
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { equals: today } }] },
      sort: 'start_time', depth: 2, limit: 100, overrideAccess: true,
    }),
    payload.find({
      collection: 'tasks',
      where: { salon: { equals: salon.id } },
      sort: ['done', 'createdAt'], depth: 0, limit: 100, overrideAccess: true,
    }),
    // Szalon-szintű nyitvatartás (staff nélküli availability rekordok).
    payload.find({
      collection: 'availability',
      where: { and: [{ salon: { equals: salon.id } }, { staff: { exists: false } }] },
      depth: 0, limit: 20, overrideAccess: true,
    }),
    payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      depth: 0, limit: 100, overrideAccess: true,
    }),
    payload.find({
      collection: 'services',
      where: { and: [{ salon: { equals: salon.id } }, { is_active: { not_equals: false } }] },
      depth: 0, limit: 200, overrideAccess: true,
    }),
  ])

  const all = todayAll.docs as Booking[]
  const activeBookings = all.filter((b) => b.status !== 'cancelled')
  const availability = availRes.docs as Availability[]
  const staff = staffRes.docs as StaffMember[]
  const tasks = tasksRes.docs as Task[]
  const staffCount = staff.length
  const serviceCount = servicesRes.totalDocs

  // ── Státusz-csík (animelt StatusPills, mint az étteremen) ──
  const total = all.length || 1
  const confirmedPct = Math.round((all.filter((b) => b.status === 'confirmed' || b.status === 'completed').length / total) * 100)
  const pendingPct = Math.round((all.filter((b) => b.status === 'pending').length / total) * 100)
  const cancelledPct = Math.round((all.filter((b) => b.status === 'cancelled').length / total) * 100)

  // ── Heti oszlopdiagram: „Foglalások a héten" — az AKTUÁLIS hét (hétfő–vasárnap) napi foglalásszáma. ──
  const bookingsByDate = new Map(stats.trend.map((d) => [d.date, d.bookings]))
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // e hét hétfője
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(weekStart); dt.setDate(weekStart.getDate() + i)
    return { label: DOW_SHORT[dt.getDay()], value: bookingsByDate.get(ymd(dt)) ?? 0 }
  })
  const weekTotal = weekDays.reduce((s, d) => s + d.value, 0)
  const weekMax = Math.max(1, ...weekDays.map((d) => d.value))
  const weekPeak = Math.max(0, ...weekDays.map((d) => d.value))
  const weekBars = weekDays.map((d) => ({ ...d, peak: d.value === weekPeak && weekPeak > 0 }))

  // ── Kihasználtság = foglalt idő / (nyitott idő × szakemberszám) ──
  const openToday = availability.filter((a) => a.day_of_week === todayDow && a.is_available !== false)
  const openMinsToday = openToday.reduce((s, a) => s + Math.max(0, minOfDay(a.end_time) - minOfDay(a.start_time)), 0)
  const bookedMins = activeBookings.reduce((s, b) => {
    const dur = b.end_time ? minOfDay(b.end_time) - minOfDay(b.start_time) : 60
    return s + Math.max(0, dur)
  }, 0)
  const capacityMins = openMinsToday * Math.max(1, staffCount)
  const occupancy = capacityMins > 0 ? Math.min(100, Math.round((bookedMins / capacityMins) * 100)) : 0

  // ── Idővonal SZAKEMBERENKÉNT: a mai foglalások az adott szakember sorába. ──
  const staffName = new Map(staff.map((s) => [String(s.id), s.name]))
  const rowMap = new Map<string, TimelineBlock[]>()
  for (const b of activeBookings) {
    const st = b.staff
    const stId = st == null ? null : typeof st === 'object' ? String(st.id) : String(st)
    const stName = stId ? (typeof b.staff === 'object' && b.staff ? (b.staff as StaffMember).name : staffName.get(stId)) : null
    const key = stName || 'Nincs szakember'
    const svc = b.service
    const svcName = typeof svc === 'object' && svc ? (svc as Service).name : ''
    const block: TimelineBlock = {
      id: String(b.id),
      name: `${b.customer_name}${svcName ? ` · ${svcName}` : ''}`,
      startMin: minOfDay(b.start_time),
      endMin: b.end_time ? minOfDay(b.end_time) : minOfDay(b.start_time) + 60,
      pax: 1,
      status: b.status,
      source: 'online',
      occasion: null,
      occasionIcon: null,
    }
    rowMap.set(key, [...(rowMap.get(key) ?? []), block])
  }
  const timelineRows: TimelineRow[] = [...rowMap.entries()]
    .sort((a, b) => (a[0] === 'Nincs szakember' ? 1 : b[0] === 'Nincs szakember' ? -1 : a[0].localeCompare(b[0], 'hu')))
    .map(([table, blocks]) => ({ table, blocks }))

  // Idővonal-ablak: MA a jelenlegi 4 órás ablak; a foglalások köré tágítva.
  const tlStart = activeBookings.map((b) => minOfDay(b.start_time))
  const tlEnd = activeBookings.map((b) => (b.end_time ? minOfDay(b.end_time) : minOfDay(b.start_time) + 60))
  let tlHourMin = activeBookings.length ? Math.floor(Math.min(...tlStart) / 60) : hour
  let tlHourMax = activeBookings.length ? Math.ceil(Math.max(...tlEnd) / 60) : hour + 4
  tlHourMin = Math.min(tlHourMin, hour)
  tlHourMax = Math.max(tlHourMax, hour + 4, tlHourMin + 4)
  const tlInitWin = Math.max(tlHourMin, Math.min(hour, tlHourMax - 4))

  // ── Akkordeon-tartalmak (szalon: Mai bevétel [saját] + Nyitvatartás + Szolgáltatások + Munkatársak) ──
  const availByDay = new Map(availability.filter((a) => a.is_available !== false).map((a) => [a.day_of_week, a]))
  const accItems: AccItem[] = [
    {
      label: 'Mai bevétel',
      body: (
        <div className="flex items-end gap-2">
          <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{formatPrice(stats.revenueToday, 'HUF')}</div>
          {stats.revenueTodayDiff !== 0 && (
            <div className={`ml-auto pb-1.5 text-xs font-semibold ${stats.revenueTodayDiff >= 0 ? 'text-[#1D9D63]' : 'text-bad'}`}>
              {stats.revenueTodayDiff >= 0 ? '+' : ''}{stats.revenueTodayDiff}%
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Nyitvatartás',
      body: (
        <div className="space-y-1.5">
          {DOW_ORDER.map((d) => {
            const a = availByDay.get(d)
            const open = a && a.start_time && a.end_time
            return (
              <div key={d} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">{DOW_HU[d]}</span>
                <span className={open ? 'font-medium text-ink' : 'text-ink-soft2'}>
                  {open ? `${a!.start_time}–${a!.end_time}` : 'Zárva'}
                </span>
              </div>
            )
          })}
        </div>
      ),
    },
    {
      label: 'Szolgáltatások',
      body: (
        <div className="flex items-end gap-2">
          <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{serviceCount}</div>
          <div className="pb-1.5 text-[13px] font-medium text-ink-soft">aktív szolgáltatás</div>
        </div>
      ),
    },
    {
      label: 'Munkatársak',
      body: (
        <div className="flex items-end gap-2">
          <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{staffCount}</div>
          <div className="pb-1.5 text-[13px] font-medium text-ink-soft">aktív szakember</div>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-5 lg:p-0">
      {/* ── HERO: köszönés + jobbra fiókváltó + Új foglalás ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[15px] text-ink-soft">{greeting},</p>
          <h1 className="mt-0.5 text-4xl font-light leading-[1.05] tracking-[-0.02em] text-ink lg:text-[46px]">{salon.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StoreSwitcher name={salon.name} logoUrl={logoUrl} businesses={businesses} activeKey={active ? `${active.type}:${active.id}` : null} />
          <Link
            href="/dashboard/bookings"
            className="inline-flex h-[52px] items-center gap-2 rounded-dav-pill bg-ink-dark px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Új foglalás
          </Link>
        </div>
      </div>

      {/* ── STÁTUSZ-CSÍK (bal) + 3 KPI (jobb) ── */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <StatusPills
          eager
          className="flex-1 lg:max-w-[760px]"
          segments={[
            { label: 'Megerősített', pct: confirmedPct, background: '#1D1C19', color: '#fff' },
            { label: 'Függő', pct: pendingPct, background: '#F1CE45', color: '#1D1C19' },
            { label: 'Lemondva', pct: cancelledPct, background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
          ]}
        />
        <div className="flex flex-wrap items-start gap-8 lg:gap-10">
          <HeroKpi icon={CalendarDays} value={String(stats.bookingsToday)} label="Foglalás ma" />
          <HeroKpi icon={Banknote} value={formatPrice(stats.revenueToday, 'HUF')} label="Bevétel ma" />
          <HeroKpi icon={CheckCircle2} value={`${stats.completionRate}%`} label="Teljesítés" />
        </div>
      </div>

      {/* ── BENTO — 3 oszlop (mint az étterem): profil+accordion / grafikonok+idővonal / teendők ── */}
      <div className="grid grid-cols-1 gap-[5px] lg:grid-cols-[300px_minmax(0,1.5fr)_minmax(0,1.05fr)] lg:items-stretch">

        {/* ── COL1: Profil-kártya (avatar) + accordion ── */}
        <div className="flex flex-col gap-[5px]">
          <div className={`${CARD} relative shrink-0 overflow-hidden p-0`} style={{ aspectRatio: '0.82', transform: 'translateZ(0)' }}>
            {profileImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#3a2f12] via-[#9A7B1E] to-[#F1CE45] text-[56px] font-semibold text-white/90">
                {initials(user?.name ?? salon.name)}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  top: '-64px',
                  background: 'rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(36px) saturate(125%)',
                  WebkitBackdropFilter: 'blur(36px) saturate(125%)',
                  maskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,.45)' }}>
                  <div className="truncate text-[17px] font-semibold leading-tight text-white">{user?.name ?? salon.name}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-white/85">{roleLabel}</div>
                </div>
                <span
                  className="shrink-0 rounded-[14px] px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{
                    background: 'transparent',
                    backdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    WebkitBackdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    textShadow: '0 1px 3px rgba(0,0,0,.45)',
                  }}
                >
                  {stats.bookingsToday} ma
                </span>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <OverviewAccordion items={accItems} defaultOpen={0} />
          </div>
        </div>

        {/* ── COL2: 2 grafikon-kártya + idővonal ── */}
        <div className="flex min-h-0 flex-col gap-[5px]">
          <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-2">
            {/* Foglalások a héten — oszlopdiagram */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="flex items-start justify-between">
                <div className="text-[17px] font-medium text-ink">Foglalások a héten</div>
                <DetailSheet title="Foglalások a héten" subtitle="Napi foglalásszám az e-héten">
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-[38px] font-light tracking-[-0.02em] text-ink">{weekTotal}</span>
                    <span className="text-[13px] text-ink-soft">foglalás összesen</span>
                  </div>
                  <div className="mb-6 h-56 w-full min-w-0 rounded-[18px] bg-white p-3 shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
                    <WeekBarChart bars={weekBars} />
                  </div>
                  <div className="space-y-2.5">
                    {weekBars.map((b, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-10 shrink-0 text-[13px] font-medium text-ink-soft">{b.label}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#ececea]">
                          <div className="h-full rounded-full" style={{ width: `${Math.round((b.value / weekMax) * 100)}%`, background: b.peak ? '#F1CE45' : '#1D1C19' }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-[13px] font-semibold text-ink">{b.value}</span>
                      </div>
                    ))}
                  </div>
                </DetailSheet>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[32px] font-light tracking-[-0.02em] text-ink">{weekTotal}</span>
                <span className="text-[11.5px] leading-[1.2] text-ink-soft">foglalás<br />a héten</span>
              </div>
              <div className="mt-4 flex flex-1 flex-col justify-end">
                <div className="relative flex items-end justify-between gap-1.5" style={{ minHeight: '118px' }}>
                  <div className="pointer-events-none absolute inset-x-0 bottom-[3px] border-t border-dashed border-[#d9d4c5]" />
                  {weekBars.map((b, i) => (
                    <div key={i} className="relative z-10 flex flex-1 flex-col items-center justify-end">
                      {b.peak ? <span className="mb-1.5 rounded-[8px] bg-gold px-2 py-0.5 text-[10px] font-bold text-ink-dark">{b.value}</span> : null}
                      <div className="w-[6px] rounded-full" style={{ height: `${Math.max(8, (b.value / weekMax) * 92)}px`, background: b.peak ? '#F1CE45' : '#1D1C19' }} />
                      <span className="mt-1.5 h-[6px] w-[6px] rounded-full" style={{ background: b.peak ? '#F1CE45' : '#c9c3b4' }} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between gap-1.5">
                  {weekBars.map((b, i) => (
                    <span key={i} className="flex-1 text-center text-[10px] font-medium text-ink-soft">{b.label}</span>
                  ))}
                </div>
              </div>
            </div>
            {/* Kihasználtság — donut (foglalt idő / nyitott kapacitás) */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="flex w-full items-start justify-between">
                <div className="text-[17px] font-medium text-ink">Kihasználtság</div>
                <DetailSheet title="Kihasználtság" subtitle="Mai foglalt idő a nyitott kapacitáshoz">
                  <div className="mb-6 flex items-center justify-center rounded-[18px] bg-white py-5 shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
                    <div className="scale-[1.35]">
                      <OccupancyDonut pct={occupancy} centerLabel="mai kihasználtság" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { k: 'Foglalás ma', v: String(stats.bookingsToday) },
                      { k: 'Foglalt idő', v: `${Math.round(bookedMins / 60 * 10) / 10} óra` },
                      { k: 'Szakemberek', v: `${staffCount} fő` },
                    ].map((r) => (
                      <div key={r.k} className="flex items-center justify-between border-b border-dashed border-line pb-3">
                        <span className="text-[13.5px] text-ink-soft">{r.k}</span>
                        <span className="text-[15px] font-semibold text-ink">{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-[16px] bg-[#f3f2ef] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                    A kihasználtság a mai lefoglalt idő és a nyitott (szakemberenkénti) kapacitás aránya.
                  </div>
                </DetailSheet>
              </div>
              <div className="flex flex-1 items-center justify-center py-1">
                <div className="scale-[1.08]">
                  <OccupancyDonut pct={occupancy} centerLabel="mai kihasználtság" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center"><div className="text-[15px] font-semibold text-ink">{stats.bookingsToday}</div><div className="text-[11px] text-[#A8A496]">foglalás</div></div>
                <div className="h-[24px] w-px bg-line-strong" />
                <div className="text-center"><div className="text-[15px] font-semibold text-ink">{staffCount}</div><div className="text-[11px] text-[#A8A496]">szakember</div></div>
              </div>
            </div>
          </div>

          {/* Idővonal — SZAKEMBERENKÉNT (óra-léptethető, foglalás-blokkok) */}
          <OverviewTimeline
            rows={timelineRows}
            hourMin={tlHourMin}
            hourMax={tlHourMax}
            initialWin={tlInitWin}
            dayLabel="Ma"
          />
        </div>

        {/* ── COL3: Mai teendők (valós, salonId scope) ── */}
        <OverviewTasksPanel salonId={String(salon.id)} initial={tasks} />
      </div>
    </div>
  )
}
