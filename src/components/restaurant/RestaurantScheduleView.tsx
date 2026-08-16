'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { hhmmToMinutes, ymdLocal } from '@/lib/utils'
import { ReservationEditSheet, type EditTarget } from './ReservationEditSheet'
import { ACTIVE, cellKey, draftToReservation, groupOverlaps, renderCellItem, tableNamesOf } from './DailyView'
import { extraStackHeightPx } from '@/components/dashboard/SalonDailyView'
import { getDrafts, subscribeDrafts, type ReservationDraft } from '@/lib/offlineDrafts'
import type { Reservation, Room, Table } from '@/payload/payload-types'

const HU_WEEKDAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7 // hétfő = 0
}

/** Egy foglalás terem-kulcsa: az első asztalához tartozó terem id-je, vagy `'none'`, ha nincs
 *  terembe sorolt asztala (ugyanaz a "Egyéb" bucket-minta, mint a napi TimelineGroup-nál). */
function roomKeyOf(r: Reservation): string {
  const t = r.tables?.[0]
  if (!t || typeof t !== 'object') return 'none'
  const room = (t as Table).room
  if (!room) return 'none'
  return typeof room === 'object' ? String(room.id) : String(room)
}

export interface RestaurantScheduleViewProps {
  /** A megjelenítendő napok (`YYYY-MM-DD`), tetszőleges hosszban — heti nézetnél 7, havinál a
   *  hónap összes napja. */
  days: string[]
  title: string
  subtitle: string
  restaurantId: string
  /** A `days` tartományra eső foglalások (a page.tsx tartomány-lekérdezéséből). */
  reservations: Reservation[]
  rooms: Room[]
  eventTypes?: { icon: string; label: string }[]
  openMin: number
  closeMin: number
  turnMinutes: number
  dateFilter: React.ReactNode
  canManage?: boolean
}

/**
 * Megosztott ütemterv-nézet a Heti ÉS Havi áttekintéshez. Desktop: a szalon rácsával azonos
 * szerkezet — bal tengelyen a `days` napjai, fejlécben viszont TEREM-oszlopok (a napi
 * Terem-nézet `TimelineGroup`-jaihoz hasonlóan), óránkénti bontás nélkül, "+N" kinyitható
 * verem naponta. 4-nél több teremnél, és mobilon (ahol nem fér el egy több-oszlopos rács) egy
 * egy-oszlopos, a napi mobil idővonallal (MobileTimeline/HourList) azonos mechanikájú lista fut.
 */
