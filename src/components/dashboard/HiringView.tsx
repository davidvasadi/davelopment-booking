'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence, animate, type Variants } from 'framer-motion'
import { MessageCircle, Phone, ArrowUpRight, ChevronLeft, ChevronRight, Printer, PhoneCall, Search, SlidersHorizontal, X, Mail, Check } from 'lucide-react'
import { popItem } from '@/lib/motion'
import { StatusPills } from '@/components/dashboard/StatusPills'

/**
 * MUNKAVÁLLALÓK aloldal — Crextio „Hiring" design, de a tartalom NEM CV/toborzás, hanem a
 * MEGLÉVŐ csapat: ki milyen SZEREPET tölt be az étteremben (tulajdonos/manager/munkatárs),
 * milyen POZÍCIÓ (Séf, Pincér…), hány NAPOT dolgozott, hányszor volt BETEG / SZABADSÁGON,
 * plusz elérhetőség (email, telefon). A fő grafikon MINDIG az előző időszakhoz hasonlít
 * (aktuális hét vs. előző hét ledolgozott órái). Kiválasztáskor a jobb oldali adatlap
 * újra-animálódik (a diagramok újrarajzolódnak).
 *
 * Az adat MOCK (fallback), hogy a dizájn azonnal tesztelhető legyen. A fejléc `currentUser`-t is
 * kaphat (bejelentkezett felhasználó neve/avatarja/emailje) — Google OAuth élesítéskor onnan jön.
 * A nyomtatás ikon szándékosan nincs bekötve (a user szerint majd külön átbeszéljük).
 */

type Variant = 'salon' | 'restaurant'
type RoleTone = 'owner' | 'manager' | 'staff'

export interface CurrentUser {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

interface Employee {
  id: string
  name: string
  position: string           // pozíció az üzletben (Séf, Pincér, Fodrász…)
  roleTone: RoleTone         // szerep: tulajdonos / manager / munkatárs
  email: string
  phone: string
  since: string              // belépés dátuma
  contract: string           // foglalkoztatás típusa
  tags: string[]             // állomások / specializáció
  note: string               // rövid, üzleti megjegyzés (NEM CV)
  // — havi statisztikák —
  attendance: number         // jelenlét % (0–100)
  daysWorked: number         // ledolgozott napok
  vacationDays: number       // szabadság (nap)
  sickDays: number           // betegszabadság (nap)
  shifts: number             // műszakok száma
  hoursThisMonth: number     // havi órák
  hoursLastMonth: number     // előző havi órák (összehasonlításhoz)
  // — heti grafikon (napi ledolgozott órák) —
  recent: number[]           // aktuális hét (H…V)
  previous: number[]         // előző hét ugyanezen napjai
}

const GRADS = [
  'linear-gradient(140deg,#EEBE8A,#DF9F61)',
  'linear-gradient(140deg,#B4C49A,#9DB07E)',
  'linear-gradient(140deg,#D2A6BE,#BE89A6)',
  'linear-gradient(140deg,#9FBAD1,#7E9EBE)',
]
const monogram = (n: string) => {
  const p = n.trim().split(/\s+/)
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase()
}
const WEEK = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']
const EASE = [0.22, 1, 0.36, 1] as const

const ROLE_LABEL: Record<RoleTone, string> = { owner: 'Tulajdonos', manager: 'Manager', staff: 'Munkatárs' }
const ROLE_TONE: Record<RoleTone, { bg: string; fg: string }> = {
  owner: { bg: '#1D1C19', fg: '#ffffff' },
  manager: { bg: 'var(--dav-accent)', fg: '#1D1C19' },
  staff: { bg: '#EDE7DC', fg: '#57564f' },
}

const TAG_TONE: Record<string, { bg: string; fg: string }> = {
  a: { bg: '#EDE7FF', fg: '#5B4BC4' },
  b: { bg: '#FDE5D8', fg: '#C56A2C' },
  c: { bg: '#DDEBF9', fg: '#2C6BB0' },
  d: { bg: '#E3F0D8', fg: '#4A7A2A' },
}
const TAG_KEYS = ['a', 'b', 'c', 'd'] as const

/* ── Animáció-variánsok ─────────────────────────────────────────────────── */
const detailCol: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { staggerChildren: 0.07, delayChildren: 0.03, duration: 0.3 } },
}
const detailItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 32 } },
}
const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
}
const listItem: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 500, damping: 34 } },
}

