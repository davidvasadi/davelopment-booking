'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

/** Cella-szín 3 intenzitás-szinttel (a Statisztika heatmap-jével egyező). */
function heatColor(t: number): string {
  if (t >= 0.66) return '#F1CE45'
  if (t >= 0.33) return '#8f8330'
  return '#3a3934'
}

const DOW_SHORT = ['Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas']

export type Heatmap = { grid: number[][]; hours: number[]; peakDayIdx?: number; peakHour?: number }

/**
 * „Foglaltsági jelentés" SÖTÉT kártya (Crextio Attendance Report): fent nagy szám
 * mai ↗ / lemondott ↘, alatta NAP×ÓRA pötty-rács. Az adat a Statisztika heatmap-számításából.
 */
export function OccupancyReportCard({
  todayCount, cancelledCount, heatmap,
}: { todayCount: number; cancelledCount: number; heatmap: Heatmap }) {
  const flat = heatmap.grid.flat()
  const max = Math.max(1, ...flat)
  const norm = heatmap.grid.map((row) => row.map((v) => v / max))
  const hourTicks = heatmap.hours.map((h, i) => (i % 3 === 0 || i === heatmap.hours.length - 1 ? h : null))
  const peakDay = heatmap.peakDayIdx !== undefined ? DOW_SHORT[heatmap.peakDayIdx] : null
  const peakHourStr = heatmap.peakHour !== undefined ? `${String(heatmap.peakHour).padStart(2, '0')}h` : null

  return (
    <div className="flex h-full flex-col rounded-[26px] bg-ink-dark p-[22px] text-white shadow-[0_20px_44px_-26px_rgba(40,35,15,.5)]">
      <div className="mb-5 flex items-start justify-between">
        <span className="text-[19px] font-medium text-white">Foglaltsági jelentés</span>
      </div>
      <div className="mb-5 flex items-center gap-6">
        <div className="flex items-center gap-1.5">
          <span className="text-[40px] font-light leading-none text-white">{todayCount}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[40px] font-light leading-none text-white/55">{cancelledCount}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e08a3c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" /></svg>
        </div>
      </div>

      <div className="mb-1.5 flex items-center gap-1 pl-7 sm:gap-1.5 sm:pl-8">
        {hourTicks.map((h, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-medium text-white/40">{h !== null ? h : ''}</span>
        ))}
      </div>
      <div className="space-y-1 sm:space-y-1.5">
        {norm.map((row, di) => (
          <div key={di} className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-6 shrink-0 text-[10px] font-medium text-white/40">{DOW_SHORT[di]}</span>
            {row.map((t, hi) => (
              <span key={hi} className="aspect-square flex-1 rounded-full" style={{ background: heatColor(t) }} />
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="truncate text-[11px] font-medium text-gold">
          {peakDay && peakHourStr ? `Csúcs · ${peakDay} ${peakHourStr}` : 'Csúcsidő'}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/40">
          Kevesebb
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: '#3a3934' }} />
            <span className="h-2 w-2 rounded-full" style={{ background: '#8f8330' }} />
            <span className="h-2 w-2 rounded-full" style={{ background: '#F1CE45' }} />
          </span>
          Több
        </span>
      </div>
    </div>
  )
}

export type AccItem = { label: string; body: React.ReactNode }

/**
 * Élő (nyitható) akkordeon-kártya a bento bal-alsó helyére: Nyitvatartás / Mai vendégszám /
 * Foglalási források / Asztalok — valós adattal, framer-motion nyílással (a Statisztika ritmusa).
 */
export function OverviewAccordion({ items, defaultOpen = 0 }: { items: AccItem[]; defaultOpen?: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(defaultOpen)
  return (
    <div className="flex h-full flex-col rounded-[26px] bg-white px-[22px] py-1 shadow-[0_1px_2px_rgba(80,70,30,0.05),0_18px_40px_-28px_rgba(80,70,30,0.2)]">
      {items.map((item, i) => {
        const open = openIdx === i
        return (
          <div key={i} className={i < items.length - 1 ? 'border-b border-dashed' : ''} style={{ borderColor: 'rgba(120,110,70,.28)' }}>
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="flex w-full items-center justify-between gap-2 py-3 text-left"
            >
              <span className="text-[15px] font-medium text-ink">{item.label}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pb-3">{item.body}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
