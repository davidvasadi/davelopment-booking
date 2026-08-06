'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { EASE, SPRING_QUICK } from '@/lib/motion'

const cardV = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const imgV = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: EASE } },
} as const

function useCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px 0px' })
  return { ref, animate: inView ? 'show' : 'hidden' } as const
}

// ─── Foglaltsági kártya ───────────────────────────────────────────────────────

const HC = ['', '#3a3934', '#8f8330', '#F1CE45'] as const

const HEAT = [
  { label: 'H',   cells: [1,1,1,2,1,1,1,3,1,2,2,1,1] },
  { label: 'K',   cells: [1,1,1,1,2,3,1,1,1,2,2,1,1] },
  { label: 'Sze', cells: [1,1,2,1,1,1,3,1,2,3,2,1,1] },
  { label: 'Cs',  cells: [1,1,1,2,1,1,1,1,2,1,1,2,3] },
  { label: 'P',   cells: [1,1,1,2,1,3,1,1,2,3,2,1,1] },
  { label: 'Szo', cells: [1,1,1,2,1,3,1,1,2,3,3,3,2] },
  { label: 'V',   cells: [1,1,1,2,1,1,3,1,1,2,3,2,3] },
]

// 13 cella, csak néhányban van szöveg — ezzel az óra-axis mindig a sorokkal szinkronban van
const HOUR_AXIS = ['10','','','13','','','16','','','19','','','22h']

function OccupancyCard() {
  return (
    <div className="w-full rounded-[10px] p-4 flex flex-col gap-3" style={{ background: '#1d1c19' }}>

      {/* fejléc */}
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm text-white">Foglaltsági jelentés</span>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,.12)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
          </svg>
        </div>
      </div>

      {/* statisztikák */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="font-light text-2xl leading-none text-white">63</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2.5" strokeLinecap="round">
            <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
          </svg>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-light text-2xl leading-none" style={{ color: 'rgba(255,255,255,.42)' }}>12</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e08a3c" strokeWidth="2.5" strokeLinecap="round">
            <line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/>
          </svg>
        </div>
      </div>

      {/* hőtérkép */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1 items-center">
          <div className="w-8 shrink-0" />
          <div className="flex flex-1 gap-1">
            {HOUR_AXIS.map((h, i) => (
              <span key={i} className="flex-1 text-center text-[9px] font-medium leading-none" style={{ color: 'rgba(255,255,255,.28)' }}>{h}</span>
            ))}
          </div>
        </div>
        {HEAT.map((row, ri) => (
          <div key={row.label} className="flex gap-1 items-center">
            <span className="w-8 shrink-0 text-right pr-1 text-[10px] font-medium" style={{ color: 'rgba(255,255,255,.34)' }}>{row.label}</span>
            <div className="flex flex-1 gap-1">
              {row.cells.map((c, ci) =>
                c === 3 ? (
                  <motion.span key={ci}
                    className="aspect-square flex-1 rounded-full"
                    style={{ background: HC[c] }}
                    animate={{ scale: [1, 1.09, 1], opacity: [1, 0.46, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: ((ri * 13 + ci) * 0.11) % 1.5 }}
                  />
                ) : (
                  <span key={ci} className="aspect-square flex-1 rounded-full" style={{ background: HC[c] }} />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* lábléc */}
      <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <span className="text-[11px] font-medium" style={{ color: '#f1ce45' }}>Csúcs · Pén 18h</span>
        <div className="flex items-center gap-1.5">
          {(['#3a3934', '#8f8330', '#F1CE45'] as const).map((c, i) => (
            <span key={i} className="h-2 w-2 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Ledolgozott órák kártya ──────────────────────────────────────────────────

const HOURS_DATA = [84, 76, 66, 56, 50, 55, 63, 60, 68, 73, 82, 90]
const HW = 260, HH = 64, HP = 4

function hoursPath(): string {
  const min = Math.min(...HOURS_DATA)
  const max = Math.max(...HOURS_DATA)
  const range = max - min
  const pts = HOURS_DATA.map((v, i) => ({
    x: HP + (i / (HOURS_DATA.length - 1)) * (HW - HP * 2),
    y: HP + (1 - (v - min) / range) * (HH - HP * 2),
  }))
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  const t = 0.28
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    d += ` C ${(p1.x + (p2.x - p0.x) * t).toFixed(1)} ${(p1.y + (p2.y - p0.y) * t).toFixed(1)},${(p2.x - (p3.x - p1.x) * t).toFixed(1)} ${(p2.y - (p3.y - p1.y) * t).toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

function BookingTrendCard() {
  const path = hoursPath()

  return (
    <div className="flex-1 rounded-[10px] p-4 flex flex-col" style={{ background: '#f1ce45' }}>

      <span className="font-medium text-sm text-[#1d1c19]/60">Ledolgozott órák — e hó</span>

      <div className="flex-1 my-3" style={{ minHeight: 80, width: '100%' }}>
        <svg viewBox={`0 0 ${HW} ${HH}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '100%' }}>
          <motion.path d={path} fill="none" stroke="#1d1c19" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 1.6, ease: EASE }} />
        </svg>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <span className="font-light text-[44px] leading-none text-[#1d1c19]">90</span>
          <span className="font-medium text-base text-[#1d1c19]/50">ó</span>
          <span className="font-semibold text-sm" style={{ color: '#1a6640' }}>+64 ó</span>
        </div>
        <span className="text-[11px] font-medium text-[#1d1c19]/55">Előző hónap: 26 ó</span>
      </div>
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function CalendarSection() {
  const cImg = useCard()
  const cRight = useCard()

  return (
    <section id="naptar" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28">

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className="flex flex-col gap-6 mb-12 lg:mb-14"
      >
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
          Naptár
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <h2 className="font-semibold text-[clamp(2.25rem,5.5vw,72px)] leading-[0.94] tracking-[-0.05em] text-brand-ink max-w-2xl">
            Mindenki naptára,<br className="hidden sm:block" /> egy képernyőn.
          </h2>
          <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-sm lg:pb-1">
            Valós idejű foglalások, szakembersávok, szabadnapok — húzd át, kattints, kész.
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">

        {/* bal: tablet képernyő */}
        <motion.div
          ref={cImg.ref} variants={cardV} initial="hidden" animate={cImg.animate}
          className="lg:bg-white rounded-[13px] overflow-hidden min-h-[400px] lg:min-h-[620px]"
        >
          <motion.div variants={imgV} className="w-full h-full lg:p-4">
            <div className="bg-[#f7f7f7] rounded-[13px] overflow-hidden w-full h-full">
              <img
                src="/landing/calendar/naptar-tablet-davelopment-booking.webp"
                alt="Naptár — davelopment booking"
                className="w-full h-full object-cover"
                style={{ objectPosition: '50% 22%', transform: 'scale(1.12)', transformOrigin: '50% 18%' }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* jobb: két kártya */}
        <motion.div
          ref={cRight.ref} variants={cardV} initial="hidden" animate={cRight.animate}
          className="flex flex-col sm:flex-row lg:flex-col gap-4"
        >
          <motion.div variants={imgV} className="flex-1 w-full lg:bg-white rounded-[13px] overflow-hidden lg:p-3 flex flex-col">
            <OccupancyCard />
          </motion.div>

          <motion.div variants={imgV} className="flex-1 min-h-[420px] sm:min-h-[280px] w-full lg:bg-white rounded-[13px] overflow-hidden lg:p-3 flex flex-col">
            <BookingTrendCard />
          </motion.div>
        </motion.div>

      </div>
    </section>
  )
}
