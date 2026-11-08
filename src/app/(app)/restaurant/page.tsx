import { getOwnedRestaurant } from '@/lib/restaurantContext'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { getRestaurantStats } from '@/lib/restaurantStats'
import { OverviewInbox } from '@/components/shared/OverviewInbox'
import { getOverviewInbox } from '@/lib/overviewInbox'
import { OverviewTasksPanel } from '@/components/shared/OverviewTasksPanel'
import { getSetupFlags } from '@/lib/setupFlags'
import { SetupNudge } from '@/components/dashboard/SetupNudge'
import { DetailSheet } from '@/components/shared/DetailSheet'
import { OverviewTimeline, type TimelineBlock, type TimelineRow } from '@/components/shared/OverviewTimeline'
import { KeyRows, OverviewLayout, WeekDetail, headDate, segments, thousands } from '@/components/dashboard/OverviewLayout'
import { PhotoCard, RingCard, WeekCard } from '@/components/blocks/overview'
import { IconButton, Kpi } from '@/components/ui-kit'
import { ArrowUpRight, Banknote, CalendarDays, Clock, Users } from 'lucide-react'
import { can } from '@/lib/permissions'
import { getMyUpcomingShifts } from '@/lib/myShifts'
import { StaffOverview } from '@/components/dashboard/StaffOverview'
import { fixMediaUrl, capsWords } from '@/lib/utils'
import { deleteStaleTasks } from '@/lib/taskCleanup'
import type { Reservation, Media, Task, OpeningHour, Shift } from '@/payload/payload-types'
import { brandImage, type BrandPlace } from '@/lib/brandImage'

// Idő-függő tartalom (naptár + header-pillek a szolgáltatás-nap szerint) → mindig frissüljön.
export const dynamic = 'force-dynamic'



// JS getDay() (0=Vasárnap) → day_of_week kulcs.
const JS_TO_DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

