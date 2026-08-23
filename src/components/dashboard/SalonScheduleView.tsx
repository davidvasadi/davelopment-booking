'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { hhmmToMinutes, ymdLocal } from '@/lib/utils'
import { BookingEditSheet, type EditTarget } from '@/components/dashboard/BookingEditSheet'
import {
  ACTIVE,
  Ava,
  avatarUrlOf,
  cellKey,
  draftToBooking,
  extraStackHeightPx,
  groupOverlaps,
  idOf,
  renderCellItem,
} from '@/components/dashboard/SalonDailyView'
import { getDrafts, subscribeDrafts, type SalonBookingDraft } from '@/lib/salonBookingDrafts'
import type { Booking, Service, StaffMember } from '@/payload/payload-types'

const HU_WEEKDAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7 // hétfő = 0
}

export interface SalonScheduleViewProps {
  /** A megjelenítendő napok (`YYYY-MM-DD`), tetszőleges hosszban — heti nézetnél 7, havinál a
   *  hónap összes napja. */
  days: string[]
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
  dateFilter: React.ReactNode
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
  days, title, subtitle, salonId, bookings, staff, services, openMin, closeMin, invitedEmails, dateFilter, canManage = false,
}: SalonScheduleViewProps) {
  const router = useRouter()
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<SalonBookingDraft[]>([])
  const [expandedGridDays, setExpandedGridDays] = useState<Set<string>>(() => new Set())
  const [expandedFlatDays, setExpandedFlatDays] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setDrafts(getDrafts(salonId))
    return subscribeDrafts(salonId, setDrafts)
  }, [salonId])

  const today = ymdLocal(new Date())
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

  const toggleGridDay = (day: string) =>
    setExpandedGridDays((prev) => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })
  const toggleFlatDay = (day: string) =>
    setExpandedFlatDays((prev) => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })

  const openEdit = (b: Booking) => {
    if (canManage) setTarget({ booking: b })
  }
  const goToDay = (day: string) => router.push(`/dashboard/bookings?range=day&date=${day}`)

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
        <div className="flex flex-wrap items-center gap-2">{dateFilter}</div>
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
                return (
                  <div
                    className="grid gap-x-3"
                    style={{
                      gridTemplateColumns: `86px repeat(${staff.length}, minmax(${colMin}px, 1fr))`,
                      minWidth: 86 + staff.length * colMin,
                    }}
                  >
                    {/* Fejléc-sor: üres bal sarok + szakember-fejlécek (ugyanaz, mint az Idősáv nézetben). */}
                    <div style={{ gridColumn: 1, gridRow: 1 }} />
                    {staff.map((s, ci) => (
                      <div key={String(s.id)} style={{ gridColumn: ci + 2, gridRow: 1 }} className="flex items-center gap-2.5 border-b border-line pb-3">
                        <Ava url={avatarUrlOf(s)} className="h-9 w-9 shrink-0 rounded-full overflow-hidden" />
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-ink truncate leading-tight">{s.name}</span>
                          {s.role_title && <span className="block text-[11px] text-[#A8A496] truncate leading-tight">{s.role_title}</span>}
                        </div>
                      </div>
                    ))}

                    {/* Bal tengely — egy nap-pill naponta, alatta a nyitó "+" gomb, ha bármelyik
                        szakembernél van extra foglalás aznap. A pill maga a napi nézetbe drillel. */}
                    {days.map((day, i) => {
                      const isToday = day === today
                      const anyThatDay = perStaffDayBookings.some((rows) => rows[i].length > 0)
                      const extraTotal = perStaffDayBookings.reduce((sum, rows) => sum + Math.max(0, rows[i].length - 1), 0)
                      const isOpen = expandedGridDays.has(day)
                      const last = i === days.length - 1
                      const pillCls = isToday ? 'bg-ink-dark text-white' : anyThatDay ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
                      return (
                        <div key={day} style={{ gridColumn: 1, gridRow: i + 2 }} className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => goToDay(day)}
                            className={`flex h-9 w-full items-center justify-center gap-1 rounded-full px-1.5 text-[12.5px] font-semibold tabular-nums transition-opacity hover:opacity-90 ${pillCls}`}
                          >
                            {HU_WEEKDAYS_SHORT[weekdayIndex(day)]} {Number(day.slice(8, 10))}
                          </button>
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
                      const HatchBand = () => (
                        <div
                          aria-hidden
                          className="h-[72px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                          style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                        />
                      )
                      let ci = 0
                      while (ci < staff.length) {
                        const rows = perStaffDayBookings[ci][i]
                        if (rows.length > 0) {
                          const s = staff[ci]
                          const hatchNeeded = maxExtra - (rows.length - 1)
                          cells.push(
                            <div key={`${s.id}-${day}`} style={{ gridColumn: ci + 2, gridRow: i + 2 }} className="pb-3">
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
                          while (ci < staff.length && perStaffDayBookings[ci][i].length === 0) ci += 1
                          const span = ci - start
                          cells.push(
                            <div key={`gap-${day}-${start}`} style={{ gridColumn: `${start + 2} / span ${span}`, gridRow: i + 2 }} className="pb-3">
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
              const isToday = day === today
              const isOpen = expandedFlatDays.has(day)
              const last = i === days.length - 1
              const pillCls = isToday ? 'bg-ink-dark text-white' : inDay.length > 0 ? 'bg-gold text-ink-dark' : 'border border-line bg-white text-ink-soft'
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
                    {!last && (
                      <div className="relative flex min-h-[30px] flex-1 items-center justify-center py-1.5">
                        <span className="absolute inset-y-0 border-l-2 border-dotted border-line-strong" />
                        {inDay.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleFlatDay(day)}
                            aria-label={`még ${inDay.length - 1} foglalás ezen a napon`}
                            className={`relative z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm transition-colors ${isOpen ? 'bg-ink-dark text-white' : 'bg-gold text-ink-dark'}`}
                          >
                            +{inDay.length - 1}
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
                          {isOpen && inDay.length > 1 && (
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
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
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
    </div>
  )
}
