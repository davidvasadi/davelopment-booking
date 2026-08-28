'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, CalendarRange, CalendarClock, Plus, type LucideIcon } from 'lucide-react'
import { hhmmToMinutes, ymdLocal } from '@/lib/utils'
import { BookingEditSheet, type EditTarget } from '@/components/dashboard/BookingEditSheet'
import { HoverButton } from '@/components/shared/HoverButton'
import { MobileOptionSheet } from '@/components/ui/MobileOptionSheet'
import type { BookingsRange } from '@/components/dashboard/DateFilter'
import {
  ACTIVE,
  Ava,
  avatarUrlOf,
  cellKey,
  CLOSED_BORDER,
  CLOSED_FG,
  CLOSED_HATCH,
  draftToBooking,
  extraStackHeightPx,
  groupOverlaps,
  idOf,
  OFF_TYPE_LABEL,
  OFF_TYPE_STYLE,
  renderCellItem,
} from '@/components/dashboard/SalonDailyView'
import { getDrafts, subscribeDrafts, type SalonBookingDraft } from '@/lib/salonBookingDrafts'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'

const HU_WEEKDAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7 // hétfő = 0
}

/** JS natív `getDay()` (0=vasárnap..6=szombat) — ez a `closedWeekdays` kódolása, nem a
 *  hétfő-first `weekdayIndex`. */
function jsDow(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Ugyanaz a "Zárva" jelvény, mint a Naptár hónap-rácsán (ScheduleView.tsx). */
function ClosedBadge() {
  return (
    <span className="mt-1 inline-block rounded-[5px] bg-[rgba(180,60,50,.12)] px-1 text-[7.5px] font-bold uppercase tracking-wide text-[#b43c32] sm:text-[8px]">
      Zárva
    </span>
  )
}

/** Ugyanaz a "Zárva" sáv, mint a napi nézet üres/beosztatlan óráinál — a hatch-sávok (nem csak a
 *  nap-pill jelvény) is ezt kapják zárva napokon. */
function ClosedBand() {
  return (
    <div
      aria-hidden
      className="flex h-[72px] items-center justify-center rounded-[18px] border"
      style={{ background: CLOSED_HATCH, borderColor: CLOSED_BORDER }}
    >
      <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: CLOSED_FG }}>Zárva</span>
    </div>
  )
}

/** Egy távollévő szakember kártyája a mobil/egy-oszlopos nap-listában — ugyanaz a méret/stílus,
 *  mint a napi nézet `OffAndBreakExtras` kártyája, hogy a kibontott verem soraiban a foglalás- és
 *  off-kártyák egyformák legyenek. */