export default async function RestaurantDashboardPage() {
  const [{ restaurant, capabilities, roleName }, user] = await Promise.all([getOwnedRestaurant(), getCurrentUser()])
  const payload = await getPayloadClient()

  const now = new Date()
  // HELYI dátum (nem UTC!) — a toISOString() hajnalban a helyi tegnapot adná, ezért a naptár és
  // a header-pillek a tegnapi foglalásokat mutatnák. A foglalás-dátumok is helyi napok.
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = ymd(now)
  const hour = now.getHours()
  const todayLabel = capsWords(now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }))
  const greeting = hour < 10 ? 'Jó reggelt' : hour < 18 ? 'Jó napot' : 'Jó estét'

  const logoUrl = brandImage(restaurant as BrandPlace, 'dash') // vezérlőpult: az ikon, ha van (design 24.2)
  // Profil-kép a nagy kártyára: a fiók avatarja (Google-nál nagyobb méretet kérünk, hogy ne
  // legyen pixeles), fallback a logó, végül gradiens+monogram. A regex csak a Google-mintát
  // cseréli — más URL-t érintetlenül hagy.
  const rawAvatar = user?.avatar_url ?? null
  const userAvatar = rawAvatar && rawAvatar.includes('googleusercontent') ? rawAvatar.replace(/=s\d+-c/, '=s512-c') : rawAvatar
  const profileImg = userAvatar
  // A szerep a fiókból jön (lehet salon_owner akkor is, ha épp étteremben vagyunk), ezért
  // nem az üzlet-típust írjuk ki, csak a semleges „Tulajdonos"-t (admin kivétel).
  const roleLabel = user?.role === 'admin' ? 'Adminisztrátor' : roleName

  // Személyes áttekintés (saját műszak) az üzleti KPI-k helyett annak, aki NEM lát üzleti
  // statisztikát (`analytics.view`). A tulaj + a Statisztika-jogot kapó szerepek (Üzletvezető,
  // Supervisor) a teljes KPI-dashboardot kapják; a felszolgáló a személyes nézetet.
  if (user && !can(capabilities, 'analytics.view')) {
    const myShifts = await getMyUpcomingShifts({ type: 'restaurant', id: restaurant.id }, { id: user.id, email: user.email })
    // Avatar: user.avatar_url az első, ha az null → membership.avatar (amit a StaffManager tölt fel)
    let staffProfileImg = fixMediaUrl(profileImg)
    if (!staffProfileImg && user.email) {
      const memRes = await payload.find({
        collection: 'memberships',
        where: { and: [{ restaurant: { equals: restaurant.id } }, { email: { equals: user.email } }] },
        depth: 1, limit: 1, overrideAccess: true,
      })
      const mem = memRes.docs[0] as { avatar?: { url?: string } } | undefined
      if (mem?.avatar?.url) staffProfileImg = fixMediaUrl(mem.avatar.url)
    }
    return (
      <StaffOverview
        greeting={greeting}
        userName={user.name ?? 'Dolgozó'}
        roleLabel={roleLabel}
        businessName={restaurant.name}
        todayLabel={todayLabel}
        shifts={myShifts}
        profileImg={staffProfileImg}
        variant="restaurant"
      />
    )
  }
  // Háttér-karbantartás: 7 napnál régebbi "korábbi" teendők törlése — nem blokkolja az oldalt.
  void deleteStaleTasks(payload, 'restaurant', restaurant.id)

  const [[stats, upcomingRes, tasksRes, openingRes, shiftsTodayRes], setup] = await Promise.all([
    Promise.all([
    getRestaurantStats(restaurant.id),
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
      // sebesség: az étteremből csak a név (az asztalok kellenek — depth 1), ne a teljes adatlap foglalásonként
      sort: ['date', 'start_time'], depth: 1, populate: { restaurants: { name: true } }, limit: 150, overrideAccess: true,
    }),
    payload.find({
      collection: 'tasks',
      where: { restaurant: { equals: restaurant.id } },
      sort: ['done', 'createdAt'], depth: 1, limit: 100, overrideAccess: true,
    }),
    payload.find({
      collection: 'opening-hours',
      where: { restaurant: { equals: restaurant.id } },
      depth: 0, limit: 14, overrideAccess: true,
    }),
    // Mai műszakok — a „Személyzet ma" KPI-hoz (dolgozó betegszabadság/szabadság nélkül).
    payload.find({
      collection: 'shifts',
      where: { and: [{ restaurant: { equals: restaurant.id } }, { date: { equals: today } }, { type: { equals: 'shift' } }] },
      depth: 0, limit: 200, overrideAccess: true,
    }),
    ]),
    getSetupFlags('restaurant', restaurant.id),
  ])


  // ── Mai személyzet: a mai (nem szabadság/beteg) műszakra beosztott, ténylegesen felvett
  //    csapattagok (egyedi, a tulaj saját owner_shift fedezés-sorai NEM számítanak bele). ──
  const shiftsToday = shiftsTodayRes.docs as Shift[]
  const staffTodaySet = new Set(
    shiftsToday.filter((s) => !s.owner_shift && s.member).map((s) => (typeof s.member === 'object' && s.member ? s.member.id : s.member)),
  )
  const staffToday = staffTodaySet.size

  // ── „Naptár" idővonal-panel: MINDIG a JELENLEGI 4 órás ablak az alap (ma). A megjelenített nap
  //    MA, ha van ma olyan aktív foglalás, ami MÉG NEM ÉRT VÉGET (nem csak hogy volt ma bármi —
  //    egy rég lezárult mai foglalás önmagában NE tartsa "ma"-n, ha már elmúlt a záró időpontja);
  //    különben a következő nap, amin van (zárás utáni szabály). ──
  const tomorrow = (() => { const d = new Date(now); d.setDate(now.getDate() + 1); return ymd(d) })()
  const minOfDay = (t: string | null) => { const [h, m] = (t ?? '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
  const nowMin = hour * 60 + now.getMinutes()
  const calSource = (upcomingRes.docs as Reservation[])
  const isActive = (r: Reservation) => r.status !== 'cancelled' && r.status !== 'no_show'
  const todayActive = calSource.filter((r) => r.date === today && isActive(r))
  const todayHasUpcoming = todayActive.some((r) => (r.end_time ? minOfDay(r.end_time) : minOfDay(r.start_time) + 90) > nowMin)
  const futureActive = calSource
    .filter((r) => isActive(r) && r.date > today)
    .sort((a, b) => `${a.date}T${a.start_time ?? ''}`.localeCompare(`${b.date}T${b.start_time ?? ''}`))
  const tlDay = todayHasUpcoming ? today : (futureActive.length ? futureActive[0].date : today)
  const tlSrc = tlDay === today ? todayActive : futureActive.filter((r) => r.date === tlDay)

  // Sorok = ASZTALOK: minden foglalás az asztalá(i) sorába kerül (asztal nélkül → egyedi sor).
  const rowMap = new Map<string, { label: string; blocks: TimelineBlock[] }>()
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
    const tableNames = (r.tables ?? []).map((t) => (typeof t === 'object' ? (t.name ?? `#${t.id}`) : `#${t}`))
    const entries = tableNames.length
      ? tableNames.map((n) => ({ key: n, label: n }))
      : [{ key: `_na_${r.id}`, label: 'Nincs asztalhoz rendelve' }]
    for (const { key, label } of entries) {
      const ex = rowMap.get(key)
      rowMap.set(key, { label: ex?.label ?? label, blocks: [...(ex?.blocks ?? []), block] })
    }
  }
  const timelineRows: TimelineRow[] = [...rowMap.entries()]
    .sort((a, b) => (a[0].startsWith('_na_') ? 1 : b[0].startsWith('_na_') ? -1 : a[0].localeCompare(b[0], 'hu', { numeric: true })))
    .map(([table, { label, blocks }]) => ({ table, label, blocks }))

  const tlStartMins = tlSrc.map((r) => minOfDay(r.start_time))
  const tlEndMins = tlSrc.map((r) => (r.end_time ? minOfDay(r.end_time) : minOfDay(r.start_time) + 90))
  // A foglalás(ok) alapján számolt kezdő óra — ezt kell KEZDŐBŐL mutatni, NE a jelenlegi órát,
  // különben pl. hajnalban egy 11 órás mai foglalás elé a halott 00:00–x:00 sáv kerülne.
  const bookingHourMin = tlSrc.length ? Math.floor(Math.min(...tlStartMins) / 60) : null
  let tlHourMin = bookingHourMin ?? (tlDay === today ? hour : 17)
  let tlHourMax = tlSrc.length ? Math.ceil(Math.max(...tlEndMins) / 60) : (tlDay === today ? hour + 4 : 21)
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
  // ma: a „most” körül indul (legfeljebb egy órával előtte), ha épp zajlik foglalás, annak az órájától — nem a nap első
  // (rég lezajlott) foglalásától; a kliens a „most” vonallal együtt tovább is lépteti
  const tlActiveStarts = tlStartMins.filter((_, i) => tlEndMins[i] > nowMin)
  const tlActiveHour = tlActiveStarts.length ? Math.floor(Math.min(...tlActiveStarts) / 60) : null
  const tlInitWin = tlDay === today ? Math.max(tlHourMin, hour - 1, Math.min(hour, tlActiveHour ?? hour)) : tlHourMin
  const tlDayLabel = tlDay === today ? 'Ma' : tlDay === tomorrow ? 'Holnap'
    : capsWords(new Date(tlDay + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }))

  const tasks = tasksRes.docs as Task[]
  const openingHours = openingRes.docs as OpeningHour[]


  // ── Státusz-csík (header pillek): a MEGJELENÍTETT szolgáltatás-nap (tlDay) státusz-bontása —
  //    zárás után a következő nyitás napjának bontása. Ha egyáltalán nincs közelgő foglalás
  //    (zárva / nincs mit mutatni) → 0%-ra frissül (nem a lezárt nap régi adata). ──
  const pillRes = calSource.filter((r) => r.date === tlDay)
  const avgParty = stats.reservationsToday > 0 ? Math.round((stats.paxToday / stats.reservationsToday) * 10) / 10 : 0

  // ── Heti oszlopdiagram: „Következő 7 nap" — mai naptól számított 7 nap várható pax-a.
  //    Az upcomingRes már tartalmazza a jövőbeli (pending/confirmed) foglalásokat is.
  const DOW_SHORT = ['Vas', 'Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo']
  const upcomingActive = (upcomingRes.docs as Reservation[]).filter(
    (r) => r.status !== 'cancelled' && r.status !== 'no_show',
  )
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(now)
    dt.setDate(now.getDate() + i)
    const dtStr = ymd(dt)
    const dayPax = upcomingActive
      .filter((r) => r.date === dtStr)
      .reduce((s, r) => s + (r.pax ?? 0), 0)
    return { label: DOW_SHORT[dt.getDay()], value: dayPax }
  })
  const weekTotal = weekDays.reduce((s, d) => s + d.value, 0)
  const weekPeak = Math.max(0, ...weekDays.map((d) => d.value))
  const weekBars = weekDays.map((d) => ({ ...d, peak: d.value === weekPeak && weekPeak > 0 }))

  // Asztalok — a stats már lekérte, nem kell duplán DB-re menni.
  const tableCount = stats.tableCount
  const totalSeats = stats.totalSeats

  // ── Megoszlás-csík ASZTALOKBAN (4.6): a megjelenített nap foglalt / függő asztalai, a maradék szabad ──
  const tableIds = (f: (r: Reservation) => boolean) => new Set(pillRes.filter(f).flatMap((r) => (r.tables ?? []).map((t) => String(typeof t === 'object' ? t.id : t))))
  const bookedTables = tableIds((r) => r.status === 'confirmed' || r.status === 'seated' || r.status === 'completed')
  const pendingTables = [...tableIds((r) => r.status === 'pending')].filter((id) => !bookedTables.has(id))
  const freeTables = Math.max(0, tableCount - bookedTables.size - pendingTables.length)
  const bar = segments([
    { label: 'Foglalt asztal', value: bookedTables.size, tone: 'dark' },
    { label: 'Függő', value: pendingTables.length, tone: 'yellow' },
    { label: 'Szabad', value: freeTables, tone: 'hatch' },
  ])

  // Üzlet-kártya: a borítókép, alul a mai nyitvatartás
  const coverUrl = restaurant.cover_image && typeof restaurant.cover_image === 'object' ? fixMediaUrl((restaurant.cover_image as Media).url ?? null) : null
  const openingByDay = new Map(openingHours.map((o) => [o.day_of_week, o]))
  const ohToday = openingByDay.get(JS_TO_DOW[now.getDay()])
  const openLabel = !(ohToday?.is_open && ohToday.open_time && ohToday.close_time) ? 'Ma zárva'
    : nowMin < minOfDay(ohToday.open_time) ? `Ma ${ohToday.open_time}-tól`
      : nowMin < minOfDay(ohToday.close_time) || minOfDay(ohToday.close_time) < minOfDay(ohToday.open_time) ? `Nyitva · ${ohToday.close_time}-ig` : 'Ma már zárva'

  // Következő 7 nap vendégei (mától): a zárt nap csíkos
  const DAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo']
  const weekCols = weekBars.map((b, i) => {
    const dt = new Date(now); dt.setDate(now.getDate() + i)
    const oh = openingByDay.get(JS_TO_DOW[dt.getDay()])
    return { d: i === 0 ? 'ma' : DAY_SHORT[dt.getDay()], v: b.value, peak: b.peak, closed: !oh?.is_open && b.value === 0 }
  })

  // ── Kezelendők (tegnap lezáratlan, jóváhagyásra vár, szülinap, lejáró utalvány) ──
  const yesterday = (() => { const d = new Date(now); d.setDate(now.getDate() - 1); return ymd(d) })()
  const inbox = await getOverviewInbox(payload, 'restaurant', restaurant.id, today, yesterday)

  return (
    <OverviewLayout
      start={<SetupNudge variant="restaurant" base="/restaurant" flags={setup} />}
      sub={`${headDate(now)} · ${restaurant.name}`}
      bar={bar}
      kpis={<>
        <Kpi icon={CalendarDays} value={String(stats.reservationsToday)} label="Foglalás ma" />
        <Kpi icon={Users} value={String(stats.paxToday)} label="Vendég ma (fő)" />
        <Kpi icon={Clock} value={`${stats.occupancyToday}%`} label="Telítettség" />
        {restaurant.deposit_settings?.enabled && <Kpi icon={Banknote} value={thousands(stats.depositsToday)} label="Előleg ma (Ft)" />}
      </>}
      photo={<PhotoCard img={coverUrl} logo={fixMediaUrl(logoUrl)} title={restaurant.name} sub={openLabel} action={restaurant.slug ? <IconButton icon={ArrowUpRight} label="Foglalóoldal megnyitása" variant="onDark" href={`/${restaurant.slug}`} /> : undefined} />}
      week={<WeekCard title="Vendégek" total={weekTotal} unit="fő a következő 7 napban" days={weekCols} tag={(v) => `${v} fő`} action={
        <DetailSheet title="Köv. 7 nap vendégei" subtitle="Napi várható vendéglétszám"><WeekDetail total={weekTotal} unit="fő összesen" days={weekCols} /></DetailSheet>
      } />}
      today={<RingCard sub="a férőhelyekből foglalt" pct={stats.occupancyToday} foot={[`${staffToday} fő személyzet`, `átl. ${avgParty} fő / foglalás`]} action={
        <DetailSheet title="Kihasználtság" subtitle="Mai telítettség és összetétel">
          <RingCard sub="a férőhelyekből foglalt" pct={stats.occupancyToday} foot={[`${stats.reservationsToday} foglalás`, `${stats.paxToday} fő`]} action={<span />} className="bg-ui-cell" />
          <div className="mt-4"><KeyRows rows={[['Foglalás ma', stats.reservationsToday], ['Vendég ma', `${stats.paxToday} fő`], ['Átlagos létszám', `${avgParty} fő / foglalás`], ['Asztalok', `${tableCount} · ${totalSeats} férőhely`], ['Személyzet ma', `${staffToday} fő`]]} /></div>
        </DetailSheet>
      } />}
      tasks={<OverviewTasksPanel restaurantId={String(restaurant.id)} initial={tasks} />}
      accordion={<OverviewInbox inbox={inbox} restaurant={true} base="/restaurant" />}
      timeline={<OverviewTimeline rows={timelineRows} hourMin={tlHourMin} hourMax={tlHourMax} initialWin={tlInitWin} dayLabel={tlDayLabel} allHref="/restaurant/bookings" compactPx={96} tableCol={52} />}
    />
  )
}
