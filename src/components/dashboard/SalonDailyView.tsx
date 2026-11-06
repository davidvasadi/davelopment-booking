'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { hhmmToMinutes, ymdLocal, fixMediaUrl } from '@/lib/utils'
import { Check, Clock, Wallet, CalendarDays, Coffee, FileSignature, Phone, X } from 'lucide-react'
import type { BookingsRange } from '@/components/shared/BookingsDateNav'
import { BookingsHead, EmptyDayBar, EMPTY_FILTER, type NextBooking, applyBookingFilter, type BookingFilter } from '@/components/shared/BookingsHead'
import { segments, thousands } from '@/components/dashboard/OverviewLayout'
import { Avatar, Card, FieldRow, Kpi, Meta, Note, StatusPill } from '@/components/ui-kit'
import { BookingDrawer, type DrawerAction } from '@/components/shared/BookingDrawer'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { setBookingStatus } from '@/components/dashboard/ApprovalActions'
import { markLocalMutation } from '@/lib/localMutationTracker'
import { MobileDayTimeline, hourRows } from '@/components/blocks/day-timeline'
import { DayStrip } from '@/components/shared/BookingsDateNav'
import { ResourceGrid, shortAlert } from '@/components/shared/ResourceGrid'
import { STATUS_LEGEND, statusBlockClass, statusCard } from '@/components/shared/statusColors'
import { BlockLegend, BookingFacts } from '@/components/blocks/booking'
import { BookingList, statusOf } from '@/components/shared/BookingList'
import { SalonOfflineBanner } from '@/components/dashboard/SalonOfflineBanner'
import { BookingEditSheet, type EditTarget } from '@/components/dashboard/BookingEditSheet'
import { getDrafts, subscribeDrafts, type SalonBookingDraft } from '@/lib/salonBookingDrafts'
import type { Booking, Service, StaffMember, Media } from '@/payload/payload-types'
import { BookingCheckout, type OnsiteSettings } from './BookingCheckout'
import { AttentionPill } from '@/components/blocks/booking'

type ViewMode = 'list' | 'timeline'

