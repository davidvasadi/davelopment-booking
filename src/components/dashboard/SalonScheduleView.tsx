'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Wallet } from 'lucide-react'
import { hhmmToMinutes, ymdLocal } from '@/lib/utils'
import { BookingEditSheet, type EditTarget } from '@/components/dashboard/BookingEditSheet'
import { BookingsHead, EMPTY_FILTER, applyBookingFilter, type BookingFilter } from '@/components/shared/BookingsHead'
import { segments, thousands } from '@/components/dashboard/OverviewLayout'
import { Avatar, Kpi, MarqueeText } from '@/components/ui-kit'
import { MonthGrid, StaffSwitch, WeekChips, WeekGrid, WeekHours, chipTone } from '@/components/shared/RangeGrids'
import type { BookingsRange } from '@/components/shared/BookingsDateNav'
import { ACTIVE, SalonBookingDrawer, avatarUrlOf, staffOf, isDraft, draftToBooking, groupOverlaps, idOf, OFF_TYPE_LABEL } from '@/components/dashboard/SalonDailyView'
import { getDrafts, subscribeDrafts, type SalonBookingDraft } from '@/lib/salonBookingDrafts'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'
import type { OnsiteSettings } from './BookingCheckout'

/** JS natív `getDay()` (0=vasárnap..6=szombat) — ez a `closedWeekdays` kódolása, nem a
 *  hétfő-first `weekdayIndex`. */