/* ── Szám-felszámláló (count-up) ── */
function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const controls = animate(0, to, { duration: 0.9, ease: EASE, onUpdate: (v) => setN(v) })
    return () => controls.stop()
  }, [to])
  return <>{Math.round(n).toLocaleString('hu-HU')}</>
}

function mockData(variant: Variant): Employee[] {
  const restaurant: Employee[] = [
    {
      id: 'r1', name: 'Tóth Réka', position: 'Üzletvezető', roleTone: 'owner',
      email: 'toth.reka@example.com', phone: '+36 30 444 5566',
      since: '2019. márc.', contract: 'Teljes munkaidő',
      tags: ['Terem', 'Beszerzés', 'Ütemezés'],
      note: 'Napi műszak-szervezés, beszerzés és a csapat összehangolása.',
      attendance: 98, daysWorked: 22, vacationDays: 1, sickDays: 0, shifts: 24, hoursThisMonth: 176, hoursLastMonth: 168,
      recent: [8, 8, 9, 8, 8, 6, 0], previous: [8, 8, 8, 8, 9, 6, 0],
    },
    {
      id: 'r2', name: 'Molnár Dóra', position: 'Séf', roleTone: 'manager',
      email: 'molnar.dora@example.com', phone: '+36 30 111 2233',
      since: '2020. szept.', contract: 'Teljes munkaidő',
      tags: ['Konyha', 'Á la carte', 'HACCP'],
      note: 'Konyhavezetés, napi étlap és a konyhai csapat irányítása.',
      attendance: 95, daysWorked: 21, vacationDays: 2, sickDays: 1, shifts: 21, hoursThisMonth: 172, hoursLastMonth: 180,
      recent: [9, 9, 8, 10, 9, 7, 0], previous: [8, 9, 8, 9, 8, 8, 0],
    },
    {
      id: 'r3', name: 'Fekete Ádám', position: 'Pincér', roleTone: 'staff',
      email: 'fekete.adam@example.com', phone: '+36 30 222 3344',
      since: '2022. jún.', contract: 'Teljes munkaidő',
      tags: ['Terem', 'Bár', 'Felszolgálás'],
      note: 'Terem és bár, csúcsidőben is stabil vendégkezelés.',
      attendance: 91, daysWorked: 19, vacationDays: 0, sickDays: 2, shifts: 20, hoursThisMonth: 152, hoursLastMonth: 148,
      recent: [6, 8, 8, 0, 9, 10, 8], previous: [7, 7, 8, 0, 8, 9, 7],
    },
    {
      id: 'r4', name: 'Nagy Bence', position: 'Sommelier', roleTone: 'staff',
      email: 'nagy.bence@example.com', phone: '+36 30 333 4455',
      since: '2021. nov.', contract: 'Részmunkaidő',
      tags: ['Bár', 'Borlap', 'Tanácsadás'],
      note: 'Borpárosítás és a prémium tételek értékesítése esti műszakban.',
      attendance: 88, daysWorked: 14, vacationDays: 3, sickDays: 0, shifts: 15, hoursThisMonth: 96, hoursLastMonth: 104,
      recent: [0, 5, 6, 5, 7, 8, 6], previous: [0, 4, 5, 5, 6, 7, 6],
    },
  ]
  const salon: Employee[] = [
    {
      id: 's1', name: 'Vass Nóra', position: 'Szalonvezető', roleTone: 'owner',
      email: 'vass.nora@example.com', phone: '+36 30 444 5566',
      since: '2018. jan.', contract: 'Teljes munkaidő',
      tags: ['Vezetés', 'Ügyfélkezelés', 'Ütemezés'],
      note: 'Napi működés, beosztás-szervezés és a csapat motiválása.',
      attendance: 98, daysWorked: 22, vacationDays: 1, sickDays: 0, shifts: 22, hoursThisMonth: 176, hoursLastMonth: 170,
      recent: [8, 8, 9, 8, 8, 6, 0], previous: [8, 8, 8, 8, 9, 6, 0],
    },
    {
      id: 's2', name: 'Katona Fanni', position: 'Senior fodrász', roleTone: 'manager',
      email: 'katona.fanni@example.com', phone: '+36 30 111 2233',
      since: '2019. ápr.', contract: 'Teljes munkaidő',
      tags: ['Szín', 'Balayage', 'Konzultáció'],
      note: 'Színspecializáció és a junior kollégák mentorálása.',
      attendance: 95, daysWorked: 21, vacationDays: 2, sickDays: 1, shifts: 21, hoursThisMonth: 168, hoursLastMonth: 176,
      recent: [9, 9, 8, 10, 9, 7, 0], previous: [8, 9, 8, 9, 8, 8, 0],
    },
    {
      id: 's3', name: 'Kis Márton', position: 'Barber', roleTone: 'staff',
      email: 'kis.marton@example.com', phone: '+36 30 333 4455',
      since: '2021. szept.', contract: 'Teljes munkaidő',
      tags: ['Fade', 'Szakáll', 'Borotválás'],
      note: 'Klasszikus férfi fazonok, stabil visszatérő vendégkör.',
      attendance: 92, daysWorked: 20, vacationDays: 0, sickDays: 1, shifts: 20, hoursThisMonth: 160, hoursLastMonth: 156,
      recent: [6, 8, 8, 0, 9, 10, 8], previous: [7, 7, 8, 0, 8, 9, 7],
    },
    {
      id: 's4', name: 'Rácz Petra', position: 'Junior fodrász', roleTone: 'staff',
      email: 'racz.petra@example.com', phone: '+36 30 222 3344',
      since: '2023. febr.', contract: 'Részmunkaidő',
      tags: ['Vágás', 'Styling', 'Melír'],
      note: 'Gyorsan fejlődő csapattag, precíz kézimunkával.',
      attendance: 88, daysWorked: 15, vacationDays: 3, sickDays: 0, shifts: 15, hoursThisMonth: 104, hoursLastMonth: 112,
      recent: [0, 5, 6, 5, 7, 8, 6], previous: [0, 4, 5, 5, 6, 7, 6],
    },
  ]
  return variant === 'restaurant' ? restaurant : salon
}

