'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, UserRound, Pencil, Printer, ChevronLeft, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { TableGlyph } from '@/components/restaurant/TableGlyph'
import { EASE } from '@/lib/motion'

// ─── Status palette: 1:1 copy from real dashboard ───────────────────────────
const SB: Record<string, string> = {
  pending:   'bg-[#F1CE45] text-[#1D1C19] border-[#F1CE45]',
  confirmed: 'bg-[#1D1C19] text-white border-[#1D1C19]',
  completed: 'bg-[#1D9D63] text-white border-[#1D9D63]',
  seated:    'bg-[#1D9D63] text-white border-[#1D9D63]',
}
const SD: Record<string, string> = {
  pending:   'bg-[#F1CE45]',
  confirmed: 'bg-[#1D1C19]',
  completed: 'bg-[#1D9D63]',
  seated:    'bg-[#1D9D63]',
}
const SL: Record<string, string> = {
  pending:   'Függő',
  confirmed: 'Megerősített',
  completed: 'Befejezett',
  seated:    'Leültetve',
}
const HATCH = 'repeating-linear-gradient(115deg,#f3efe4 0 7px,#e8e4d8 7px 9px)'
const WD = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V']
const BG = '#FAF7F0'
// 1:1 --dav-container-gradient from globals.css
const PAGE_GRADIENT = [
  'radial-gradient(125% 80% at 100% -8%, rgba(241,206,69,.26) 0%, rgba(241,206,69,0) 42%)',
  'linear-gradient(116deg, #ECECE8 0%, #E8E8E6 50%, #E4E4E2 100%)',
].join(', ')
// 1:1 GRADS from HiringView.tsx — used when no real photo
const GRADS = [
  'linear-gradient(140deg,#EEBE8A,#DF9F61)',
  'linear-gradient(140deg,#B4C49A,#9DB07E)',
  'linear-gradient(140deg,#D2A6BE,#BE89A6)',
  'linear-gradient(140deg,#9FBAD1,#7E9EBE)',
  'linear-gradient(140deg,#B4C49A,#9DB07E)',
]

