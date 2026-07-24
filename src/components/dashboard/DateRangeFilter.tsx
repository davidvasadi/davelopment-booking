'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react'
import {
  format, addMonths, subMonths, startOfMonth, eachDayOfInterval,
  endOfMonth, isSameDay, isBefore, isAfter, parseISO, getDay,
} from 'date-fns'
import { hu } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const PRESETS = [
  { label: 'Ma', days: 1 },
  { label: '7 nap', days: 7 },
  { label: '30 nap', days: 30 },
  { label: '90 nap', days: 90 },
  { label: '6 hónap', days: 180 },
  { label: '1 év', days: 365 },
]

const DAY_LABELS = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']

// Staggered spring panel — UserMenu etalon
const POP = {
  hidden: { opacity: 0, scale: 0.88, y: -8 },
  show:   { opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 500, damping: 28, mass: 0.8 } },
  exit:   { opacity: 0, scale: 0.93, y: -6,
    transition: { duration: 0.14, ease: 'easeIn' as const } },
}
const OVERLAY = {
  hidden: { opacity: 0 }, show: { opacity: 1 }, exit: { opacity: 0 },
}
const SHEET = {
  hidden: { y: '100%' },
  show:   { y: 0, transition: { type: 'spring' as const, stiffness: 400, damping: 38, mass: 0.9 } },
  exit:   { y: '100%', transition: { type: 'spring' as const, stiffness: 400, damping: 38, mass: 0.9 } },
}

