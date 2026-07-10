import Link from 'next/link'
import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/activeBusiness'
import { getPayloadClient } from '@/lib/payload'
import { StoreSwitcher } from '@/components/dashboard/StoreSwitcher'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { ReservationActions } from '@/components/restaurant/ReservationActions'
import { OccupancyDonut, WeekBarChart } from '@/components/restaurant/OverviewCharts'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { OccupancyReportCard, OverviewAccordion, type AccItem } from '@/components/restaurant/OverviewPanels'
import { OverviewTasksPanel } from '@/components/restaurant/OverviewTasksPanel'
import { DetailSheet } from '@/components/restaurant/DetailSheet'
import { OverviewTimeline, type TimelineBlock, type TimelineRow } from '@/components/restaurant/OverviewTimeline'
import { CalendarDays, Users, Gauge, Plus } from 'lucide-react'
import { CARD, HeroKpi } from '@/components/dashboard/overview-ui'
import type { Reservation, Media, Task, OpeningHour } from '@/payload/payload-types'

// Idő-függő tartalom (naptár + header-pillek a szolgáltatás-nap szerint) → mindig frissüljön.
export const dynamic = 'force-dynamic'


const DOW_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DOW_HU: Record<string, string> = {
  monday: 'Hétfő', tuesday: 'Kedd', wednesday: 'Szerda', thursday: 'Csütörtök',
  friday: 'Péntek', saturday: 'Szombat', sunday: 'Vasárnap',
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}

