'use client'

import { useState, useEffect } from 'react'
import { hhmmToMinutes, minutesToHHMM } from '@/lib/utils'
import { List, LayoutGrid, Map as MapIcon, Plus } from 'lucide-react'
import { ReservationActions } from './ReservationActions'
import { ReservationEditSheet, type EditTarget } from './ReservationEditSheet'
import type { Reservation, Table, Room } from '@/payload/payload-types'

type ViewMode = 'list' | 'timeline' | 'floor'
const STORAGE_KEY = 'restaurant-daily-view'

const statusLabel: Record<string, string> = {
  pending: 'Megerősítésre vár', confirmed: 'Megerősítve', seated: 'Leültetve',
  completed: 'Befejezett', no_show: 'Nem jött meg', cancelled: 'Lemondva',
}
// Tömör blokk-színek (háttér) + pont-színek
const statusBlock: Record<string, string> = {
  pending: 'bg-amber-400/90 text-amber-950 border-amber-500',
  confirmed: 'bg-emerald-500/90 text-white border-emerald-600',
  seated: 'bg-blue-500/90 text-white border-blue-600',
  completed: 'bg-zinc-400/80 text-white border-zinc-500',
  no_show: 'bg-red-400/80 text-white border-red-500',
  cancelled: 'bg-zinc-200 text-zinc-400 border-zinc-300 line-through',
}
const statusDot: Record<string, string> = {
  pending: 'bg-amber-400', confirmed: 'bg-emerald-500', seated: 'bg-blue-500',
  completed: 'bg-zinc-400', no_show: 'bg-red-400', cancelled: 'bg-red-500',
}
const ACTIVE = new Set(['pending', 'confirmed', 'seated', 'completed'])

export interface DailyViewProps {
  date: string
  capacityMode: 'tables' | 'flat'
  maxPax: number
  reservations: Reservation[]
  rooms: Room[]
  tables: Table[]
  /** A nap nyitvatartása (perc), a timeline tengelyhez */
  openMin: number
  closeMin: number
  turnMinutes: number
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tableIdsOf(r: Reservation): string[] {
  return (r.tables ?? []).map((t) => String(typeof t === 'object' && t ? t.id : t))
}

function tableNamesOf(r: Reservation): string[] {
  return (r.tables ?? [])
    .map((t) => (typeof t === 'object' && t ? t.name : null))
    .filter((n): n is string => !!n)
}

export function DailyView(props: DailyViewProps) {
  const { date, capacityMode, maxPax, reservations, rooms, tables, openMin, closeMin, turnMinutes } = props
  const [view, setView] = useState<ViewMode>('list')
  const [target, setTarget] = useState<EditTarget | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
    if (saved === 'list' || saved === 'timeline' || saved === 'floor') setView(saved)
  }, [])
  const pick = (v: ViewMode) => {
    setView(v)
    localStorage.setItem(STORAGE_KEY, v)
  }

  const openEdit = (reservation: Reservation) => setTarget({ reservation })
  const openCreate = (presetStart?: string, presetTableId?: string | number | null) =>
    setTarget({ reservation: null, presetStart, presetTableId })

  const viewButtons: { mode: ViewMode; icon: typeof List; label: string }[] = [
    { mode: 'list', icon: List, label: 'Lista' },
    { mode: 'timeline', icon: LayoutGrid, label: 'Idővonal' },
    { mode: 'floor', icon: MapIcon, label: 'Terem' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-zinc-100 dark:bg-white/[0.06] p-1">
          {viewButtons.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => pick(mode)}
              title={label}
              className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                view === mode
                  ? 'bg-white dark:bg-white/[0.12] text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-white/40 hover:text-zinc-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => openCreate()}
          className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-sm font-bold hover:opacity-90 transition-opacity shrink-0"
        >
          <Plus className="h-4 w-4 shrink-0" /> <span className="hidden sm:inline">Új foglalás</span>
        </button>
      </div>

      {view === 'list' && <ListView reservations={reservations} onEdit={openEdit} />}
      {view === 'timeline' && (
        <TimelineView
          {...{ capacityMode, maxPax, reservations, rooms, tables, openMin, closeMin, turnMinutes }}
          onEdit={openEdit}
          onCreate={openCreate}
        />
      )}
      {view === 'floor' && (
        <FloorView
          date={date}
          {...{ capacityMode, maxPax, reservations, rooms, tables, openMin, closeMin, turnMinutes }}
          onEdit={openEdit}
        />
      )}

      <ReservationEditSheet
        open={!!target}
        onClose={() => setTarget(null)}
        date={date}
        capacityMode={capacityMode}
        target={target}
      />
    </div>
  )
}