function fmtM(m: number) {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

function Ava({
  ini, bg = '#EDE7D7', fg = '#86826F', size = 32,
}: {
  ini: string; bg?: string; fg?: string; size?: number
}) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none"
      style={{ background: bg, color: fg, width: size, height: size }}
    >
      {ini}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALON — wide1: Szakember-naptársávok (StaffGrid)
   ═══════════════════════════════════════════════════════════════════════════ */
export function SalonTimelineDemo() {
  const OPEN = 540, TOTAL = 540
  const pct = (m: number) => `${((m - OPEN) / TOTAL) * 100}%`
  const spn = (d: number) => `${(d / TOTAL) * 100}%`
  const marks = [540, 660, 780, 900, 1020]

  const staff = [
    { id: 's1', name: 'Kovács Anna', ini: 'KA' },
    { id: 's2', name: 'Szabó Péter', ini: 'SP' },
    { id: 's3', name: 'Tóth Réka',   ini: 'TR' },
  ]

  const base = [
    { id: 'b1', sId: 's1', name: 'Kiss J.',    svc: 'Hajvágás', s: 570, d: 60,  st: 'confirmed' },
    { id: 'b2', sId: 's1', name: 'Nagy M.',    svc: 'Festés',   s: 680, d: 120, st: 'completed' },
    { id: 'b3', sId: 's1', name: 'Horváth B.', svc: 'Vágás',    s: 870, d: 60,  st: 'pending'   },
    { id: 'b4', sId: 's2', name: 'Varga K.',   svc: 'Szárítás', s: 600, d: 90,  st: 'confirmed' },
    { id: 'b5', sId: 's2', name: 'Fekete L.',  svc: 'Festés',   s: 760, d: 120, st: 'pending'   },
    { id: 'b6', sId: 's3', name: 'Molnár É.',  svc: 'Vágás',    s: 540, d: 60,  st: 'completed' },
    { id: 'b7', sId: 's3', name: 'Balogh D.',  svc: 'Hajvágás', s: 660, d: 75,  st: 'confirmed' },
    { id: 'b8', sId: 's3', name: 'Sipos R.',   svc: 'Festés',   s: 870, d: 90,  st: 'pending'   },
  ]

  const [anim, setAnim] = useState<Record<string, string>>({ b3: 'pending', b5: 'pending', b8: 'pending' })

  useEffect(() => {
    const CYCLE: [string, string][] = [
      ['b3', 'confirmed'], ['b5', 'confirmed'], ['b3', 'completed'],
      ['b8', 'confirmed'], ['b5', 'completed'], ['b8', 'completed'],
      ['b3', 'pending'],   ['b5', 'pending'],   ['b8', 'pending'],
    ]
    let i = 0
    const id = setInterval(() => {
      const [k, v] = CYCLE[i % CYCLE.length]
      setAnim(p => ({ ...p, [k]: v }))
      i++
    }, 1600)
    return () => clearInterval(id)
  }, [])

  const books = base.map(b => ({ ...b, st: anim[b.id] ?? b.st }))

  return (
    <div className="flex h-full w-full flex-col p-4 font-onest select-none" style={{ background: BG }}>
      {/* Header + legend */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold" style={{ color: '#1D1C19' }}>Napi időbeosztás</span>
        <div className="flex items-center gap-3">
          {([['#1D1C19', 'Megerősített'], ['#F1CE45', 'Függő'], ['#1D9D63', 'Befejezett']] as const).map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="h-[9px] w-[9px] rounded-[2px]" style={{ background: c }} />
              <span className="text-[10px]" style={{ color: '#A8A496' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hour axis */}
      <div className="mb-1 flex">
        <div className="w-[104px] shrink-0" />
        <div className="relative flex-1 h-4">
          {marks.map(m => (
            <span
              key={m}
              className="absolute top-0 text-[10px] font-medium tabular-nums -translate-x-1/2"
              style={{ left: pct(m), color: '#A8A496' }}
            >
              {fmtM(m)}
            </span>
          ))}
        </div>
      </div>

      {/* Staff rows */}
      <div className="flex-1 min-h-0">
        {staff.map((st, si) => (
          <div
            key={st.id}
            className="flex items-center"
            style={{ height: 68, borderTop: si > 0 ? '1px solid rgba(120,110,70,.12)' : 'none' }}
          >
            {/* Label */}
            <div className="flex w-[104px] shrink-0 items-center gap-2 pr-2">
              <Ava ini={st.ini} size={30} />
              <span className="text-[11px] font-semibold truncate leading-tight" style={{ color: '#1D1C19' }}>
                {st.name}
              </span>
            </div>

            {/* Timeline track */}
            <div className="relative flex-1" style={{ height: '100%' }}>
              {marks.map(m => (
                <span
                  key={m}
                  className="pointer-events-none absolute inset-y-0 w-px"
                  style={{ left: pct(m), background: 'rgba(120,110,70,.09)' }}
                />
              ))}
              {/* Free-gap hatch (between bookings) */}
              {(() => {
                const row = books.filter(b => b.sId === st.id).sort((a, b) => a.s - b.s)
                const gaps: [number, number][] = []
                let cur = OPEN
                for (const b of row) {
                  if (b.s - cur >= 15) gaps.push([cur, b.s])
                  cur = Math.max(cur, b.s + b.d)
                }
                if (540 + TOTAL - cur >= 15) gaps.push([cur, OPEN + TOTAL])
                return gaps.map(([gs, ge], i) => (
                  <span
                    key={`gap-${i}`}
                    aria-hidden
                    className="pointer-events-none absolute rounded-[9px] border"
                    style={{
                      left: `calc(${pct(gs)} + 2px)`,
                      width: `calc(${spn(ge - gs)} - 4px)`,
                      top: 9, bottom: 9,
                      background: HATCH,
                      borderColor: 'rgba(120,110,70,.10)',
                    }}
                  />
                ))
              })()}
              {/* Booking blocks */}
              {books.filter(b => b.sId === st.id).map(b => (
                <div
                  key={b.id}
                  className={`absolute rounded-[9px] border px-2 overflow-hidden transition-all duration-500 ${SB[b.st] ?? ''}`}
                  style={{
                    left: `calc(${pct(b.s)} + 2px)`,
                    width: `calc(${spn(b.d)} - 4px)`,
                    top: 9, bottom: 9,
                  }}
                >
                  <div className="truncate text-[10px] font-semibold leading-tight">{b.name}</div>
                  {b.d >= 60 && (
                    <div className="truncate text-[9px] leading-tight opacity-70">{b.svc}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALON — narrow1: Automatikus emlékeztetők
   ═══════════════════════════════════════════════════════════════════════════ */
const ALL_NOTIFS = [
  { id: 'n1', name: 'Kiss Judit',  svc: 'Hajvágás',  time: '14:00', status: 'confirmed' },
  { id: 'n2', name: 'Nagy Máté',   svc: 'Festés',    time: '15:30', status: 'confirmed' },
  { id: 'n3', name: 'Varga Kata',  svc: 'Szárítás',  time: '10:00', status: 'pending'   },
  { id: 'n4', name: 'Horváth B.',  svc: 'Vágás',     time: '11:30', status: 'confirmed' },
  { id: 'n5', name: 'Molnár Éva', svc: 'Kezelés',   time: '13:00', status: 'confirmed' },
]

export function SalonReminderDemo() {
  const [indices, setIndices] = useState([0, 1, 2])
  const [sent, setSent] = useState<Set<number>>(new Set([0]))

  useEffect(() => {
    let tick = 0
    const id = setInterval(() => {
      tick++
      if (tick % 4 === 0) {
        setIndices(prev => prev.map(i => (i + 1) % ALL_NOTIFS.length))
        setSent(new Set())
      } else {
        setIndices(prev => {
          const unsent = prev.find(i => !sent.has(i))
          if (unsent !== undefined) setSent(ps => new Set([...ps, unsent]))
          return prev
        })
      }
    }, 1600)
    return () => clearInterval(id)
  }, [sent])

  const items = indices.map(i => ALL_NOTIFS[i])

  return (
    <div
      className="flex h-full w-full flex-col px-4 py-3 font-onest select-none gap-2"
      style={{ background: BG }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-semibold" style={{ color: '#1D1C19' }}>Holnapi emlékeztetők</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: 'rgba(29,157,99,.12)', color: '#1D9D63' }}
        >
          24 ó előtt
        </span>
      </div>

      <AnimatePresence initial={false}>
        {items.map((n, i) => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.04 }}
            className="flex items-center gap-2.5 rounded-[14px] border px-3"
            style={{
              height: 58,
              background: '#fff',
              borderColor: 'rgba(120,110,70,.12)',
            }}
          >
            {/* Status dot icon */}
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: n.status === 'confirmed' ? '#1D1C19' : '#F1CE45' }}
            >
              <Bell className="h-3.5 w-3.5" style={{ color: n.status === 'confirmed' ? '#fff' : '#1D1C19' }} strokeWidth={2} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-semibold" style={{ color: '#1D1C19' }}>
                {n.name} · {n.svc}
              </div>
              <div className="text-[10px]" style={{ color: '#A8A496' }}>Holnap {n.time}</div>
            </div>

            <AnimatePresence mode="wait">
              {sent.has(indices[i]) ? (
                <motion.span
                  key="sent"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: '#1D9D63' }}
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={2.5} />
                </motion.span>
              ) : (
                <motion.span
                  key="unsent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: '#F1CE45' }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALON — narrow2: Szabadnap & kivételes nap
   (1:1 a StaffCalendarSheet.tsx-ből: hónap-naptár + nap-szerkesztő panel, NEM heti sávdiagram)
   ═══════════════════════════════════════════════════════════════════════════ */
const AV_DOW = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']
const AV_OFFSET = 5 // 2026. aug. 1. = szombat
const AV_DAYS = 31
// Egyéni felülírások: 18. (kedd) — egyénileg szabadnap; 8. (szombat) — egyénileg mégis dolgozik.
const AV_EXCEPTIONS: Record<number, 'work' | 'off'> = { 8: 'work', 18: 'off' }

export function SalonAvailabilityDemo() {
  const [selDay, setSelDay] = useState<8 | 18>(18)

  useEffect(() => {
    const id = setInterval(() => setSelDay((d) => (d === 18 ? 8 : 18)), 2600)
    return () => clearInterval(id)
  }, [])

  const cells: Array<{ day: number | null; dow: number }> = []
  for (let i = 0; i < AV_OFFSET; i++) cells.push({ day: null, dow: i })
  for (let d = 1; d <= AV_DAYS; d++) cells.push({ day: d, dow: (AV_OFFSET + d - 1) % 7 })
  while (cells.length % 7 !== 0) cells.push({ day: null, dow: cells.length % 7 })

  const sel = AV_EXCEPTIONS[selDay]
  const selDate = selDay === 18 ? '2026. aug. 18., kedd' : '2026. aug. 8., szombat'
  const selBase = selDay === 18 ? '9:00–18:00' : 'zárva'

  return (
    <div className="flex h-full w-full flex-col p-3 font-onest select-none" style={{ background: BG }}>
      {/* Fejléc: munkatárs + hónap-nav */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[11.5px] font-semibold leading-tight" style={{ color: '#1D1C19' }}>Kovács Anna — Elérhetőség</div>
          <div className="text-[9px]" style={{ color: '#A8A496' }}>Augusztus 2026</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
            <ChevronLeft className="h-3 w-3" style={{ color: '#A8A496' }} />
          </span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
            <ChevronRight className="h-3 w-3" style={{ color: '#A8A496' }} />
          </span>
        </div>
      </div>

      {/* Hétnap-fejléc */}
      <div className="grid grid-cols-7">
        {AV_DOW.map((d, i) => (
          <div key={d} className="flex items-center justify-center" style={{ height: 12, fontSize: 6.5, fontWeight: 600, color: i >= 5 ? '#C98A2E' : '#A8A496' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Nap-rács: szám + állapot-dot alatta (pontosan a valós StaffCalendarSheet mintája) */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          if (!c.day) return <div key={`p${i}`} style={{ height: 15 }} />
          const exc = AV_EXCEPTIONS[c.day]
          const isSelected = c.day === selDay
          const isWeekend = c.dow >= 5
          const dotColor = isSelected
            ? 'rgba(255,255,255,.6)'
            : exc === 'work' ? '#1D9D63' : exc === 'off' ? '#C0564A' : !isWeekend ? 'rgba(120,110,70,.35)' : 'transparent'
          return (
            <div key={`d${c.day}`} className="flex items-center justify-center" style={{ height: 15 }}>
              <span
                className="flex flex-col items-center justify-center"
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: isSelected ? '#1D1C19' : 'transparent',
                  fontSize: 6.5, fontWeight: isSelected ? 700 : 500, lineHeight: 1,
                  color: isSelected ? '#fff' : isWeekend ? '#C98A2E' : '#1D1C19',
                }}
              >
                {c.day}
                <span className="mt-[1px] h-[3px] w-[3px] rounded-full" style={{ background: dotColor }} />
              </span>
            </div>
          )
        })}
      </div>

      {/* Jelmagyarázat — 1:1 a StaffCalendarSheet felirataival */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {([['#1D9D63', 'Egyéni: dolgozik'], ['#C0564A', 'Szabadnap'], ['rgba(120,110,70,.35)', 'Szalon alap']] as const).map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: c }} />
            <span className="text-[7px]" style={{ color: '#A8A496' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Nap-szerkesztő panel — kiválasztott napra */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selDay}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="mt-1.5 rounded-[12px] p-2.5"
          style={{ background: '#F0EAD8' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[9.5px] font-semibold" style={{ color: '#1D1C19' }}>{selDate}</div>
              <div className="text-[8px]" style={{ color: '#A8A496' }}>Szalon alap: {selBase}</div>
            </div>
            <span
              className="flex h-4 w-7 shrink-0 items-center rounded-full px-0.5"
              style={{ background: sel === 'work' ? '#1D1C19' : '#DCD5BE', justifyContent: sel === 'work' ? 'flex-end' : 'flex-start' }}
            >
              <span className="h-3 w-3 rounded-full bg-white shadow" />
            </span>
          </div>
          <div className="mt-1 text-[8.5px] font-semibold" style={{ color: sel === 'work' ? '#1D9D63' : '#C0564A' }}>
            {sel === 'work' ? 'Dolgozik ezen a napon' : 'Szabadnap — nem dolgozik'}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALON — wide2: Bér & jelenlét nyilvántartás (ScheduleView salary panel)
   ═══════════════════════════════════════════════════════════════════════════ */
const PAYROLL = [
  { ini: 'KA', name: 'Kovács Anna',  role: 'Fodrász',     days: 21, total: 23, rate: 3200, salary: 67200 },
  { ini: 'SP', name: 'Szabó Péter',  role: 'Fodrász',     days: 20, total: 23, rate: 3200, salary: 64000 },
  { ini: 'TR', name: 'Tóth Réka',    role: 'Kozmetikus',  days: 18, total: 23, rate: 2800, salary: 50400 },
  { ini: 'FN', name: 'Fekete Nóra',  role: 'Asszisztens', days: 22, total: 23, rate: 2400, salary: 52800 },
]

export function SalonPayrollDemo() {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 250); return () => clearTimeout(t) }, [])

  const grandTotal = PAYROLL.reduce((s, p) => s + p.salary, 0)

  return (
    <div className="flex h-full w-full flex-col p-5 font-onest select-none" style={{ background: BG }}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold" style={{ color: '#1D1C19' }}>Bér & jelenlét</div>
          <div className="text-[11px]" style={{ color: '#A8A496' }}>Augusztus 2026 · 23 munkanap</div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="shrink-0 rounded-[10px] px-3 py-1.5 text-[13px] font-semibold tabular-nums"
          style={{ background: 'rgba(241,206,69,.18)', color: '#1D1C19' }}
        >
          {grandTotal.toLocaleString('hu-HU')} Ft
        </motion.div>
      </div>

      <div className="flex flex-col gap-4 justify-center flex-1">
        {PAYROLL.map((s, idx) => (
          <div key={s.ini} className="flex items-center gap-3">
            <Ava ini={s.ini} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div>
                  <span className="block text-[12px] font-semibold leading-tight" style={{ color: '#1D1C19' }}>{s.name}</span>
                  <span className="text-[10px]" style={{ color: '#A8A496' }}>{s.role} · {s.rate.toLocaleString('hu-HU')} Ft/nap</span>
                </div>
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: ready ? 1 : 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className="shrink-0 tabular-nums text-[12px] font-semibold"
                  style={{ color: '#1D1C19' }}
                >
                  {s.salary.toLocaleString('hu-HU')} Ft
                </motion.span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: '#EAE5D6' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: ready ? `${(s.days / s.total) * 100}%` : 0 }}
                    transition={{ duration: 0.8, delay: 0.15 + idx * 0.08, ease: EASE }}
                    style={{ background: (s.days / s.total) >= 0.85 ? '#F1CE45' : '#1D1C19' }}
                  />
                </div>
                <span className="shrink-0 text-[10px] tabular-nums" style={{ color: '#A8A496' }}>
                  {s.days}/{s.total} nap
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURANT — wide1: Napi idővonal, asztal szerint
   (1:1 a DailyView.tsx TableGrid-jéből — ez az alapértelmezett "Idősáv" nézet, terem
   szerint csoportosítva. A "Terem" nézet — lásd RestaurantFloorDemo lejjebb — a
   valós rendszerben egy HARMADIK, nem-alapértelmezett opció, nem a fő nézet.)
   ═══════════════════════════════════════════════════════════════════════════ */
// Étterem-specifikus státusz-paletta — MÁS mint a szalon: itt 'seated' (leültetve) a zöld
// "most aktív" állapot, a 'completed' (befejezett) pedig fehér kártya, nem zöld.
const RSB: Record<string, string> = {
  pending:   'bg-[#F1CE45] text-[#1D1C19] border-[#F1CE45]',
  confirmed: 'bg-[#1D1C19] text-white border-[#1D1C19]',
  seated:    'bg-[#1D9D63] text-white border-[#1D9D63]',
  completed: 'bg-white text-[#1D1C19] border-[rgba(120,110,70,.18)]',
}

export function RestaurantTimelineDemo() {
  const OPEN = 1050, CLOSE = 1380, TOTAL = CLOSE - OPEN // 17:30–23:00 (vacsora-szerviz)
  const pct = (m: number) => `${((m - OPEN) / TOTAL) * 100}%`
  const spn = (d: number) => `${(d / TOTAL) * 100}%`
  const marks = [1080, 1140, 1200, 1260, 1320]

  const rooms = [
    {
      name: 'Belső terem', pill: 'egész évben',
      tables: [
        { id: 'a1', name: 'A1', cap: 2 },
        { id: 'a2', name: 'A2', cap: 4 },
        { id: 'a3', name: 'A3', cap: 4 },
      ],
    },
    {
      name: 'Terasz', pill: 'kültéri · szezonális',
      tables: [
        { id: 't1', name: 'T1', cap: 4 },
        { id: 't2', name: 'T2', cap: 6 },
      ],
    },
  ]

  const base = [
    { id: 'r1', tId: 'a1', name: 'Nagy Péter',     pax: 2, s: 1080, d: 90,  st: 'confirmed' },
    { id: 'r2', tId: 'a2', name: 'Kovács Anna',    pax: 4, s: 1110, d: 105, st: 'seated'    },
    { id: 'r3', tId: 'a3', name: 'Tóth Béla',      pax: 3, s: 1290, d: 60,  st: 'pending'   },
    { id: 'r4', tId: 't1', name: 'Szabó család',   pax: 5, s: 1110, d: 105, st: 'confirmed' },
    { id: 'r5', tId: 't2', name: 'Fekete csoport', pax: 6, s: 1200, d: 105, st: 'seated'    },
  ]

  const [anim, setAnim] = useState<Record<string, string>>({ r3: 'pending' })
  useEffect(() => {
    const CYCLE: [string, string][] = [['r3', 'confirmed'], ['r3', 'completed'], ['r3', 'pending']]
    let i = 0
    const id = setInterval(() => {
      const [k, v] = CYCLE[i % CYCLE.length]
      setAnim((p) => ({ ...p, [k]: v }))
      i++
    }, 1700)
    return () => clearInterval(id)
  }, [])

  const resos = base.map((r) => ({ ...r, st: anim[r.id] ?? r.st }))

  return (
    <div className="flex h-full w-full flex-col p-3 font-onest select-none" style={{ background: BG }}>
      {/* Header + legend — 1:1 a TableGrid "Mai szervizterv" fejlécével */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold" style={{ color: '#1D1C19' }}>Mai szervizterv</span>
        <div className="flex flex-wrap items-center gap-2.5">
          {([['#1D1C19', 'Megerősített'], ['#F1CE45', 'Függő'], ['#1D9D63', 'Leültetve'], ['#FFFFFF', 'Befejezett']] as const).map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5">
              <span className="h-[9px] w-[9px] rounded-[2px] border" style={{ background: c, borderColor: 'rgba(120,110,70,.2)' }} />
              <span className="text-[10px]" style={{ color: '#A8A496' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hour axis */}
      <div className="mb-0.5 flex">
        <div className="w-[82px] shrink-0" />
        <div className="relative flex-1 h-4">
          {marks.map((m) => (
            <span key={m} className="absolute top-0 text-[10px] font-medium tabular-nums -translate-x-1/2" style={{ left: pct(m), color: '#A8A496' }}>
              {fmtM(m)}
            </span>
          ))}
        </div>
      </div>

      {/* Terem-csoportok + asztal-sorok */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {rooms.map((room) => (
          <div key={room.name}>
            <div className="flex items-center gap-[7px] pt-1.5 pb-1">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#86826F' }}>{room.name}</span>
              <span className="rounded-[8px] px-[7px] py-[2px] text-[8.5px] font-semibold" style={{ background: '#EDE7D6', color: '#9A8B52' }}>{room.pill}</span>
            </div>
            {room.tables.map((t) => {
              const rows = resos.filter((r) => r.tId === t.id)
              const sortedRows = [...rows].sort((a, b) => a.s - b.s)
              const gaps: [number, number][] = []
              let cur = OPEN
              for (const r of sortedRows) {
                if (r.s - cur >= 15) gaps.push([cur, r.s])
                cur = Math.max(cur, r.s + r.d)
              }
              if (CLOSE - cur >= 15) gaps.push([cur, CLOSE])
              return (
                <div key={t.id} className="flex items-center" style={{ height: 42, borderTop: '1px solid rgba(120,110,70,.10)' }}>
                  <div className="flex w-[82px] shrink-0 flex-col justify-center pr-2">
                    <span className="text-[10px] font-semibold truncate leading-tight" style={{ color: '#1D1C19' }}>{t.name}</span>
                    <span className="text-[8.5px] tabular-nums leading-tight" style={{ color: '#A8A496' }}>{t.cap} fő</span>
                  </div>
                  <div className="relative flex-1" style={{ height: '100%' }}>
                    {marks.map((m) => (
                      <span key={m} className="pointer-events-none absolute inset-y-0 w-px" style={{ left: pct(m), background: 'rgba(120,110,70,.09)' }} />
                    ))}
                    {gaps.map(([gs, ge], i) => (
                      <span
                        key={`g-${i}`}
                        aria-hidden
                        className="pointer-events-none absolute rounded-[8px] border"
                        style={{
                          left: `calc(${pct(gs)} + 2px)`,
                          width: `calc(${spn(ge - gs)} - 4px)`,
                          top: 6, bottom: 6,
                          background: HATCH,
                          borderColor: 'rgba(120,110,70,.10)',
                        }}
                      />
                    ))}
                    {rows.map((r) => (
                      <div
                        key={r.id}
                        className={`absolute rounded-[8px] border px-1.5 overflow-hidden transition-all duration-500 ${RSB[r.st] ?? ''}`}
                        style={{ left: `calc(${pct(r.s)} + 2px)`, width: `calc(${spn(r.d)} - 4px)`, top: 6, bottom: 6 }}
                      >
                        <div className="truncate text-[9px] font-semibold leading-tight">{r.name}</div>
                        {r.d >= 75 && <div className="truncate text-[8px] leading-tight opacity-70">{r.pax} fő</div>}
                      </div>
                    ))}
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

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURANT — bónusz: Terem-nézet (asztaltérkép) — a valós appban 3. opció, NEM az
   alapértelmezett fő nézet; itt csak referenciaként maradt meg, jelenleg nincs használva.
   ═══════════════════════════════════════════════════════════════════════════ */
const FLOOR_STATUS_DOT: Record<string, string> = {
  pending:   '#F1CE45',
  confirmed: '#1D1C19',
  seated:    '#1D9D63',
  completed: '#C9C2AE',
  empty:     '',
}

const TABLES = [
  { id: 1, name: 'A1', cap: 2, status: 'confirmed' },
  { id: 2, name: 'A2', cap: 4, status: 'seated'    },
  { id: 3, name: 'A3', cap: 4, status: 'confirmed' },
  { id: 4, name: 'B1', cap: 4, status: 'pending'   }, // animated
  { id: 5, name: 'B2', cap: 6, status: 'seated'    },
  { id: 6, name: 'B3', cap: 4, status: 'confirmed' },
  { id: 7, name: 'C1', cap: 4, status: 'pending'   },
  { id: 8, name: 'C2', cap: 4, status: 'confirmed' },
  { id: 9, name: 'C3', cap: 2, status: 'empty'     },
]

const RESOS = [
  { time: '18:30', name: 'Fekete', pax: 4, status: 'seated'    },
  { time: '19:00', name: 'Kovács', pax: 6, status: 'confirmed' },
  { time: '20:00', name: 'Tóth',   pax: 2, status: 'pending'   },
]

export function RestaurantFloorDemo() {
  const [t4, setT4] = useState<string>('pending')

  useEffect(() => {
    const seq = ['pending', 'seated', 'completed', 'empty', 'pending']
    let i = 0
    const id = setInterval(() => { i++; setT4(seq[i % seq.length]) }, 2000)
    return () => clearInterval(id)
  }, [])

  const tables = TABLES.map(t => t.id === 4 ? { ...t, status: t4 } : t)

  return (
    <div className="flex h-full w-full flex-col p-3 font-onest select-none" style={{ background: BG }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ color: '#1D1C19' }}>Asztaltérkép · Ma</span>
        <div className="flex items-center gap-2.5">
          {([['#1D9D63', 'Leültetve'], ['#F1CE45', 'Érkező'], ['#1D1C19', 'Foglalt']] as const).map(([c, l]) => (
            <div key={l} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
              <span className="text-[8.5px]" style={{ color: '#A8A496' }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3×3 floor grid */}
      <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
        {tables.map(t => (
          <div
            key={t.id}
            className="flex flex-col items-center justify-center gap-1 rounded-[10px] border"
            style={{ background: 'rgba(255,255,255,.65)', borderColor: 'rgba(120,110,70,.12)' }}
          >
            <span className="text-[8px] font-semibold uppercase tracking-wide" style={{ color: '#A8A496' }}>{t.name}</span>
            <div className="relative">
              <TableGlyph capacity={t.cap} size={28} />
              {t.status !== 'empty' && FLOOR_STATUS_DOT[t.status] && (
                <motion.span
                  key={t.status}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                  className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                  style={{ background: FLOOR_STATUS_DOT[t.status] }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Mini reservation list */}
      <div
        className="mt-2 divide-y divide-[rgba(120,110,70,.08)] overflow-hidden rounded-[10px] border"
        style={{ borderColor: 'rgba(120,110,70,.12)', background: 'rgba(255,255,255,.7)' }}
      >
        {RESOS.map(r => (
          <div key={r.time} className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-9 shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: '#1D1C19' }}>{r.time}</span>
            <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: '#1D1C19' }}>
              {r.name} · {r.pax} fő
            </span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: FLOOR_STATUS_DOT[r.status] ?? '#A8A496' }} />
            <span className="shrink-0 text-[10px]" style={{ color: '#A8A496' }}>{SL[r.status]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURANT — narrow1: Foglalás-forrás & csatorna (donut chart — real dashboard)
   ═══════════════════════════════════════════════════════════════════════════ */
// DONUT_COLORS 1:1 from AnalyticsOverview.tsx
const DONUT_COLORS = ['#F1CE45', '#C9A24B', '#8A8378', '#4A4944']

const DONUT_SEGS = [
  { label: 'Online',  pct: 45, value: 105 },
  { label: 'Telefon', pct: 28, value: 65  },
  { label: 'Beeső',   pct: 18, value: 42  },
  { label: 'Google',  pct: 9,  value: 22  },
].map((s, i) => ({ ...s, color: DONUT_COLORS[i] }))

export function RestaurantSourceDemo() {
  return (
    // Sötét kártya: 1:1 a valódi AnalyticsOverview "Foglalási arány" panelével
    <div
      className="flex h-full w-full flex-col p-5 font-onest select-none"
      style={{ background: '#1D1C19' }}
    >
      <div className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,.55)' }}>
        Foglalási arány
      </div>

      <div className="mt-4 flex flex-1 items-center justify-between gap-4 min-h-0">
        {/* Legenda */}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {DONUT_SEGS.map(seg => (
            <div key={seg.label} className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
              <span className="min-w-0 truncate text-[13px]" style={{ color: 'rgba(255,255,255,.80)' }}>
                {seg.label}
              </span>
              <span className="ml-auto shrink-0 text-[13px] font-semibold tabular-nums text-white">
                {seg.pct}%
              </span>
            </div>
          ))}
        </div>

        {/* Recharts donut: innerRadius/outerRadius/cornerRadius/paddingAngle 1:1 */}
        <div className="h-[104px] w-[104px] shrink-0">
          <ResponsiveContainer width="100%" height="100%" debounce={50}>
            <PieChart>
              <Pie
                data={DONUT_SEGS}
                dataKey="pct"
                nameKey="label"
                cx="50%" cy="50%"
                innerRadius={30} outerRadius={50}
                startAngle={90} endAngle={-270}
                paddingAngle={2}
                cornerRadius={6}
                stroke="none"
                isAnimationActive
                animationDuration={800}
              >
                {DONUT_SEGS.map((seg, i) => (
                  <Cell key={i} fill={seg.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURANT — narrow2: Csapatbeosztás & smenák (ScheduleView mini calendar)
   ═══════════════════════════════════════════════════════════════════════════ */
type Chip = { ini: string; bg: string; fg: string }

// chipStyle from ScheduleView: shift=#F1CE45/ink, sick=#1D1C19/white, leave=#E4DECC/#5C5848
const SHIFT = { bg: '#F1CE45', fg: '#1D1C19' }
const SICK  = { bg: '#1D1C19', fg: '#ffffff' }
const LEAVE = { bg: '#E4DECC', fg: '#5C5848' }

// 5 rows × 7 cols — Mon(0)–Sun(6); Aug 2026 starts on Saturday = offset 5
const OFFSET = 5
const DAYS_IN_MONTH = 31
const CHIPS_BY_DAY: Record<number, Chip[]> = {
  // Day numbers in the month (1-based)
  4:  [{ ini: 'KA', ...SHIFT }, { ini: 'SP', ...SHIFT }],
  5:  [{ ini: 'TR', ...SHIFT }, { ini: 'FN', ...SHIFT }],
  6:  [{ ini: 'KA', ...SHIFT }, { ini: 'SP', ...SHIFT }, { ini: 'TR', ...SHIFT }],
  7:  [{ ini: 'FN', ...SHIFT }],
  11: [{ ini: 'KA', ...SHIFT }, { ini: 'FN', ...SHIFT }],
  12: [{ ini: 'SP', ...SHIFT }, { ini: 'TR', ...LEAVE }],
  13: [{ ini: 'KA', ...SHIFT }, { ini: 'SP', ...SHIFT }],
  14: [{ ini: 'KA', ...SHIFT }, { ini: 'TR', ...SHIFT }, { ini: 'FN', ...SHIFT }],
  15: [{ ini: 'SP', ...SICK }],
  18: [{ ini: 'KA', ...SHIFT }, { ini: 'SP', ...SHIFT }, { ini: 'TR', ...SHIFT }],
  19: [{ ini: 'KA', ...SHIFT }],
  20: [{ ini: 'SP', ...SHIFT }],
}

export function RestaurantScheduleDemo() {
  // Animate: day 25 gets a new chip added
  const [day25, setDay25] = useState<Chip[]>([])

  useEffect(() => {
    const seq: Chip[][] = [
      [],
      [{ ini: 'KA', ...SHIFT }],
      [{ ini: 'KA', ...SHIFT }, { ini: 'TR', ...SHIFT }],
      [{ ini: 'KA', ...SHIFT }, { ini: 'TR', ...SHIFT }, { ini: 'FN', ...SHIFT }],
      [{ ini: 'KA', ...SHIFT }, { ini: 'TR', ...SHIFT }],
      [{ ini: 'KA', ...SHIFT }],
      [],
    ]
    let i = 0
    const id = setInterval(() => { i++; setDay25(seq[i % seq.length]) }, 1800)
    return () => clearInterval(id)
  }, [])

  const cells: Array<{ day: number | null; dayOfWeek: number }> = []
  for (let i = 0; i < OFFSET; i++) cells.push({ day: null, dayOfWeek: i })
  for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push({ day: d, dayOfWeek: (OFFSET + d - 1) % 7 })
  while (cells.length % 7 !== 0) cells.push({ day: null, dayOfWeek: cells.length % 7 })

  const chipsFor = (day: number | null): Chip[] => {
    if (!day) return []
    if (day === 25) return day25
    return CHIPS_BY_DAY[day] ?? []
  }

  return (
    <div className="flex h-full w-full flex-col p-3 font-onest select-none" style={{ background: BG }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold" style={{ color: '#1D1C19' }}>Csapatbeosztás</span>
        <span className="text-[11px]" style={{ color: '#A8A496' }}>Augusztus 2026</span>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {WD.map((w, i) => (
          <div key={w} className="text-center text-[8px] font-semibold" style={{ color: i >= 5 ? '#C98A2E' : '#A8A496' }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 flex-1 content-start">
        {cells.map((c, i) => {
          if (!c.day) {
            return (
              <div
                key={`empty-${i}`}
                className="rounded-[6px]"
                style={{ background: HATCH + ',rgba(255,255,255,.15)', minHeight: 38 }}
              />
            )
          }
          const chips = chipsFor(c.day)
          const isWeekend = c.dayOfWeek >= 5
          const uncovered = chips.length === 0 && !isWeekend && c.day >= 18
          return (
            <div
              key={`d-${c.day}`}
              className="flex flex-col rounded-[6px] border p-[3px]"
              style={{
                minHeight: 38,
                background: uncovered ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.65)',
                borderColor: uncovered ? 'rgba(232,162,61,.5)' : 'rgba(120,110,70,.1)',
                borderStyle: uncovered ? 'dashed' : 'solid',
              }}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[8px] font-semibold" style={{ color: isWeekend ? '#C98A2E' : '#6B6456' }}>
                  {c.day}
                </span>
                {chips.length > 0 && (
                  <span
                    className="rounded-full px-1 text-[6px] font-bold"
                    style={{ background: '#F0EAD8', color: '#86826F' }}
                  >
                    {chips.length}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {chips.slice(0, 3).map((ch, ci) => (
                  <motion.span
                    key={ch.ini + ci}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, delay: ci * 0.04 }}
                    className={`inline-flex items-center justify-center rounded-full text-[7px] font-bold ${ci > 0 ? '-mt-[2px]' : ''}`}
                    style={{ background: ch.bg, color: ch.fg, width: 14, height: 14 }}
                  >
                    {ch.ini[0]}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESTAURANT — wide2: Borravaló & bér (HiringView kétpaneles layout)
   ═══════════════════════════════════════════════════════════════════════════ */

// RadialGauge: 1:1 a HiringView.tsx-ből — 80px méret a demóban
function RadialGaugeDemo({ value }: { value: number }) {
  const pct = Math.min(1, value / 100)
  const r = 32
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: 80, height: 80 }}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(120,110,70,.14)" strokeWidth="9" />
        <motion.circle
          cx="40" cy="40" r={r} fill="none"
          stroke="#F1CE45" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[17px] font-light leading-none tabular-nums" style={{ color: '#1D1C19' }}>
          {value}<span className="text-[10px]">%</span>
        </span>
        <span className="mt-0.5 text-[7px] font-medium" style={{ color: '#A8A496' }}>Jelenlét</span>
      </div>
    </div>
  )
}

// WorkChart: 1:1 HiringView WorkChart — arany vonal (e hó) + szaggatott szürke (előző hó)
function WorkChartDemo({ recent, previous }: { recent: number[]; previous: number[] }) {
  const W = 280, H = 56, PAD = 6
  const top = Math.max(...recent, ...previous, 1)
  const toPath = (arr: number[]) =>
    arr.map((v, i) => {
      const x = PAD + (i / (arr.length - 1)) * (W - PAD * 2)
      const y = PAD + (1 - v / top) * (H - PAD * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    }).join(' ')

  return (
    <div className="mt-auto">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[9px] font-semibold" style={{ color: '#1D1C19' }}>Havi munkaidő</span>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="block rounded" style={{ width: 13, height: 2, background: '#F1CE45' }} />
            <span className="text-[7px]" style={{ color: '#A8A496' }}>E hó</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="block" style={{ width: 13, height: 2, background: 'repeating-linear-gradient(90deg,#C7C3B6 0 3px,transparent 3px 6px)' }} />
            <span className="text-[7px]" style={{ color: '#A8A496' }}>Előző hó</span>
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 44 }} preserveAspectRatio="none">
        {[0.25, 0.75].map((f, i) => (
          <line key={i} x1={PAD} y1={PAD + f * (H - PAD * 2)} x2={W - PAD} y2={PAD + f * (H - PAD * 2)}
            stroke="rgba(120,110,70,.10)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={toPath(previous)} fill="none" stroke="#C7C3B6" strokeWidth="1.5"
          strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <motion.path
          d={toPath(recent)} fill="none" stroke="#F1CE45" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <div className="flex justify-between" style={{ paddingLeft: PAD, paddingRight: PAD }}>
        {['1–7', '8–14', '15–21', '22–28', '29+'].map(l => (
          <span key={l} className="text-[7px]" style={{ color: '#A8A496' }}>{l}</span>
        ))}
      </div>
    </div>
  )
}

// Aug 2026 munkavégzett napok (hétfő–péntek)
const AUG_WORKED = [3,4,5,6,7,10,11,12,13,14,17,18,19,20,21,24,25,26,27,28,31]

const HIRING_STAFF = [
  { ini: 'VK', name: 'Viktoria', role: 'Üzletvezető', status: 'active',  attendance: 100, daysWorked: 21, payRate: 12000, tips: 22000,
    monthWeeks: [38, 42, 40, 45, 8],  prevWeeks: [35, 38, 42, 39, 40],
    photo: 'https://i.pravatar.cc/400?img=47', workedDays: AUG_WORKED },
  { ini: 'DA', name: 'Dávid',    role: 'Tulajdonos',  status: 'active',  attendance: 100, daysWorked: 21, payRate: 15000, tips: 0,
    monthWeeks: [40, 44, 42, 46, 8],  prevWeeks: [38, 40, 44, 42, 40],
    photo: 'https://i.pravatar.cc/400?img=52', workedDays: AUG_WORKED },
  { ini: 'CS', name: 'Csaba',    role: 'Supervisor',  status: 'invited', attendance: 0,   daysWorked: 0,  payRate: 10000, tips: 0,
    monthWeeks: [0, 0, 0, 0, 0],      prevWeeks: [32, 36, 38, 34, 30],
    photo: 'https://i.pravatar.cc/400?img=15', workedDays: [] },
  { ini: 'JN', name: 'Johnny',   role: 'Felszolgáló', status: 'invited', attendance: 0,   daysWorked: 0,  payRate: 9000,  tips: 0,
    monthWeeks: [0, 0, 0, 0, 0],      prevWeeks: [28, 30, 32, 28, 24],
    photo: 'https://i.pravatar.cc/400?img=11', workedDays: [] },
  { ini: 'AN', name: 'Andrea',   role: 'Felszolgáló', status: 'invited', attendance: 0,   daysWorked: 0,  payRate: 9000,  tips: 0,
    monthWeeks: [0, 0, 0, 0, 0],      prevWeeks: [30, 32, 34, 30, 28],
    photo: 'https://i.pravatar.cc/400?img=1',  workedDays: [] },
]

// MiniCalendar — 1:1 HiringView bal panel naptárja (aug 2026, ledolgozott napok arannyal)
const AUG_OFFSET = 5   // Hétfő=0 → aug. 1. = Szombat
const AUG_DAYS   = 31

function MiniCalendarDemo({ workedDays }: { workedDays: number[] }) {
  const worked = new Set(workedDays)
  const cells: Array<{ day: number | null; dow: number }> = []
  for (let i = 0; i < AUG_OFFSET; i++) cells.push({ day: null, dow: i })
  for (let d = 1; d <= AUG_DAYS; d++) cells.push({ day: d, dow: (AUG_OFFSET + d - 1) % 7 })
  while (cells.length % 7 !== 0) cells.push({ day: null, dow: cells.length % 7 })

  return (
    <div className="rounded-[14px] p-2 shrink-0"
      style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.04)', border: '1px solid rgba(120,110,70,.12)' }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[8.5px] font-semibold" style={{ color: '#1D1C19' }}>Naptár</span>
        <span className="text-[8px]" style={{ color: '#A8A496' }}>Augusztus 2026</span>
      </div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {['H','K','Sz','Cs','P','Sz','V'].map((d, i) => (
          <div key={i} className="flex items-center justify-center"
            style={{ height: 13, fontSize: 6.5, fontWeight: 600, color: i >= 5 ? '#C98A2E' : '#A8A496' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          if (!c.day) return <div key={i} style={{ height: 18 }} />
          const isWorked = worked.has(c.day)
          const isWE = c.dow >= 5
          return (
            <div key={i} className="flex items-center justify-center" style={{ height: 18 }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 15, height: 15, borderRadius: '50%',
                background: isWorked ? '#F1CE45' : 'transparent',
                fontSize: 6.5, fontWeight: isWorked ? 700 : 400,
                color: isWorked ? '#1D1C19' : isWE ? '#C98A2E' : '#6B6456',
              }}>
                {c.day}
              </span>
            </div>
          )
        })}
      </div>
      {/* Legend */}
      <div className="mt-1 flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: '#F1CE45' }} />
        <span className="text-[7px]" style={{ color: '#A8A496' }}>Ledolgozott ({workedDays.length})</span>
      </div>
    </div>
  )
}

const PILL: Record<string, { label: string; bg: string; color: string }> = {
  active:  { label: 'Aktív',    bg: '#E7F1E9', color: '#3B6B4B' },
  invited: { label: 'Meghívott', bg: '#EFF3FB', color: '#3B5BB5' },
}

export function RestaurantTipsDemo() {
  const [selIdx, setSelIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setSelIdx(i => (i + 1) % HIRING_STAFF.length), 2800)
    return () => clearInterval(id)
  }, [])

  const sel = HIRING_STAFF[selIdx]
  const payTotal = sel.payRate * sel.daysWorked
  const pill = PILL[sel.status] ?? PILL.active

  return (
    <div className="flex h-full w-full font-onest select-none overflow-hidden" style={{ background: PAGE_GRADIENT }}>

      {/* ── BAL: profilkép + naptár + staff selector dots — 1:1 HiringView bal panel ── */}
      <div className="flex w-[36%] shrink-0 flex-col gap-2 p-2.5 pr-1.5">
        {/* Profilkép — 1:1 HiringView h-[240px] rounded-[22px]; <img> ha van fotó */}
        <AnimatePresence mode="wait">
          <motion.div
            key={sel.ini}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            className="relative overflow-hidden rounded-[16px]"
            style={{ height: 160, background: GRADS[selIdx % GRADS.length], flexShrink: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sel.photo}
              alt={sel.name}
              className="h-full w-full object-cover object-top"
            />
            {/* Gradient scrim + name */}
            <div className="absolute bottom-0 left-0 right-0 p-2.5"
              style={{ background: 'linear-gradient(transparent, rgba(29,28,25,.6))' }}>
              <div className="text-[12px] font-semibold leading-tight text-white">{sel.name}</div>
              <div className="text-[9px] text-white/70">{sel.role}</div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Mini naptár — 1:1 HiringView MiniCalendar bal panel */}
        <MiniCalendarDemo workedDays={sel.workedDays} />

        {/* Staff selector dots */}
        <div className="flex items-center justify-center gap-1.5">
          {HIRING_STAFF.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelIdx(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === selIdx ? 16 : 6,
                height: 6,
                background: i === selIdx ? '#1D1C19' : 'rgba(120,110,70,.28)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── JOBB: detail panel — dav-card-glass ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={sel.ini}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -6 }}
          transition={{ duration: 0.22, ease: EASE }}
          className="flex min-w-0 flex-1 flex-col overflow-hidden"
          style={{
            padding: '10px 12px',
            gap: 7,
            background: 'rgba(255,255,255,.62)',
            borderLeft: '1px solid rgba(120,110,70,.14)',
            backdropFilter: 'blur(18px) saturate(1.08)',
            WebkitBackdropFilter: 'blur(18px) saturate(1.08)',
          }}
        >
          {/* Header: name + status pill + edit/print buttons + gauge */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-semibold leading-tight" style={{ color: '#1D1C19' }}>{sel.name}</span>
                <span className="rounded-full px-2 py-[2px] text-[8.5px] font-semibold" style={{ background: pill.bg, color: pill.color }}>{pill.label}</span>
              </div>
              <div className="mt-0.5 text-[9.5px]" style={{ color: '#A8A496' }}>{sel.role}</div>
              {/* Edit / print buttons — 1:1 HiringView action row */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.08), 0 0 0 1px rgba(120,110,70,.10)' }}>
                  <Pencil className="h-[11px] w-[11px]" style={{ color: '#1D1C19' }} strokeWidth={1.8} />
                </span>
                <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.08), 0 0 0 1px rgba(120,110,70,.10)' }}>
                  <Printer className="h-[11px] w-[11px]" style={{ color: '#1D1C19' }} strokeWidth={1.8} />
                </span>
                <span className="text-[8.5px]" style={{ color: '#A8A496' }}>
                  Belépés: <b style={{ color: '#1D1C19' }}>2026. 07. 30.</b>
                </span>
              </div>
            </div>
            <RadialGaugeDemo value={sel.attendance} />
          </div>

          {/* FIZETÉS panel — 1:1 HiringView */}
          <div className="rounded-[11px] p-2.5" style={{ background: '#EFEFEC', border: '1px solid rgba(120,110,70,.12)' }}>
            <div className="mb-0.5 text-[7.5px] font-semibold uppercase tracking-wide" style={{ color: '#A8A496' }}>Fizetés — e hó</div>
            <div className="flex flex-wrap gap-x-3 text-[9px]" style={{ color: '#A8A496' }}>
              <span>Ledolg.: <b style={{ color: '#1D1C19' }}>{sel.daysWorked} nap</b></span>
              <span>Napidíj: <b style={{ color: '#1D1C19' }}>{sel.payRate.toLocaleString('hu-HU')} Ft</b></span>
            </div>
            <div className="mt-0.5 text-[13px] font-semibold" style={{ color: '#1D1C19' }}>
              {payTotal.toLocaleString('hu-HU')} Ft
            </div>
          </div>

          {/* HAVI BORRAVALÓ panel — 1:1 HiringView */}
          {sel.tips > 0 && (
            <div className="rounded-[11px] p-2.5" style={{ background: '#EFEFEC', border: '1px solid rgba(120,110,70,.12)' }}>
              <div className="mb-0.5 text-[7.5px] font-semibold uppercase tracking-wide" style={{ color: '#A8A496' }}>Havi borravaló</div>
              <div className="text-[13px] font-semibold" style={{ color: '#1D1C19' }}>{sel.tips.toLocaleString('hu-HU')} Ft</div>
            </div>
          )}

          {/* Ledolgozott / Szabadság / Betegség pills */}
          {sel.daysWorked > 0 && (
            <div className="flex items-end gap-1">
              {[
                { label: 'Ledolgozott', value: sel.daysWorked, bg: '#1D1C19', color: '#fff', flex: sel.daysWorked },
                { label: 'Szabadság',   value: 0,             bg: '#F1CE45', color: '#1D1C19', flex: 0.01 },
                { label: 'Betegség',    value: 0,             bg: HATCH,     color: '#57564f', flex: 0.01 },
              ].map(s => (
                <div key={s.label} style={{ flex: Math.max(s.flex, 0.5), minWidth: 0 }}>
                  <div className="mb-0.5 truncate text-[7px] font-medium" style={{ color: '#A8A496' }}>{s.label}</div>
                  <div className="flex h-6 items-center overflow-hidden whitespace-nowrap rounded-[10px] px-2 text-[9px] font-semibold"
                    style={{ background: s.bg, color: s.color }}>
                    {s.value} nap
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* WorkChart — 1:1 HiringView WorkChart (arany e hó + szaggatott előző hó) */}
          <WorkChartDemo key={sel.ini} recent={sel.monthWeeks} previous={sel.prevWeeks} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
