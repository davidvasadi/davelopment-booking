import { getOwnedSalon } from '@/lib/salonContext'
import { withAvatarFallback } from '@/lib/staffAvatars'
import { getCurrentUser } from '@/lib/auth'
import { getPayloadClient } from '@/lib/payload'
import { fixMediaUrl, capsWords } from '@/lib/utils'
import { deleteStaleTasks } from '@/lib/taskCleanup'
import { getDashboardStats } from '@/lib/dashboardStats'
import { getSetupFlags } from '@/lib/setupFlags'
import { SetupNudge } from '@/components/dashboard/SetupNudge'
import { OverviewInbox } from '@/components/shared/OverviewInbox'
import { getOverviewInbox } from '@/lib/overviewInbox'
import { OverviewTasksPanel } from '@/components/shared/OverviewTasksPanel'
import { DetailSheet } from '@/components/shared/DetailSheet'
import { OverviewTimeline, type TimelineBlock, type TimelineRow } from '@/components/shared/OverviewTimeline'
import { KeyRows, OverviewLayout, WeekDetail, headDate, segments, thousands } from '@/components/dashboard/OverviewLayout'
import { PhotoCard, RingCard, WeekCard } from '@/components/blocks/overview'
import { IconButton, Kpi, Note } from '@/components/ui-kit'
import { can } from '@/lib/permissions'
import { getMyUpcomingShifts } from '@/lib/myShifts'
import { StaffOverview } from '@/components/dashboard/StaffOverview'
import { ArrowUpRight, Banknote, CalendarDays, Clock, Wallet } from 'lucide-react'
import type { Booking, Service, StaffMember, Media, Task, Availability } from '@/payload/payload-types'
import { brandImage, type BrandPlace } from '@/lib/brandImage'

// Idő-függő tartalom (naptár + header-pillek) → mindig frissüljön.
export const dynamic = 'force-dynamic'