export const ACTIVE = new Set(['pending', 'confirmed', 'completed', 'cancelled'])
/** Élő, percenként frissülő aktuális idő (perc éjféltől). null, ha a megtekintett nap nem ma van. */
function useNowMinutes(date: string): number | null {
  const calc = () => {
    const now = new Date()
    if (ymdLocal(now) !== date) return null
    return now.getHours() * 60 + now.getMinutes()
  }
  const [min, setMin] = useState<number | null>(calc)
  useEffect(() => {
    setMin(calc())
    const id = setInterval(() => setMin(calc()), 30_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])
  return min
}

/** Egyszerű sürgősség-jelzés: megerősített foglalás, de a kezdés ideje már elmúlt (ma). */
function urgencyOf(b: Booking, nowMin: number | null): { label: string } | null {
  if (nowMin == null) return null
  const start = hhmmToMinutes(b.start_time)
  if (b.status === 'confirmed' && nowMin > start) {
    return { label: `Késik ${nowMin - start} p` }
  }
  return null
}

/** Fizetésre vár (design 6.8.1 — 1. fokozat): helyszíni fizetés bekapcsolva, a megerősített foglalás véget ért, és még
 *  nincs lezárva fizetéssel. A jel a blokkon és a soron, amíg el nem intézik. */
export function paymentDue(b: Booking, onsiteOn: boolean, date: string, nowMin: number | null): boolean {
  if (!onsiteOn || b.status !== 'confirmed' || b.paid_at) return false
  const today = ymdLocal(new Date())
  return date < today || (date === today && nowMin != null && nowMin >= hhmmToMinutes(b.end_time))
}

// ── segéd-getterek (a reláció lehet id vagy kifejtett objektum) ──
export const idOf = (v: unknown): string =>
  v && typeof v === 'object' ? String((v as { id: string | number }).id) : String(v ?? '')
const serviceOf = (b: Booking): Service | null => (typeof b.service === 'object' ? b.service : null)
export const staffOf = (b: Booking): StaffMember | null => (typeof b.staff === 'object' ? b.staff : null)
const durationOf = (b: Booking): number => Math.max(0, hhmmToMinutes(b.end_time) - hhmmToMinutes(b.start_time))
export const avatarUrlOf = (s: StaffMember | null): string | null => {
  const a = s?.avatar
  return a && typeof a === 'object' ? fixMediaUrl((a as Media).url) : null
}

/** Lokális vázlatból „ál-foglalás" készül, ami beleilleszkedik a nézetekbe, de __draft-tal jelölt. */
type DraftBooking = Booking & { __draft: true; draftId: string }
export function isDraft(b: Booking): b is DraftBooking {
  return (b as DraftBooking).__draft === true
}
export function draftToBooking(d: SalonBookingDraft): DraftBooking {
  const end = d.end_time || d.start_time
  return {
    id: d.draftId as unknown as string,
    customer_name: d.customer_name || 'Foglalás',
    customer_phone: d.customer_phone || '',
    customer_email: d.customer_email || '',
    date: d.date,
    start_time: d.start_time,
    end_time: end,
    notes: d.notes || '',
    status: (d.status || 'confirmed') as Booking['status'],
    service: { id: d.serviceId, name: d.serviceName ?? '—' } as unknown as Booking['service'],
    staff: { id: d.staffId, name: d.staffName ?? '—' } as unknown as Booking['staff'],
    __draft: true,
    draftId: d.draftId,
  } as unknown as DraftBooking
}

export interface SalonDailyViewProps {
  /** Üres napon a következő foglalás (design 6.3) és a foglalóoldal címe a megosztáshoz. */
  nextBooking?: NextBooking
  publicUrl?: string | null
  date: string
  /** A jelenlegi időszak-nézet (Nap/Hét/Hónap) — a mobil nézet-választó sheet-be ágyazott
   *  Nap/Hét/Hónap váltóhoz kell (ld. dateFilter komment). Ezen az oldalon mindig 'day'. */
  range: BookingsRange
  salonId: string
  bookings: Booking[]
  staff: StaffMember[]
  services: Service[]
  openMin: number
  closeMin: number
  /** Azok az email-ek (kisbetűs), akiknek van függőben lévő meghívójuk — amíg nem fogadják el,
   *  nem oszthatók be foglalásra (lakat + UX infó, ld. BookingEditSheet). */
  invitedEmails?: Set<string>
  /** staffId → aznapi szünet (Shifts.break_start/end) — az idősávon "zárva" stílusú, a
   *  foglaló oldalon néma sávként jelenik meg (mintha foglalt lenne, semmi külön jelzés ott). */
  staffBreaks?: Record<string, { start: string; end: string }>
  /** staffId → szabadnapos/szabadságon/beteg aznap (Shifts.type) — a teljes oszlopa ez alapján
   *  jelenik meg az idősávon, nem az üres/beosztatlan hatch-mintával. */
  staffOffType?: Record<string, 'leave' | 'sick' | 'vacation'>
  /** A bejelentkezett user SAJÁT (linkelt) staff-id-je, ha van — mobilon a kevert (tulaj)
   *  nézetben is elsődleges helyen jelenik meg a SAJÁT szünete/szabadnapja, nem a "+N" alatt. */
  viewerStaffId?: string
  /** A megjelenített nap zárva van (egyszeri kivétel vagy heti visszatérő zárvatartás) — az üres
   *  (beosztatlan) sávok ilyenkor a Naptár "Zárva" mintázatát kapják sima kréme hatch helyett. */
  isClosedToday?: boolean
  /** Értesítésből érkezve ezt a foglalást nyitjuk meg automatikusan. */
  openBookingId?: string
  /** A toolbar-ba ágyazott dátum-navigátor (server komponensből). */
  dateFilter: React.ReactNode
  /** A toolbar-ba ágyazott nap-nyomtatás gomb (server komponensből). */
  printButton?: React.ReactNode
  /** Ha false, csak olvasható nézet — az Új foglalás gomb, szerkesztés és drag rejtve. */
  canManage?: boolean
  /** A szalon beleegyező nyilatkozat funkciója be van-e kapcsolva. */
  consentEnabled?: boolean
  /** Fizetés a helyszínen (Beállítások › Fizetés & számlázás) — a megnyitott foglalás „Fizetés” gombjához */
  onsite?: OnsiteSettings | null
}

export function SalonDailyView(props: SalonDailyViewProps) {
  const { date, range, salonId, staff, services, openMin, closeMin, invitedEmails, staffBreaks = {}, staffOffType = {}, viewerStaffId, isClosedToday = false, openBookingId, dateFilter, printButton, canManage = false, consentEnabled = false, onsite = null } = props
  const [view, setView] = useState<ViewMode>('timeline')
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<SalonBookingDraft[]>([])
  const router = useRouter()

  // Lokális vázlatok betöltése + élő követése.
  useEffect(() => {
    setDrafts(getDrafts(salonId))
    return subscribeDrafts(salonId, setDrafts)
  }, [salonId])

  // Az oldal mindig az Idősáv nézettel nyílik (nem a legutóbb választottal).


  const pick = (v: ViewMode) => {
    setView(v)
  }

  // A vázlatok beolvadnak a foglalások közé (jelölve maradnak). Csak az adott napiak.
  const bookings = useMemo(() => {
    const dayDrafts = drafts.filter((d) => d.date === date).map(draftToBooking)
    return [...props.bookings, ...dayDrafts]
  }, [props.bookings, drafts, date])

  const dayDrafts = useMemo(
    () => drafts.filter((d) => d.date === date).sort((a, b) => a.createdAt - b.createdAt),
    [drafts, date],
  )

  // Értesítésből érkezve (?booking=) automatikusan megnyitjuk a szerkesztőt.
  const lastOpenedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!openBookingId || lastOpenedRef.current === openBookingId) return
    const b = props.bookings.find((x) => String(x.id) === String(openBookingId))
    if (b) { lastOpenedRef.current = openBookingId; setOpened(b) }
  }, [openBookingId, props.bookings])

  // Kattintás egy foglalásra: a megnyitott foglalás lapja (design 6.7); a vázlat egyből a szerkesztőben nyílik.
  const [opened, setOpened] = useState<Booking | null>(null)
  const openEdit = (b: Booking) => { if (isDraft(b)) { if (canManage) setTarget({ booking: b }) } else setOpened(b) }
  const openCreate = (presetStart?: string, presetStaffId?: string | number | null) => {
    if (canManage) setTarget({ booking: null, presetStart, presetStaffId })
  }

  // Mobilon az "Új foglalás" a fejléc csengő melletti ikonjából nyílik (DashboardNav dispatch-eli)
  // — a gomb maga a toolbarból mobilon rejtve, ld. lent.
  useEffect(() => {
    const handler = () => openCreate()
    window.addEventListener('davelopment:open-bookings-create', handler)
    return () => window.removeEventListener('davelopment:open-bookings-create', handler)
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps

  // A főoldal fejléc-ikonja `?new=1`-gyel érkezik ide → rögtön megnyitjuk az új-foglalás panelt,
  // és a paramétert eltávolítjuk az URL-ből (frissítésnél ne nyíljon meg újra).
  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('new') !== '1') return
    url.searchParams.delete('new')
    window.history.replaceState(null, '', url.pathname + url.search)
    openCreate()
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps

  // Áthelyezés drag&drop-ból: új időpont és/vagy szakember. A szerver validál (átfedés).
  // Hibánál a router.refresh visszaállítja az eredeti pozíciót, és toast jelzi az okot.
  const moveBooking = async (b: Booking, newStart: string, newStaffId: string | number): Promise<boolean> => {
    if (isDraft(b)) return false
    try {
      const res = await fetch('/api/salon/manage-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId: b.id,
          serviceId: idOf(b.service),
          staffId: newStaffId,
          date,
          start_time: newStart,
          customer_name: b.customer_name,
          customer_phone: b.customer_phone ?? '',
          customer_email: b.customer_email,
          notes: b.notes ?? '',
          status: b.status,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Az áthelyezés nem sikerült')
      toast.success('Foglalás áthelyezve')
      router.refresh()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Az áthelyezés nem sikerült')
      router.refresh()
      return false
    }
  }

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active !== false), [staff])


  const pickRange = (v: BookingsRange) => router.push(`/dashboard/bookings?date=${date}&range=${v}`)

  // A fejléc csíkja és számai a nap valós adataiból (vázlatokkal együtt, szűrés nélkül).
  const nowMin = useNowMinutes(date)
  const cnt = (st: string) => bookings.filter((b) => b.status === st).length
  const live = bookings.filter((b) => b.status !== 'cancelled')
  const revenue = live.reduce((sum, b) => sum + (b.price_snapshot ?? (typeof b.service === 'object' && b.service ? b.service.price : 0) ?? 0), 0)
  const capacity = Math.max(0, closeMin - openMin) * Math.max(1, activeStaff.length)
  const fill = capacity ? Math.min(100, Math.round((live.reduce((sum, b) => sum + durationOf(b), 0) / capacity) * 100)) : 0

  // Szűrés (munkatárs, státusz, forrás, keresés) — az idővonal és a lista is a szűrt napot mutatja.
  const [filter, setFilter] = useState<BookingFilter>(EMPTY_FILTER)
  const shown = useMemo(
    () => applyBookingFilter(bookings, filter, (b) => [idOf(b.staff)], (b) => b.status === 'confirmed' && nowMin != null && nowMin > hhmmToMinutes(b.start_time)),
    [bookings, filter, nowMin],
  )
  const VIEWS: ViewMode[] = ['timeline', 'list']

  return (
    <div className="space-y-5">
      <SalonOfflineBanner
        salonId={salonId}
        drafts={dayDrafts}
        onReview={(d) => setTarget({ booking: draftToBooking(d) })}
      />

      <BookingsHead
        dateNav={dateFilter}
        range={range}
        onRange={pickRange}
        date={date}
        onDate={(d) => router.push(`/dashboard/bookings?date=${d}&range=day`)}
        loadEndpoint="/api/salon/day-load"
        views={['Idővonal', 'Lista']}
        view={VIEWS.indexOf(view)}
        onView={(i) => pick(VIEWS[i])}
        filter={filter}
        onFilter={setFilter}
        who={activeStaff.map((s) => ({ id: String(s.id), label: s.name, img: avatarUrlOf(s) }))}
        matchCount={shown.length}
        exportButton={printButton}
        onCreate={canManage ? () => openCreate() : undefined}
        bar={segments([
          { label: 'Megerősített', value: cnt('confirmed'), tone: 'dark' },
          { label: 'Függő', value: cnt('pending'), tone: 'yellow' },
          { label: 'Befejezett', value: cnt('completed'), tone: 'white' },
          { label: 'Lemondva', value: cnt('cancelled'), tone: 'outline' },
        ])}
        kpis={<>
          <Kpi icon={CalendarDays} value={String(live.length)} label="Foglalás" />
          <Kpi icon={Wallet} value={thousands(revenue)} label="Bevétel (Ft)" />
          <Kpi icon={Clock} value={`${fill}%`} label="Telítettség" />
        </>}
      />

      {!props.bookings.some((b) => b.status !== 'cancelled') && <EmptyDayBar next={props.nextBooking ?? null} base="/dashboard" publicUrl={props.publicUrl} />}

      {view === 'list' && <ListTableView date={date} bookings={shown} onEdit={openEdit} openId={opened ? String(opened.id) : null} onsiteOn={!!onsite?.enabled} />}
      {view === 'timeline' && (
        <TimelineView
          onsiteOn={!!onsite?.enabled}
          date={date}
          bookings={shown}
          // munkatárs-szűrésnél csak az ő soruk marad az idővonalon (nem üres sorok a többieké)
          staff={filter.who.length ? activeStaff.filter((t) => filter.who.includes(String(t.id))) : activeStaff}
          openMin={openMin}
          closeMin={closeMin}
          staffBreaks={staffBreaks}
          staffOffType={staffOffType}
          viewerStaffId={viewerStaffId}
          isClosedToday={isClosedToday}
          onEdit={openEdit}
          onCreate={openCreate}
          onMove={moveBooking}
          canManage={canManage}
        />
      )}

      {opened && (
        <SalonBookingDrawer
          key={String(opened.id)}
          b={bookings.find((x) => String(x.id) === String(opened.id)) ?? opened}
          date={date}
          canManage={canManage}
          consentEnabled={consentEnabled}
          onsite={onsite}
          onClose={() => setOpened(null)}
          onEdit={() => { const b = opened; setOpened(null); setTarget({ booking: b }) }}
        />
      )}

      <BookingEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={date}
        salonId={salonId}
        target={target}
        services={services}
        staff={staff}
        openMin={openMin}
        closeMin={closeMin}
        invitedEmails={invitedEmails}
      />

    </div>
  )
}