export default async function RestaurantDashboardPage() {
  const [{ restaurant }, user] = await Promise.all([getOwnedRestaurant(), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  // HELYI dátum (nem UTC!) — a toISOString() hajnalban a helyi tegnapot adná, ezért a naptár és
  // a header-pillek a tegnapi foglalásokat mutatnák. A foglalás-dátumok is helyi napok.
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = ymd(now)
  const hour = now.getHours()
  const nowHM = `${String(hour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const todayLabel = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
  const greeting = hour < 10 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'

  const logoUrl = restaurant.logo && typeof restaurant.logo === 'object' ? (restaurant.logo as Media).url ?? null : null
  // Profil-kép a nagy kártyára: a fiók avatarja (Google-nál nagyobb méretet kérünk, hogy ne
  // legyen pixeles), fallback a logó, végül gradiens+monogram. A regex csak a Google-mintát
  // cseréli — más URL-t érintetlenül hagy.
  const rawAvatar = user?.avatar_url ?? null
  const userAvatar = rawAvatar && rawAvatar.includes('googleusercontent') ? rawAvatar.replace(/=s\d+-c/, '=s512-c') : rawAvatar
  const profileImg = userAvatar ?? logoUrl
  // A szerep a fiókból jön (lehet salon_owner akkor is, ha épp étteremben vagyunk), ezért
  // nem az üzlet-típust írjuk ki, csak a semleges „Tulajdonos"-t (admin kivétel).
  const roleLabel = user?.role === 'admin' ? 'Adminisztrátor' : 'Tulajdonos'
  const { active, businesses } = user ? await getActiveBusiness(user) : { active: null, businesses: [] }

  const [stats, todayAll, upcomingRes, tasksRes, openingRes] = await Promise.all([
    getRestaurantStats(restaurant.id),
    payload.find({
      collection: 'reservations',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { date: { equals: today } }] },
      sort: 'start_time', depth: 1, limit: 100, overrideAccess: true,
    }),
    // Közelgő foglalások: ma-mostantól előre, MINDEN státusz (a header-pillek bontásához is),
    // legközelebbi elöl. depth:1 hogy az asztalok (tables) neve is meglegyen.
    payload.find({
      collection: 'reservations',
      where: {
        and: [
          { restaurant: { equals: restaurant.id } },
          { date: { greater_than_equal: today } },
        ],
      },
      sort: ['date', 'start_time'], depth: 1, limit: 150, overrideAccess: true,
    }),
    payload.find({
      collection: 'tasks',
      where: { restaurant: { equals: restaurant.id } },
      sort: ['done', 'createdAt'], depth: 0, limit: 100, overrideAccess: true,
    }),
    payload.find({
      collection: 'opening-hours',
      where: { restaurant: { equals: restaurant.id } },
      depth: 0, limit: 14, overrideAccess: true,
    }),
  ])

  const all = todayAll.docs as Reservation[]

  // ── „Naptár" idővonal-panel: MINDIG a JELENLEGI 4 órás ablak az alap (ma). A megjelenített nap
  //    MA, ha van ma bármi aktív foglalás; különben a következő nap, amin van (zárás utáni szabály). ──
  const tomorrow = (() => { const d = new Date(now); d.setDate(now.getDate() + 1); return ymd(d) })()
  const minOfDay = (t: string | null) => { const [h, m] = (t ?? '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
  const calSource = (upcomingRes.docs as Reservation[])
  const isActive = (r: Reservation) => r.status !== 'cancelled' && r.status !== 'no_show'
  const todayActive = calSource.filter((r) => r.date === today && isActive(r))
  const futureActive = calSource
    .filter((r) => isActive(r) && r.date > today)
    .sort((a, b) => `${a.date}T${a.start_time ?? ''}`.localeCompare(`${b.date}T${b.start_time ?? ''}`))
  const tlDay = todayActive.length ? today : (futureActive.length ? futureActive[0].date : today)
  const tlSrc = tlDay === today ? todayActive : futureActive.filter((r) => r.date === tlDay)

  // Sorok = ASZTALOK: minden foglalás az asztalá(i) sorába kerül (asztal nélkül → „Nincs asztal").
  const rowMap = new Map<string, TimelineBlock[]>()
  for (const r of tlSrc) {
    const block: TimelineBlock = {
      id: String(r.id),
      name: r.customer_name,
      startMin: minOfDay(r.start_time),
      endMin: r.end_time ? minOfDay(r.end_time) : minOfDay(r.start_time) + 90,
      pax: r.pax,
      status: r.status,
      source: r.source,
      occasion: r.occasion ?? null,
      occasionIcon: r.occasion_icon ?? null,
    }
    const names = (r.tables ?? []).map((t) => (typeof t === 'object' ? (t.name ?? `#${t.id}`) : `#${t}`))
    const keys = names.length ? names : ['Nincs asztal']
    for (const k of keys) rowMap.set(k, [...(rowMap.get(k) ?? []), block])
  }
  const timelineRows: TimelineRow[] = [...rowMap.entries()]
    .sort((a, b) => (a[0] === 'Nincs asztal' ? 1 : b[0] === 'Nincs asztal' ? -1 : a[0].localeCompare(b[0], 'hu', { numeric: true })))
    .map(([table, blocks]) => ({ table, blocks }))

  const tlStartMins = tlSrc.map((r) => minOfDay(r.start_time))
  const tlEndMins = tlSrc.map((r) => (r.end_time ? minOfDay(r.end_time) : minOfDay(r.start_time) + 90))
  let tlHourMin = tlSrc.length ? Math.floor(Math.min(...tlStartMins) / 60) : (tlDay === today ? hour : 17)
  let tlHourMax = tlSrc.length ? Math.ceil(Math.max(...tlEndMins) / 60) : (tlDay === today ? hour + 4 : 21)
  if (tlDay === today) {
    // MA: a JELENLEGI 4 órás ablak MINDIG elférjen (akkor is, ha a foglalások előrébb/hátrébb esnek).
    tlHourMin = Math.min(tlHourMin, hour)
    tlHourMax = Math.max(tlHourMax, hour + 4)
  }
  tlHourMax = Math.max(tlHourMax, tlHourMin + 4) // legalább 4 óra fér el
  // Alap-ablak: MA a jelenlegi órától (= a jelenlegi 4 óra); más napon az első foglalás órájától.
  const tlInitWin = tlDay === today ? Math.max(tlHourMin, Math.min(hour, tlHourMax - 4)) : tlHourMin
  const tlDayLabel = tlDay === today ? 'Ma' : tlDay === tomorrow ? 'Holnap'
    : new Date(tlDay + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })

  const tasks = tasksRes.docs as Task[]
  const openingHours = openingRes.docs as OpeningHour[]

  const activeRes = all.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show')

  // ── Státusz-csík (header pillek): a MEGJELENÍTETT szolgáltatás-nap (tlDay) státusz-bontása —
  //    zárás után a következő nyitás napjának bontása. Ha egyáltalán nincs közelgő foglalás
  //    (zárva / nincs mit mutatni) → 0%-ra frissül (nem a lezárt nap régi adata). ──
  const pillRes = calSource.filter((r) => r.date === tlDay)
  const pillTotal = pillRes.length || 1
  const confirmedPct = Math.round((pillRes.filter((r) => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed').length / pillTotal) * 100)
  const pendingPct = Math.round((pillRes.filter((r) => r.status === 'pending').length / pillTotal) * 100)
  const cancelledPct = Math.round((pillRes.filter((r) => r.status === 'cancelled' || r.status === 'no_show').length / pillTotal) * 100)
  const avgParty = stats.reservationsToday > 0 ? Math.round((stats.paxToday / stats.reservationsToday) * 10) / 10 : 0

  // ── Heti oszlopdiagram: „Vendégek a héten" — az AKTUÁLIS hét (hétfő–vasárnap) napi pax-a.
  //    (Korábban gördülő 7 napot vett weekday-re rendezve, ami KEVERTE az e heti és múlt heti
  //    napokat — pl. a „Vas" a MÚLT vasárnap lehetett.) A trend `revenue` mezője a napi PAX-ot
  //    tárolja; a jövőbeli napok (nincs adat a trendben) 0-val jelennek meg.
  const DOW_SHORT = ['Vas', 'Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo']
  const paxByDate = new Map(stats.trend.map((d) => [d.date, d.revenue]))
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7)) // e hét hétfője
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(weekStart)
    dt.setDate(weekStart.getDate() + i)
    return { label: DOW_SHORT[dt.getDay()], value: paxByDate.get(ymd(dt)) ?? 0 }
  })
  const weekTotal = weekDays.reduce((s, d) => s + d.value, 0)
  const weekMax = Math.max(1, ...weekDays.map((d) => d.value))
  const weekPeak = Math.max(0, ...weekDays.map((d) => d.value))
  const weekBars = weekDays.map((d) => ({ ...d, peak: d.value === weekPeak && weekPeak > 0 }))

  // ── Nap×óra hőtérkép (10..22h) a Statisztikával egyező számítással ──
  const HM_HOURS = Array.from({ length: 13 }, (_, i) => i + 10)
  const hmGrid = Array.from({ length: 7 }, () => Array.from({ length: HM_HOURS.length }, () => 0))
  for (const [date, hoursArr] of Object.entries(stats.hourlyByDate)) {
    const dow = (new Date(date + 'T00:00:00').getDay() + 6) % 7
    HM_HOURS.forEach((h, hi) => { hmGrid[dow][hi] += hoursArr[h] ?? 0 })
  }
  let hmPeakDay = 0, hmPeakHour = HM_HOURS[0], hmBest = -1
  hmGrid.forEach((row, di) => row.forEach((v, hi) => { if (v > hmBest) { hmBest = v; hmPeakDay = di; hmPeakHour = HM_HOURS[hi] } }))
  const heatmap = { grid: hmGrid, hours: HM_HOURS, peakDayIdx: hmPeakDay, peakHour: hmPeakHour }

  // ── Foglalási források (ma, aktív) ──
  const srcOnline = activeRes.filter((r) => r.source === 'online').length
  const srcPhone = activeRes.filter((r) => r.source === 'phone').length
  const srcWalkIn = activeRes.filter((r) => r.source === 'walk_in').length

  // ── Asztalok (aktív) ──
  const tablesRes = await payload.find({
    collection: 'tables',
    where: { and: [{ restaurant: { equals: restaurant.id } }, { is_active: { equals: true } }] },
    depth: 0, limit: 200, overrideAccess: true,
  })
  const tableCount = tablesRes.totalDocs
  const totalSeats = (tablesRes.docs as { capacity?: number | null }[]).reduce((s, t) => s + (t.capacity ?? 0), 0)

  // ── Akkordeon-tartalmak (élő adat) ──
  const openingByDay = new Map(openingHours.map((o) => [o.day_of_week, o]))
  const accItems: AccItem[] = [
    {
      label: 'Nyitvatartás',
      body: (
        <div className="space-y-1.5">
          {DOW_ORDER.map((d) => {
            const oh = openingByDay.get(d)
            const open = oh?.is_open && oh.open_time && oh.close_time
            return (
              <div key={d} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">{DOW_HU[d]}</span>
                <span className={open ? 'font-medium text-ink' : 'text-ink-soft2'}>
                  {open ? `${oh!.open_time}–${oh!.close_time}` : 'Zárva'}
                </span>
              </div>
            )
          })}
        </div>
      ),
    },
    {
      label: 'Mai vendégszám',
      body: (
        <div className="flex items-end gap-2">
          <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{stats.paxToday}</div>
          <div className="pb-1.5 text-[13px] font-medium text-ink-soft">fő</div>
          {stats.paxTodayDiff !== 0 && (
            <div className={`ml-auto pb-1.5 text-xs font-semibold ${stats.paxTodayDiff >= 0 ? 'text-[#1D9D63]' : 'text-bad'}`}>
              {stats.paxTodayDiff >= 0 ? '+' : ''}{stats.paxTodayDiff}%
            </div>
          )}
        </div>
      ),
    },
    {
      label: 'Foglalási források',
      body: (
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-ink-soft">Online</span><span className="font-medium text-ink">{srcOnline}</span></div>
          <div className="flex justify-between"><span className="text-ink-soft">Telefon</span><span className="font-medium text-ink">{srcPhone}</span></div>
          <div className="flex justify-between"><span className="text-ink-soft">Beeső (walk-in)</span><span className="font-medium text-ink">{srcWalkIn}</span></div>
        </div>
      ),
    },
    {
      label: 'Asztalok',
      body: (
        <div className="flex items-end gap-2">
          <div className="text-[30px] font-light tracking-[-0.02em] text-ink">{tableCount}</div>
          <div className="pb-1.5 text-[13px] font-medium text-ink-soft">aktív asztal · {totalSeats} férőhely</div>
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
          <h1 className="mt-0.5 text-4xl font-light leading-[1.05] tracking-[-0.02em] text-ink lg:text-[46px]">{restaurant.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StoreSwitcher name={restaurant.name} logoUrl={logoUrl} businesses={businesses} activeKey={active ? `${active.type}:${active.id}` : null} />
          <Link
            href="/restaurant/bookings"
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
          <HeroKpi icon={CalendarDays} value={String(stats.reservationsToday)} label="Foglalás ma" />
          <HeroKpi icon={Users} value={String(stats.paxToday)} label="Vendég ma" />
          <HeroKpi icon={Gauge} value={String(avgParty)} label="Átl. létszám" />
        </div>
      </div>

      {/* ── BENTO (Crextio Desktop design) — 3 oszlop ──
           Bal: Profil-kártya → accordion. Közép: 2 grafikon-kártya → nagy trend.
           Jobb: Mai foglalások → Mai feladatok. */}
      <div className="grid grid-cols-1 gap-[5px] lg:grid-cols-[300px_minmax(0,1.5fr)_minmax(0,1.05fr)] lg:items-stretch">

        {/* ── COL1: Profil-kártya (kép-dominált, Crextio) + accordion ── */}
        <div className="flex flex-col gap-[5px]">
          <div className={`${CARD} relative shrink-0 overflow-hidden p-0`} style={{ aspectRatio: '0.82', transform: 'translateZ(0)' }}>
            {profileImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#3a2f12] via-[#9A7B1E] to-[#F1CE45] text-[56px] font-semibold text-white/90">
                {initials(user?.name ?? restaurant.name)}
              </div>
            )}
            {/* Név + jogosultság — CSAK ÜVEG (frosted). A blur-réteg külön van, a FELSŐ ÉLE
                maszkkal elmosódik (átlátszó→látható), így nincs éles vonal a blur tetején. */}
            <div className="absolute inset-x-0 bottom-0 p-4">
              {/* Frosted blur-réteg — a felső élén maszkkal fokozatosan úszik be. */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{
                  // A réteg a tartalom FÖLÉ nyúlik (-64px), így a lágyuló zóna a kép fölött van,
                  // a tartalom pedig végig a TELJES erős blurban ül (felül is takar).
                  top: '-64px',
                  background: 'rgba(255,255,255,0.16)',
                  backdropFilter: 'blur(36px) saturate(125%)',
                  WebkitBackdropFilter: 'blur(36px) saturate(125%)',
                  maskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 64px)',
                  // Saját kompozit-réteg → csökkenti a görgetés/átmenet alatti újrarajzolást.
                  transform: 'translateZ(0)',
                  willChange: 'transform',
                }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <div className="min-w-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,.45)' }}>
                  <div className="truncate text-[17px] font-semibold leading-tight text-white">{user?.name ?? restaurant.name}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-white/85">{roleLabel}</div>
                </div>
                <span
                  className="shrink-0 rounded-[14px] px-3 py-1.5 text-[12px] font-semibold text-white"
                  style={{
                    // Színtelen üveg: nincs fehér tint, ÉS a blur DESZATURÁLJA a hátteret,
                    // hogy ne vegye át a mögötte lévő gold/sötét színt — semleges, tiszta üveg.
                    background: 'transparent',
                    backdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    WebkitBackdropFilter: 'blur(14px) saturate(0.35) brightness(1.05)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18)',
                    textShadow: '0 1px 3px rgba(0,0,0,.45)',
                  }}
                >
                  {stats.reservationsToday} ma
                </span>
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <OverviewAccordion items={[accItems[1], accItems[0], accItems[2], accItems[3]]} defaultOpen={0} />
          </div>
        </div>

        {/* ── COL2: 2 grafikon-kártya + naptár idővonal ── */}
        <div className="flex min-h-0 flex-col gap-[5px]">
          <div className="grid grid-cols-1 gap-[5px] sm:grid-cols-2">
            {/* Foglalások a héten — oszlopdiagram (Crextio „Progress"-stílus) */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="flex items-start justify-between">
                <div className="text-[17px] font-medium text-ink">Vendégek a héten</div>
                <DetailSheet title="Vendégek a héten" subtitle="Napi létszám az elmúlt 7 napban">
                  <div className="mb-4 flex items-baseline gap-2">
                    <span className="text-[38px] font-light tracking-[-0.02em] text-ink">{weekTotal}</span>
                    <span className="text-[13px] text-ink-soft">vendég összesen</span>
                  </div>
                  <div className="mb-6 h-56 w-full min-w-0 rounded-[18px] bg-white p-3 shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
                    <WeekBarChart bars={weekBars} />
                  </div>
                  <div className="mb-2 text-[13px] font-medium text-ink-soft">Napi bontás</div>
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
                  <div className="mt-5 rounded-[16px] bg-[#f3f2ef] px-4 py-3 text-[13px] font-medium text-[#57564f]">
                    Legerősebb nap: <b className="text-ink">{weekBars.find((b) => b.peak)?.label ?? '—'}</b> ({weekPeak} vendég)
                  </div>
                </DetailSheet>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[32px] font-light tracking-[-0.02em] text-ink">{weekTotal}</span>
                <span className="text-[11.5px] leading-[1.2] text-ink-soft">vendég<br />a héten</span>
              </div>
              <div className="mt-4 flex flex-1 flex-col justify-end">
                {/* Oszlopok — függőleges vonal + kis pont az alján; háttérben vízszintes szaggatott vonal */}
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
                {/* Nap-címkék külön sorban, a pontok alatt igazítva */}
                <div className="mt-2 flex justify-between gap-1.5">
                  {weekBars.map((b, i) => (
                    <span key={i} className="flex-1 text-center text-[10px] font-medium text-ink-soft">{b.label}</span>
                  ))}
                </div>
              </div>
            </div>
            {/* Kihasználtság — donut gauge (Crextio „Time tracker"-stílus) */}
            <div className={`${CARD} flex flex-col p-[22px]`}>
              <div className="flex w-full items-start justify-between">
                <div className="text-[17px] font-medium text-ink">Kihasználtság</div>
                <DetailSheet title="Kihasználtság" subtitle="Mai telítettség és összetétel">
                  <div className="mb-6 flex items-center justify-center rounded-[18px] bg-white py-5 shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
                    <div className="scale-[1.35]">
                      <OccupancyDonut pct={stats.occupancyToday} centerLabel="mai telítettség" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { k: 'Vendég ma', v: `${stats.paxToday} fő` },
                      { k: 'Foglalás ma', v: String(stats.reservationsToday) },
                      { k: 'Átlagos létszám', v: `${avgParty} fő / foglalás` },
                    ].map((r) => (
                      <div key={r.k} className="flex items-center justify-between border-b border-dashed border-line pb-3">
                        <span className="text-[13.5px] text-ink-soft">{r.k}</span>
                        <span className="text-[15px] font-semibold text-ink">{r.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-[16px] bg-[#f3f2ef] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                    A telítettség a mai vendéglétszám és a nyitvatartásba beférő kapacitás aránya.
                  </div>
                </DetailSheet>
              </div>
              <div className="flex flex-1 items-center justify-center py-1">
                <div className="scale-[1.08]">
                  <OccupancyDonut pct={stats.occupancyToday} centerLabel="mai telítettség" />
                </div>
              </div>
              <div className="flex items-center justify-center gap-6">
                <div className="text-center"><div className="text-[15px] font-semibold text-ink">{stats.paxToday}</div><div className="text-[11px] text-[#A8A496]">vendég</div></div>
                <div className="h-[24px] w-px bg-line-strong" />
                <div className="text-center"><div className="text-[15px] font-semibold text-ink">{stats.reservationsToday}</div><div className="text-[11px] text-[#A8A496]">foglalás</div></div>
              </div>
            </div>
          </div>

          {/* Naptár — vízszintes idővonal-panel (óra-léptethető, foglalás-blokkok) */}
          <OverviewTimeline
            rows={timelineRows}
            hourMin={tlHourMin}
            hourMax={tlHourMax}
            initialWin={tlInitWin}
            dayLabel={tlDayLabel}
          />
        </div>

        {/* ── COL3: Mai teendők — 3 kis grafikon-gomb (Mind/Kész/Elérhető) + kapcsolható lista ── */}
        <OverviewTasksPanel restaurantId={String(restaurant.id)} initial={tasks} />
      </div>
    </div>
  )
}