/* ── Radiál mérő (jelenlét %) — animált ív + count-up ── */
function RadialGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.min(1, value / 100)
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg viewBox="0 0 130 130" className="h-full w-full -rotate-90">
        <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(120,110,70,.14)" strokeWidth="14" />
        <motion.circle
          cx="65" cy="65" r={r} fill="none" stroke="var(--dav-accent)" strokeWidth="14" strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink"><CountUp to={value} /><span className="text-[18px]">%</span></span>
        <span className="mt-1 text-[11px] font-medium text-ink-soft">{label}</span>
      </div>
    </div>
  )
}

/* ── Sparkline (havi órák trend) — animált rajz ── */
function Spark({ data, stroke = '#1D1C19' }: { data: number[]; stroke?: string }) {
  const w = 240, h = 60, max = Math.max(...data), min = Math.min(...data)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 8) - 4
    return [x, y] as const
  })
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[60px] w-full" preserveAspectRatio="none">
      <motion.path d={d} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE }} />
    </svg>
  )
}

/* ── Munkaidő diagram: AKTUÁLIS hét vs ELŐZŐ hét (napi órák, min 0) — animált (terület + rajz + pontok) ── */
function WorkChart({ recent, previous }: { recent: number[]; previous: number[] }) {
  const w = 620, h = 200, pad = 8
  const max = Math.max(...recent, ...previous, 1)
  const top = Math.max(2, Math.ceil(max))
  const xy = (arr: number[]) => arr.map((v, i) => {
    const x = pad + (i / (arr.length - 1)) * (w - pad * 2)
    const y = pad + (1 - v / top) * (h - pad * 2)
    return [x, y] as const
  })
  const line = (arr: number[]) => xy(arr).map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
  const rp = xy(recent)
  const area = `M${rp[0][0]},${h - pad} ` + rp.map((p) => `L${p[0]},${p[1]}`).join(' ') + ` L${rp[rp.length - 1][0]},${h - pad} Z`
  const peakIdx = recent.indexOf(Math.max(...recent))
  const hi = rp[peakIdx]
  const ticks = [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25)]
  const gridYs = [0.25, 0.5, 0.75].map((f) => pad + f * (h - pad * 2))
  return (
    <div className="flex">
      {/* y-tengely (óra) */}
      <div className="flex h-[200px] flex-col justify-between pr-2 text-[11px] text-ink-soft2">
        {ticks.map((v, i) => <span key={i}>{v}ó</span>)}
      </div>
      {/* chart-terület */}
      <div className="relative flex-1">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[200px] w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wc-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dav-accent)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--dav-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* halvány rács */}
          {gridYs.map((y, i) => (
            <motion.line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke="rgba(120,110,70,.10)" strokeWidth="1" vectorEffect="non-scaling-stroke"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }} />
          ))}
          {/* terület-kitöltés az aktuális hét alatt */}
          <motion.path d={area} fill="url(#wc-area)"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.6 }} />
          {/* előző hét — szaggatott, beúszik */}
          <motion.path d={line(previous)} fill="none" stroke="#B9B3A2" strokeWidth="2" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} />
          {/* aktuális hét — kirajzolódó vonal */}
          <motion.path d={line(recent)} fill="none" stroke="var(--dav-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: EASE }} />
          {/* napi pontok (a csúcsot a sötét jelölő fedi) */}
          {rp.map((p, i) => (
            <motion.circle key={i} cx={p[0]} cy={p[1]} fill="#fff" stroke="var(--dav-accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke"
              initial={{ r: 0, opacity: 0 }} animate={{ r: i === peakIdx ? 0 : 3.4, opacity: 1 }} transition={{ delay: 0.6 + i * 0.07, type: 'spring', stiffness: 420, damping: 20 }} />
          ))}
          {/* csúcsnap jelölő */}
          <motion.line x1={hi[0]} y1={hi[1]} x2={hi[0]} y2={h - pad} stroke="#1D1C19" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.3 }} />
          <motion.circle cx={hi[0]} cy={hi[1]} fill="#1D1C19"
            initial={{ r: 0 }} animate={{ r: 5 }} transition={{ delay: 1.05, type: 'spring', stiffness: 420, damping: 18 }} />
        </svg>
        {/* Csúcsnap buborék (a chart-terület %-ában pozícionálva) */}
        <motion.div className="absolute -translate-x-1/2" style={{ left: `${(hi[0] / w) * 100}%`, top: `${(hi[1] / h) * 100}%`, marginTop: -34 }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.25 }}>
          <span className="whitespace-nowrap rounded-full bg-ink-dark px-2.5 py-1 text-[11px] font-semibold text-white">• {recent[peakIdx].toLocaleString('hu-HU')} óra</span>
        </motion.div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-soft2">
          {WEEK.map((d) => <span key={d}>{d}</span>)}
        </div>
      </div>
    </div>
  )
}