/* ---------- Lista nézet (egynapos) — a közös BookingList (design 6.2) ---------- */
function ListTableView({ date, bookings, onEdit, openId, onsiteOn = false }: { date: string; bookings: Booking[]; onEdit: (b: Booking) => void; openId: string | null; onsiteOn?: boolean }) {
  const nowMin = useNowMinutes(date)
  const byId = new Map(bookings.map((b) => [String(b.id), b]))
  return (
    <BookingList
      openId={openId}
      mobileTop={<DayStrip base="/dashboard" date={date} />}
      onOpen={(id) => { const b = byId.get(id); if (b) onEdit(b) }}
      items={bookings.map((b) => {
        const svc = serviceOf(b)
        const st = staffOf(b)
        const draft = isDraft(b)
        const late = !draft && needsHandling(b, nowMin) ? nowMin! - hhmmToMinutes(b.start_time) : null
        return {
          id: String(b.id),
          start: b.start_time,
          title: b.customer_name || 'Vendég',
          meta: [svc?.name, st?.name].filter(Boolean).join(' · '),
          who: st ? { name: st.name, img: avatarUrlOf(st) } : undefined,
          source: b.source,
          deposit: b.payment_status === 'paid' ? 'paid' : b.payment_status === 'failed' ? 'failed' : null,
          series: !!b.series_id,
          draft,
          status: !draft && paymentDue(b, onsiteOn, date, nowMin) ? { tone: 'pending' as const, label: 'Fizetésre vár' } : statusOf(b.status, late),
          cancelled: b.status === 'cancelled',
        }
      })}
    />
  )
}


