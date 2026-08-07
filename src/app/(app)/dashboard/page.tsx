import { getOwnedSalon } from '@/lib/salonContext'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getPayloadClient } from '@/lib/payload'
import { formatPrice, fixMediaUrl, formatDayBadge } from '@/lib/utils'
import { deleteStaleTasks } from '@/lib/taskCleanup'
import { getDashboardStats } from '@/lib/dashboardStats'
import { StoreSwitcher } from '@/components/dashboard/StoreSwitcher'
import { PageHeader } from '@/components/ui/page-header'
import { getSetupFlags } from '@/lib/setupFlags'
import { SetupNudge } from '@/components/dashboard/SetupNudge'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { OccupancyDonut, WeekBarChart, WeekDayLabels, WeekMiniBars } from '@/components/shared/OverviewCharts'
import { OverviewAccordion, type AccItem } from '@/components/shared/OverviewPanels'
import { OverviewTasksPanel } from '@/components/shared/OverviewTasksPanel'
import { DetailSheet } from '@/components/shared/DetailSheet'
import { OverviewTimeline, type TimelineBlock, type TimelineRow } from '@/components/shared/OverviewTimeline'
import { HoverButtonLink } from '@/components/shared/HoverButtonLink'
import { HoverScaleCard } from '@/components/shared/HoverScaleCard'
import { CARD, HeroKpi } from '@/components/dashboard/overview-ui'
import { can } from '@/lib/permissions'
import { getMyUpcomingShifts } from '@/lib/myShifts'
import { StaffOverview } from '@/components/dashboard/StaffOverview'
import { CalendarDays, Banknote, CheckCircle2, Plus, UserRound } from 'lucide-react'
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
  const [{ salon, capabilities, roleName }, user] = await Promise.all([getOwnedSalon(1), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = ymd(now)
  const hour = now.getHours()
  const greeting = hour < 10 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'
  const todayDow = JS_TO_DOW[now.getDay()]
  const dayBadge = formatDayBadge(now)

  const logoUrl = salon.logo && typeof salon.logo === 'object' ? (salon.logo as Media).url ?? null : null
  // Profil-kép a nagy kártyára: a fiók avatarja (Google-nál nagyobb méret), fallback monogram.
  const rawAvatar = user?.avatar_url ?? null
  const userAvatar = rawAvatar && rawAvatar.includes('googleusercontent') ? rawAvatar.replace(/=s\d+-c/, '=s512-c') : rawAvatar
  const profileImg = userAvatar
  // A szerep a fiókból jön (lehet restaurant_owner akkor is, ha épp szalonban vagyunk), ezért
  // nem az üzlet-típust írjuk ki, csak a semleges „Tulajdonos"-t (admin kivétel).
  const roleLabel = user?.role === 'admin' ? 'Adminisztrátor' : roleName

  // Személyes áttekintés (saját műszak) az üzleti KPI-k helyett annak, aki NEM lát üzleti
  // statisztikát (`analytics.view`). A tulaj + a Statisztika-jogot kapó szerepek (Üzletvezető,
  // Supervisor) a teljes KPI-dashboardot kapják; a felszolgáló a személyes nézetet.
  if (user && !can(capabilities, 'analytics.view')) {
    const myShifts = await getMyUpcomingShifts({ type: 'salon', id: salon.id }, { id: user.id, email: user.email })
    // Avatar: user.avatar_url az első, ha az null → staff.avatar (amit a StaffManager tölt fel)
    let staffProfileImg = fixMediaUrl(profileImg)
    if (!staffProfileImg && user.email) {
      const staffRes = await payload.find({
        collection: 'staff',
        where: { and: [{ salon: { equals: salon.id } }, { email: { equals: user.email } }] },
        depth: 1, limit: 1, overrideAccess: true,
      })
      const staffMember = staffRes.docs[0] as { avatar?: { url?: string } } | undefined
      if (staffMember?.avatar?.url) staffProfileImg = fixMediaUrl(staffMember.avatar.url)
    }
    const todayLabel = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
    return (
      <StaffOverview
        greeting={greeting}
        userName={user.name ?? 'Dolgozó'}
        roleLabel={roleLabel}
        businessName={salon.name}
        todayLabel={todayLabel}
        shifts={myShifts}
        profileImg={staffProfileImg}
        variant="salon"
      />
    )
  }
  const { active, businesses } = user ? await getActiveBusiness(user) : { active: null, businesses: [] }

  // Háttér-karbantartás: 7 napnál régebbi "korábbi" teendők törlése — nem blokkolja az oldalt.
  void deleteStaleTasks(payload, 'salon', salon.id)

  const [stats, todayAll, upcomingRes, tasksRes, availRes, staffRes, servicesRes] = await Promise.all([
    getDashboardStats(salon.id),
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { equals: today } }] },
      sort: 'start_time', depth: 2, limit: 100, overrideAccess: true,
    }),
    // Közelgő foglalások: ma-mostantól előre, MINDEN státusz — ha ma már nincs több aktív
    // foglalás (zárás után), a "Közelgő foglalások" idővonal a következő napra vált.
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { greater_than_equal: today } }] },
      sort: ['date', 'start_time'], depth: 2, limit: 150, overrideAccess: true,
    }),
    payload.find({
      collection: 'tasks',
      where: { salon: { equals: salon.id } },
      sort: ['done', 'createdAt'], depth: 1, limit: 100, overrideAccess: true,
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
  // Kerekítésnél sok szakember (nagy kapacitás-nevező) mellett 1 rövid foglalás is 0%-ra
  // kerekedne — az legalább 1%-ot mutasson, hogy ne tűnjön üresnek, ha van valós foglalás.
  const occupancy = capacityMins > 0
    ? Math.min(100, Math.max(bookedMins > 0 ? 1 : 0, Math.round((bookedMins / capacityMins) * 100)))
    : 0

  // ── „Közelgő foglalások" idővonal-panel: MINDIG a JELENLEGI 4 órás ablak az alap (ma). A
  //    megjelenített nap MA, ha van ma olyan aktív foglalás, ami MÉG NEM ÉRT VÉGET (nem csak
  //    hogy volt ma bármi — egy rég lezárult mai foglalás önmagában NE tartsa "ma"-n, ha már
  //    elmúlt a záró időpontja); különben a következő nap, amin van (zárás utáni szabály —
  //    ugyanaz, mint az étteremnél). ──
  const tomorrow = (() => { const d = new Date(now); d.setDate(now.getDate() + 1); return ymd(d) })()
  const nowMin = hour * 60 + now.getMinutes()
  const calSource = (upcomingRes.docs as Booking[])
  const isActiveB = (b: Booking) => b.status !== 'cancelled'
  const todayActiveB = calSource.filter((b) => b.date === today && isActiveB(b))
  const todayHasUpcomingB = todayActiveB.some((b) => (b.end_time ? minOfDay(b.end_time) : minOfDay(b.start_time) + 60) > nowMin)
  const futureActiveB = calSource
    .filter((b) => isActiveB(b) && b.date > today)
    .sort((a, b) => `${a.date}T${a.start_time ?? ''}`.localeCompare(`${b.date}T${b.start_time ?? ''}`))
  const tlDay = todayHasUpcomingB ? today : (futureActiveB.length ? futureActiveB[0].date : today)
  const tlSrc = tlDay === today ? todayActiveB : futureActiveB.filter((b) => b.date === tlDay)

  // Idővonal SZAKEMBERENKÉNT: a megjelenített nap (tlDay) foglalásai az adott szakember sorába.
  const staffName = new Map(staff.map((s) => [String(s.id), s.name]))
  const rowMap = new Map<string, TimelineBlock[]>()
  for (const b of tlSrc) {
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

  const tlStart = tlSrc.map((b) => minOfDay(b.start_time))
  const tlEnd = tlSrc.map((b) => (b.end_time ? minOfDay(b.end_time) : minOfDay(b.start_time) + 60))
  // A foglalás(ok) alapján számolt kezdő óra — ezt kell KEZDŐBŐL mutatni, NE a jelenlegi órát,
  // különben pl. hajnalban egy 10 órás mai foglalás elé a halott 00:00–x:00 sáv kerülne.
  const bookingHourMin = tlSrc.length ? Math.floor(Math.min(...tlStart) / 60) : null
  let tlHourMin = bookingHourMin ?? (tlDay === today ? hour : 9)
  let tlHourMax = tlSrc.length ? Math.ceil(Math.max(...tlEnd) / 60) : (tlDay === today ? hour + 4 : 13)
  if (tlDay === today) {
    // A NAVIGÁLHATÓ tartomány (nyilakkal elérhető) MINDIG foglalja magába a jelenlegi órát is,
    // hogy vissza lehessen görgetni "mostig" — de a KEZDŐ nézetet ez nem befolyásolja (lásd lent).
    tlHourMin = Math.min(tlHourMin, hour)
    tlHourMax = Math.max(tlHourMax, hour + 4)
  }
  // A navigálható tartomány érje el legalább a foglalás KEZDETE utáni 4 órát is — különben a
  // kliens-oldali ablak (ami max ennyit tud csúszni) visszahúzná a kezdő nézetet a foglalás elé.
  tlHourMax = Math.max(tlHourMax, tlHourMin + 4, (bookingHourMin ?? tlHourMin) + 4)
  tlHourMax += 1 // +1 óra levegő a végén, hogy ne érjen pont a foglalás szélére a nézet
  // KEZDŐ nézet: ha van MA foglalás, egyenesen arra ugorjon (ne a jelenlegi órára) — zárás után/
  // éjfél után is egyből a következő foglalást lássa, ne kelljen a halott sávon átgörgetni hozzá.
  const tlInitWin = tlDay === today ? Math.max(tlHourMin, bookingHourMin ?? hour) : tlHourMin
  const tlDayLabel = tlDay === today ? 'Ma' : tlDay === tomorrow ? 'Holnap'
    : new Date(tlDay + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })

  // ── Státusz-csík (header pillek): a MEGJELENÍTETT nap (tlDay) státusz-bontása — zárás után a
  //    következő nyitás napjának bontása, mint az étteremnél. ──
  const pillRes = calSource.filter((b) => b.date === tlDay)
  const pillTotal = pillRes.length || 1
  const confirmedPct = Math.round((pillRes.filter((b) => b.status === 'confirmed' || b.status === 'completed').length / pillTotal) * 100)
  const pendingPct = Math.round((pillRes.filter((b) => b.status === 'pending').length / pillTotal) * 100)
  const cancelledPct = Math.round((pillRes.filter((b) => b.status === 'cancelled').length / pillTotal) * 100)

  // ── Akkordeon-tartalmak (szalon: Mai bevétel [saját] + Nyitvatartás + Szolgáltatások + Munkatársak) ──
  const availByDay = new Map(availability.filter((a) => a.is_available !== false).map((a) => [a.day_of_week, a]))
  const accItems: AccItem[] = [
    {
      label: 'Bevétel',
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

  // Onboarding-állapot a főoldali nudge-hoz (nyitvatartás + szolgáltatások kész-e).
  const setup = await getSetupFlags('salon', salon.id)

  return (
    <div className="space-y-6 p-5 lg:p-0">
      <PageHeader eyebrow={salon.name} title="Áttekintés" />

      {/* Onboarding-nudge */}
      <SetupNudge variant="salon" base="/dashboard" flags={setup} />

      {/* CTA-sor: StoreSwitcher + Új foglalás */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-ink-soft">{greeting}, <span className="font-medium text-ink">{user?.name ?? ''}</span></p>
        <div className="flex items-stretch gap-2.5">
          <StoreSwitcher name={salon.name} logoUrl={logoUrl} businesses={businesses} activeKey={active ? `${active.type}:${active.id}` : null} />
          <HoverButtonLink
            href="/dashboard/bookings"
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-dav-pill bg-ink-dark px-5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Új foglalás
          </HoverButtonLink>
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
          <HeroKpi icon={CalendarDays} value={String(stats.bookingsToday)} label="Foglalás" />
          <HeroKpi icon={Banknote} value={formatPrice(stats.revenueToday, 'HUF')} label="Bevétel" />
          <HeroKpi icon={CheckCircle2} value={`${stats.completionRate}%`} label="Teljesítés" />
        </div>
      </div>

      {/* ── BENTO — mobilon named grid-area sorrend: avatar → charts (grafikonok+idővonal) →
           tasks (teendők) → accordion (Nyitvatartás/Mai bevétel stb.) legalul. lg-től a klasszikus
           3-oszlopos elrendezés: avatar+accordion a bal 300px oszlopban egymás alatt, charts/tasks
           teljes magasságban átfogja mindkét sort (grid-rows: auto a fix magasságú avatarnak,
           1fr az accordionnak, ami kitölti a maradék helyet). ── */}
      <div className="dav-overview-bento">

        {/* ── Profil-kártya (avatar) ──
             lg alatt (1 oszlopos grid, teli szélesség) a portré-kép óriásira nőne felbontatlan
             arcközelivé vágva → helyette kompakt sor (kör-avatar + név). lg-től a teljes,
             kép-domináns kártya (fix 300px oszlop, portré-arány jól áll). */}
        <div className="flex flex-col gap-[5px]" style={{ gridArea: 'avatar' }}>
          <HoverScaleCard className={`${CARD} relative flex shrink-0 items-center gap-3 p-4 lg:hidden`}>
            <Link href="/dashboard/settings?tab=self" aria-label="Saját profil" className="absolute inset-0 z-20" />
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[14px]" style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
              {profileImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/30">
                  <UserRound className="h-7 w-7" strokeWidth={1.4} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold leading-tight text-ink">{user?.name ?? salon.name}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">{roleLabel}</div>
            </div>
            <span className="shrink-0 whitespace-nowrap rounded-[14px] bg-[#f1f0ed] px-3 py-1.5 text-[12px] font-semibold text-ink">
              {dayBadge}
            </span>
          </HoverScaleCard>
          <HoverScaleCard className={`${CARD} group relative hidden shrink-0 overflow-hidden p-0 lg:block lg:aspect-[0.82]`}>
            {/* A teljes profil-kártya a Saját profil oldalra visz (stretched link). */}
            <Link href="/dashboard/settings?tab=self" aria-label="Saját profil" className="absolute inset-0 z-20" />
            {profileImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white/30" style={{ background: 'linear-gradient(145deg, #2a2720 0%, #1d1c19 100%)' }}>
                <div className="absolute inset-0" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, transparent 55%)' }} />
                <UserRound className="relative h-20 w-20" strokeWidth={1.2} />
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 p-4">
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  top: '-64px',
                  background: 'rgba(255,255,255,0.10)',
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
                  className="shrink-0 whitespace-nowrap rounded-[14px] px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{
                    background: 'transparent',
                    backdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    WebkitBackdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    textShadow: '0 1px 3px rgba(0,0,0,.45)',
                  }}
                >
                  {dayBadge}
                </span>
              </div>
            </div>
          </HoverScaleCard>
        </div>

        {/* ── Grafikon-kártyák + idővonal ── */}
        <div className="flex min-h-0 flex-col gap-[5px]" style={{ gridArea: 'charts' }}>
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
                <WeekMiniBars bars={weekBars} weekMax={weekMax} unit="foglalás" />
                <WeekDayLabels bars={weekBars} />
              </div>
            </div>
            {/* Kihasználtság — donut (foglalt idő / nyitott kapacitás) */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="flex w-full items-start justify-between">
                <div className="text-[17px] font-medium text-ink">Kihasználtság</div>
                <DetailSheet title="Kihasználtság" subtitle="Mai foglalt idő a nyitott kapacitáshoz">
                  <div className="mb-6 flex items-center justify-center rounded-[18px] bg-white py-5 shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
                    <div className="scale-[1.35]">
                      <OccupancyDonut pct={occupancy} centerLabel="kihasználtság" />
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
                  <OccupancyDonut pct={occupancy} centerLabel="kihasználtság" />
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
            dayLabel={tlDayLabel}
            allHref="/dashboard/bookings"
          />
        </div>

        {/* ── Mai teendők (valós, salonId scope) ── */}
        <div style={{ gridArea: 'tasks' }}>
          <OverviewTasksPanel salonId={String(salon.id)} initial={tasks} />
        </div>

        {/* ── Accordion (Mai bevétel / Nyitvatartás / Szolgáltatások / Munkatársak) — mobilon
             legalul, lg-től az avatar alatt, a bal oszlop alján. ── */}
        <div className="min-h-0" style={{ gridArea: 'accordion' }}>
          <OverviewAccordion items={accItems} defaultOpen={0} />
        </div>
      </div>
    </div>
  )
}
