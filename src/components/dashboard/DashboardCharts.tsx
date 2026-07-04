'use client'

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DayData, ServiceStat, StaffStat, DowStat, HourStat } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'
import { KpiDetailsSheet } from './KpiDetailsSheet'

/* davelopment-design chart-paletta (light). */
const C = {
  ink: '#1D1C19',          // vonal / oszlop alap
  accent: '#F1CE45',       // kiemelés (gold)
  bad: '#C0564A',          // lemondás / negatív
  grid: 'rgba(120,110,70,.14)',
  tick: '#9b9788',
  cursor: 'rgba(120,110,70,.10)',
  barCursor: 'rgba(120,110,70,.06)',
}

/* Egységes, fehér davelopment-tooltip. */
function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-white px-3 py-2 text-xs text-ink shadow-dav-card">
      {children}
    </div>
  )
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}e`
  return String(n)
}

function periodLabel(days: number) {
  if (days === 1) return 'mai'
  if (days === 7) return '7 nap'
  if (days === 30) return '30 nap'
  if (days === 90) return '90 nap'
  if (days === 180) return '6 hónap'
  if (days === 365) return '1 év'
  return `${days} nap`
}

function DetailsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Részletek"
      className="shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[#f3efe4] text-ink transition-transform hover:scale-105 active:scale-95"
    >
      <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
    </button>
  )
}

/** Toggle-pill csoport (davelopment): aktív = sötét ink kitöltés, fehér szöveg. */
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-[12px] text-xs font-semibold transition-all ${
        active ? 'bg-ink-dark text-white shadow-sm' : 'text-ink-soft2 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

const CARD = 'bg-[#fcfbf7] border border-line rounded-[26px] shadow-dav-card p-6'

function xAxisInterval(days: number) {
  if (days <= 14) return 1
  if (days <= 30) return 4
  if (days <= 90) return 13
  if (days <= 180) return 26
  return 60
}

export function TrendChart({ data, period = 30, embedded = false }: { data: DayData[]; period?: number; embedded?: boolean }) {
  const [tab, setTab] = useState<'revenue' | 'bookings'>('revenue')
  const [sheetOpen, setSheetOpen] = useState(false)

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <TipBox>
        <p className="text-ink-soft mb-0.5">{label}</p>
        <p className="font-semibold">
          {tab === 'revenue' ? formatPrice(payload[0].value, 'HUF') : `${payload[0].value} foglalás`}
        </p>
      </TipBox>
    )
  }

  return (
    <div className={embedded ? 'h-full' : CARD}>
      {!embedded && (
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
          <h3 className="text-lg font-medium tracking-tight text-ink">
            {tab === 'revenue' ? 'Bevétel' : 'Foglalások'}
          </h3>
        </div>
        <div className="flex items-center gap-3">
        <DetailsButton onClick={() => setSheetOpen(true)} />
        <div className="flex gap-1 bg-[var(--dav-glass-strong)] border border-line rounded-[14px] p-1">
          <Toggle active={tab === 'revenue'} onClick={() => setTab('revenue')}>Bevétel</Toggle>
          <Toggle active={tab === 'bookings'} onClick={() => setTab('bookings')}>Foglalások</Toggle>
        </div>
        </div>
      </div>
      )}

      <ResponsiveContainer width="100%" height={embedded ? '100%' : 220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.ink} stopOpacity={0.18} />
              <stop offset="95%" stopColor={C.ink} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} interval={xAxisInterval(period)} />
          <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} tickFormatter={tab === 'revenue' ? fmt : undefined} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.cursor, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey={tab} stroke={C.ink} strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: C.ink, strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
      <KpiDetailsSheet kind="trend" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} />
    </div>
  )
}

/**
 * Étterem-trend: foglalás-szám / vendégszám (pax). A pax a DayData.revenue mezőben utazik
 * (a getRestaurantStats így tölti). Nincs HUF-formázás, nincs drill-down sheet.
 */
export function ReservationTrendChart({ data, period = 30, embedded = false }: { data: DayData[]; period?: number; embedded?: boolean }) {
  const [tab, setTab] = useState<'bookings' | 'revenue'>('bookings')

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <TipBox>
        <p className="text-ink-soft mb-0.5">{label}</p>
        <p className="font-semibold">
          {tab === 'revenue' ? `${payload[0].value} vendég` : `${payload[0].value} foglalás`}
        </p>
      </TipBox>
    )
  }

  return (
    <div className={embedded ? 'h-full' : CARD}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-medium tracking-tight text-ink">
              {tab === 'revenue' ? 'Vendégszám' : 'Foglalások'}
            </h3>
          </div>
          <div className="flex gap-1 bg-[var(--dav-glass-strong)] border border-line rounded-[14px] p-1">
            <Toggle active={tab === 'bookings'} onClick={() => setTab('bookings')}>Foglalások</Toggle>
            <Toggle active={tab === 'revenue'} onClick={() => setTab('revenue')}>Vendégszám</Toggle>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={embedded ? '100%' : 220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-res" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={C.ink} stopOpacity={0.18} />
              <stop offset="95%" stopColor={C.ink} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} interval={xAxisInterval(period)} />
          <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.cursor, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey={tab} stroke={C.ink} strokeWidth={2} fill="url(#grad-res)" dot={false} activeDot={{ r: 4, fill: C.ink, strokeWidth: 0 }} isAnimationActive animationDuration={800} animationEasing="ease-out" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// Teljes nap-név → rövidítés a tengelyen (hogy mind a 7 kiférjen, Szombat is).
const DOW_ABBR: Record<string, string> = {
  'Hétfő': 'Hé', 'Kedd': 'Ke', 'Szerda': 'Sze', 'Csütörtök': 'Csü', 'Péntek': 'Pé', 'Szombat': 'Szo', 'Vasárnap': 'Va',
}

export function DowChart({ data, period = 30, rawDays = [], moneyless = false, embedded = false }: { data: DowStat[]; period?: number; rawDays?: DayData[]; moneyless?: boolean; embedded?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  // A legerősebb napot gold-dal emeljük ki (davelopment peak-oszlop).
  const peakIdx = data.reduce((mi, d, i, a) => (d.bookings > (a[mi]?.bookings ?? -1) ? i : mi), 0)

  return (
    <div className={embedded ? 'h-full' : CARD}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-medium tracking-tight text-ink">Heti eloszlás</h3>
          </div>
          <DetailsButton onClick={() => setSheetOpen(true)} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={embedded ? '100%' : 160}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={9}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} interval={0} tickFormatter={(v: string) => DOW_ABBR[v] ?? v} />
          <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: C.barCursor, radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return <TipBox><p className="font-semibold">{payload[0].value} foglalás</p></TipBox>
            }}
          />
          {/* Vékony, lekerekített oszlopok — csúcs GOLD, a többi sötét ink (mint az Áttekintésben). */}
          <Bar dataKey="bookings" radius={[5, 5, 5, 5]} isAnimationActive animationDuration={800} animationEasing="ease-out">
            {data.map((_, i) => (
              <Cell key={i} fill={i === peakIdx ? C.accent : C.ink} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <KpiDetailsSheet kind="dow" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={rawDays} moneyless={moneyless} />
    </div>
  )
}

export function HourChart({ data, period = 30, rawDays = [], hourlyByDate, moneyless = false, embedded = false }: { data: HourStat[]; period?: number; rawDays?: DayData[]; hourlyByDate?: Record<string, number[]>; moneyless?: boolean; embedded?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const hasData = data.some(d => d.bookings > 0)

  // Csak a tényleges forgalmat tartalmazó óratartományt mutatjuk (első–utolsó foglalt óra).
  const first = data.findIndex(d => d.bookings > 0)
  const last = data.length - 1 - [...data].reverse().findIndex(d => d.bookings > 0)
  const visible = hasData ? data.slice(first, last + 1) : []
  const peakIdx = visible.reduce((mi, d, i, a) => (d.bookings > (a[mi]?.bookings ?? -1) ? i : mi), 0)

  if (!hasData) return null

  return (
    <div className={embedded ? 'h-full' : CARD}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-medium tracking-tight text-ink">Óránkénti forgalom</h3>
          </div>
          <DetailsButton onClick={() => setSheetOpen(true)} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={embedded ? '100%' : 160}>
        <BarChart data={visible} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={9}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: C.tick }} tickLine={false} axisLine={false} interval={visible.length > 12 ? 1 : 0} />
          <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: C.barCursor, radius: 6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <TipBox>
                  <p className="text-ink-soft mb-0.5">{label}</p>
                  <p className="font-semibold">{payload[0].value} foglalás</p>
                </TipBox>
              )
            }}
          />
          {/* Vékony, lekerekített oszlopok — csúcs GOLD, a többi sötét ink (mint az Áttekintésben). */}
          <Bar dataKey="bookings" radius={[5, 5, 5, 5]} isAnimationActive animationDuration={800} animationEasing="ease-out">
            {visible.map((_, i) => (
              <Cell key={i} fill={i === peakIdx ? C.accent : C.ink} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <KpiDetailsSheet kind="hour" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} rawDays={rawDays} hourlyByDate={hourlyByDate} moneyless={moneyless} />
    </div>
  )
}

/**
 * NAPSZAK-bontás: az óránkénti forgalmat 5 napszakba vonja össze (Reggel/Délelőtt/
 * Délután/Este/Éjszaka). Tisztább, kevés-oszlopos alternatíva a sűrű óra-charthoz —
 * a csúcs-napszak GOLD, a többi sötét ink. Vékony, lekerekített oszlopok.
 */
const DAYPARTS: { label: string; from: number; to: number }[] = [
  { label: 'Reggel', from: 5, to: 9 },
  { label: 'Délelőtt', from: 9, to: 12 },
  { label: 'Délután', from: 12, to: 17 },
  { label: 'Este', from: 17, to: 22 },
  { label: 'Éjszaka', from: 22, to: 29 }, // 22–24 + 0–5 (mod 24)
]

export function DaypartChart({ data, embedded = false }: { data: HourStat[]; embedded?: boolean }) {
  const hourVal = (h: number) => data.find((d) => parseInt(d.hour, 10) === (h % 24))?.bookings ?? 0
  const parts = DAYPARTS.map((p) => {
    let sum = 0
    for (let h = p.from; h < p.to; h++) sum += hourVal(h)
    return { label: p.label, bookings: sum }
  })
  const hasData = parts.some((p) => p.bookings > 0)
  const peakIdx = parts.reduce((mi, d, i, a) => (d.bookings > (a[mi]?.bookings ?? -1) ? i : mi), 0)

  if (!hasData) return <div className="flex h-full items-center justify-center text-sm text-ink-soft">Nincs adat ehhez az időszakhoz.</div>

  return (
    <div className={embedded ? 'h-full' : CARD}>
      <ResponsiveContainer width="100%" height={embedded ? '100%' : 160}>
        <BarChart data={parts} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={12}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: C.tick }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: C.barCursor, radius: 6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <TipBox>
                  <p className="text-ink-soft mb-0.5">{label}</p>
                  <p className="font-semibold">{payload[0].value} foglalás</p>
                </TipBox>
              )
            }}
          />
          {/* Vékony, lekerekített oszlopok — csúcs-napszak GOLD, a többi sötét ink. */}
          <Bar dataKey="bookings" radius={[5, 5, 5, 5]} isAnimationActive animationDuration={800} animationEasing="ease-out">
            {parts.map((_, i) => (
              <Cell key={i} fill={i === peakIdx ? C.accent : C.ink} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ServiceChart({ data, period = 30, embedded = false }: { data: ServiceStat[]; period?: number; embedded?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.revenue))
  return (
    <div className={embedded ? 'h-full overflow-y-auto' : CARD}>
      {!embedded && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-medium tracking-tight text-ink">Szolgáltatások</h3>
          </div>
          <DetailsButton onClick={() => setSheetOpen(true)} />
        </div>
      )}
      <div className="space-y-3.5">
        {data.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink truncate pr-2">{s.name}</span>
              <span className="text-xs font-semibold text-ink shrink-0">{formatPrice(s.revenue, 'HUF')}</span>
            </div>
            <div className="h-2 bg-[var(--dav-glass-strong)] border border-line rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: max > 0 ? `${(s.revenue / max) * 100}%` : '0%', background: i === 0 ? C.accent : C.ink }} />
            </div>
            <p className="text-xs text-ink-soft mt-1">{s.bookings} foglalás</p>
          </div>
        ))}
      </div>
      <KpiDetailsSheet kind="service" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} />
    </div>
  )
}

export function StaffChart({ data, period = 30, embedded = false }: { data: StaffStat[]; period?: number; embedded?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.bookings))
  return (
    <div className={embedded ? 'h-full overflow-y-auto' : CARD}>
      {!embedded && (
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-medium tracking-tight text-ink">Munkatársak</h3>
          </div>
          <DetailsButton onClick={() => setSheetOpen(true)} />
        </div>
      )}
      <div className="space-y-3.5">
        {data.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink truncate pr-2">{s.name}</span>
              <span className="text-xs font-semibold text-ink shrink-0">{s.bookings} foglalás</span>
            </div>
            <div className="h-2 bg-[var(--dav-glass-strong)] border border-line rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: max > 0 ? `${(s.bookings / max) * 100}%` : '0%', background: i === 0 ? C.accent : C.ink }} />
            </div>
            <p className="text-xs text-ink-soft mt-1">{formatPrice(s.revenue, 'HUF')} bevétel</p>
          </div>
        ))}
      </div>
      <KpiDetailsSheet kind="staff" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} />
    </div>
  )
}
