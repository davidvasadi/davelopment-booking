'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Link2, type LucideIcon } from 'lucide-react'
import { Card, Pill, StatusPill } from '@/components/ui-kit'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { minutesToHHMM, minutesToHHMMWrapped } from '@/lib/utils'

/**
 * A Foglalások napi idővonala (a /design 6.1 / 6.13) — szalonnál és étteremnél is EZ fut: soronként egy
 * erőforrás (munkatárs vagy asztal, étteremnél termenként csoportosítva), vízszintesen az idő. A sáv csíkos (szabad idő),
 * rajta a foglalás-blokkok az állapot színével (benne a riasztás-pill), pontozott óra-vonalak, sárga „most” vonal.
 * Áthelyezés húzással: kis mozdulatig kattintás (= megnyitás), utána a blokk felemelkedik, a helye szaggatott, 15 perces
 * rácsra illeszt, és azonnal jelzi, ha a cél-soron ütközne. Nagyon hosszú napon (`scroll`) px/perc alapú, vízszintesen
 * görgethető sáv, nyitáskor a mostani időre görget. A lemondott + újrafoglalt pár egymás mellett áll (kattintásra cserél).
 */

export type GridBlockInfo = { title: React.ReactNode; sub?: React.ReactNode; badge?: React.ReactNode; tooltip: string }
/** Egy foglalás olvasása a rács számára — a hívó adja (szalon: Booking, étterem: Reservation). */
export type GridAccess<S> = {
  id: (s: S) => string
  start: (s: S) => number
  end: (s: S) => number
  status: (s: S) => string
  draft?: (s: S) => boolean
  createdAt?: (s: S) => string
  /** a blokk tartalma — `size`: tiny ≤ 30 perc (csak név), wide ≥ 3 óra (a riasztás teljes felirata) */
  block: (s: S, size: 'tiny' | 'narrow' | 'wide') => GridBlockInfo
  /** a blokk színe (shared/statusColors) */
  tone: (s: S) => string
  /** az állapot pöttye a blokk jobb felső sarkában (mint a mobil kártyán) */
  dot?: (s: S) => string | undefined
  /** a húzott blokk felirata */
  dragLabel: (s: S) => string
}
/** Sávon belüli jelölés (szünet) vagy az egész sor (szabadnap / szabadság / beteg). */
export type GridBand = { start: number; end: number; label: string; icon?: LucideIcon }
/** `name`: a sor neve szövegként (az áthelyezés-megerősítőben: „Dávid”, „T4”). */
export type GridRow<S> = { id: string; label: React.ReactNode; name?: string; items: S[]; bands?: GridBand[]; off?: string; capacity?: number; noDrop?: boolean
  /** a sávra rajzolt plusz elem (a design oldalon: a húzás közbeni állapot) — megkapja a perc → pozíció függvényt */
  overlay?: (pos: (min: number) => string) => React.ReactNode }
/** Összevont asztalok (design 6.13): a sávok egy keretben egymás alatt, a több asztalt foglaló foglalás egyetlen
 *  blokkban mindegyiken átível, rajta a „T4 + T5 · 8 hely” jelölés. Az asztalok saját foglalásai a saját sávjukban. */
export type GridMerged<S> = { id: string; merged: GridRow<S>[]; spanning: S[]; caption: string }
export type GridGroup<S> = { key: string; title?: React.ReactNode; rows: (GridRow<S> | GridMerged<S>)[] }
/** A riasztás rövid alakja keskeny blokkba: „Késik 146 perce” → „146'”. */
export const shortAlert = (label: string) => { const n = label.match(/\d+/)?.[0]; return n ? `${n}'` : label }
const isMerged = <S,>(r: GridRow<S> | GridMerged<S>): r is GridMerged<S> => 'merged' in r

const PX_PER_MIN = 1.5
const DRAG_THRESHOLD = 8
const LABEL_W = 150

type DragState<S> = { s: S; dur: number; previewMin: number; rowId: string; cx: number; cy: number; grabDx: number; widthPx: number }

