'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react'
import { Button, IconButton } from '@/components/ui-kit'
import { CalendarMonthGrid } from './CalendarMonthGrid'
import { isClosedDay } from '@/lib/closedDays'
import { ymdLocal } from '@/lib/utils'

const HU_MONTHS_FULL = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
]
const HU_DAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

// A sheet-ek "genie" nyitó-animációjának kicsinyített, popoverhez illő változata.
const POP = {
  hidden: { opacity: 0, scale: 0.92, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 480, damping: 30, mass: 0.8 } },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12, ease: 'easeIn' as const } },
}

/** Egy hónap zárt napjai és napi foglalásszámai a terheltség-végpontból (`?month=YYYY-MM` → closedDates,
 *  closedWeekdays, counts) — a naptár csíkozza a zárt napot és a foglaltság szerint színez (design 6.20), a napválasztó
 *  csík csíkoz. Hónaponként egyszer kér; egy perc után frissít (közben felvett foglalások). */
type MonthLoad = { closedDates: string[]; closedWeekdays: number[]; counts: Record<string, number>; util: Record<string, number> }
const closedCache = new Map<string, { t: number; p: Promise<MonthLoad | null> }>()
export function useMonthClosed(endpoint: string | undefined, month: string) {
  const [data, setData] = useState<MonthLoad | null>(null)
  useEffect(() => {
    if (!endpoint) return
    const k = `${endpoint}|${month}`
    const hit = closedCache.get(k)
    if (!hit || Date.now() - hit.t > 60_000) {
      closedCache.set(k, { t: Date.now(), p: fetch(`${endpoint}?month=${month}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j ? { closedDates: j.closedDates ?? [], closedWeekdays: j.closedWeekdays ?? [], counts: j.counts ?? {}, util: j.util ?? {} } : null))
        .catch(() => { closedCache.delete(k); return null }) })
    }
    let alive = true
    closedCache.get(k)!.p.then((v) => { if (alive) setData(v) })
    return () => { alive = false }
  }, [endpoint, month])
  return data
}

/** A nap foglaltsági fokozata (design 6.20): 1 szabad, 2 közepes, 3 telt — a napi kihasználtságból (a foglalható
 *  időhöz / ülőhelyhez mérve, lib/dayUtil); ha arra a napra nincs (nincs nyitvatartás / beosztás), a hónap legteltebb
 *  napjához mért foglalásszámból. */
function loadTier(util: number | undefined, count: number, max: number): 1 | 2 | 3 {
  if (util != null) return util >= 75 ? 3 : util >= 40 ? 2 : 1
  if (!count || max <= 0) return 1
  const r = count / max
  return r >= 0.8 ? 3 : r >= 0.45 ? 2 : 1
}

/** „Csüt., Nov. 19.” — a kiválasztott nap felirata */
function dayTitle(key: string): string {
  const [yy, mm, dd] = key.split('-').map(Number)
  const d = new Date(yy, mm - 1, dd)
  return `${['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'][d.getDay()]}, ${HU_MONTHS_FULL[mm - 1].slice(0, 3)}. ${dd}.`
}

function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

/**
 * Hónap-naptár (beágyazható, a design MiniMonth-ja): fent hónap-lapozó (opcionálisan év-választó), a hétvége piros a
 * fejlécben, alatta a napok — ha `loadEndpoint` adott, a zárt napok csíkosak.
 * A felugró DatePickerPopover és a Foglalások mobil „Nézet és szűrők” lapja (design 6.11 „Nap”) is ezt használja.
 */
export function MonthPicker({ value, rangeTo, onPick, loadEndpoint, yearRange, onClear }: {
  value: string
  /** időszak vége — a `value`–`rangeTo` tartomány kiemelve */
  rangeTo?: string | null
  /** élőben a nap választása; nélküle csak megjelenít (a design oldalon) */
  onPick?: (date: string) => void
  loadEndpoint?: string
  yearRange?: [number, number]
  onClear?: () => void
}) {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = value.split('-').map(Number)
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1)
  })
  const closed = useMonthClosed(loadEndpoint, monthKey(viewDate.getFullYear(), viewDate.getMonth()))
  const y = viewDate.getFullYear()
  const m = viewDate.getMonth()
  const today = ymdLocal(new Date())
  // a hónap legteltebb napja — ehhez mérjük a fokozatot
  const maxCount = closed ? Math.max(0, ...Object.entries(closed.counts).filter(([k]) => k.startsWith(monthKey(y, m))).map(([, v]) => v)) : 0

  return (
    <div>
      <div className="flex items-center justify-between">
        <IconButton icon={ArrowLeft} label="Előző hónap" variant="cell" size="sm" onClick={() => setViewDate(new Date(y, m - 1, 1))} />
        {yearRange ? (
          <span className="flex items-center gap-1 text-ui-body text-ui-text">
            {HU_MONTHS_FULL[m]}
            <select
              value={y}
              onChange={(e) => setViewDate(new Date(Number(e.target.value), m, 1))}
              aria-label="Év"
              className="cursor-pointer appearance-none rounded-ui-control bg-transparent px-1 py-0.5 text-ui-text transition-colors hover:bg-ui-cell focus:outline-none"
            >
              {Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => yearRange[1] - i).map((yy) => <option key={yy} value={yy}>{yy}</option>)}
            </select>
          </span>
        ) : (
          <span className="text-ui-body text-ui-text">{HU_MONTHS_FULL[m]} {y}</span>
        )}
        <IconButton icon={ArrowRight} label="Következő hónap" variant="cell" size="sm" onClick={() => setViewDate(new Date(y, m + 1, 1))} />
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-ui-label">
        {HU_DAYS_SHORT.map((d, i) => <span key={i} className={i > 4 ? 'text-ui-bad-dot' : 'text-ui-muted'}>{d}</span>)}
      </div>
      <div className="mt-1">
        <CalendarMonthGrid year={y} month={m} value={value} rangeTo={rangeTo} closed={closed ? (d) => isClosedDay(d, today, closed) : undefined}
          load={closed && !rangeTo ? (d) => loadTier(closed.util[d], closed.counts[d] ?? 0, maxCount) : undefined} onSelectDay={(d) => onPick?.(d)} />
      </div>
      {/* foglaltság (design 6.20): a kiválasztott nap száma a naptár alatt, alatta a jelmagyarázat */}
      {closed && !rangeTo && <>
        {value.startsWith(monthKey(y, m)) && (
          <div className="mt-3 flex items-center justify-between border-t border-dashed border-ui-divider pt-2.5 text-ui-meta">
            <span className="text-ui-muted">{dayTitle(value)}</span>
            <span className="text-ui-text">{isClosedDay(value, '', closed) ? 'Zárva' : `${closed.counts[value] ?? 0} foglalás${closed.util[value] != null ? ` · ${closed.util[value]}%` : ''}`}</span>
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-dashed border-ui-divider pt-2.5 text-ui-label text-ui-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ui-cell" />Szabad</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ui-yellow/40" />Közepes</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ui-yellow" />Telt</span>
          <span className="flex items-center gap-1.5"><span className="ui-hatch-cell h-2.5 w-2.5 rounded-full" />Zárva</span>
        </div>
      </>}
      {onClear && value && (
        <div className="mt-3 flex justify-center border-t border-dashed border-ui-divider pt-2.5">
          <Button variant="ghost" size="sm" onClick={onClear}>Törlés</Button>
        </div>
      )}
    </div>
  )
}

/**
 * Saját stílusú dátumválasztó popup (a natív `<input type="date">` OS-szintű ablaka helyett): a trigger alatt nyíló
 * fehér panelben a MonthPicker. Kattintás kívülre és Escape zárja. A panel a body-ra portálozva, fix pozícióval —
 * különben egy görgethető / overflow-hidden szülő levágná.
 */
export function DatePickerPopover({
  value,
  onChange,
  children,
  triggerClassName,
  loadEndpoint,
  yearRange,
  onClear,
}: {
  value: string
  onChange: (date: string) => void
  children: ReactNode
  /** Saját gomb-kinézet; nélküle a kit üveg-gombja naptár-ikonnal (Foglalások fejléce). */
  triggerClassName?: string
  /** Ha adott (pl. "/api/salon/day-load"), a napok a terheltségük szerint színezve. Minden nyitáskor friss adat. */
  loadEndpoint?: string
  /** Ha adott ([tól, ig]), az évszám a fejlécben választható (pl. születésnaphoz). */
  yearRange?: [number, number]
  /** Ha adott, a panel alján „Törlés” — a nem kötelező dátum ürítéséhez. */
  onClear?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    // a panel a mező alá nyílik; ha ott nem fér el, fölé — ha egyik irányban sem, a képernyőn belülre igazodik
    const compute = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const margin = 16
      const panelWidth = Math.min(292, vw - margin * 2)
      const idealLeft = rect.left + rect.width / 2 - panelWidth / 2
      const vh = window.innerHeight
      const h = panelRef.current?.offsetHeight || 420
      const below = rect.bottom + 8, above = rect.top - 8 - h
      const up = below + h > vh - margin && above >= margin
      const top = up ? above : Math.max(margin, Math.min(below, vh - h - margin))
      setPos({ top, left: Math.max(margin, Math.min(idealLeft, vw - panelWidth - margin)), width: panelWidth, up })
    }
    compute()
    const raf = requestAnimationFrame(compute)
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t) && !(panelRef.current && panelRef.current.contains(t))) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDocClick); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      {triggerClassName
        ? <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClassName}>{children}</button>
        : <Button variant="glass" icon={CalendarDays} onClick={() => setOpen((o) => !o)}>{children}</Button>}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <div ref={panelRef} className="fixed z-[1200] font-onest" style={{ top: pos.top, left: pos.left, width: pos.width }}>
              <motion.div variants={POP} initial="hidden" animate="show" exit="exit" style={{ transformOrigin: pos.up ? 'bottom center' : 'top center' }} className="rounded-ui-card bg-white p-4 shadow-ui-popup">
                {/* minden nyitáskor új példány → friss terheltség-adat */}
                <MonthPicker
                  value={value}
                  onPick={(d) => { onChange(d); setOpen(false) }}
                  loadEndpoint={loadEndpoint}
                  yearRange={yearRange}
                  onClear={onClear ? () => { onClear(); setOpen(false) } : undefined}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