/* ---------- Lista nézet ---------- */
function ListView({ reservations, onEdit }: { reservations: Reservation[]; onEdit: (r: Reservation) => void }) {
  const card = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'
  if (reservations.length === 0) {
    return <div className={`${card} p-12 text-center text-zinc-500 dark:text-zinc-400`}>Erre a napra nincs foglalás.</div>
  }
  return (
    <div className={`${card} divide-y divide-zinc-100 dark:divide-white/[0.06]`}>
      {reservations.map((r) => {
        const tableNames = tableNamesOf(r)
        return (
          <div key={r.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 sm:py-4">
            <button onClick={() => onEdit(r)} className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 text-left">
              <div className="w-12 sm:w-16 shrink-0">
                <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tabular-nums">{r.start_time}</div>
                <div className="text-xs text-zinc-400">{r.end_time}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full sm:hidden ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                  <span className="font-medium text-zinc-900 dark:text-white truncate">{r.customer_name}</span>
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  {r.pax} fő{tableNames.length > 0 ? ` · ${tableNames.join(' + ')} asztal${tableNames.length > 1 ? ' (összevont)' : ''}` : ''}{r.customer_phone ? ` · ${r.customer_phone}` : ''}
                </div>
                {r.notes && <div className="text-xs text-zinc-400 mt-0.5 truncate">„{r.notes}”</div>}
              </div>
            </button>
            <div className="flex items-center shrink-0">
              <span className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot[r.status] ?? 'bg-zinc-300'}`} />
                <span className="text-xs text-zinc-500 dark:text-white/40 truncate">
                  {statusLabel[r.status] ?? r.status}
                </span>
              </span>
              <div className="flex items-center justify-end w-10 shrink-0">
                <ReservationActions reservationId={r.id} status={r.status} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Timeline (asztal × idő rács) ---------- */
const pxPerMin = 2.4 // 1 perc = 2.4px → 30 perc = 72px

function TimelineView({
  capacityMode, maxPax, reservations, rooms, tables, openMin, closeMin, turnMinutes, onEdit, onCreate,
}: Omit<DailyViewProps, 'date'> & {
  onEdit: (r: Reservation) => void
  onCreate: (start?: string, tableId?: string | number | null) => void
}) {
  const totalMin = Math.max(closeMin - openMin, 60)
  const width = totalMin * pxPerMin
  const card = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

  // óránkénti rácsvonalak
  const hourMarks: number[] = []
  for (let m = Math.ceil(openMin / 60) * 60; m < closeMin; m += 60) hourMarks.push(m)

  const active = reservations.filter((r) => ACTIVE.has(r.status))

  if (capacityMode === 'flat') {
    // óránkénti kapacitás-sáv
    const slots: { min: number; pax: number }[] = []
    for (let m = openMin; m < closeMin; m += 60) {
      const pax = active
        .filter((r) => m < hhmmToMinutes(r.end_time) && m + 60 > hhmmToMinutes(r.start_time))
        .reduce((s, r) => s + (r.pax ?? 0), 0)
      slots.push({ min: m, pax })
    }
    return (
      <div className={`${card} p-5 space-y-2`}>
        <p className="text-xs text-zinc-400 mb-3">Óránkénti kihasználtság (max {maxPax} fő)</p>
        {slots.map((s) => {
          const pct = maxPax ? Math.min(100, (s.pax / maxPax) * 100) : 0
          return (
            <button
              key={s.min}
              onClick={() => onCreate(minutesToHHMM(s.min))}
              className="flex items-center gap-3 w-full group"
            >
              <span className="w-12 text-xs tabular-nums text-zinc-500 shrink-0">{minutesToHHMM(s.min)}</span>
              <span className="flex-1 h-7 rounded-md bg-zinc-100 dark:bg-white/[0.06] overflow-hidden relative">
                <span
                  className={`absolute inset-y-0 left-0 ${pct >= 100 ? 'bg-red-400' : pct >= 75 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${pct}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-zinc-700 dark:text-white">
                  {s.pax} / {maxPax} fő
                </span>
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // tables mód — sorok termenként csoportosítva
  const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const tablesByRoom = new Map<string, Table[]>()
  const noRoom: Table[] = []
  for (const t of [...tables].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
    if (rid == null) noRoom.push(t)
    else {
      const arr = tablesByRoom.get(String(rid)) ?? []
      arr.push(t)
      tablesByRoom.set(String(rid), arr)
    }
  }
  const groups: { name: string | null; tables: Table[] }[] = [
    ...roomOrder.map((r) => ({ name: r.name, tables: tablesByRoom.get(String(r.id)) ?? [] })),
    ...(noRoom.length ? [{ name: roomOrder.length ? 'Egyéb' : null, tables: noRoom }] : []),
  ].filter((g) => g.tables.length > 0)

  return (
    <div className={`${card} overflow-x-auto`}>
      <div style={{ minWidth: width + 128 }}>
        {/* idő-tengely fejléc */}
        <div className="flex sticky top-0 z-20 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-white/[0.06]">
          <div className="w-24 sm:w-32 shrink-0 sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400">Asztal</div>
          <div className="relative" style={{ width }}>
            {hourMarks.map((m) => (
              <span
                key={m}
                className="absolute top-2 text-xs tabular-nums text-zinc-400"
                style={{ left: (m - openMin) * pxPerMin }}
              >
                {minutesToHHMM(m)}
              </span>
            ))}
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.name ?? 'none'}>
            {g.name && (
              <div className="sticky left-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-50 dark:bg-white/[0.03] w-fit">
                {g.name}
              </div>
            )}
            {g.tables.map((t) => {
              const rows = active.filter((r) => tableIdsOf(r).includes(String(t.id)))
              return (
                <div key={t.id} className="flex border-b border-zinc-50 dark:border-white/[0.04]">
                  <div className="w-24 sm:w-32 shrink-0 sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-2 flex items-center justify-between gap-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{t.name}</span>
                    <span className="text-[11px] text-zinc-400 shrink-0">{t.capacity}f</span>
                  </div>
                  <div
                    className="relative h-12"
                    style={{ width }}
                    onClick={(e) => {
                      // üres sávra kattintva új foglalás az adott időpontra+asztalra
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      const min = openMin + Math.round((e.clientX - rect.left) / pxPerMin / 15) * 15
                      onCreate(minutesToHHMM(Math.max(openMin, Math.min(min, closeMin - turnMinutes))), t.id)
                    }}
                  >
                    {/* óránkénti rácsvonalak */}
                    {hourMarks.map((m) => (
                      <span
                        key={m}
                        className="absolute inset-y-0 w-px bg-zinc-100 dark:bg-white/[0.05]"
                        style={{ left: (m - openMin) * pxPerMin }}
                      />
                    ))}
                    {rows.map((r) => {
                      const s = hhmmToMinutes(r.start_time)
                      const e = hhmmToMinutes(r.end_time)
                      return (
                        <button
                          key={r.id}
                          onClick={(ev) => { ev.stopPropagation(); onEdit(r) }}
                          title={`${r.customer_name} · ${r.pax} fő · ${statusLabel[r.status]}`}
                          className={`absolute top-1 bottom-1 rounded-md border px-2 text-xs font-medium overflow-hidden text-left ${statusBlock[r.status]}`}
                          style={{ left: (s - openMin) * pxPerMin + 1, width: (e - s) * pxPerMin - 2 }}
                        >
                          <span className="block truncate leading-tight">{r.customer_name}</span>
                          <span className="block truncate leading-tight opacity-80">{r.pax} fő</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Floor plan (auto-grid + idő-csúszka) ---------- */
function FloorView({
  date, capacityMode, reservations, rooms, tables, openMin, closeMin, onEdit,
}: DailyViewProps & { onEdit: (r: Reservation) => void }) {
  // Kezdőpillanat: ha a megtekintett nap ma van, az aktuális idő (a nyitvatartásra
  // szorítva); egyébként a nyitvatartás közepe.
  const initialMin = () => {
    const now = new Date()
    const isToday = ymdLocal(now) === date
    const cur = now.getHours() * 60 + now.getMinutes()
    const base = isToday ? cur : (openMin + closeMin) / 2
    return Math.round(Math.max(openMin, Math.min(base, closeMin)) / 15) * 15
  }
  const [atMin, setAtMin] = useState(initialMin)
  const card = 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] rounded-2xl'

  if (capacityMode === 'flat') {
    return <div className={`${card} p-12 text-center text-zinc-500`}>A teremnézet csak asztalos módban érhető el.</div>
  }

  const active = reservations.filter((r) => ACTIVE.has(r.status))
  // melyik asztal foglalt az adott pillanatban + ki ül ott
  const occupantOf = (tableId: string) =>
    active.find(
      (r) => tableIdsOf(r).includes(tableId) && atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time),
    ) ?? null

  const roomOrder = [...rooms].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const tablesByRoom = (roomId: string | null) =>
    [...tables]
      .filter((t) => {
        const rid = t.room ? (typeof t.room === 'object' ? t.room.id : t.room) : null
        return roomId == null ? rid == null : String(rid) === roomId
      })
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const groups: { name: string | null; tables: Table[] }[] = [
    ...roomOrder.map((r) => ({ name: r.name, tables: tablesByRoom(String(r.id)) })),
    ...(tablesByRoom(null).length ? [{ name: roomOrder.length ? 'Egyéb' : null, tables: tablesByRoom(null) }] : []),
  ].filter((g) => g.tables.length > 0)

  const occupiedTableIds = new Set(
    active
      .filter((r) => atMin >= hhmmToMinutes(r.start_time) && atMin < hhmmToMinutes(r.end_time))
      .flatMap((r) => tableIdsOf(r)),
  )
  const free = tables.length - occupiedTableIds.size

  return (
    <div className={`${card} p-5 space-y-5`}>
      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        <span className="text-2xl font-black tabular-nums text-zinc-900 dark:text-white w-20 shrink-0">{minutesToHHMM(atMin)}</span>
        <span className="text-xs text-zinc-400 ml-auto sm:hidden">{free} szabad</span>
        <input
          type="range"
          min={openMin}
          max={closeMin}
          step={15}
          value={atMin}
          onChange={(e) => setAtMin(Number(e.target.value))}
          className="flex-1 min-w-full sm:min-w-0 accent-zinc-900 dark:accent-white"
        />
        <span className="hidden sm:block text-xs text-zinc-400 w-24 text-right shrink-0">{free} szabad asztal</span>
      </div>

      {groups.map((g) => (
        <div key={g.name ?? 'none'}>
          {g.name && <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">{g.name}</p>}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {g.tables.map((t) => {
              const occ = occupantOf(String(t.id))
              const cls = `relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center p-1 overflow-hidden ${
                occ
                  ? `${statusBlock[occ.status]} cursor-pointer hover:opacity-90 transition-opacity`
                  : 'border-dashed border-zinc-200 dark:border-white/[0.1] text-zinc-400'
              }`
              if (!occ) {
                return (
                  <div key={t.id} title={`${t.name} · szabad`} className={cls}>
                    <span className="text-sm font-bold leading-tight">{t.name}</span>
                    <span className="text-[11px] leading-tight">{t.capacity} fő</span>
                  </div>
                )
              }
              const startM = hhmmToMinutes(occ.start_time)
              const endM = hhmmToMinutes(occ.end_time)
              const elapsedPct = Math.max(0, Math.min(100, ((atMin - startM) / Math.max(1, endM - startM)) * 100))
              const remaining = Math.max(0, endM - atMin)
              return (
                <button
                  key={t.id}
                  onClick={() => onEdit(occ)}
                  title={`${occ.customer_name} · ${occ.pax} fő · ${occ.start_time}–${occ.end_time}`}
                  className={cls}
                >
                  <span className="text-sm font-bold leading-tight">{t.name}</span>
                  <span className="text-[11px] leading-tight">{occ.pax}/{t.capacity} fő</span>
                  <span className="text-[10px] font-medium tabular-nums leading-tight opacity-90">
                    {occ.start_time}–{occ.end_time}
                  </span>
                  <span className="text-[10px] tabular-nums leading-tight opacity-75">
                    még {remaining} perc
                  </span>
                  {/* eltelt idő sáv a cella alján */}
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-black/15">
                    <span className="block h-full bg-white/70" style={{ width: `${elapsedPct}%` }} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