type TLProps = {
  onsiteOn?: boolean
  date: string
  bookings: Booking[]
  staff: StaffMember[]
  openMin: number
  closeMin: number
  staffBreaks?: Record<string, { start: string; end: string }>
  staffOffType?: Record<string, 'leave' | 'sick' | 'vacation'>
  viewerStaffId?: string
  isClosedToday?: boolean
  onEdit: (b: Booking) => void
  onCreate: (start?: string, staffId?: string | number | null) => void
  onMove: (b: Booking, newStart: string, newStaffId: string | number) => Promise<boolean>
  canManage?: boolean
}

function TimelineView({ onsiteOn = false, date, bookings, staff, openMin, closeMin, staffBreaks = {}, staffOffType = {}, viewerStaffId, isClosedToday = false, onEdit, onCreate, onMove, canManage = false }: TLProps) {
  const nowMin = useNowMinutes(date)

  // Ha a nyitás nem kerek órakor van, a nyitás saját időpontja is kap jelölést — különben a
  // tengely csak a következő kerek órától indult, és a nyitás utáni első szakasz jelöletlen/
  // "levágottnak" tűnt.
  const hourMarks: number[] = []
  if (openMin % 60 !== 0) hourMarks.push(openMin)
  for (let m = Math.ceil(openMin / 60) * 60; m < closeMin; m += 60) hourMarks.push(m)

  const active = bookings.filter((b) => ACTIVE.has(b.status))

  return (
    <>
      <div className="lg:hidden">
        <MobileTimeline {...{ date, active, openMin, closeMin, nowMin, onEdit, staff, staffBreaks, staffOffType, viewerStaffId, isClosedToday }} />
      </div>
      {/* Desktop (design 6.1): munkatársanként egy sor, vízszintesen az idő — a közös rács, mint az étteremnél */}
      <div className="hidden lg:block">
        <SalonDayGrid {...{ bookings: active, staff, openMin, closeMin, staffBreaks, staffOffType, isClosedToday, nowMin, canManage, onEdit, onMove }} payDue={(b) => paymentDue(b, onsiteOn, date, nowMin)} />
      </div>
    </>
  )
}

/** A szalon napi idővonala desktopon (design 6.1 / 6.3): munkatársanként egy sor — a közös ResourceGrid. A design oldal is
 *  ezt mutatja (mintaadattal, rögzített „most”-tal). `overlay`: munkatárs-id → a sávra rajzolt plusz elem. */
