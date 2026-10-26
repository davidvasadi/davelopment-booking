'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CalendarMonthGrid, LOAD_TIERS } from './CalendarMonthGrid'

const HU_MONTHS_FULL = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
]
const HU_DAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

// A sheet-ek "genie" nyitó-animációjának kicsinyített, popoverhez illő változata — ugyanaz a
// pattanó-spring nyelv, mint az Új foglalás panelen, csak kisebb elmozdulással/scale-lel.
const POP = {
  hidden: { opacity: 0, scale: 0.92, y: -6 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 480, damping: 30, mass: 0.8 } },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12, ease: 'easeIn' as const } },
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

/**
 * Saját stílusú hónap-rács naptár popup — a natív `<input type="date">` böngésző-natív
 * (OS-szintű, az app dizájnjától teljesen idegen) felugró ablaka helyett. Nincs hozzá új
 * függőség (nincs Popover/date-picker csomag telepítve) — egyszerű abszolút pozicionált
 * panel, kattintás-kívülre + Escape zárja.
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
  triggerClassName: string
  /** Ha adott (pl. "/api/salon/day-load"), a komponens `?month=YYYY-MM`-mel lekéri az adott
   *  hónap napi terheltségét (aktív foglalások száma/nap), és aszerint színezi a napokat —
   *  minél teltebb egy nap, annál erősebb az arany háttér. Megnyitáskor mindig friss adatot
   *  kér (nem gyorsítótárazott a nyitások között), csak az adott nyitáson belüli hónap-
   *  lapozás nem kérdez rá kétszer ugyanarra a hónapra. */
  loadEndpoint?: string
  /** Ha adott ([tól, ig]), az évszám a fejlécben választható — távoli dátumhoz (pl. születésnap)
   *  ne kelljen hónapról hónapra lapozni. */
  yearRange?: [number, number]
  /** Ha adott, a panel alján „Törlés” — a nem kötelező dátum ürítéséhez. */
  onClear?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = value.split('-').map(Number)
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1)
  })
  const [loadByMonth, setLoadByMonth] = useState<Record<string, Record<string, number>>>({})
  // Melyik hónapokra indult már lekérés EBBEN a nyitásban — REF-ben, nem state-ben, mert a
  // state-alapú ellenőrzés (loadByMonth[key]) egy külön effektben, egy render-körrel később
  // látta csak a reset hatását → páratlan/páros nyitásonként hol lefutott a lekérés, hol nem
  // (a felhasználó által észlelt "egyszer bejön, aztán nem" villogás pont ez volt).
  const fetchedMonthsRef = useRef<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  // A panel a body-ra portálozva, FIX pozícióval — különben egy görgethető/overflow-hidden szülő
  // (pl. az Új foglalás panel törzse) levágta. `pos` = a trigger alja + a viewportba szorított bal
  // szél (a jobb szélhez közeli triggereknél sem lóg ki a képernyőről).
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const [y, m] = value.split('-').map(Number)
    setViewDate(new Date(y || new Date().getFullYear(), (m || 1) - 1, 1))
    // Minden ÚJ megnyitáskor friss terheltség-adat — szinkron törlés (ref), hogy a lentebbi
    // fetch-effekt UGYANEBBEN a render-körben biztosan lássa az üres állapotot.
    fetchedMonthsRef.current = new Set()
    setLoadByMonth({})
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const compute = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const margin = 16
      const panelWidth = Math.min(292, vw - margin * 2)
      // A trigger közepéhez igazítva indulunk (ugyanaz, mint a korábbi CSS `left-1/2`), majd
      // rácsípjük a viewport széleire, ha a trigger a szélhez közel van.
      const idealViewportLeft = rect.left + rect.width / 2 - panelWidth / 2
      const clampedViewportLeft = Math.max(margin, Math.min(idealViewportLeft, vw - panelWidth - margin))
      setPos({ top: rect.bottom + 8, left: clampedViewportLeft, width: panelWidth })
    }
    compute()
    window.addEventListener('resize', compute)
    // görgetéskor (bármelyik szülő) a fix panel kövesse a triggert
    window.addEventListener('scroll', compute, true)
    return () => { window.removeEventListener('resize', compute); window.removeEventListener('scroll', compute, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (ref.current && !ref.current.contains(t) && !(panelRef.current && panelRef.current.contains(t))) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const y = viewDate.getFullYear()
  const m = viewDate.getMonth()
  const key = monthKey(y, m)

  useEffect(() => {
    if (!open || !loadEndpoint || fetchedMonthsRef.current.has(key)) return
    fetchedMonthsRef.current.add(key)
    const ctrl = new AbortController()
    fetch(`${loadEndpoint}?month=${key}`, { credentials: 'include', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { counts: {} }))
      .then((json: { counts?: Record<string, number> }) => {
        setLoadByMonth((prev) => ({ ...prev, [key]: json.counts ?? {} }))
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        fetchedMonthsRef.current.delete(key)
        setLoadByMonth((prev) => ({ ...prev, [key]: {} }))
      })
    return () => ctrl.abort()
  }, [open, loadEndpoint, key])

  const monthCounts = loadByMonth[key] ?? {}

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {children}
      </button>
      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {open && pos && (
          <div
            ref={panelRef}
            className="fixed z-[1200] font-onest"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
          <motion.div
            variants={POP}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'top center' }}
            className="rounded-2xl border border-line bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate(new Date(y, m - 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {yearRange ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                  {HU_MONTHS_FULL[m]}
                  <select
                    value={y}
                    onChange={(e) => setViewDate(new Date(Number(e.target.value), m, 1))}
                    aria-label="Év"
                    className="cursor-pointer appearance-none rounded-[8px] bg-transparent px-1 py-0.5 font-semibold text-ink transition-colors hover:bg-paper focus:outline-none"
                  >
                    {Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => yearRange[1] - i).map((yy) => (
                      <option key={yy} value={yy}>{yy}</option>
                    ))}
                  </select>
                </span>
              ) : (
                <span className="text-sm font-semibold text-ink">{HU_MONTHS_FULL[m]} {y}</span>
              )}
              <button
                type="button"
                onClick={() => setViewDate(new Date(y, m + 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-ink-soft">
              {HU_DAYS_SHORT.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="mt-1">
              <CalendarMonthGrid
                year={y}
                month={m}
                value={value}
                counts={monthCounts}
                onSelectDay={(d) => { onChange(d); setOpen(false) }}
              />
            </div>
            {onClear && value && (
              <div className="mt-3 flex justify-center border-t border-line pt-2.5">
                <button
                  type="button"
                  onClick={() => { onClear(); setOpen(false) }}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-paper hover:text-ink"
                >
                  Törlés
                </button>
              </div>
            )}
            {loadEndpoint && (
              <div className="mt-3 flex items-center justify-center gap-3 border-t border-line pt-2.5 text-[10px] font-medium text-ink-soft">
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: LOAD_TIERS[0].bg }} /> Kevesebb
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: LOAD_TIERS[1].bg }} /> Közepes
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: LOAD_TIERS[2].bg }} /> Forgalmas
                </span>
              </div>
            )}
          </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </div>
  )
}