export function RestaurantScheduleView({
  days, title, subtitle, restaurantId, reservations, rooms, eventTypes = [], openMin, closeMin, turnMinutes, dateFilter, canManage = false,
}: RestaurantScheduleViewProps) {
  const router = useRouter()
  const [target, setTarget] = useState<EditTarget | null>(null)
  const [drafts, setDrafts] = useState<ReservationDraft[]>([])
  const [expandedGridDays, setExpandedGridDays] = useState<Set<string>>(() => new Set())
  const [expandedFlatDays, setExpandedFlatDays] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setDrafts(getDrafts(restaurantId))
    return subscribeDrafts(restaurantId, setDrafts)
  }, [restaurantId])

  const today = ymdLocal(new Date())
  const daySet = useMemo(() => new Set(days), [days])

  const allReservations = useMemo(() => {
    const rangeDrafts = drafts.filter((d) => daySet.has(d.date)).map(draftToReservation)
    return [...reservations, ...rangeDrafts]
  }, [reservations, drafts, daySet])

  const active = useMemo(() => allReservations.filter((r) => ACTIVE.has(r.status)), [allReservations])

  // Terem-oszlopok: a beállított termek (sorrend szerint) + egy "Egyéb" oszlop, HA van
  // terembe nem sorolt asztalú foglalás.
  const columns = useMemo(() => {
    const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    const cols = roomOrder.map((r) => ({ key: String(r.id), name: r.name }))
    const hasNoRoom = active.some((r) => roomKeyOf(r) === 'none')
    if (hasNoRoom) cols.push({ key: 'none', name: cols.length ? 'Egyéb' : 'Asztalok' })
    return cols
  }, [rooms, active])

  // 4-nél több teremnél a rács már nem férne el kényelmesen — ilyenkor (a szalon 6+
  // szakember-szabályához hasonlóan) a lapos, kinyitható napi lista fut desktopon is.
  const forceMobile = columns.length > 4
  const showGrid = columns.length > 0 && !forceMobile

  const perRoomDayBookings = useMemo(
    () =>
      columns.map((col) =>
        days.map((day) => {
          const rows = active
            .filter((r) => r.date === day && roomKeyOf(r) === col.key)
            .sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time))
          return groupOverlaps(rows)
        }),
      ),
    [columns, active, days],
  )

  const toggleGridDay = (day: string) =>
    setExpandedGridDays((prev) => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })
  const toggleFlatDay = (day: string) =>
    setExpandedFlatDays((prev) => { const n = new Set(prev); n.has(day) ? n.delete(day) : n.add(day); return n })

  const openEdit = (r: Reservation) => {
    if (canManage) setTarget({ reservation: r })
  }
  const goToDay = (day: string) => router.push(`/restaurant/bookings?range=day&date=${day}`)

  const card = 'rounded-[26px] dav-card-glass'
  const legend = [
    { c: '#1D1C19', l: 'Megerősített' },
    { c: '#F1CE45', l: 'Függő' },
    { c: '#1D9D63', l: 'Leültetve' },
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

      {/* Desktop rács — terem-oszlopok, nap-sorok (óránkénti bontás nélkül). */}
      {showGrid && (
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

          <div className="overflow-x-auto">
            {(() => {
              const colMin = columns.length <= 4 ? 220 : Math.max(160, Math.round(880 / columns.length))
              return (
                <div
                  className="grid gap-x-3"
                  style={{
                    gridTemplateColumns: `86px repeat(${columns.length}, minmax(${colMin}px, 1fr))`,
                    minWidth: 86 + columns.length * colMin,
                  }}
                >
                  {/* Fejléc-sor: üres bal sarok + terem-fejlécek. */}
                  <div style={{ gridColumn: 1, gridRow: 1 }} />
                  {columns.map((col, ci) => (
                    <div key={col.key} style={{ gridColumn: ci + 2, gridRow: 1 }} className="flex items-center border-b border-line pb-3">
                      <span className="block text-sm font-semibold text-ink truncate leading-tight">{col.name}</span>
                    </div>
                  ))}

                  {/* Bal tengely — egy nap-pill naponta, alatta a nyitó "+" gomb, ha bármelyik
                      teremnél van extra foglalás aznap. A pill maga a napi nézetbe drillel. */}
                  {days.map((day, i) => {
                    const isToday = day === today
                    const anyThatDay = perRoomDayBookings.some((rows) => rows[i].length > 0)
                    const extraTotal = perRoomDayBookings.reduce((sum, rows) => sum + Math.max(0, rows[i].length - 1), 0)
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

                  {/* Tartalom-cellák naponként/termenként. */}
                  {days.flatMap((day, i) => {
                    const cells: React.ReactNode[] = []
                    const isOpen = expandedGridDays.has(day)
                    const maxExtra = Math.max(0, ...columns.map((_, ci) => perRoomDayBookings[ci][i].length - 1))
                    const HatchBand = () => (
                      <div
                        aria-hidden
                        className="h-[72px] rounded-[18px] border border-[rgba(120,110,70,.10)]"
                        style={{ background: 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)' }}
                      />
                    )
                    let ci = 0
                    while (ci < columns.length) {
                      const rows = perRoomDayBookings[ci][i]
                      if (rows.length > 0) {
                        const col = columns[ci]
                        const hatchNeeded = maxExtra - (rows.length - 1)
                        cells.push(
                          <div key={`${col.key}-${day}`} style={{ gridColumn: ci + 2, gridRow: i + 2 }} className="pb-3">
                            {renderCellItem(rows[0], openEdit, tableNamesOf, null)}
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
                                      <div key={cellKey(item)}>{renderCellItem(item, openEdit, tableNamesOf, null)}</div>
                                    ))}
                                    {Array.from({ length: hatchNeeded }).map((_, hi) => (
                                      <div key={`repeat-${hi}`} className="relative">
                                        <span aria-hidden className="absolute -top-2 left-1/2 h-2 -translate-x-1/2 border-l-2 border-dotted" style={{ borderColor: 'rgba(120,110,70,.55)' }} />
                                        {renderCellItem(rows[0], openEdit, tableNamesOf, null)}
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
                        while (ci < columns.length && perRoomDayBookings[ci][i].length === 0) ci += 1
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
        </div>
      )}

      {/* Egy-oszlopos nap-lista — UGYANAZ a mechanika, mint a napi nézet mobil idővonala
          (MobileTimeline/HourList): nap-pill + szaggatott összekötő + az első kártya mindig
          látszik, "+N" nyitja ki a többit. Mindig ez fut mobilon (és 4+ teremnél desktopon is,
          a `showGrid` mellett) — nincs hely egy több-oszlopos rácsnak. */}
      <div className={showGrid ? 'lg:hidden' : ''}>
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
                active.filter((r) => r.date === day).sort((a, b) => hhmmToMinutes(a.start_time) - hhmmToMinutes(b.start_time)),
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
                        {renderCellItem(inDay[0], openEdit, tableNamesOf, null)}
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
                                  <div key={cellKey(item)}>{renderCellItem(item, openEdit, tableNamesOf, null)}</div>
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

      <ReservationEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={days[0] ?? today}
        restaurantId={restaurantId}
        eventTypes={eventTypes}
        target={target}
        openMin={openMin}
        closeMin={closeMin}
        turnMinutes={turnMinutes}
      />
    </div>
  )
}