export function SalonDayGrid({ bookings: active, staff, openMin, closeMin, staffBreaks = {}, staffOffType = {}, isClosedToday = false, nowMin, canManage = false, onEdit, onMove, overlay, staffSub, payDue }: {
  /** Fizetésre vár (6.8.1) — a blokkon sárga jel */
  payDue?: (b: Booking) => boolean
  bookings: Booking[]
  staff: StaffMember[]
  openMin: number
  closeMin: number
  staffBreaks?: Record<string, { start: string; end: string }>
  staffOffType?: Record<string, 'leave' | 'sick' | 'vacation'>
  isClosedToday?: boolean
  nowMin: number | null
  canManage?: boolean
  onEdit: (b: Booking) => void
  onMove?: (b: Booking, newStart: string, newStaffId: string | number) => Promise<boolean>
  overlay?: Record<string, (pos: (min: number) => string) => React.ReactNode>
  /** a név alatti sor munkatársanként (pl. heti óra) — alapból a pozíció */
  staffSub?: Record<string, string>
}) {
  const dayEnd = active.reduce((max, b) => Math.max(max, hhmmToMinutes(b.end_time)), closeMin)
  const unassigned = active.filter((b) => !idOf(b.staff) || !staff.some((t) => String(t.id) === idOf(b.staff)))
  return (
    <ResourceGrid<Booking>
      groups={[{
        key: 'staff',
        rows: [
          ...staff.map((t) => {
            const brk = staffBreaks[String(t.id)]
            const off = staffOffType[String(t.id)]
            return {
              id: String(t.id),
              name: t.name,
              label: (
                <span className="flex items-center gap-2.5">
                  <Avatar size="sm" src={avatarUrlOf(t)} name={t.name} />
                  <span className="min-w-0"><span className="block truncate text-ui-body text-ui-text">{t.name}</span><span className="block truncate text-ui-label text-ui-muted">{off ? OFF_TYPE_LABEL[off] : staffSub?.[String(t.id)] ?? t.role_title}</span></span>
                </span>
              ),
              items: active.filter((b) => idOf(b.staff) === String(t.id)),
              bands: brk ? [{ start: hhmmToMinutes(brk.start), end: hhmmToMinutes(brk.end), label: 'Szünet', icon: Coffee }] : undefined,
              off: off ? OFF_TYPE_LABEL[off] : undefined,
              overlay: overlay?.[String(t.id)],
            }
          }),
          ...(unassigned.length ? [{ id: '__no_staff__', name: 'Nincs szakember', label: <span className="text-ui-body text-ui-muted">Nincs szakember</span>, items: unassigned, noDrop: true }] : []),
        ],
      }]}
      access={{
        id: (b) => String(b.id),
        start: (b) => hhmmToMinutes(b.start_time),
        end: (b) => hhmmToMinutes(b.end_time),
        status: (b) => b.status,
        draft: isDraft,
        createdAt: (b) => b.createdAt,
        // a 30 percen belül kezdődő megerősített foglalás „hamarosan” (körvonalas) — design 6.1
        // a mobil kártyával egyező színek (shared/statusColors)
        tone: (b) => statusBlockClass(b.status),
        dot: (b) => (b.status === 'cancelled' || b.status === 'no_show' ? undefined : statusCard(b.status).dot),
        dragLabel: (b) => `${b.customer_name}${serviceOf(b) ? ` · ${serviceOf(b)!.name}` : ''}`,
        block: (b, size) => {
          const due = !isDraft(b) && !!payDue?.(b)
          const u = isDraft(b) || due ? null : urgencyOf(b, nowMin)
          const svc = serviceOf(b)?.name
          return {
            title: b.customer_name,
            sub: size === 'tiny' ? undefined : svc,
            // design 6.1: a riasztás pill a blokkban — keskenyebb blokkban rövidítve („146'”), a legrövidebbben csak pötty
            badge: due ? (size === 'tiny' ? <span className="h-2 w-2 shrink-0 rounded-full bg-ui-yellow" /> : <AttentionPill className="shrink-0" />) : u && (size === 'tiny' ? <span className="h-2 w-2 shrink-0 rounded-full bg-ui-bad-dot" /> : <StatusPill status="bad" className="shrink-0">{size === 'wide' ? u.label : shortAlert(u.label)}</StatusPill>),
            tooltip: `${isDraft(b) ? 'VÁZLAT — ' : canManage ? 'Kattints a szerkesztéshez, vagy húzd át másik időpontra/szakemberhez · ' : ''}${b.customer_name} · ${b.start_time}–${b.end_time}${svc ? ` · ${svc}` : ''}${u ? ` · ${u.label}` : ''}`,
          }
        },
      }}
      stack={groupOverlaps}
      openMin={openMin}
      closeMin={closeMin}
      endMin={dayEnd}
      nowMin={nowMin}
      mode={dayEnd - openMin > 13 * 60 ? 'scroll' : 'fit'}
      closed={isClosedToday}
      canManage={canManage}
      onEdit={onEdit}
      onMove={onMove ? (b, start, rowId) => onMove(b, start, rowId) : undefined}
      legend={<BlockLegend alerts={false} items={Object.keys(staffBreaks).length ? STATUS_LEGEND : STATUS_LEGEND.filter((x) => x[1] !== 'Szünet')} />}
      empty={<Meta className="py-10 text-center">Nincs aktív szakember. Vegyél fel szakembert a foglalások idővonalához.</Meta>}
    />
  )
}

/** Megerősítve maradt, de a kezdés ideje már elmúlt, senki nem vezette át (befejezve/lemondva)
 *  — ez utólagos KEZELÉST igényel, ezért a "Függő" (arany) színt kapja a kártyán, nem a rendes
 *  sötét "megerősítve" színt (a piros "Késik" jelvény önmagában kevés volt). */