/* ── Mini havi naptár: mely napokon dolgozott (a heti minta a hónapra vetítve) ── */
const CAL_WEEK = ['H', 'K', 'Sz', 'Cs', 'P', 'Szo', 'V']
function MiniCalendar({ pattern, daysWorked }: { pattern: number[]; daysWorked: number }) {
  const firstWeekday = 2 // a minta-hónap 1-je szerdára esik (generikus, determinisztikus — nincs SSR-eltérés)
  const daysInMonth = 30
  const cells: (number | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  const workedOn = (idx: number) => pattern[idx % 7] > 0
  return (
    <div className="rounded-[22px] border border-line bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[14px] font-semibold text-ink">Mely napokon dolgozott</p>
        <span className="text-[12px] font-medium text-ink-soft">{daysWorked} nap</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {CAL_WEEK.map((d) => (
          <div key={d} className="pb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-soft2">{d}</div>
        ))}
        {cells.map((c, i) =>
          c === null ? (
            <div key={`b${i}`} />
          ) : (
            <motion.div
              key={c}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.12 + i * 0.012, type: 'spring', stiffness: 500, damping: 26 }}
              className="flex aspect-square items-center justify-center rounded-[9px] text-[11.5px] font-semibold"
              style={workedOn(i) ? { background: 'var(--dav-accent)', color: '#1D1C19' } : { background: '#F5F3EC', color: '#B7B2A4' }}
            >
              {c}
            </motion.div>
          ),
        )}
      </div>
      <div className="mt-3.5 flex items-center gap-4 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: 'var(--dav-accent)' }} />Ledolgozott</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[4px] bg-[#E9E5DA]" />Szabadnap</span>
      </div>
    </div>
  )
}