function OffChip({ staff, off }: { staff: StaffMember; off: 'leave' | 'sick' | 'vacation' }) {
  const st = OFF_TYPE_STYLE[off]
  return (
    <div
      className="flex h-[72px] w-full items-center gap-2.5 rounded-[18px] border px-4"
      style={{ background: st.hatch, color: st.fg, borderColor: st.border }}
    >
      <Ava url={avatarUrlOf(staff)} className="h-8 w-8 shrink-0 rounded-full overflow-hidden" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{staff.name}</div>
        <div className="mt-0.5 truncate text-xs opacity-80">{OFF_TYPE_LABEL[off]}</div>
      </div>
    </div>
  )
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
  title: string
  subtitle: string
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
  days, range, date, title, subtitle, salonId, bookings, staff, services, openMin, closeMin, invitedEmails, staffOffType = {}, closedDates = [], closedWeekdays = [], dateFilter, printButton, canManage = false,
}: SalonScheduleViewProps) {
  const router = useRouter()
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<SalonBookingDraft[]>([])
  const [expandedGridDays, setExpandedGridDays] = useState<Set<string>>(() => new Set())
  const [expandedFlatDays, setExpandedFlatDays] = useState<Set<string>>(() => new Set())
  const [mobileViewOpen, setMobileViewOpen] = useState(false)

  // Mobilon a Nap/Hét/Hónap váltó a fejléc csengő melletti ikonjából nyílik (DashboardNav
  // dispatch-eli) — ugyanaz az esemény, mint a napi nézet nézet-választója (ott az Idősáv/Lista
  // váltóval együtt, itt önmagában, mert ebben a nézetben nincs másik váltandó almód).
  useEffect(() => {
    const handler = () => setMobileViewOpen(true)
    window.addEventListener('davelopment:open-bookings-view', handler)
    return () => window.removeEventListener('davelopment:open-bookings-view', handler)
  }, [])

  const rangeButtons: { mode: BookingsRange; icon: LucideIcon; label: string }[] = [
    { mode: 'day', icon: CalendarDays, label: 'Nap' },
    { mode: 'week', icon: CalendarRange, label: 'Hét' },
    { mode: 'month', icon: CalendarClock, label: 'Hónap' },
  ]
  const pickRange = (v: BookingsRange) => router.push(`/dashboard/bookings?date=${date}&range=${v}`)

  useEffect(() => {
    setDrafts(getDrafts(salonId))
    return subscribeDrafts(salonId, setDrafts)
  }, [salonId])

  const today = ymdLocal(new Date())
  // Zárva: egyszeri kivétel BÁRMIKOR, vagy heti visszatérő zárvatartás — de utóbbi csak a mai
  // naptól előre (ugyanaz a szabály, mint a Naptár hónap-rácsán).
  const isClosedDay = (day: string) => closedDates.includes(day) || (day >= today && closedWeekdays.includes(jsDow(day)))
  const daySet = useMemo(() => new Set(days), [days])

  const allBookings = useMemo(() => {
    const rangeDrafts = drafts.filter((d) => daySet.has(d.date)).map(draftToBooking)
    return [...bookings, ...rangeDrafts]
  }, [bookings, drafts, daySet])

  const active = useMemo(() => allBookings.filter((b) => ACTIVE.has(b.status)), [allBookings])

  const forceMobile = staff.length >= 6

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

  const toggleGridDay = (day: string) =>
    setExpandedGridDays((prev) => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })
  const toggleFlatDay = (day: string) =>
    setExpandedFlatDays((prev) => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })

  const openEdit = (b: Booking) => {
    if (canManage) setTarget({ booking: b })
  }
  const openCreate = () => {
    if (canManage) setTarget({ booking: null })
  }
  const goToDay = (day: string) => router.push(`/dashboard/bookings?range=day&date=${day}`)

  // Mobilon az "Új foglalás" a fejléc csengő melletti ikonjából nyílik (DashboardNav
  // dispatch-eli) — ugyanaz az esemény, mint a napi nézetben.
  useEffect(() => {
    const handler = () => openCreate()
    window.addEventListener('davelopment:open-bookings-create', handler)
    return () => window.removeEventListener('davelopment:open-bookings-create', handler)
  }, [canManage])  // eslint-disable-line react-hooks/exhaustive-deps

  const card = 'rounded-[26px] dav-card-glass'
  const legend = [
    { c: '#1D1C19', l: 'Megerősített' },
    { c: '#F1CE45', l: 'Függő' },
    { c: 'repeating-linear-gradient(115deg,#f3efe4 0 3px,#e8e4d8 3px 5px)', l: 'Befejezett' },
    { c: '#C0564A', l: 'Lemondva' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] lg:text-[42px] font-light tracking-[-0.02em] text-ink leading-none">
            {title}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-ink-soft2">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dateFilter}
          <div className="hidden lg:block">{printButton}</div>
          {canManage && (
            <HoverButton
              onClick={openCreate}
              className="hidden items-center justify-center gap-2 h-[42px] w-[42px] sm:w-auto sm:px-[18px] rounded-dav-pill bg-ink-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity shrink-0 lg:inline-flex"
            >
              <Plus className="h-[15px] w-[15px] shrink-0 text-gold" strokeWidth={2.2} />
              <span className="hidden sm:inline">Új foglalás</span>
            </HoverButton>
          )}
        </div>
      </div>

      {/* Desktop rács — csak 6-nál kevesebb szakembernél (ugyanaz a küszöb, mint az Idősáv nézetben). */}
      {!forceMobile && (
        <div className={`hidden lg:block ${card} p-[18px] sm:p-[20px_22px_22px]`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-[17px] font-medium text-ink">Időbeosztás</div>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
              {legend.map((x) => (
                <div key={x.l} className="flex items-center gap-[7px]">
                  <span className="h-[11px] w-[11px] rounded-[3px] border border-line" style={{ background: x.c }} />
                  <span className="text-xs font-medium text-ink-soft2">{x.l}</span>
                </div>
              ))}
            </div>
          </div>

          {staff.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-ink-soft">Nincs aktív szakember. Vegyél fel szakembert a foglalások idősávjához.</div>
          ) : (
            <div className="overflow-x-auto">
              {(() => {
                const colMin = staff.length <= 4 ? 220 : Math.max(160, Math.round(880 / staff.length))
                const gridTemplateColumns = `86px repeat(${staff.length}, minmax(${colMin}px, 1fr))`
                const minWidth = 86 + staff.length * colMin
                return (
                  <div style={{ minWidth }}>
                    {/* Fejléc-sor: üres bal sarok + szakember-fejlécek — SAJÁT, NEM görgő fa (ugyanaz
                        a minta, mint a napi Idősáv nézetnél), így havi nézetnél (sok nap-sor) sem
                        csúszik el a fejléc a függőleges görgetéskor. */}
                    <div className="grid gap-x-3" style={{ gridTemplateColumns }}>
                      <div />
                      {staff.map((s, ci) => (
                        <div key={String(s.id)} style={{ gridColumn: ci + 2 }} className="flex items-center gap-2.5 border-b border-line pb-3">
                          <Ava url={avatarUrlOf(s)} className="h-9 w-9 shrink-0 rounded-full overflow-hidden" />
                          <div className="min-w-0">
                            <span className="block text-sm font-semibold text-ink truncate leading-tight">{s.name}</span>
                            {s.role_title && <span className="block text-[11px] text-[#A8A496] truncate leading-tight">{s.role_title}</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tartalom: KÜLÖN, függőlegesen görgő konténer a fejléc alatt — havi nézetnél
                        (akár 31 nap-sor) ez görgethető belül, nem az egész oldal nő meg, és a fejléc
                        mindig látszik fölötte. */}
                    <div className="max-h-[65vh] overflow-y-auto pt-1">
                    <div className="grid gap-x-3" style={{ gridTemplateColumns }}>
                    {/* Bal tengely — egy nap-pill naponta, alatta a nyitó "+" gomb, ha bármelyik
                        szakembernél van extra foglalás aznap. A pill maga a napi nézetbe drillel. */}
                    {days.map((day, i) => {
                      const isToday = day === today
                      const isClosed = isClosedDay(day)
                      const anyThatDay = perStaffDayBookings.some((rows) => rows[i].length > 0)
                      const extraTotal = perStaffDayBookings.reduce((sum, rows) => sum + Math.max(0, rows[i].length - 1), 0)
                      const isOpen = expandedGridDays.has(day)
                      const last = i === days.length - 1
                      const pillCls = isToday ? 'bg-ink-dark text-white' : isClosed ? 'border border-[rgba(180,60,50,.3)] bg-[rgba(180,60,50,.08)] text-[#b43c32]' : anyThatDay ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
                      return (
                        <div key={day} style={{ gridColumn: 1, gridRow: i + 1 }} className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => goToDay(day)}
                            className={`flex h-9 w-full items-center justify-center gap-1 rounded-full px-1.5 text-[12.5px] font-semibold tabular-nums transition-opacity hover:opacity-90 ${pillCls}`}
                          >
                            {HU_WEEKDAYS_SHORT[weekdayIndex(day)]} {Number(day.slice(8, 10))}
                          </button>
                          {isClosed && <ClosedBadge />}
                          {!last ? (
                            <div className="relative min-h-[16px] flex-1 py-1">
                              <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dotted border-line-strong" />
                              {extraTotal > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleGridDay(day)}
                                  aria-label={`még ${extraTotal} foglalás ezen a napon`}
                                  className={`absolute left-1/2 top-1 z-10 flex h-5 w-5 -translate-x-1/2 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                                >
                                  +{extraTotal}
                                </button>
                              )}
                            </div>
                          ) : (
                            extraTotal > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleGridDay(day)}
                                aria-label={`még ${extraTotal} foglalás ezen a napon`}
                                className={`relative z-10 mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                              >
                                +{extraTotal}
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}

                    {/* Tartalom-cellák naponként/szakemberenként. */}
                    {days.flatMap((day, i) => {
                      const cells: React.ReactNode[] = []
                      const isOpen = expandedGridDays.has(day)
                      const maxExtra = Math.max(0, ...staff.map((_, ci) => perStaffDayBookings[ci][i].length - 1))
                      const dayClosed = isClosedDay(day)
                      const HatchBand = () =>
                        dayClosed ? (
                          <ClosedBand />
                        ) : (
                          <div
                            aria-hidden
                            className="h-[72px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                            style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                          />
                        )
                      let ci = 0
                      while (ci < staff.length) {
                        const off = perStaffDayOff[ci][i]
                        const rows = perStaffDayBookings[ci][i]
                        if (off) {
                          const s = staff[ci]
                          const st = OFF_TYPE_STYLE[off]
                          cells.push(
                            <div key={`${s.id}-${day}-off`} style={{ gridColumn: ci + 2, gridRow: i + 1 }} className="pb-3">
                              <div
                                className="flex h-[72px] items-center justify-center rounded-[18px] border"
                                style={{ background: st.hatch, color: st.fg, borderColor: st.border }}
                              >
                                <span className="text-[13px] font-semibold">{OFF_TYPE_LABEL[off]}</span>
                              </div>
                            </div>,
                          )
                          ci += 1
                          continue
                        }
                        if (rows.length > 0) {
                          const s = staff[ci]
                          const hatchNeeded = maxExtra - (rows.length - 1)
                          cells.push(
                            <div key={`${s.id}-${day}`} style={{ gridColumn: ci + 2, gridRow: i + 1 }} className="pb-3">
                              {renderCellItem(rows[0], openEdit, false, null)}
                              <AnimatePresence initial={false}>
                                {isOpen && maxExtra > 0 && (
                                  <motion.div
                                    key="extra"
                                    className="overflow-hidden"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: extraStackHeightPx(maxExtra), opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                                  >
                                    <div className="space-y-2 pt-2">
                                      {rows.slice(1).map((item) => (
                                        <div key={cellKey(item)}>{renderCellItem(item, openEdit, false, null)}</div>
                                      ))}
                                      {Array.from({ length: hatchNeeded }).map((_, hi) => (
                                        <div key={`repeat-${hi}`} className="relative">
                                          <span aria-hidden className="absolute -top-2 left-1/2 h-2 -translate-x-1/2 border-l-2 border-dotted" style={{ borderColor: 'rgba(120,110,70,.55)' }} />
                                          {renderCellItem(rows[0], openEdit, false, null)}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>,
                          )
                        } else {
                          const start = ci
                          while (ci < staff.length && perStaffDayBookings[ci][i].length === 0 && !perStaffDayOff[ci][i]) ci += 1
                          const span = ci - start
                          cells.push(
                            <div key={`gap-${day}-${start}`} style={{ gridColumn: `${start + 2} / span ${span}`, gridRow: i + 1 }} className="pb-3">
                              <HatchBand />
                              <AnimatePresence initial={false}>
                                {isOpen && maxExtra > 0 && (
                                  <motion.div
                                    key="extra"
                                    className="overflow-hidden"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: extraStackHeightPx(maxExtra), opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                                  >
                                    <div className="space-y-2 pt-2">
                                      {Array.from({ length: maxExtra }).map((_, hi) => (
                                        <HatchBand key={`hatch-${hi}`} />
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>,
                          )
                          continue
                        }
                        ci += 1
                      }
                      return cells
                    })}
                    </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {/* Egy-oszlopos nap-lista — UGYANAZ a mechanika, mint a napi nézet mobil idővonala
          (MobileTimeline/HourList): nap-pill + szaggatott összekötő + az első kártya mindig
          látszik, "+N" nyitja ki a többit. 6+ szakembernél MINDIG ez fut, egyébként csak
          mobilon (a rács `lg:block`-ja mellett). */}
      <div className={forceMobile ? '' : 'lg:hidden'}>
        <div className={`${card} p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-[17px] font-medium text-ink">Időbeosztás</div>
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
              {legend.map((x) => (
                <div key={x.l} className="flex items-center gap-[7px]">
                  <span className="h-[11px] w-[11px] rounded-[3px] border border-line" style={{ background: x.c }} />
                  <span className="text-xs font-medium text-ink-soft2">{x.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            {days.map((day, i) => {
              const inDay = groupOverlaps(
                active.filter((b) => b.date === day).sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time)),
              )
              const dayOff = staff
                .map((s, si) => ({ s, off: perStaffDayOff[si][i] }))
                .filter((x): x is { s: StaffMember; off: 'leave' | 'sick' | 'vacation' } => !!x.off)
              // Ugyanaz az egységes "+N" mechanika, mint a napi nézet mobil idővonalán — a
              // szabadnapos/szabadságos/beteg szakemberek NEM elöl, hanem az extra-veremben
              // jelennek meg, együtt az extra foglalásokkal (nem külön, mindig-látható blokk).
              const extraTotal = Math.max(0, inDay.length - 1) + dayOff.length
              const isToday = day === today
              const isClosed = isClosedDay(day)
              const isOpen = expandedFlatDays.has(day)
              const last = i === days.length - 1
              const pillCls = isToday ? 'bg-ink-dark text-white' : isClosed ? 'border border-[rgba(180,60,50,.3)] bg-[rgba(180,60,50,.08)] text-[#b43c32]' : inDay.length > 0 ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
              return (
                <div key={day} className="flex gap-3">
                  <div className="flex w-[62px] shrink-0 flex-col items-center">
                    <button
                      type="button"
                      onClick={() => goToDay(day)}
                      className={`flex h-9 w-full items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums transition-opacity hover:opacity-90 ${pillCls}`}
                    >
                      {HU_WEEKDAYS_SHORT[weekdayIndex(day)]} {Number(day.slice(8, 10))}
                    </button>
                    {isClosed && <ClosedBadge />}
                    {!last && (
                      <div className="relative flex min-h-[30px] flex-1 items-center justify-center py-1.5">
                        <span className="absolute inset-y-0 border-l-2 border-dotted border-line-strong" />
                        {extraTotal > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleFlatDay(day)}
                            aria-label={`még ${extraTotal} tétel ezen a napon`}
                            className={`relative z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                          >
                            +{extraTotal}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    {inDay.length > 0 ? (
                      <div>
                        {renderCellItem(inDay[0], openEdit, true, null)}
                        <AnimatePresence initial={false}>
                          {isOpen && extraTotal > 0 && (
                            <motion.div
                              key="extra"
                              className="overflow-hidden"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                            >
                              <div className="space-y-2 pt-2">
                                {inDay.slice(1).map((item) => (
                                  <div key={cellKey(item)}>{renderCellItem(item, openEdit, true, null)}</div>
                                ))}
                                {dayOff.map(({ s, off }) => (
                                  <OffChip key={`${s.id}-off`} staff={s} off={off} />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : extraTotal > 0 ? (
                      <div>
                        {isClosed ? (
                          <ClosedBand />
                        ) : (
                          <div
                            aria-hidden
                            className="h-[72px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                            style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                          />
                        )}
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key="extra"
                              className="overflow-hidden"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
                            >
                              <div className="space-y-2 pt-2">
                                {dayOff.map(({ s, off }) => (
                                  <OffChip key={`${s.id}-off`} staff={s} off={off} />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : isClosed ? (
                      <ClosedBand />
                    ) : (
                      <div
                        aria-hidden
                        className="h-[72px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                        style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

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

      <MobileOptionSheet
        open={mobileViewOpen}
        onClose={() => setMobileViewOpen(false)}
        title="Időszak"
        options={rangeButtons}
        value={range}
        onChange={pickRange}
      />
    </div>
  )
}