export function needsHandling(b: Booking, nowMin: number | null): boolean {
  return nowMin != null && b.status === 'confirmed' && nowMin > hhmmToMinutes(b.start_time)
}

/** Egy idősáv-cella tartalma: vagy egyetlen foglalás, vagy egy [aktív, lemondott] pár, amikor
 *  ugyanarra az időre lemondtak egy foglalást, majd újra lefoglalták — ekkor a kettő egy
 *  kártya-veremben jelenik meg (a lemondott pirosan kandikál ki mögüle, kattintásra cserélnek). */
export type CellItem = Booking | [Booking, Booking]

/** Az órás sávon belüli foglalásokat csoportosítja: az időben átfedő lemondott+aktív párok egy
 *  verembe kerülnek, a többi (magában álló, akár lemondott is) sima elem marad — időrendben. */
export function groupOverlaps(rows: Booking[]): CellItem[] {
  const cancelled = rows.filter((b) => b.status === 'cancelled')
  const activeOnes = rows.filter((b) => b.status !== 'cancelled')
  const usedIds = new Set<string>()
  const pairs: [Booking, Booking][] = []
  for (const c of cancelled) {
    const cs = hhmmToMinutes(c.start_time)
    const ce = hhmmToMinutes(c.end_time)
    const partner = activeOnes.find((o) => {
      if (usedIds.has(String(o.id)) || idOf(o.staff) !== idOf(c.staff)) return false
      const os = hhmmToMinutes(o.start_time)
      const oe = hhmmToMinutes(o.end_time)
      return cs < oe && ce > os
    })
    if (partner) {
      usedIds.add(String(partner.id))
      usedIds.add(String(c.id))
      pairs.push([partner, c])
    }
  }
  // Ami emellett is átfedésben marad (pl. két lemondás ugyanarra a szakemberre/időre, aktív pár
  // nélkül) — ezeket ÁLTALÁNOSAN, egymás közt is összepárosítjuk, nehogy külön-külön, összevissza
  // jelenjenek meg.
  const leftover = rows
    .filter((b) => !usedIds.has(String(b.id)))
    .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
  for (let i = 0; i < leftover.length; i++) {
    const a = leftover[i]
    if (usedIds.has(String(a.id))) continue
    const as = hhmmToMinutes(a.start_time)
    const ae = hhmmToMinutes(a.end_time)
    for (let j = i + 1; j < leftover.length; j++) {
      const b = leftover[j]
      if (usedIds.has(String(b.id)) || idOf(a.staff) !== idOf(b.staff)) continue
      const bs = hhmmToMinutes(b.start_time)
      const be = hhmmToMinutes(b.end_time)
      if (as < be && ae > bs) {
        usedIds.add(String(a.id))
        usedIds.add(String(b.id))
        pairs.push([a, b])
        break
      }
    }
  }
  const singles = rows.filter((b) => !usedIds.has(String(b.id)))
  const items: { sortKey: number; node: CellItem }[] = [
    ...singles.map((b) => ({ sortKey: hhmmToMinutes(b.start_time), node: b as CellItem })),
    ...pairs.map((p) => ({
      sortKey: Math.min(hhmmToMinutes(p[0].start_time), hhmmToMinutes(p[1].start_time)),
      node: p as CellItem,
    })),
  ]
  items.sort((a, b) => a.sortKey - b.sortKey)
  return items.map((x) => x.node)
}

/** Mobil nap (a /design 6.11): a napcsík, alatta a közös függőleges idővonal — óránként az első foglalás, a
 *  többi a „+N” alatt; a kártyára koppintva megnyílik. Saját nézetben (egy szakember) a szünet és a távollét is látszik.
 *  A lemondott foglalások itt nem jelennek meg (a Lista mutatja őket). */
function MobileTimeline({
  date, active, openMin, closeMin, nowMin, onEdit, staff, staffBreaks = {}, staffOffType = {}, viewerStaffId, isClosedToday = false,
}: {
  date: string; active: Booking[]; openMin: number; closeMin: number; nowMin: number | null; onEdit: (b: Booking) => void
  staff: StaffMember[]
  staffBreaks?: Record<string, { start: string; end: string }>
  staffOffType?: Record<string, 'leave' | 'sick' | 'vacation'>
  viewerStaffId?: string
  isClosedToday?: boolean
}) {
  const live = active.filter((b) => b.status !== 'cancelled')
  const byKey = new Map(live.map((b) => [String(b.id), b]))
  const own = staff.length === 1 ? staff[0] : viewerStaffId ? staff.find((t) => String(t.id) === viewerStaffId) : undefined
  const off = own ? staffOffType[String(own.id)] : undefined
  const rows = hourRows(live, {
    openMin, closeMin, nowMin,
    start: (b) => hhmmToMinutes(b.start_time),
    end: (b) => hhmmToMinutes(b.end_time),
    ev: (b) => ({
      key: String(b.id),
      n: `${isDraft(b) ? '✎ ' : ''}${b.customer_name}`,
      // a munkatárs neve is a kártyán (nem csak az avatarja)
      s: [`${b.start_time}–${b.end_time}`, staffOf(b)?.name, serviceOf(b)?.name].filter(Boolean).join(' · '),
      ...statusCard(b.status),
      avatars: staffOf(b) ? [{ src: avatarUrlOf(staffOf(b)), name: staffOf(b)!.name }] : undefined,
    }),
    // a látható munkatársak szünetei, névvel és avatarral (kié a szünet)
    extra: (lo, hi) => staff.flatMap((t) => {
      const br = staffBreaks[String(t.id)]
      if (!br || hhmmToMinutes(br.start) < lo || hhmmToMinutes(br.start) >= hi) return []
      return [{ n: `Szünet · ${t.name}`, s: `${br.start}–${br.end}`, tone: 'light' as const, dot: 'bg-ui-bad-dot', avatars: [{ src: avatarUrlOf(t), name: t.name }] }]
    }),
  })
  return (
    <Card>
      <DayStrip base="/dashboard" date={date} />
      {(isClosedToday || off) && <Note className="mt-3">{isClosedToday ? 'Ezen a napon zárva vagytok.' : `${OFF_TYPE_LABEL[off!]} — ezen a napon nincs beosztásod.`}</Note>}
      <MobileDayTimeline rows={rows} more={false} onOpen={(k) => { const b = byKey.get(k); if (b) onEdit(b) }} />
    </Card>
  )
}