export function HiringView({ variant, currentUser = null, onClose, initialIndex = 0 }: { variant: Variant; currentUser?: CurrentUser | null; onClose?: () => void; initialIndex?: number }) {
  const data = mockData(variant)
  const startId = data[Math.min(Math.max(initialIndex, 0), data.length - 1)]?.id ?? data[0].id
  const [selId, setSelId] = useState(startId)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [posFilter, setPosFilter] = useState<string>('all')
  const [filterOpen, setFilterOpen] = useState(false)

  const positions = Array.from(new Set(data.map((d) => d.position)))
  const sel = data.find((c) => c.id === selId) ?? data[0]
  const filtered = data.filter((c) => {
    const q = query.trim().toLowerCase()
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.position.toLowerCase().includes(q)
    const matchPos = posFilter === 'all' || c.position === posFilter
    return matchQ && matchPos
  })
  // A mock lapozót elrejtjük, amint keresünk/szűrünk (a fals oldalszámok félrevezetnék a listát).
  const isFiltering = query.trim() !== '' || posFilter !== 'all'

  // A fejléc a bejelentkezett felhasználó adatával felülírható (Google OAuth élesítéskor); fallback a mock tag.
  const headName = currentUser?.name ?? sel.name
  const headAvatar = currentUser?.avatarUrl ?? null
  const headEmail = currentUser?.email ?? sel.email

  const hoursDelta = sel.hoursThisMonth - sel.hoursLastMonth
  const role = ROLE_TONE[sel.roleTone]

  // Havi napok szélesség-aránya a pillekhez: ARÁNYOS, de TOMPÍTOTT (fél-egyenlő + fél-arányos),
  // hogy a nagy „Ledolgozott" pill ne nyomja agyon a másik kettőt — különben a rövid pilleken
  // levágódik a felirat. A megjelenített szám továbbra is a valós érték.
  const dayVals = [sel.daysWorked, sel.vacationDays, sel.sickDays]
  const daySum = dayVals.reduce((a, b) => a + b, 0) || 1
  const dampenPct = (v: number) => 50 / dayVals.length + 0.5 * (v / daySum) * 100

  return (
    <div>
      {/* HEADER: cím + kereső + szűrő + (overlay) bezárás */}
      <motion.div variants={popItem} className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">{variant === 'restaurant' ? 'Éttermi csapat' : 'Szalon csapat'}</p>
          <h1 className="text-[26px] font-light tracking-[-0.02em] text-ink lg:text-[34px]">Munkavállalók</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-11 min-w-[200px] items-center gap-2.5 rounded-dav-pill border border-line bg-white px-4">
            <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Keresés" className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none" />
          </div>
          {/* Szűrő gomb → meglévő pozíciók */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              aria-label="Szűrés pozícióra"
              className={`relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${filterOpen || posFilter !== 'all' ? 'border-line-strong bg-ink-dark text-white' : 'border-line bg-white text-ink-soft hover:border-line-strong'}`}
            >
              <SlidersHorizontal className="h-[17px] w-[17px]" strokeWidth={1.7} />
              {posFilter !== 'all' && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-gold ring-2 ring-white" />}
            </button>
            <AnimatePresence>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: EASE }}
                    className="absolute right-0 top-[52px] z-20 w-56 rounded-[18px] border border-line bg-white p-1.5 shadow-dav-container"
                  >
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft2">Pozíció</p>
                    <button onClick={() => { setPosFilter('all'); setFilterOpen(false) }} className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper">
                      Minden pozíció {posFilter === 'all' && <Check className="h-4 w-4 text-ink" strokeWidth={2} />}
                    </button>
                    {positions.map((p) => (
                      <button key={p} onClick={() => { setPosFilter(p); setFilterOpen(false) }} className="flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper">
                        {p} {posFilter === p && <Check className="h-4 w-4 text-ink" strokeWidth={2} />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          {onClose && (
            <button onClick={onClose} aria-label="Bezárás" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
              <X className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* ── BAL: csapat-lista ── */}
        <motion.div variants={popItem} className="flex flex-col">
          <motion.div variants={listContainer} className="space-y-3">
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-ink-soft">Nincs találat.</p>}
            {filtered.map((c, i) => {
              const active = c.id === selId
              return (
                <motion.button
                  key={c.id}
                  variants={listItem}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelId(c.id)}
                  className={`w-full rounded-[22px] p-4 text-left transition-colors ${active ? 'bg-white shadow-dav-card ring-1 ring-line' : 'bg-[var(--dav-glass)] hover:bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white" style={{ background: GRADS[i % GRADS.length] }}>{monogram(c.name)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{c.name}</p>
                      <p className="truncate text-[12px] text-ink-soft">{c.position} · {ROLE_LABEL[c.roleTone]}</p>
                    </div>
                    <ArrowUpRight className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-ink' : 'text-ink-soft'}`} />
                  </div>
                  <div className="mt-3.5 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 text-[11px] font-medium text-ink-soft">Jelenlét · {c.attendance}%</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(120,110,70,.14)]">
                        <motion.div className="h-full rounded-full" style={{ background: c.attendance >= 95 ? '#4A7A2A' : c.attendance >= 90 ? 'var(--dav-accent)' : '#E08A3C' }}
                          initial={{ width: 0 }} animate={{ width: `${c.attendance}%` }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }} />
                      </div>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-dav-card"><MessageCircle className="h-[15px] w-[15px] text-ink-soft" strokeWidth={1.7} /></span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-dav-card"><Phone className="h-[15px] w-[15px] text-ink-soft" strokeWidth={1.7} /></span>
                  </div>
                </motion.button>
              )
            })}
          </motion.div>
          {/* Lapozó — csak szűretlen listán (keresés/szűrés közben elrejtve) */}
          {!isFiltering && (
            <div className="mt-4 flex items-center gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft hover:border-line-strong"><ChevronLeft className="h-4 w-4" /></button>
              {[1, 2, 3].map((n) => (
                <button key={n} onClick={() => setPage(n)} className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold ${page === n ? 'bg-ink-dark text-white' : 'border border-line bg-white text-ink-soft hover:border-line-strong'}`}>{n}</button>
              ))}
              <span className="px-1 text-ink-soft2">…</span>
              <button onClick={() => setPage(10)} className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold ${page === 10 ? 'bg-ink-dark text-white' : 'border border-line bg-white text-ink-soft hover:border-line-strong'}`}>10</button>
              <button onClick={() => setPage((p) => p + 1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-ink-soft hover:border-line-strong"><ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </motion.div>

        {/* ── JOBB: adatlap (kiválasztáskor újra-animálódik) ── */}
        <motion.div variants={popItem} className="rounded-[26px] border border-line bg-white p-6 shadow-dav-card sm:p-8">
          <motion.div
            key={sel.id}
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.02 } } }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] lg:gap-8"
          >
            {/* Bal belső: fotó + Alapadatok + Havi órák */}
            <motion.div variants={detailCol} className="space-y-5">
              <motion.div variants={detailItem} className="relative h-[240px] overflow-hidden rounded-[22px]" style={{ background: GRADS[0] }}>
                {headAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={headAvatar} alt={headName ?? ''} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[64px] font-light text-white/90">{monogram(headName ?? sel.name)}</div>
                )}
              </motion.div>

              {/* Mely napokon dolgozott — mini havi naptár (a kontakt-kártya helyén) */}
              <motion.div variants={detailItem}>
                <MiniCalendar pattern={sel.recent} daysWorked={sel.daysWorked} />
              </motion.div>

              {/* Havi órák kártya (előző hónaphoz hasonlítva) */}
              <motion.div variants={detailItem} className="rounded-[22px] p-6" style={{ background: 'var(--dav-accent)' }}>
                <p className="text-[14px] font-semibold text-ink-dark">Havi órák</p>
                <div className="mt-1.5"><Spark data={sel.recent} /></div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-[36px] font-light leading-none tracking-[-0.02em] text-ink-dark"><CountUp to={sel.hoursThisMonth} /><span className="text-[17px]"> ó</span></span>
                  <span className="text-[12.5px] font-medium text-ink-dark/70">{hoursDelta >= 0 ? '+' : '−'}{Math.abs(hoursDelta)} ó vs. előző hó</span>
                </div>
              </motion.div>
            </motion.div>

            {/* Jobb belső: fejléc + szerep + állomások + megjegyzés + jelenlét, alul stat-ok + chart */}
            <motion.div variants={detailCol}>
              <motion.div variants={detailItem} className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-[28px] font-semibold leading-tight text-ink">{headName}</h2>
                        <span className="rounded-full px-3 py-1 text-[12px] font-semibold" style={{ background: role.bg, color: role.fg }}>{ROLE_LABEL[sel.roleTone]}</span>
                      </div>
                      <p className="mt-1.5 text-[16px] text-ink-soft">{sel.position}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft"><Printer className="h-[18px] w-[18px]" strokeWidth={1.7} /></span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink-soft"><PhoneCall className="h-[18px] w-[18px]" strokeWidth={1.7} /></span>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2.5">
                    {sel.tags.map((s, i) => {
                      const t = TAG_TONE[TAG_KEYS[i % TAG_KEYS.length]]
                      return <span key={s} className="rounded-full px-4 py-2 text-[13px] font-semibold" style={{ background: t.bg, color: t.fg }}>{s}</span>
                    })}
                  </div>
                  <p className="mt-5 max-w-[520px] text-[15.5px] leading-relaxed text-ink-soft">{sel.note}</p>
                  <div className="mt-5 flex flex-wrap gap-x-8 gap-y-2.5 text-[14px] text-ink-soft">
                    <span className="flex items-center gap-2.5"><Mail className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.7} />{headEmail}</span>
                    <span className="flex items-center gap-2.5"><Phone className="h-[17px] w-[17px] text-ink-soft2" strokeWidth={1.7} />{sel.phone}</span>
                  </div>
                </div>
                <RadialGauge value={sel.attendance} label="Jelenlét (hó)" />
              </motion.div>

              {/* Havi napok — ARÁNYOS szélességű pillek (ledolgozott / szabadság / betegszabadság) */}
              <motion.div variants={detailItem} className="mt-8">
                <StatusPills
                  segments={[
                    { label: 'Ledolgozott nap', pct: dampenPct(sel.daysWorked), value: sel.daysWorked, suffix: ' nap', background: '#1D1C19', color: '#fff' },
                    { label: 'Szabadság', pct: dampenPct(sel.vacationDays), value: sel.vacationDays, suffix: ' nap', background: '#F1CE45', color: '#1D1C19' },
                    { label: 'Betegség', pct: dampenPct(sel.sickDays), value: sel.sickDays, suffix: ' nap', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
                  ]}
                />
              </motion.div>

              {/* Munkaidő — aktuális hét vs. előző hét */}
              <motion.div variants={detailItem} className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[17px] font-medium text-ink">Munkaidő</h3>
                  <div className="flex items-center gap-4 text-[12.5px] text-ink-soft">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" />Aktuális hét</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B9B3A2]" />Előző hét</span>
                  </div>
                </div>
                <WorkChart recent={sel.recent} previous={sel.previous} />
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
