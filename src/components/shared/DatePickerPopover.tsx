'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const HU_MONTHS_FULL = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
]
const HU_DAYS_SHORT = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

// Terheltség-jelölő 3 sávja — a MEGLÉVŐ státusz-paletta (statusBlock, SalonDailyView.tsx):
// Befejezett-zöld (nyugodt) → Függő-arany (közepes) → Megerősítve-sötét (forgalmas).
const LOAD_TIERS = [
  { bg: 'rgba(29,157,99,0.50)', text: 'text-ink' },   // Befejezett zöld
  { bg: '#FFD85F', text: 'text-ink' },  // Függő arany — teljes tömör szín, nem halványítva
  { bg: 'rgba(29,28,25,0.85)', text: 'text-white' },  // Megerősítve sötét
] as const

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
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
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

  const monthCounts = loadByMonth[key]
  const maxCount = monthCounts ? Math.max(0, ...Object.values(monthCounts)) : 0

  const today = ymd(new Date())
  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7 // hétfő = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1
    const date = new Date(y, m, dayNum)
    return { date, inMonth: dayNum >= 1 && dayNum <= daysInMonth }
  })

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClassName}>
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            variants={POP}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'top left' }}
            className="absolute left-0 top-full z-50 mt-2 w-[292px] rounded-2xl border border-line bg-white p-4 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate(new Date(y, m - 1, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-paper"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-ink">{HU_MONTHS_FULL[m]} {y}</span>
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
            <div className="mt-1 grid grid-cols-7 gap-y-1">
              {cells.map(({ date, inMonth }, i) => {
                const dstr = ymd(date)
                const isSelected = dstr === value
                const isToday = dstr === today
                const count = inMonth ? (monthCounts?.[dstr] ?? 0) : 0
                // Terheltség-szín: csak a hónap saját napjaira, a max. 3 sávra bontva a hónap
                // legforgalmasabb napjához képest (relatív, nem abszolút kapacitás-százalék).
                // Valódi színátmenet (nem csak egy szín eltérő átlátszósága) a jobb
                // felismerhetőségért — halvány arany → borostyán → sötét borostyán, ez utóbbin
                // fehér szám kell a kontraszthoz.
                const tier =
                  isSelected || !inMonth || count === 0 || maxCount === 0
                    ? null
                    : count > (maxCount * 2) / 3
                      ? LOAD_TIERS[2]
                      : count > maxCount / 3
                        ? LOAD_TIERS[1]
                        : LOAD_TIERS[0]
                return (
                  <button
                    key={i}
                    type="button"
                    title={count > 0 ? `${count} foglalás` : undefined}
                    onClick={() => { onChange(dstr); setOpen(false) }}
                    style={tier ? { backgroundColor: tier.bg } : undefined}
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium tabular-nums transition-colors ${
                      isSelected
                        ? `bg-ink-dark text-white ${isToday ? 'ring-2 ring-ink-dark ring-offset-2 ring-offset-white' : ''}`
                        : isToday
                          // Sötét gyűrű + fehér offset-rés — ez FÜGGETLENÜL a kör belsejének
                          // színétől (zöld/arany/sötét terheltség-jelölés) mindig jól látszik,
                          // szemben az előző arany gyűrűvel, ami az arany (közepes) sávon eltűnt.
                          ? `font-bold ring-2 ring-ink-dark ring-offset-2 ring-offset-white ${tier ? tier.text : 'text-ink'}`
                          : tier
                            ? tier.text
                            : inMonth
                              ? 'text-ink hover:bg-paper'
                              : 'text-ink-soft2/50 hover:bg-paper'
                    }`}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
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
        )}
      </AnimatePresence>
    </div>
  )
}