/** Idő × szakember (desktop) — pontosan a mobil idővonal kártya-stílusa, csak az idő-tengely
 *  EGYETLEN KÖZÖS oszlop balra (nem duplikálva szakemberenként), a szakemberek pedig a saját
 *  oszlopukban kapják a kártyáikat, ugyanahhoz a közös óra-sorhoz igazítva (CSS grid — minden
 *  sor automatikusan a legmagasabb cellájához igazodik, így a tengely és az oszlopok mindig
 *  egy vonalban maradnak, még ha az egyik oszlopban ki is nyílik egy "+N" extra foglalás). */
export const OFF_TYPE_LABEL: Record<'leave' | 'sick' | 'vacation', string> = { leave: 'Szabadság', sick: 'Beteg', vacation: 'Szabadnap' }
const SOURCE_LABEL: Record<string, string> = { online: 'Online · foglalóoldal', phone: 'Telefon', walk_in: 'Beeső' }

/** A megnyitott szalon-foglalás (design 6.7) tartalma és gyors műveletei: függőnél jóváhagyás / elutasítás, késésnél
 *  megérkezett / nem jött el, mindig hívás és áthelyezés (a szerkesztő), megerősítettnél lemondás (6.10 ablakkal). */
export function SalonBookingDrawer({ b, date, canManage, consentEnabled = false, onsite, onClose, onEdit }: { b: Booking; date: string; canManage: boolean; /** Fizetés a helyszínen (design 6.7.1) — bekapcsolva a megkezdett foglalás első gombja a „Fizetés” */ onsite?: OnsiteSettings | null; /** a nyilatkozat be van kapcsolva — ha a vendég még nem írta alá, helyszíni aláíratás */ consentEnabled?: boolean; onClose: () => void; onEdit: () => void }) {
  const router = useRouter()
  const nowMin = useNowMinutes(date)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'cancel' | 'decline'>(null)
  const [checkout, setCheckout] = useState(false)
  const svc = serviceOf(b)
  const st = staffOf(b)
  const lateMin = b.status === 'confirmed' && nowMin != null ? nowMin - hhmmToMinutes(b.start_time) : 0
  const late = lateMin > 0
  const price = b.price_snapshot ?? svc?.price ?? null
  const today = ymdLocal(new Date())
  const when = `${date === today ? 'ma' : date.slice(5).replace('-', '. ') + '.'} ${b.start_time}–${b.end_time}`

  const set = async (status: Booking['status'], msg: string, decline = false) => {
    setBusy(true)
    try {
      await setBookingStatus({ restaurant: false, id: b.id, status, decline })
      toast.success(msg)
      markLocalMutation()
      router.refresh()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }
  // a foglalás elkezdődött (vagy múltbeli) és még nincs lezárva fizetéssel → „Fizetés” (ha a szalonnál be van kapcsolva)
  const started = date < today || (date === today && nowMin != null && nowMin >= hhmmToMinutes(b.start_time))
  const canCheckout = canManage && !!onsite?.enabled && b.status === 'confirmed' && started && !b.paid_at
  const call = b.customer_phone ? { label: 'Hívás', icon: Phone, href: `tel:${b.customer_phone.replace(/\s/g, '')}` } : null
  const move = { label: 'Áthelyezés', onClick: onEdit }
  const pay: DrawerAction = { label: 'Fizetés', icon: Wallet, variant: 'dark', onClick: () => setCheckout(true), disabled: busy }
  const base: DrawerAction[] = canCheckout ? [pay, { label: 'Nem jött el', onClick: () => set('no_show', 'Lezárva — nem jött'), disabled: busy }, ...(call ? [call] : []), move]
    : !canManage ? (call ? [call] : []) : b.status === 'pending'
    ? [{ label: 'Jóváhagyom', icon: Check, variant: 'dark', onClick: () => set('confirmed', 'Elfogadva — a vendég megkapta a visszaigazolást'), disabled: busy }, { label: 'Elutasítom', onClick: () => setConfirm('decline'), disabled: busy }, ...(call ? [call] : []), move]
    : late
      ? [{ label: 'Megérkezett', icon: Check, variant: 'dark', onClick: () => set('completed', 'Lezárva — megjelent'), disabled: busy }, { label: 'Nem jött el', onClick: () => set('no_show', 'Lezárva — nem jött'), disabled: busy }, ...(call ? [call] : []), move]
      : b.status === 'confirmed'
        ? [...(call ? [call] : []), move, { label: 'Lemondás', onClick: () => setConfirm('cancel'), disabled: busy }]
        : (call ? [call] : [])
  const consent = canManage && consentEnabled && !b.consent_accepted && b.status !== 'cancelled'
  const actions: DrawerAction[] = consent ? [...base, { label: 'Nyilatkozat aláíratása', icon: FileSignature, href: `/dashboard/bookings/consent/${b.id}` }] : base

  return (
    <>
      <BookingDrawer
        open
        onClose={onClose}
        onEdit={canManage ? onEdit : undefined}
        when={when}
        title={b.customer_name || 'Vendég'}
        guest={{ email: b.customer_email, phone: b.customer_phone, name: b.customer_name }}
        city={b.customer_city}
        alert={b.status === 'pending' ? { tone: 'pending', text: 'Jóváhagyásra vár' } : paymentDue(b, !!onsite?.enabled, date, nowMin) ? { tone: 'pending', text: 'Fizetésre vár — zárd le a fizetéssel' } : late && !canCheckout ? { tone: 'bad', text: `${lateMin} perce késik` } : null}
        actions={actions}
      >
        <BookingFacts
          service={svc?.name ?? 'Szolgáltatás'}
          detail={[`${durationOf(b)} perc`, st?.name].filter(Boolean).join(' · ')}
          price={price ? `${price.toLocaleString('hu-HU')} Ft` : '—'}
          img={avatarUrlOf(st)}
          name={st?.name}
          rows={([
            ['Állapot', b.status === 'confirmed' || b.status === 'pending' ? null : statusOf(b.status).label],
            ['Telefon', b.customer_phone],
            ['E-mail', b.customer_email],
            ['Forrás', SOURCE_LABEL[b.source ?? ''] ?? b.source],
            ['Sorozat', b.series_id ? 'Ismétlődő foglalás' : null],
            ['Előleg', b.payment_status === 'paid' ? 'fizetve' : b.payment_status === 'failed' ? 'sikertelen fizetés' : null],
            ['Helyben fizetve', b.paid_at ? `${Math.round(Number(b.paid_amount_huf ?? 0)).toLocaleString('hu-HU')} Ft · ${({ cash: 'készpénz', card: 'bankkártya', transfer: 'átutalás', link: 'fizetési link' } as Record<string, string>)[b.pay_method ?? ''] ?? '—'}${b.pay_receipt === 'manual' ? ' · végszámla kézzel' : b.pay_receipt === 'register' ? ' · pénztárgép' : ''}` : null],
            ['Fizetés', b.voucher_code ? `Utalvánnyal · ${b.voucher_code}` : null],
            ['Megjegyzés', b.notes],
          ] as [string, string | null | undefined][]).filter((r): r is [string, string] => !!r[1])}
          ok={b.payment_status === 'paid' ? ['Előleg'] : []}
        />
      </BookingDrawer>
      {canCheckout && onsite && (
        <BookingCheckout open={checkout} onClose={() => setCheckout(false)} onDone={() => { setCheckout(false); markLocalMutation(); router.refresh(); onClose() }}
          settings={onsite} settingsHref="/dashboard/settings?tab=payments"
          booking={{
            id: b.id, customerName: b.customer_name || 'Vendég', customerEmail: b.customer_email, customerCity: b.customer_city, customerAddress: b.customer_address,
            when, service: { name: svc?.name ?? 'Szolgáltatás', meta: [`${durationOf(b)} perc`, st?.name].filter(Boolean).join(' · '), price: Math.round(Number(price ?? 0)) },
            deposit: b.payment_status === 'paid' ? Math.round(Number(b.deposit_amount_huf ?? 0)) : 0, depositInvoice: b.invoice_number,
            voucher: Math.round(Number(b.voucher_discount_huf ?? 0)), voucherCode: b.voucher_code,
          }} />
      )}
      <ConfirmDialog
        open={confirm === 'cancel'}
        icon={X}
        title="Lemondod a foglalást?"
        description={`${b.customer_name} · ${b.start_time}${svc ? ` · ${svc.name}` : ''}`}
        confirmLabel="Lemondás"
        busy={busy}
        onConfirm={() => set('cancelled', 'Foglalás lemondva')}
        onCancel={() => setConfirm(null)}
        zIndexClass="z-[95]"
      >
        {b.customer_email && <FieldRow boxed label="Értesítés" hint={`${b.customer_name} e-mailt kap`}><Check className="h-4 w-4 text-ui-ok" /></FieldRow>}
        <FieldRow boxed label="Az időpont" hint="Felszabadul, újra foglalható"><Check className="h-4 w-4 text-ui-ok" /></FieldRow>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'decline'}
        icon={X}
        title="Elutasítod a foglalást?"
        description={`${b.customer_name} · ${b.start_time}${svc ? ` · ${svc.name}` : ''}`}
        confirmLabel="Elutasítom"
        busy={busy}
        onConfirm={() => set('cancelled', 'Elutasítva — a vendég e-mailben értesült', true)}
        onCancel={() => setConfirm(null)}
        zIndexClass="z-[95]"
      >
        {b.customer_email && <FieldRow boxed label="Értesítés" hint={`${b.customer_name} e-mailt kap az elutasításról`}><Check className="h-4 w-4 text-ui-ok" /></FieldRow>}
      </ConfirmDialog>
    </>
  )
}