function monthCells(month: Date): (Date | null)[] {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const lead = (getDay(start) + 6) % 7 // Monday-based
  const cells: (Date | null)[] = Array(lead).fill(null)
  cells.push(...days)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function currentLabel(period: number, from: string | null, to: string | null) {
  if (from && to) {
    const f = parseISO(from), t = parseISO(to)
    if (f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear()) {
      const m = format(f, 'LLLL', { locale: hu })
      return m.charAt(0).toUpperCase() + m.slice(1)
    }
    return `${format(f, 'd MMM', { locale: hu })} – ${format(t, 'd MMM', { locale: hu })}`
  }
  return PRESETS.find(p => p.days === period)?.label ?? '30 nap'
}

export function DateRangeFilter({ basePath }: { basePath: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const fromParam = searchParams.get('from')
  const toParam   = searchParams.get('to')
  const period    = Number(searchParams.get('period')) || 30

  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [mobile, setMobile] = useState(false)
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()))
  const [rangeStart, setRangeStart] = useState<Date | null>(null)
  const [rangeEnd,   setRangeEnd]   = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    const check = () => setMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Sync calendar state from URL when panel opens
  useEffect(() => {
    if (!open) return
    if (fromParam) {
      const s = parseISO(fromParam)
      setRangeStart(s)
      setCalMonth(startOfMonth(s))
    } else {
      setRangeStart(null)
    }
    setRangeEnd(toParam ? parseISO(toParam) : null)
  }, [open, fromParam, toParam])

  // Outside click close (desktop)
  useEffect(() => {
    if (!open || mobile) return
    const h = (e: MouseEvent) => {
      if (
        !panelRef.current?.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open, mobile])

  function applyPreset(days: number) {
    setRangeStart(null); setRangeEnd(null)
    router.push(`${basePath}?period=${days}`)
    setOpen(false)
  }

  function applyCustom() {
    if (!rangeStart || !rangeEnd) return
    const [s, e] = isBefore(rangeStart, rangeEnd)
      ? [rangeStart, rangeEnd]
      : [rangeEnd, rangeStart]
    router.push(`${basePath}?from=${format(s, 'yyyy-MM-dd')}&to=${format(e, 'yyyy-MM-dd')}`)
    setOpen(false)
  }

  function handleDay(day: Date) {
    if (isAfter(day, new Date())) return
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day); setRangeEnd(null)
    } else {
      if (isSameDay(day, rangeStart)) { setRangeStart(null); return }
      setRangeEnd(day)
    }
  }

  function inRange(d: Date) {
    if (!rangeStart || !rangeEnd) return false
    const [s, e] = isBefore(rangeStart, rangeEnd)
      ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart]
    return !isBefore(d, s) && !isAfter(d, e)
  }

  const canNextMonth = startOfMonth(addMonths(calMonth, 1)) <= startOfMonth(new Date())
  const monthTitle = (() => {
    const m = format(calMonth, 'LLLL yyyy', { locale: hu })
    return m.charAt(0).toUpperCase() + m.slice(1)
  })()

  const pickerContent = (
    <div className="p-4 space-y-4">
      {/* Preset gombok */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-2.5">Gyors kiválasztás</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(({ label: pl, days }) => (
            <button
              key={days}
              type="button"
              onClick={() => applyPreset(days)}
              className={cn(
                'px-3 py-1.5 rounded-[10px] text-sm font-medium transition-colors',
                !fromParam && !toParam && period === days
                  ? 'bg-ink text-white'
                  : 'bg-[#f4f1eb] text-ink hover:bg-[#e8e4da]',
              )}
            >
              {pl}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-black/[0.06]" />

      {/* Naptár */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setCalMonth(m => subMonths(m, 1))}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-soft hover:bg-[#f0ede8] transition-colors"
            aria-label="Előző hónap"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-ink">{monthTitle}</span>
          <button
            type="button"
            onClick={() => canNextMonth && setCalMonth(m => addMonths(m, 1))}
            disabled={!canNextMonth}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-ink-soft hover:bg-[#f0ede8] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Következő hónap"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Hét fejlécek */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold text-ink-soft py-1">{d}</div>
          ))}
        </div>

        {/* Napok */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthCells(calMonth).map((day, i) => {
            if (!day) return <div key={i} />
            const future  = isAfter(day, new Date())
            const isStart = rangeStart ? isSameDay(day, rangeStart) : false
            const isEnd   = rangeEnd   ? isSameDay(day, rangeEnd)   : false
            const inside  = inRange(day) && !isStart && !isEnd
            const today   = isSameDay(day, new Date())
            return (
              <button
                key={i}
                type="button"
                disabled={future}
                onClick={() => handleDay(day)}
                className={cn(
                  'h-8 w-full text-sm rounded-[8px] transition-colors font-medium',
                  future && 'opacity-20 cursor-not-allowed',
                  (isStart || isEnd) && 'bg-ink text-white',
                  inside  && 'bg-[#e8e4da] text-ink',
                  !isStart && !isEnd && !inside && !future && 'hover:bg-[#f0ede8] text-ink',
                  today && !isStart && !isEnd && 'underline underline-offset-2',
                )}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>

      {/* Alkalmaz gomb — csak ha teljes tartomány van kiválasztva */}
      <AnimatePresence>
        {rangeStart && rangeEnd && (
          <motion.button
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18 }}
            type="button"
            onClick={applyCustom}
            className="w-full h-10 rounded-[12px] bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors"
          >
            {(() => {
              const [s, e] = isBefore(rangeStart, rangeEnd)
                ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart]
              return `${format(s, 'd MMM', { locale: hu })} – ${format(e, 'd MMM', { locale: hu })}`
            })()}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 h-11 lg:h-9 px-4 lg:px-3 bg-[var(--dav-glass-strong)] border border-line rounded-[12px] text-sm font-semibold text-ink hover:border-line-strong transition-colors active:scale-95"
      >
        <CalendarDays className="h-[15px] w-[15px] text-ink-soft shrink-0" />
        <span>{currentLabel(period, fromParam, toParam)}</span>
      </button>

      {mounted && (
        <>
          {/* Desktop popover */}
          <AnimatePresence>
            {open && !mobile && (
              <motion.div
                ref={panelRef}
                variants={POP}
                initial="hidden" animate="show" exit="exit"
                style={{ transformOrigin: 'top right' }}
                className="absolute top-full right-0 mt-2 w-72 z-[60] rounded-[18px] border border-[#ececec] bg-white shadow-[0_18px_50px_-18px_rgba(0,0,0,.35)] overflow-hidden"
              >
                {pickerContent}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobil bottom sheet */}
          {createPortal(
            <AnimatePresence>
              {open && mobile && (
                <div className="fixed inset-0 z-[160] lg:hidden">
                  <motion.div
                    variants={OVERLAY} initial="hidden" animate="show" exit="exit"
                    className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                    onClick={() => setOpen(false)}
                  />
                  <motion.div
                    variants={SHEET} initial="hidden" animate="show" exit="exit"
                    className="absolute bottom-0 left-0 right-0 rounded-t-[26px] bg-white overflow-hidden"
                    data-lenis-prevent
                  >
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-10 h-1 rounded-full bg-[#d4d0c8]" />
                    </div>
                    <div className="flex items-center justify-between px-4 pb-2">
                      <span className="text-base font-semibold text-ink">Időszak kiválasztása</span>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f0ede8] text-ink-soft"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-[82vh] pb-10" data-lenis-prevent>
                      {pickerContent}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}