const DOW_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
// JS getDay() (0=Vasárnap) → day_of_week kulcs.
const JS_TO_DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const DOW_SHORT = ['Vas', 'Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo']

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

  const logoUrl = brandImage(salon as BrandPlace, 'dash') // vezérlőpult: az ikon, ha van (design 24.2)
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
    const todayLabel = capsWords(now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }))
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

  // Háttér-karbantartás: 7 napnál régebbi "korábbi" teendők törlése — nem blokkolja az oldalt.
  void deleteStaleTasks(payload, 'salon', salon.id)

  const [stats, todayAll, upcomingRes, tasksRes, availRes, staffRes] = await Promise.all([
    getDashboardStats(salon.id),
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { equals: today } }] },
      // sebesség: depth 1 + a szalonból csak a név (itt csak a munkatárs és a szolgáltatás neve kell)
      sort: 'start_time', depth: 1, populate: { salons: { name: true } }, limit: 100, overrideAccess: true,
    }),
    // Közelgő foglalások: ma-mostantól előre, MINDEN státusz — ha ma már nincs több aktív
    // foglalás (zárás után), a "Közelgő foglalások" idővonal a következő napra vált.
    payload.find({
      collection: 'bookings',
      where: { and: [{ salon: { equals: salon.id } }, { date: { greater_than_equal: today } }] },
      sort: ['date', 'start_time'], depth: 1, populate: { salons: { name: true } }, limit: 150, overrideAccess: true,
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
      // depth:1 kell, hogy az `avatar` a kép-objektummal (url) jöjjön, ne csak nyers ID-ként —
      // enélkül az Áttekintés idővonal sor-avatarjai sosem tudták kiolvasni a feltöltött fotót.
      depth: 1, limit: 100, overrideAccess: true,
    }),
  ])

  const all = todayAll.docs as Booking[]
  const activeBookings = all.filter((b) => b.status !== 'cancelled')
  const availability = availRes.docs as Availability[]
  // a munkatárs saját profilképe is (ha a szalonban nincs külön feltöltve) — ugyanaz, mint a Foglalásokban
  const staff = await withAvatarFallback(payload, staffRes.docs as StaffMember[])
  const tasks = tasksRes.docs as Task[]
  const staffCount = staff.length

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
  const staffAvatar = new Map(staff.map((s) => [s.name, s.avatar && typeof s.avatar === 'object' ? fixMediaUrl((s.avatar as Media).url ?? null) : null]))
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
      // Szalonnál a "N fő" értelmetlen (mindig 1) — a subline helyette az időpontot és a
      // szolgáltatást mutatja, a név pedig önmagában áll a felső sorban.
      name: b.customer_name,
      subline: `${b.start_time}${svcName ? ` · ${svcName}` : ''}`,
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
    .map(([table, blocks]) => ({ table, avatarUrl: table === 'Nincs szakember' ? undefined : staffAvatar.get(table), blocks }))

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
  // ma: a „most” körül indul (legfeljebb egy órával előtte), ha épp zajlik foglalás, annak az órájától — nem a nap első
  // (rég lezajlott) foglalásától; a kliens a „most” vonallal együtt tovább is lépteti
  const tlActiveStarts = tlStart.filter((_, i) => tlEnd[i] > nowMin)
  const tlActiveHour = tlActiveStarts.length ? Math.floor(Math.min(...tlActiveStarts) / 60) : null
  const tlInitWin = tlDay === today ? Math.max(tlHourMin, hour - 1, Math.min(hour, tlActiveHour ?? hour)) : tlHourMin
  const tlDayLabel = tlDay === today ? 'Ma' : tlDay === tomorrow ? 'Holnap'
    : capsWords(new Date(tlDay + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }))

  // ── Megoszlás-csík: a MEGJELENÍTETT nap (tlDay) bontása — zárás után a következő nyitás napjáé, mint az étteremnél.
  //    Szabad = a mai nyitott kapacitásból még le nem foglalt idő (órában). ──
  const pillRes = calSource.filter((b) => b.date === tlDay)
  const cnt = (f: (b: Booking) => boolean) => pillRes.filter(f).length
  const freeHours = Math.max(0, Math.round((capacityMins - bookedMins) / 60))
  const bar = segments([
    { label: 'Megerősített', value: cnt((b) => b.status === 'confirmed' || b.status === 'completed'), tone: 'dark' },
    { label: 'Függő', value: cnt((b) => b.status === 'pending'), tone: 'yellow' },
    { label: 'Szabad', value: tlDay === today ? freeHours : 0, tone: 'hatch', show: tlDay === today ? `${freeHours} óra` : '0' },
    { label: 'Lemondva', value: cnt((b) => b.status === 'cancelled'), tone: 'outline' },
  ])

  // Következő foglalás (ma még el nem kezdődött, különben a következő napé)
  const nextB = [...todayActiveB.filter((b) => minOfDay(b.start_time) >= nowMin), ...futureActiveB][0]
  const nextLabel = nextB ? (nextB.date === today ? 'Következő' : nextB.date === tomorrow ? 'Következő · holnap' : `Következő · ${nextB.date.slice(5).replace('-', '.')}.`) : 'Következő'

  // Üzlet-kártya: a borítókép, alul a mai nyitvatartás
  const coverUrl = salon.cover_image && typeof salon.cover_image === 'object' ? fixMediaUrl((salon.cover_image as Media).url ?? null) : null
  const todayOpen = openToday.length ? { start: openToday.map((a) => a.start_time ?? '').sort()[0], end: openToday.map((a) => a.end_time ?? '').sort().pop() } : null
  const openLabel = !todayOpen ? 'Ma zárva'
    : nowMin < minOfDay(todayOpen.start) ? `Ma ${todayOpen.start}-tól`
      : nowMin < minOfDay(todayOpen.end) ? `Nyitva · ${todayOpen.end}-ig` : 'Ma már zárva'

  // Hét (H–V): a zárt nap csíkos
  const openDows = new Set(availability.filter((a) => a.is_available !== false).map((a) => a.day_of_week))
  const DAY_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
  const weekCols = weekBars.map((b, i) => ({ d: DAY_SHORT[i], v: b.value, peak: b.peak, closed: !openDows.has(DOW_ORDER[i]) && b.value === 0 }))

  // ── Kezelendők (tegnap lezáratlan, jóváhagyásra vár, szülinap, lejáró utalvány) ──
  const yesterday = (() => { const d = new Date(now); d.setDate(now.getDate() - 1); return ymd(d) })()
  const inbox = await getOverviewInbox(payload, 'salon', salon.id, today, yesterday)

  // Onboarding-állapot az Indulás-pillhez (nyitvatartás + szolgáltatások kész-e).
  const setup = await getSetupFlags('salon', salon.id)

  return (
    <OverviewLayout
      start={<SetupNudge variant="salon" base="/dashboard" flags={setup} />}
      sub={`${headDate(now)} · ${salon.name}`}
      bar={bar}
      kpis={<>
        <Kpi icon={CalendarDays} value={String(stats.bookingsToday)} label="Foglalás ma" />
        <Kpi icon={Wallet} value={thousands(stats.revenueToday)} label="Várható bevétel (Ft)" />
        {salon.deposit_settings?.enabled && <Kpi icon={Banknote} value={thousands(stats.depositsToday)} label="Előleg ma (Ft)" />}
        <Kpi icon={Clock} value={nextB?.start_time ?? '—'} label={nextLabel} />
      </>}
      photo={<PhotoCard img={coverUrl} logo={fixMediaUrl(logoUrl)} title={salon.name} sub={openLabel} action={salon.slug ? <IconButton icon={ArrowUpRight} label="Foglalóoldal megnyitása" variant="onDark" href={`/${salon.slug}`} /> : undefined} />}
      week={<WeekCard total={weekTotal} days={weekCols} tag={String} action={
        <DetailSheet title="Foglalások a héten" subtitle="Napi foglalásszám az e-héten"><WeekDetail total={weekTotal} unit="foglalás összesen" days={weekCols} /></DetailSheet>
      } />}
      today={<RingCard pct={occupancy} foot={[`${stats.bookingsToday} foglalás`, `${staffCount} szakember`]} action={
        <DetailSheet title="Kihasználtság" subtitle="Mai foglalt idő a nyitott kapacitáshoz">
          <RingCard pct={occupancy} foot={[`${stats.bookingsToday} foglalás`, `${staffCount} szakember`]} action={<span />} className="bg-ui-cell" />
          <div className="mt-4"><KeyRows rows={[['Foglalás ma', stats.bookingsToday], ['Foglalt idő', `${Math.round((bookedMins / 60) * 10) / 10} óra`], ['Szakemberek', `${staffCount} fő`]]} /></div>
          <Note className="mt-4">A kihasználtság a mai lefoglalt idő és a nyitott (szakemberenkénti) kapacitás aránya.</Note>
        </DetailSheet>
      } />}
      tasks={<OverviewTasksPanel salonId={String(salon.id)} initial={tasks} />}
      accordion={<OverviewInbox inbox={inbox} restaurant={false} base="/dashboard" />}
      timeline={<OverviewTimeline rows={timelineRows} hourMin={tlHourMin} hourMax={tlHourMax} initialWin={tlInitWin} dayLabel={tlDayLabel} allHref="/dashboard/bookings" badge="duration" />}
    />
  )
}