function jsDow(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export interface SalonScheduleViewProps {
  /** A megjelenítendő napok (`YYYY-MM-DD`), tetszőleges hosszban — heti nézetnél 7, havinál a
   *  hónap összes napja. */
  days: string[]
  /** A jelenlegi időszak-nézet (heti/havi) — a mobil fejléc-ikon nézet-választó sheet-jéhez kell,
   *  hogy a Nap/Hét/Hónap pill közül a helyeset jelölje aktívnak. */
  range: BookingsRange
  /** A DateFilter query-paraméterében szereplő aktuális dátum — a Nap/Hét/Hónap váltásnál ez
   *  marad a cél-dátum (ld. DateFilter azonos mintája). */
  date: string
  salonId: string
  /** A `days` tartományra eső foglalások (a page.tsx tartomány-lekérdezéséből). */
  bookings: Booking[]
  staff: StaffMember[]
  services: Service[]
  openMin: number
  closeMin: number
  /** Azok az email-ek (kisbetűs), akiknek van függőben lévő meghívójuk — amíg nem fogadják el,
   *  nem oszthatók be foglalásra (lakat + UX infó, ld. BookingEditSheet). */
  invitedEmails?: Set<string>
  /** Szakember-id → nap (`YYYY-MM-DD`) → aznapi teljes napos távollét-típus. A napi nézet
   *  óránkénti Szünet-je itt nincs ábrázolva (nincs óra-bontás ebben a nézetben, csak napi cella). */
  staffOffType?: Record<string, Record<string, 'leave' | 'sick' | 'vacation'>>
  /** Egyszeri kivétel-zárás dátumai (`YYYY-MM-DD`) — ugyanaz a forrás, mint a Naptár oldalon. */
  closedDates?: string[]
  /** Heti visszatérő zárvatartás napjai (0=vasárnap..6=szombat) — ugyanaz a forrás, mint a
   *  Naptár oldalon; csak a mai naptól előre érvényes (ld. isClosedDay). */
  closedWeekdays?: number[]
  dateFilter: React.ReactNode
  printButton?: React.ReactNode
  canManage?: boolean
  /** Fizetés a helyszínen — a megnyitott foglalás „Fizetés” gombjához (design 6.7.1) */
  onsite?: OnsiteSettings | null
}

/**
 * Megosztott ütemterv-nézet a Heti ÉS Havi áttekintéshez — a napi Idősáv nézet
 * (StaffColumnsTimeline) szakember-oszlopos rácsa, csak az óra-tengely helyett a `days` napjai
 * a bal tengelyen (nincs óránkénti bontás — a kártyák eleve mutatják a saját időpontjukat).
 * 6+ szakembernél (ugyanaz a szabály, mint a napi nézetnél) egy egy-oszlopos, a napi mobil
 * idővonallal (MobileTimeline/HourList) azonos mechanikájú lista váltja fel a rácsot — ez a
 * mobil nézet is.
 */
export function SalonScheduleView({
  days, range, date, salonId, bookings: unfiltered, staff, services, openMin, closeMin, invitedEmails, staffOffType = {}, closedDates = [], closedWeekdays = [], dateFilter, printButton, canManage = false, onsite = null,
}: SalonScheduleViewProps) {
  const router = useRouter()
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<SalonBookingDraft[]>([])

  // Szűrés (a közös fejlécből) — a rács és a lista a szűrt időszakot mutatja; a csík és a számok a teljeset.
  const [filter, setFilter] = useState<BookingFilter>(EMPTY_FILTER)
  const bookings = useMemo(() => {
    const now = new Date()
    const nowKey = `${ymdLocal(now)} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return applyBookingFilter(unfiltered, filter, (b) => [idOf(b.staff)], (b) => b.status === 'confirmed' && `${String(b.date).slice(0, 10)} ${b.start_time}` < nowKey)
  }, [unfiltered, filter])


  const pickRange = (v: BookingsRange) => router.push(`/dashboard/bookings?date=${date}&range=${v}`)

  useEffect(() => {
    setDrafts(getDrafts(salonId))
    return subscribeDrafts(salonId, setDrafts)
  }, [salonId])

  const today = ymdLocal(new Date())
  const nowMin = (() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() })()
  // Zárva: egyszeri kivétel BÁRMIKOR, vagy heti visszatérő zárvatartás — de utóbbi csak a mai
  // naptól előre (ugyanaz a szabály, mint a Naptár hónap-rácsán).
  const isClosedDay = (day: string) => closedDates.includes(day) || (day >= today && closedWeekdays.includes(jsDow(day)))
  const daySet = useMemo(() => new Set(days), [days])

  const allBookings = useMemo(() => {
    const rangeDrafts = drafts.filter((d) => daySet.has(d.date)).map(draftToBooking)
    return [...bookings, ...rangeDrafts]
  }, [bookings, drafts, daySet])

  const active = useMemo(() => allBookings.filter((b) => ACTIVE.has(b.status)), [allBookings])

  // Szakemberenként/naponként előre kiszámolt foglalás-lista — a rács tartalom-cellái ÉS az
  // üres napok is ebből jönnek.
  const perStaffDayBookings = useMemo(
    () =>
      staff.map((s) =>
        days.map((day) => {
          const rows = active
            .filter((b) => b.date === day && idOf(b.staff) === String(s.id))
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          return groupOverlaps(rows)
        }),
      ),
    [staff, active, days],
  )

  // Szakemberenként/naponként előre kiszámolt teljes napos távollét-típus — ugyanaz a rács-alak,
  // mint a foglalás-lista fent, hogy [ci][i] indexeléssel egyszerre lehessen olvasni a kettőt.
  const perStaffDayOff = useMemo(
    () => staff.map((s) => days.map((day) => staffOffType[String(s.id)]?.[day])),
    [staff, days, staffOffType],
  )


  // kattintás egy foglalásra: a megnyitott foglalás lapja (design 6.7); a vázlat egyből a szerkesztőben
  const [opened, setOpened] = useState<Booking | null>(null)
  const openEdit = (b: Booking) => { if (isDraft(b)) { if (canManage) setTarget({ booking: b }) } else setOpened(b) }
  const openCreate = () => {
    if (canManage) setTarget({ booking: null })
  }
  const goToDay = (day: string) => router.push(`/dashboard/bookings?range=day&date=${day}`)
  const stepMonth = (dir: -1 | 1) => { const [y, m] = date.split('-').map(Number); router.push(`/dashboard/bookings?date=${ymdLocal(new Date(y, m - 1 + dir, 1))}&range=month`) }
  // design 6.4 / 6.5: a hét tetején Mind + a munkatársak — egy emberre váltva az ő óránkénti hete
  // mobilon a munkatárs a „Nézet és szűrők” lapon választható — itt nem kell
  const staffSwitch = staff.length > 1 ? <div className="max-lg:hidden"><StaffSwitch people={staff.map((s) => ({ id: String(s.id), name: s.name, img: avatarUrlOf(s) }))} active={filter.who.length === 1 ? filter.who[0] : null} onPick={(id) => setFilter({ ...filter, who: id ? [id] : [] })} /></div> : undefined

  // Mobilon az "Új foglalás" a fejléc csengő melletti ikonjából nyílik (DashboardNav
  // dispatch-eli) — ugyanaz az esemény, mint a napi nézetben.
  useEffect(() => {
    const handler = () => openCreate()
    window.addEventListener('davelopment:open-bookings-create', handler)
    return () => window.removeEventListener('davelopment:open-bookings-create', handler)
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <div className="space-y-5">
      <BookingsHead
        dateNav={dateFilter}
        range={range}
        onRange={pickRange}
        date={date}
        onDate={(d) => router.push(`/dashboard/bookings?date=${d}&range=day`)}
        loadEndpoint="/api/salon/day-load"
        filter={filter}
        onFilter={setFilter}
        who={staff.map((s) => ({ id: String(s.id), label: s.name, img: avatarUrlOf(s) }))}
        matchCount={bookings.length}
        exportButton={printButton}
        onCreate={canManage ? openCreate : undefined}
        bar={segments([
          { label: 'Megerősített', value: unfiltered.filter((b) => b.status === 'confirmed').length, tone: 'dark' },
          { label: 'Függő', value: unfiltered.filter((b) => b.status === 'pending').length, tone: 'yellow' },
          { label: 'Befejezett', value: unfiltered.filter((b) => b.status === 'completed').length, tone: 'white' },
          { label: 'Lemondva', value: unfiltered.filter((b) => b.status === 'cancelled').length, tone: 'outline' },
        ])}
        kpis={<>
          <Kpi icon={CalendarDays} value={String(unfiltered.filter((b) => b.status !== 'cancelled').length)} label="Foglalás" />
          <Kpi icon={Wallet} value={thousands(unfiltered.filter((b) => b.status !== 'cancelled').reduce((sum, b) => sum + (b.price_snapshot ?? (typeof b.service === 'object' && b.service ? b.service.price : 0) ?? 0), 0))} label="Bevétel (Ft)" />
        </>}
      />

      {range === 'week' && filter.who.length === 1 ? (
        // Hét — egy munkatárs (design 6.4): óránként, a hét napjai oszlopban
        <WeekHours
          top={staffSwitch}
          days={days}
          today={today}
          closed={(d) => isClosedDay(d) || !!staffOffType[filter.who[0]]?.[d]}
          openMin={openMin}
          closeMin={closeMin}
          nowMin={nowMin}
          onOpen={(id) => { const b = active.find((x) => String(x.id) === id); if (b) openEdit(b) }}
          items={active.filter((b) => b.status !== 'cancelled').map((b) => ({ id: String(b.id), day: b.date, start: b.start_time, end: b.end_time, title: b.customer_name, status: b.status, tone: chipTone(b.status), who: staffOf(b) ? { name: staffOf(b)!.name, img: avatarUrlOf(staffOf(b)) } : undefined }))}
        />
      ) : range === 'week' ? (
        // Hét — egész csapat (design 6.5): sor = munkatárs, oszlop = nap, a cellában chipek; a névre kattintva az ő hete
        <WeekGrid
          top={staffSwitch}
          days={days}
          today={today}
          closed={isClosedDay}
          onDay={goToDay}
          rows={staff.map((s, ci) => ({
            id: String(s.id),
            label: (
              <button type="button" onClick={() => setFilter({ ...filter, who: [String(s.id)] })} className="flex items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20" title="Az ő hete óránként">
                <Avatar size="sm" src={avatarUrlOf(s)} name={s.name} /><MarqueeText className="text-ui-body text-ui-text max-sm:hidden">{s.name}</MarqueeText>
              </button>
            ),
            total: perStaffDayBookings[ci].reduce((sum, cell) => sum + cell.flat().filter((b) => b.status !== 'cancelled').length, 0),
          }))}
          cell={(staffId, day) => {
            const ci = staff.findIndex((s) => String(s.id) === staffId)
            const di = days.indexOf(day)
            const off = perStaffDayOff[ci]?.[di]
            if (isClosedDay(day)) return null
            const list = perStaffDayBookings[ci][di].flat().filter((b) => b.status !== 'cancelled')
            // távollét (szabadnap / szabadság / beteg) foglalás nélkül: csíkos cella a felirattal, mint a zárt nap — első ránézésre látszik
            if (off && list.length === 0) return <span className="ui-hatch-cell absolute inset-0 flex items-start rounded-ui-control p-1.5 text-ui-label text-ui-muted">{OFF_TYPE_LABEL[off]}</span>
            return <WeekChips onOpen={(id) => { const b = list.find((x) => String(x.id) === id); if (b) openEdit(b) }} onMore={() => goToDay(day)} chips={list.map((b) => ({ id: String(b.id), time: b.start_time, name: b.customer_name, tone: chipTone(b.status) }))} />
          }}
        />
      ) : (
        // Hónap (design 6.6): napi foglalásszám és telítettség; a napra kattintva a nap idővonala
        <MonthGrid
          month={date}
          today={today}
          unit="foglalás"
          closed={isClosedDay}
          onDay={goToDay}
          onStep={stepMonth}
          // mobil nap-kártya: első / utolsó időpont és kik dolgoznak aznap (akiknek van foglalásuk)
          dayInfo={(d) => {
            const list = active.filter((b) => b.date === d && b.status !== 'cancelled').sort((a, b) => a.start_time.localeCompare(b.start_time))
            const ids = [...new Set(list.map((b) => String(typeof b.staff === 'object' && b.staff ? b.staff.id : b.staff)))]
            return { first: list[0]?.start_time ?? null, last: list.at(-1)?.start_time ?? null, who: staff.filter((s) => ids.includes(String(s.id))).map((s) => ({ name: s.name, img: avatarUrlOf(s) })) }
          }}
          counts={Object.fromEntries(days.map((d) => [d, active.filter((b) => b.date === d && b.status !== 'cancelled').length]))}
          pct={(d) => {
            const cap = Math.max(0, closeMin - openMin) * Math.max(1, staff.length)
            const booked = active.filter((b) => b.date === d && b.status !== 'cancelled').reduce((sum, b) => sum + Math.max(0, hhmmToMinutes(b.end_time) - hhmmToMinutes(b.start_time)), 0)
            return cap ? Math.min(100, Math.round((booked / cap) * 100)) : null
          }}
        />
      )}

      {opened && (
        <SalonBookingDrawer
          key={String(opened.id)}
          b={opened}
          date={String(opened.date).slice(0, 10)}
          canManage={canManage}
          onsite={onsite}
          onClose={() => setOpened(null)}
          onEdit={() => { const b = opened; setOpened(null); setTarget({ booking: b }) }}
        />
      )}

      <BookingEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={days[0] ?? today}
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