export function ResourceGrid<S>({
  groups, access, stack, openMin, closeMin, endMin, nowMin, mode = 'fit', closed = false, canManage = false, onEdit, onMove, tooSmall, legend, empty, head,
}: {
  groups: GridGroup<S>[]
  access: GridAccess<S>
  /** a sor foglalásai: egyesével vagy [aktív, lemondott] párban (átfedés) */
  stack: (items: S[]) => (S | [S, S])[]
  openMin: number
  closeMin: number
  /** a rács jobb széle (a záróra után végződő foglalásig) */
  endMin?: number
  nowMin: number | null
  mode?: 'fit' | 'scroll'
  /** zárt nap: a sávok a „Zárva” mintát kapják */
  closed?: boolean
  canManage?: boolean
  onEdit: (s: S) => void
  /** `false` (vagy hiba) esetén a blokk visszaugrik a régi helyére */
  onMove?: (s: S, newStart: string, rowId: string) => void | Promise<boolean | void>
  /** húzás közben: a cél-sor túl kicsi-e (étterem: asztal-létszám) */
  tooSmall?: (row: GridRow<S>, s: S) => boolean
  legend?: React.ReactNode
  empty?: React.ReactNode
  /** a kártya teteje (pl. a Naptár nap-nézetében a dátumváltó) */
  head?: React.ReactNode
}) {
  const fit = mode === 'fit'
  const end = Math.max(endMin ?? closeMin, closeMin)
  const totalMin = Math.max(end - openMin, 60)
  const pos = (min: number) => (fit ? `${((min - openMin) / totalMin) * 100}%` : `${(min - openMin) * PX_PER_MIN}px`)
  const len = (min: number) => (fit ? `${(min / totalMin) * 100}%` : `${min * PX_PER_MIN}px`)
  const axisWidth = fit ? undefined : totalMin * PX_PER_MIN
  const hourMarks: number[] = []
  if (openMin % 60 !== 0) hourMarks.push(openMin)
  for (let m = Math.ceil(openMin / 60) * 60; m <= end; m += 60) hourMarks.push(m)
  const nowVisible = nowMin != null && nowMin >= openMin && nowMin <= end
  // a sorok laposan (az összevont csoport al-sávjai is; ütközés-vizsgálathoz bennük az átívelő foglalás is)
  const allRows: GridRow<S>[] = groups.flatMap((g) => g.rows.flatMap((r) => (isMerged(r) ? r.merged.map((m) => ({ ...m, items: [...m.items, ...r.spanning] })) : [r])))

  // ── a fejléc-vonalzó és a tartalom vízszintes görgetése szinkronban (scroll mód) ──
  const gridRef = useRef<HTMLDivElement>(null)
  const axisRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)
  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (syncing.current || !from || !to) return
    syncing.current = true
    to.scrollLeft = from.scrollLeft
    syncing.current = false
  }
  useEffect(() => {
    if (fit || nowMin == null || !gridRef.current) return
    const el = gridRef.current
    el.scrollLeft = Math.max(0, (nowMin - openMin) * PX_PER_MIN - el.clientWidth / 2)
    if (axisRef.current) axisRef.current.scrollLeft = el.scrollLeft
    // csak nyitáskor egyszer — a további görgetést nem írjuk felül
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── húzás: pointerdown csak előkészít; a küszöb után indul a valódi húzás, különben kattintás ──
  const [drag, setDrag] = useState<DragState<S> | null>(null)
  const dragRef = useRef<DragState<S> | null>(null)
  const pendingRef = useRef<{ init: DragState<S>; startX: number; startY: number } | null>(null)

  const xToMin = (clientX: number, rowEl: HTMLElement) => {
    const rect = rowEl.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round((openMin + ratio * totalMin) / 15) * 15
  }

  useEffect(() => {
    const onPendingMove = (e: PointerEvent) => {
      const p = pendingRef.current
      if (!p || dragRef.current) return
      if (Math.abs(e.clientX - p.startX) >= DRAG_THRESHOLD || Math.abs(e.clientY - p.startY) >= DRAG_THRESHOLD) {
        dragRef.current = p.init
        setDrag(p.init)
        pendingRef.current = null
      }
    }
    const onPendingUp = () => {
      const p = pendingRef.current
      pendingRef.current = null
      // a húzás elindult, de az onUp még nem iratkozott fel (aszinkron effekt) — itt takarítunk
      if (dragRef.current) { dragRef.current = null; setDrag(null); return }
      if (p) onEdit(p.init.s)
    }
    window.addEventListener('pointermove', onPendingMove)
    window.addEventListener('pointerup', onPendingUp)
    return () => { window.removeEventListener('pointermove', onPendingMove); window.removeEventListener('pointerup', onPendingUp) }
  }, [onEdit])

  useEffect(() => {
    if (!drag) return
    const onMoveEvt = (e: PointerEvent) => {
      const cur = dragRef.current
      if (!cur) return
      // a húzott blokk pointer-events:none, így az alatta lévő sort találjuk
      const rowEl = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-grid-row]')
      const target = rowEl && rowEl.dataset.noDrop !== '1' ? rowEl : null
      const rowId = target?.dataset.gridRow ?? cur.rowId
      const axis = target ?? gridRef.current?.querySelector<HTMLElement>(`[data-grid-row="${cur.rowId}"]`)
      const previewMin = axis ? Math.max(openMin, Math.min(xToMin(e.clientX - cur.grabDx, axis), closeMin - cur.dur)) : cur.previewMin
      const next = { ...cur, previewMin, rowId, cx: e.clientX, cy: e.clientY }
      dragRef.current = next
      setDrag(next)
    }
    const onUp = () => {
      const cur = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!cur || !onMove) return
      const origRow = allRows.find((r) => r.items.some((x) => access.id(x) === access.id(cur.s)))
      // nem ment rögtön: előbb megkérdezi (design 6.10 — régi → új, ütközés)
      if (cur.previewMin !== access.start(cur.s) || cur.rowId !== origRow?.id) setPending({ s: cur.s, start: cur.previewMin, rowId: cur.rowId, fromRow: origRow?.id ?? '' })
    }
    window.addEventListener('pointermove', onMoveEvt)
    // capture: az onUp fut először, így a pending-kezelő már üres húzást lát
    window.addEventListener('pointerup', onUp, { capture: true })
    return () => { window.removeEventListener('pointermove', onMoveEvt); window.removeEventListener('pointerup', onUp, { capture: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, openMin, closeMin, totalMin, onMove])

  // ── áthelyezés megerősítése, és a jóváhagyott áthelyezés azonnal az új helyén látszik (amíg a friss adat meg nem jön) ──
  const [pending, setPending] = useState<{ s: S; start: number; rowId: string; fromRow: string } | null>(null)
  const [moved, setMoved] = useState<Map<string, { start: number; rowId: string }>>(() => new Map())
  const [saving, setSaving] = useState(false)
  const dataSig = allRows.map((r) => r.id + ':' + r.items.map((x) => `${access.id(x)}@${access.start(x)}`).join(',')).join('|')
  useEffect(() => { setMoved(new Map()) }, [dataSig])
  const confirmMove = async () => {
    if (!pending || !onMove) return
    setSaving(true)
    setMoved((m) => new Map(m).set(access.id(pending.s), { start: pending.start, rowId: pending.rowId }))
    const id = access.id(pending.s)
    let ok: boolean | void = false
    try { ok = await onMove(pending.s, minutesToHHMM(pending.start), pending.rowId) } finally {
      if (ok === false) setMoved((m) => { const n = new Map(m); n.delete(id); return n })
      setSaving(false)
      setPending(null)
    }
  }
  const pendingConflict = (() => {
    if (!pending) return false
    const row = allRows.find((r) => r.id === pending.rowId)
    const a = pending.start, b = pending.start + access.end(pending.s) - access.start(pending.s)
    return !!row?.items.some((x) => access.id(x) !== access.id(pending.s) && access.status(x) !== 'cancelled' && access.start(x) < b && access.end(x) > a)
  })()
  // a cél-sor szünetére nem lehet áthelyezni
  const pendingBreak = (() => {
    if (!pending) return null
    const row = allRows.find((r) => r.id === pending.rowId)
    const a = pending.start, b = pending.start + access.end(pending.s) - access.start(pending.s)
    return row?.bands?.find((w) => w.start < b && w.end > a) ?? null
  })()
  const rowName = (id: string) => allRows.find((r) => r.id === id)?.name ?? ''

  const begin = (s: S, rowId: string, e: React.PointerEvent) => {
    if (access.draft?.(s)) return
    const st = access.start(s)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    pendingRef.current = {
      init: { s, dur: access.end(s) - st, previewMin: st, rowId, cx: e.clientX, cy: e.clientY, grabDx: e.clientX - rect.left, widthPx: rect.width },
      startX: e.clientX, startY: e.clientY,
    }
  }

  // ütközés a cél-soron (a húzott foglaláson és a lemondottakon kívül)
  const conflict = (() => {
    if (!drag) return false
    const row = allRows.find((r) => r.id === drag.rowId)
    const a = drag.previewMin, b = drag.previewMin + drag.dur
    return !!row?.items.some((x) => access.id(x) !== access.id(drag.s) && access.status(x) !== 'cancelled' && access.start(x) < b && access.end(x) > a)
  })()

  /** Egy foglalás-blokk. `standalone`: önmagát pozicionálja az idő-tengelyen (fix 48px magas — a gomb elem nem minden
   *  böngészőben nyúlik ki a top/bottom közé); különben egy pár kitöltő eleme. Az összevont asztalokon átívelő (`caption`)
   *  a sávok teljes magasságát fogja át. */
  const renderBlock = (s: S, rowId: string, standalone = true, caption?: string): React.ReactNode => {
    const dur = access.end(s) - access.start(s)
    const st = moved.get(access.id(s))?.start ?? access.start(s)
    const draft = access.draft?.(s) ?? false
    const info = access.block(s, dur <= 30 ? 'tiny' : dur >= 180 ? 'wide' : 'narrow')
    const isDragging = drag != null && access.id(drag.s) === access.id(s)
    return (
      <button
        key={access.id(s)}
        type="button"
        onPointerDown={(ev) => {
          if (draft) return
          if (canManage && onMove) { ev.stopPropagation(); begin(s, rowId, ev) } else onEdit(s)
        }}
        title={info.tooltip}
        className={`${standalone ? (caption ? 'absolute inset-y-1' : 'absolute top-1 h-12') : 'relative h-full w-full min-w-0'} flex items-center justify-between gap-2 overflow-hidden rounded-ui-control px-2.5 text-left outline-none transition-[filter,opacity] focus-visible:ring-2 focus-visible:ring-ui-dark/30 ${
          isDragging ? 'pointer-events-none border-2 border-dashed border-ui-dark/40 bg-transparent text-transparent'
            : draft ? 'cursor-default border-2 border-dashed border-ui-yellow bg-ui-yellow/20 text-ui-text'
              : `${access.tone(s)} ${canManage && onMove ? 'cursor-grab active:cursor-grabbing hover:brightness-110' : ''}`
        }`}
        style={{ ...(standalone ? { left: `calc(${pos(st)} + 2px)`, width: `calc(${len(dur)} - 4px)` } : {}), touchAction: 'none' }}
      >
        {!draft && !isDragging && access.dot?.(s) && <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${access.dot(s)}`} />}
        <span className="min-w-0">
          <span className="block truncate pr-3 text-ui-meta font-medium">{draft ? '✎ ' : ''}{info.title}</span>
          {info.sub && <span className="block truncate text-ui-label opacity-60">{info.sub}</span>}
          {/* az összevonás jelölése: sötét blokkon áttetsző, világos (függő, hamarosan) blokkon fehér */}
          {caption && <Pill tone={access.tone(s).includes('bg-ui-dark') ? 'onDark' : 'white'} size="sm" icon={Link2} className="mt-1.5 w-fit">{caption}</Pill>}
        </span>
        {info.badge}
      </button>
    )
  }

  if (allRows.length === 0) return <Card>{head}{empty}</Card>

  /** Egy sáv (egy asztal / munkatárs): csíkos háttér, szünet-sávok, a foglalás-blokkok. */
  const track = (row: GridRow<S>) => {
    // a jóváhagyott, még mentés alatt álló áthelyezés: a régi sorból kikerül, az újban látszik
    const items = [
      ...row.items.filter((x) => { const mv = moved.get(access.id(x)); return !mv || mv.rowId === row.id }),
      ...allRows.filter((r) => r.id !== row.id).flatMap((r) => r.items).filter((x) => moved.get(access.id(x))?.rowId === row.id && !row.items.includes(x)),
    ]
    const target = drag != null && drag.rowId === row.id
    const small = drag != null && tooSmall?.(row, drag.s)
    return (
      <div
        key={row.id}
        data-grid-row={row.id}
        data-no-drop={row.noDrop ? '1' : undefined}
        className={`relative h-14 min-w-0 flex-1 rounded-ui-inner transition-colors ${
          target ? (small ? 'bg-ui-bad-bg ring-1 ring-inset ring-ui-bad-dot' : 'bg-ui-yellow/30') : closed ? 'ui-hatch bg-ui-bad-bg' : row.off ? 'ui-hatch-cell' : 'ui-hatch'
        } ${drag && small && !target ? 'opacity-45' : ''}`}
      >
        {row.off && !items.length && <span className="absolute inset-0 flex items-center justify-center text-ui-meta text-ui-muted">{row.off}</span>}
        {row.bands?.map((b) => {
          const Icon = b.icon
          return (
            // szünet: ugyanolyan blokk, mint a foglalás (tömör fehér, a csík nem üt át rajta); keskenyen csak az ikon marad
            <span key={`${b.start}-${b.label}`} title={b.label} className="pointer-events-none absolute top-1 flex h-12 min-w-0 items-center gap-1.5 overflow-hidden rounded-ui-control bg-white px-2.5 text-ui-meta text-ui-muted" style={{ left: `calc(${pos(b.start)} + 2px)`, width: `calc(${len(b.end - b.start)} - 4px)` }}>
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />}<span className="min-w-0 truncate pr-3">{b.label}</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ui-bad-dot" />
            </span>
          )
        })}
        {stack(items).map((item) => (Array.isArray(item)
          ? <StackPair key={item.map(access.id).join('-')} pair={item} access={access} left={pos} span={len} render={(x) => renderBlock(x, row.id, false)} />
          : renderBlock(item, row.id)))}
        {row.overlay?.(pos)}
        {/* zárás után: a sáv csíkozva, a rajta lévő foglalás átlátszik (látszik, hogy zárás után is foglalt) */}
        {closeMin < end && <span className="pointer-events-none absolute inset-y-0 right-0 z-10 rounded-r-ui-inner border-l-[1.5px] border-dashed border-ui-bad/50 ui-hatch-over" style={{ left: pos(closeMin) }} />}
      </div>
    )
  }
  const labelCls = `shrink-0 pr-3 ${fit ? '' : 'sticky left-0 z-30 bg-white/90 backdrop-blur'}`

  // design 6.1: a munkatárs-sorok között pontozott vonal; 6.13: a termek alatt az asztalok szorosan, vonal nélkül
  const rowsOf = (g: GridGroup<S>, gi: number) => (
    <div key={g.key}>
      {g.title && <div className={`mb-2 flex items-center gap-2 text-ui-meta text-ui-muted ${gi ? 'mt-4' : ''}`}>{g.title}</div>}
      <div className={g.title ? 'space-y-1.5' : ''}>
        {g.rows.map((row) => isMerged(row) ? (
          // összevont asztalok: egy keretben, az átívelő foglalás egy blokkban
          <div key={row.id} className={g.title ? '' : 'border-t border-dotted border-ui-divider py-2'}>
            <div className="flex rounded-ui-inner bg-white/60 p-1.5">
              <div className={`${labelCls} flex flex-col justify-around gap-1.5`} style={{ width: LABEL_W - 6 }}>
                {row.merged.map((m) => <div key={m.id}>{m.label}</div>)}
              </div>
              <div className="relative min-w-0 flex-1 space-y-1.5">
                {row.merged.map((m) => <div key={m.id} className="flex">{track(m)}</div>)}
                {row.spanning.filter((x) => !moved.has(access.id(x))).map((x) => renderBlock(x, row.merged[0].id, true, row.caption))}
              </div>
            </div>
          </div>
        ) : (
          <div key={row.id} className={`flex items-center ${g.title ? '' : 'border-t border-dotted border-ui-divider py-2'}`}>
            {/* görgethető módban a címke balra ragad, hogy ne görgessen ki */}
            <div className={labelCls} style={{ width: LABEL_W }}>{row.label}</div>
            {track(row)}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <Card>
        {head}
        {/* óra-vonalzó — külön fa, vízszintesen a tartalommal szinkronban görget */}
        <div className="flex">
          <div className="shrink-0" style={{ width: LABEL_W }} />
          <div ref={axisRef} onScroll={() => sync(axisRef.current, gridRef.current)} className={`min-w-0 flex-1 ${fit ? '' : 'no-scrollbar overflow-x-auto'}`}>
            <div className="relative h-9" style={{ width: axisWidth }}>
              {hourMarks.filter((m) => !(closeMin < end && Math.abs(m - closeMin) < 45)).map((m, i) => (
                <span key={m} className={`absolute bottom-1 text-ui-label tabular-nums text-ui-muted ${i === 0 ? '' : '-translate-x-1/2'}`} style={{ left: pos(m) }}>{minutesToHHMMWrapped(m)}</span>
              ))}
              {closeMin < end && <span className="absolute bottom-1 whitespace-nowrap text-ui-label font-medium tabular-nums text-ui-bad" style={{ left: `calc(${pos(closeMin)} + 6px)` }}>Zárás {minutesToHHMMWrapped(closeMin)}</span>}
              {nowVisible && <span className="absolute top-0 z-20 -translate-x-1/2" style={{ left: pos(nowMin!) }}><Pill tone="yellow" size="sm">{minutesToHHMM(nowMin!)}</Pill></span>}
            </div>
          </div>
        </div>

        {/* sorok — sok sornál belül görget, nem az egész oldal nő */}
        <div className="max-h-[65vh] overflow-y-auto">
          <div ref={gridRef} onScroll={() => sync(gridRef.current, axisRef.current)} className={fit ? '' : 'overflow-x-auto'}>
            <div className="relative" style={{ width: axisWidth ? axisWidth + LABEL_W : undefined }}>
              {/* pontozott óra-vonalak a sorok mögött (a sávok között látszanak), a „most” vonal felettük */}
              <div className="pointer-events-none absolute inset-y-0 right-0" style={{ left: LABEL_W }}>
                {hourMarks.map((m) => <span key={m} className="absolute inset-y-0 border-l border-dotted border-ui-divider" style={{ left: pos(m) }} />)}
              </div>
              {groups.map(rowsOf)}
              {nowVisible && (
                <div className="pointer-events-none absolute inset-y-0 right-0 z-20" style={{ left: LABEL_W }}>
                  <span className="absolute inset-y-0 border-l-2 border-ui-yellow" style={{ left: pos(nowMin!) }}><span className="absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-ui-yellow" /></span>
                </div>
              )}
            </div>
          </div>
        </div>
        {legend}
      </Card>

      {/* áthelyezés megerősítése (design 6.10): régi → új egymás mellett, ütközés-jelzés */}
      <ConfirmDialog
        open={!!pending}
        icon={ArrowRight}
        destructive={false}
        title="Áthelyezed?"
        description={pending ? access.dragLabel(pending.s) : undefined}
        confirmLabel={pendingBreak ? 'Rendben' : 'Áthelyezés'}
        busy={saving}
        onConfirm={pendingBreak ? () => setPending(null) : confirmMove}
        onCancel={() => setPending(null)}
        zIndexClass="z-[210]"
      >
        {pending && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <div className="rounded-ui-inner p-3 text-ui-muted ui-hatch-cell">
                <div className="text-ui-label">Eredeti</div>
                <div className="text-ui-title font-light line-through">{minutesToHHMM(access.start(pending.s))}</div>
                <div className="truncate text-ui-label">{rowName(pending.fromRow)}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-ui-muted" />
              <div className="rounded-ui-inner bg-ui-dark p-3 text-white">
                <div className="text-ui-label text-white/55">Új</div>
                <div className="text-ui-title font-light">{minutesToHHMM(pending.start)}</div>
                <div className="truncate text-ui-label text-white/70">{rowName(pending.rowId)}</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {pendingBreak
                ? <StatusPill status="bad">{pendingBreak.label}re esik ({minutesToHHMM(pendingBreak.start)}–{minutesToHHMM(pendingBreak.end)}) — ide nem lehet</StatusPill>
                : <StatusPill status={pendingConflict ? 'bad' : 'ok'}>{pendingConflict ? 'Ütközik egy másik foglalással' : 'Nincs ütközés'}</StatusPill>}
              {tooSmall && (() => { const row = allRows.find((r) => r.id === pending.rowId); return row && tooSmall(row, pending.s) ? <StatusPill status="warn">Kicsi az asztal — a szomszédossal összevonjuk</StatusPill> : null })()}
            </div>
          </>
        )}
      </ConfirmDialog>

      {/* húzott blokk — követi a kurzort; fölötte a cél időpont és hogy ütközik-e */}
      {drag && typeof document !== 'undefined' && createPortal(
        <div className="pointer-events-none fixed z-[200]" style={{ left: drag.cx - drag.grabDx, top: drag.cy - 28, width: drag.widthPx }}>
          <Pill tone="white" size="sm" className="mb-1.5 shadow-ui-float">
            <span className={`h-1.5 w-1.5 rounded-full ${conflict ? 'bg-ui-bad-dot' : 'bg-ui-ok-dot'}`} />
            {minutesToHHMM(drag.previewMin)}-ra · {conflict ? 'ütközik' : 'nincs ütközés'}
          </Pill>
          <div className="flex h-14 -rotate-1 items-center rounded-ui-control bg-ui-dark px-2.5 text-white shadow-ui-float">
            <span className="min-w-0">
              <span className="block truncate text-ui-meta font-medium">{access.dragLabel(drag.s)}</span>
              <span className="block truncate text-ui-label opacity-60">{minutesToHHMM(drag.previewMin)}–{minutesToHHMM(drag.previewMin + drag.dur)}</span>
            </span>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/** Lemondott + újrafoglalt pár egy helyen, egymás mellett (nincs takarás): az elöl lévő a teljes szélességet kapja, a
 *  másik keskeny csíkra húzódik — kattintásra cserélnek. A konténer a pár idő-unióját fogja át. */
function StackPair<S>({ pair, access, left, span, render }: { pair: [S, S]; access: GridAccess<S>; left: (m: number) => string; span: (m: number) => string; render: (s: S) => React.ReactNode }) {
  const ordered = [...pair].sort((a, b) => (access.status(a) === 'cancelled' ? -1 : access.status(b) === 'cancelled' ? 1 : 0))
  const s = Math.min(...pair.map(access.start)), e = Math.max(...pair.map(access.end))
  const freshest = [...pair].sort((a, b) => new Date(access.createdAt?.(b) ?? 0).getTime() - new Date(access.createdAt?.(a) ?? 0).getTime())[0]
  const [front, setFront] = useState(access.id(freshest))
  return (
    <div className="absolute top-1 flex h-12 items-stretch gap-1" style={{ left: `calc(${left(s)} + 2px)`, width: `calc(${span(e - s)} - 4px)` }}>
      {ordered.map((x) => {
        const id = access.id(x), isFront = id === front
        return (
          <div
            key={id}
            onClick={isFront ? undefined : (ev) => { ev.stopPropagation(); setFront(id) }}
            role={isFront ? undefined : 'button'}
            tabIndex={isFront ? undefined : 0}
            className={`h-full overflow-hidden rounded-ui-control ${isFront ? 'min-w-0' : `shrink-0 cursor-pointer ${access.tone(x)}`}`}
            style={{ flex: isFront ? '1 1 100%' : '0 0 20px', transition: 'flex 320ms cubic-bezier(0.22,1,0.36,1)' }}
          >
            <AnimatePresence initial={false}>
              {isFront && (
                <motion.div key="c" className="h-full w-full" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                  {render(x)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
