'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

/** Lazán tipizált recharts-tooltip payload (verzió-független). */
type TipEntry = { dataKey?: string | number; name?: string; value?: number; payload?: Record<string, unknown> }
type TipProps = { active?: boolean; payload?: TipEntry[]; label?: string | number }
import {
  Download, ChevronDown, ChevronRight,
  CalendarCheck, Users, CheckCircle2, Megaphone, CalendarX,
  Clock, CalendarRange, CalendarDays, Timer, Globe, DoorOpen, Phone, UserX,
  Wallet, Receipt, Scissors, TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const ICONS: Record<string, LucideIcon> = {
  reservations: CalendarCheck, pax: Users, completion: CheckCircle2, source: Megaphone, cancelled: CalendarX,
  hour: Clock, dow: CalendarRange, daily: CalendarDays, dwell: Timer, nat: Globe,
  online: Globe, walkin: DoorOpen, phone: Phone, noshow: UserX, done: CheckCircle2,
  // Szalon
  revenue: Wallet, bookings: CalendarCheck, avg: Receipt, service: Scissors, staff: Users, trend: TrendingUp,
}

/* davelopment / Crextio chart-paletta. */
const C = {
  ink: '#1D1C19',
  accent: '#F1CE45',
  grid: '#efebdf',
  tick: '#A8A496',
  cursor: '#cdc9bd',
}

export type OverviewSeriesPoint = { label: string; value: number }
export type OverviewView = {
  id: string
  label: string
  icon: string
  status?: 'done' | 'in_progress' | 'pending'
  /** Meglévő grafikon kulcsa (detailCharts). */
  target?: string
  /** Saját idősor — ekkor a mini-kártyában sparkline-ként jelenik meg. */
  series?: OverviewSeriesPoint[]
  /** Saját érték — ekkor a mini-kártya headline erre vált (pl. „86 fő"). */
  value?: string
  /** Saját változás % (opcionális). */
  deltaPct?: number
}
export type OverviewMetric = {
  id: string
  label: string
  value: string
  unit: string
  deltaPct?: number
  color: string
  icon: string
  series: OverviewSeriesPoint[]
  views: OverviewView[]
}

/** Nap×óra hőtérkép-adat a „Foglaltsági jelentés" kártyához. */
export type OverviewHeatmap = {
  /** 7 sor (Hét..Vas) × N óra mátrix, foglalás-darab. */
  grid: number[][]
  /** Az oszlopokhoz tartozó órák (pl. [10,11,...,22]). */
  hours: number[]
  /** Legerősebb cella (opcionális) — a lábléc csúcs-jelöléséhez. */
  peakDayIdx?: number
  peakHour?: number
}

/** Egy szegmens a forrás-/összetétel-csík kártyához. */
export type OverviewSourceSeg = {
  label: string
  value: string
  pct: number
  /** Vizuális stílus: ink pill / gold pill / sraffozott / outline. */
  variant: 'ink' | 'gold' | 'striped' | 'outline'
}

/** Catmull–Rom → cubic bezier: sima görbe a pontokon át. */
function smoothPath(pts: number[][], yMin: number, yMax: number): string {
  if (pts.length < 2) return ''
  const clamp = (y: number) => Math.max(yMin, Math.min(yMax, y))
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6)
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6)
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}


function DeltaText({ pct }: { pct: number }) {
  const cls = pct > 0 ? 'text-[#1D9D63]' : pct < 0 ? 'text-bad' : 'text-ink-soft'
  return <span className={`text-xs font-semibold ${cls}`}>{pct > 0 ? '+' : ''}{pct}%</span>
}

/** Soronkénti mini-trend (sparkline) a Bontások dúsabb list-kártyáihoz. */
function MiniSparkline({ series, color }: { series: OverviewSeriesPoint[]; color: string }) {
  const vals = series.map((s) => s.value)
  if (vals.length < 2) return <div className="h-8" />
  const W = 140, H = 32
  const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * W, H - ((v - min) / range) * (H - 5) - 2.5])
  const line = smoothPath(pts, 0, H)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-8 w-full">
      <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Crextio kör-nyíl fejléc gomb (kártya jobb-felső sarok). */
function HeaderArrow({ onClick, label = 'Részletek', dark = false }: { onClick?: () => void; label?: string; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 ${
        dark ? 'bg-[#33322e] text-white' : 'bg-[#f1f0ed] text-ink'
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" />
      </svg>
    </button>
  )
}

/** KPI-kijelző (nem választó): ikon + nagy light szám + címke + delta. */
function KpiTile({ m }: { m: OverviewMetric }) {
  const Icon = ICONS[m.icon] ?? CalendarCheck
  return (
    <div className="shrink-0">
      <div className="mb-1.5 flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-soft" strokeWidth={1.8} />
        {m.deltaPct !== undefined && <DeltaText pct={m.deltaPct} />}
      </div>
      <p className="text-3xl lg:text-[42px] font-light leading-none tracking-[-0.02em] text-ink">{m.value}</p>
      <p className="mt-1.5 text-sm text-ink-soft">{m.label}</p>
    </div>
  )
}

/** Hosszú napi sorozatot kevesebb, átlagolt pontba von össze — sima trend-görbe. */
function bucketSeries(series: OverviewSeriesPoint[], max = 30): OverviewSeriesPoint[] {
  if (series.length <= max) return series
  const size = series.length / max
  const out: OverviewSeriesPoint[] = []
  for (let i = 0; i < max; i++) {
    const a = Math.floor(i * size), b = Math.max(a + 1, Math.floor((i + 1) * size))
    const slice = series.slice(a, b)
    const avg = slice.reduce((s, p) => s + p.value, 0) / slice.length
    out.push({ label: slice[Math.floor(slice.length / 2)].label, value: Math.round(avg * 10) / 10 })
  }
  return out
}

/** Sötét pill-tooltip a vonaldiagramhoz (aktuális + előző érték). */
function LineTip({ active, payload, label, unit }: TipProps & { unit?: string }) {
  if (!active || !payload?.length) return null
  const suffix = unit === '%' ? '%' : ''
  const cur = payload.find((p) => p.dataKey === 'cur')
  const prev = payload.find((p) => p.dataKey === 'prev')
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card">
      <p className="mb-1 text-white/55">{label}</p>
      {cur?.value !== undefined && (
        <p className="flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
          Aktuális {Math.round(cur.value)}{suffix}
        </p>
      )}
      {prev?.value !== undefined && (
        <p className="mt-0.5 flex items-center gap-1.5 text-white/70">
          <span className="h-2 w-2 rounded-full" style={{ background: '#8a8880' }} />
          Előző {Math.round(prev.value)}{suffix}
        </p>
      )}
    </div>
  )
}

/**
 * „Hiring Statistics" stílusú trend-chart RECHARTS-szal (betöltés-animáció + hover).
 * - Aktuális időszak = GOLD `#F1CE45`, folytonos, monotone, strokeWidth 3.
 * - Előző időszak = FEKETE `#1D1C19`, PONTOZOTT (2 6), monotone, strokeWidth 2.5.
 * Nincs area-fill; halvány vízszintes rács; sötét pill-tooltip; függőleges szaggatott cursor.
 */
function HiringChart({
  unit, series, deltaPct,
}: { unit: string; series: OverviewSeriesPoint[]; deltaPct?: number }) {
  if (series.length < 2) {
    return <div className="h-full flex items-center justify-center text-sm text-ink-soft">Nincs elég adat a diagramhoz ezen az időszakon.</div>
  }
  const hasPrev = deltaPct !== undefined && Number.isFinite(deltaPct)
  const prevScale = hasPrev ? 1 / (1 + (deltaPct as number) / 100) : 1
  const cur = bucketSeries(series)
  const data = cur.map((p) => ({
    label: p.label,
    cur: p.value,
    ...(hasPrev ? { prev: Math.round(p.value * prevScale * 10) / 10 } : {}),
  }))
  const n = data.length
  const xInterval = Math.max(0, Math.round(n / 8) - 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#efebdf" />
        <XAxis
          dataKey="label" tickLine={false} axisLine={false}
          tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }}
          interval={xInterval} minTickGap={12}
        />
        <YAxis
          width={30} tickLine={false} axisLine={false}
          tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }}
          tickFormatter={(v: number) => `${v}${unit === '%' ? '%' : ''}`}
          allowDecimals={false}
        />
        <Tooltip
          content={<LineTip unit={unit} />}
          cursor={{ stroke: '#cdc9bd', strokeWidth: 1, strokeDasharray: '3 4' }}
        />
        {hasPrev && (
          <Line
            type="monotone" dataKey="prev" stroke={C.ink} strokeWidth={2.5}
            strokeDasharray="2 6" strokeLinecap="round" dot={false} activeDot={false}
            isAnimationActive animationDuration={800}
          />
        )}
        <Line
          type="monotone" dataKey="cur" stroke={C.accent} strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" dot={false}
          activeDot={{ r: 5, fill: C.accent, stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive animationDuration={900}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Chart-fejléc jelmagyarázat (Aktuális gold · Előző fekete). */
function ChartLegend({ showPrev }: { showPrev: boolean }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft2">
        <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />Aktuális
      </span>
      {showPrev && (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft2">
          <span className="h-2 w-2 rounded-full" style={{ background: C.ink }} />Előző
        </span>
      )}
    </div>
  )
}

/**
 * „Teljesítés · összetétel" TELÍTETTSÉG-GYŰRŰ: sötét track (`#33322e`) + GOLD ív,
 * ami a % arányban töltődik ki. Középen a % szám + label. Recharts (animál + hover).
 */
function CompositionDonut({ metric, onOpen }: { metric: OverviewMetric; onOpen?: () => void }) {
  // A % a metrika értékéből (pl. „42%"); ha nem parse-olható, a sorozat 2. feléből.
  const parsed = parseInt(String(metric.value).replace(/[^\d.-]/g, ''), 10)
  let pct: number
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 && String(metric.value).includes('%')) {
    pct = parsed
  } else {
    const vals = metric.series.map((s) => s.value)
    const half = Math.floor(vals.length / 2)
    const firstSum = vals.slice(0, half).reduce((s, v) => s + v, 0)
    const secondSum = vals.slice(half).reduce((s, v) => s + v, 0)
    const total = firstSum + secondSum
    pct = total > 0 ? Math.round((secondSum / total) * 100) : 50
  }
  const rest = Math.max(0, 100 - pct)
  const TRACK = '#33322e'
  const pieData = [
    { name: 'Teljesített', pct, color: C.accent },
    { name: 'Hátralévő', pct: rest, color: TRACK },
  ]

  return (
    <div className="rounded-[26px] dav-card-glass p-5 lg:p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <div className="text-[19px] font-medium text-ink">{metric.label} · összetétel</div>
        <HeaderArrow label="Összetétel" onClick={onOpen} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative my-3 h-[150px] w-[170px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData} dataKey="pct" nameKey="name"
                cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                startAngle={90} endAngle={-270} cornerRadius={6} stroke="none"
                isAnimationActive animationDuration={800}
              >
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="text-[32px] font-light tracking-[-0.02em] leading-none text-ink truncate max-w-[110px]">{metric.value}</div>
            <div className="text-xs font-medium text-ink-soft mt-1">{metric.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-2">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: C.accent }} />{pct}%
            <span className="text-xs font-medium text-ink-soft">teljesült</span>
          </span>
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TRACK }} />{rest}%
            <span className="text-xs font-medium text-ink-soft">hátralévő</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Fehér/sötét pill-tooltip a donutokhoz (szegmens neve + %). */
function DonutTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const pp = p.payload as { color?: string; value?: string } | undefined
  const color = pp?.color ?? C.accent
  const extra = pp?.value
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card ring-1 ring-white/15">
      <p className="flex items-center gap-1.5 font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {p.name}{extra ? ` · ${extra}` : ''}
      </p>
      {typeof p.value === 'number' && <p className="mt-0.5 text-white/70">{Math.round(p.value)}%</p>}
    </div>
  )
}

const DOW_SHORT = ['Hét', 'Ked', 'Sze', 'Csü', 'Pén', 'Szo', 'Vas']
const DOW_FULL = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']

/** Nap×óra mátrixot a metrika napi sorozata × óránkénti eloszlásból közelít
 *  (ha nincs kész `heatmap` prop). A nap-of-week súly a sorozat-értékekből, az
 *  óra-profil egy tipikus vendéglátó-görbe. */
function approximateHeatmap(metric: OverviewMetric): OverviewHeatmap {
  const hours = Array.from({ length: 13 }, (_, i) => i + 10) // 10..22
  // Nap-of-week súlyok: a sorozat utolsó ~28 napját dow-ra vetítjük.
  const dow = Array.from({ length: 7 }, () => 0)
  const tail = metric.series.slice(-28)
  tail.forEach((p, i) => { dow[i % 7] += Math.max(0, p.value) })
  const dowMax = Math.max(1, ...dow)
  // Tipikus óra-profil (ebéd + vacsora csúcs).
  const prof = [0.2, 0.35, 0.6, 0.85, 0.7, 0.4, 0.35, 0.55, 0.9, 1, 0.8, 0.45, 0.2]
  const grid = dow.map((d) => hours.map((_, hi) => (d / dowMax) * prof[hi]))
  let peakDayIdx = 0, peakHour = hours[0], best = -1
  grid.forEach((row, di) => row.forEach((v, hi) => { if (v > best) { best = v; peakDayIdx = di; peakHour = hours[hi] } }))
  return { grid, hours, peakDayIdx, peakHour }
}

/** Cella-szín 3 intenzitás-szinttel (kevés/közepes/sok). */
function heatColor(t: number): string {
  if (t >= 0.66) return C.accent          // sok — élénk gold
  if (t >= 0.33) return '#8f8330'          // közepes — tompa olív-gold
  return '#3a3934'                          // kevés — sötét szürke
}

/**
 * RÉSZLETES „Foglaltsági jelentés" hőtérkép (dark). Fent nagy szám + zöld/narancs
 * nyilak, alatta NAP×ÓRA pötty-rács 3 intenzitás-szinttel, lábléc: csúcs + legenda.
 */
function HeatmapCard({ metric, heatmap }: { metric: OverviewMetric; heatmap?: OverviewHeatmap }) {
  const hm = heatmap ?? approximateHeatmap(metric)
  const flat = hm.grid.flat()
  const max = Math.max(1, ...flat)
  const norm = hm.grid.map((row) => row.map((v) => v / max))

  // Fejléc-számok: forgalmas vs. gyenge cellák aránya.
  const activeCount = flat.filter((v) => v > max * 0.5).length
  const quietCount = flat.filter((v) => v <= max * 0.15).length

  // Óra-fejléc címkék: minden 3. óra (10,13,16,19,22).
  const hourTicks = hm.hours.map((h, i) => (i % 3 === 0 || i === hm.hours.length - 1 ? h : null))

  const peakDay = hm.peakDayIdx !== undefined ? DOW_SHORT[hm.peakDayIdx] : null
  const peakHourStr = hm.peakHour !== undefined ? `${String(hm.peakHour).padStart(2, '0')}h` : null

  return (
    <div className="rounded-[26px] bg-ink-dark p-5 lg:p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <span
          className="text-[15px] font-medium text-white cursor-help"
          title="Melyik napszakban a legforgalmasabb. Minden pötty egy nap+óra cella: minél sárgább (a jobb alsó jelmagyarázat szerint), annál több a foglalás. Vidd az egeret egy pöttyre a pontos számért."
        >
          Foglaltsági jelentés
        </span>
        <HeaderArrow label="Foglaltsági jelentés" dark />
      </div>

      <div className="flex items-center gap-5 mb-5">
        <div className="flex items-center gap-1 cursor-help" title="Forgalmas cellák — ahol az adott nap+óra foglaltsága kiemelkedő.">
          <span className="text-[30px] font-light leading-none text-white">{activeCount}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3ecf8e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
        </div>
        <div className="flex items-center gap-1 cursor-help" title="Csendes cellák — ahol alig vagy egyáltalán nincs foglalás.">
          <span className="text-[30px] font-light leading-none text-white/55">{quietCount}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e08a3c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="7" x2="17" y2="17" /><polyline points="17 7 17 17 7 17" /></svg>
        </div>
      </div>

      {/* Óra-fejléc — a rács flex-1 celláival egy tengelyen (mobilon kisebb gap) */}
      <div className="flex items-center gap-1 sm:gap-1.5 pl-7 sm:pl-8 mb-1.5">
        {hourTicks.map((h, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-medium text-white/40">{h !== null ? h : ''}</span>
        ))}
      </div>

      {/* Nap×óra rács — flex-1 cellák, így SOHA nem lóg ki (mobilon is kifér). Minden cella
          natív hover-tooltipet kap: „<Nap> <óra>h · N foglalás" — így érthető a hőtérkép. */}
      <div className="space-y-1 sm:space-y-1.5">
        {norm.map((row, di) => (
          <div key={di} className="flex items-center gap-1 sm:gap-1.5">
            <span className="w-6 shrink-0 text-[10px] font-medium text-white/40">{DOW_SHORT[di]}</span>
            {row.map((t, hi) => {
              const raw = hm.grid[di]?.[hi] ?? 0
              const hour = hm.hours[hi]
              return (
                <span
                  key={hi}
                  className="flex-1 aspect-square rounded-full cursor-help transition-transform duration-150 hover:scale-[1.55] hover:ring-2 hover:ring-white/60"
                  style={{ background: heatColor(t) }}
                  title={`${DOW_FULL[di]} ${String(hour).padStart(2, '0')}:00 · ${raw} foglalás`}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Lábléc: csúcs + legenda */}
      <div className="mt-5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gold truncate">
          {peakDay && peakHourStr ? `Csúcs · ${peakDay} ${peakHourStr}` : 'Csúcsidő'}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/40">
          Kevesebb
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: '#3a3934' }} />
            <span className="h-2 w-2 rounded-full" style={{ background: '#8f8330' }} />
            <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
          </span>
          Több
        </span>
      </div>
    </div>
  )
}

/** GRAFIKON-kártya: cream kártya, cím + kör-nyíl + méretezett chart-konténer. */
function ChartCard({ title, children, onOpen }: { title: string; children: React.ReactNode; onOpen?: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="rounded-[26px] dav-card-glass p-4 lg:p-5 flex flex-col min-w-0 min-h-[212px] cursor-pointer transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between mb-2">
        <span className="text-[17px] font-medium text-ink truncate">{title}</span>
        <HeaderArrow label={title} onClick={onOpen} />
      </div>
      <div className="flex-1 w-full min-w-0 min-h-[160px]">{children}</div>
    </div>
  )
}

/** FORRÁS-CSÍK kártya: vízszintes pillek, szélesség a %-arányban, címke felül. */
function SourceStripCard({ title = 'Foglalási források', segments }: { title?: string; segments: OverviewSourceSeg[] }) {
  const stripe = 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 6px, rgba(190,180,140,.28) 6px, rgba(190,180,140,.28) 12px)'
  return (
    <div className="rounded-[26px] dav-card-glass p-4 lg:p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[17px] font-medium text-ink truncate">{title}</span>
        <HeaderArrow label={title} />
      </div>
      <div className="flex-1 flex items-end gap-2">
        {segments.map((s, i) => {
          const cls =
            s.variant === 'ink' ? 'bg-ink-dark text-white'
            : s.variant === 'gold' ? 'bg-gold text-ink-dark'
            : s.variant === 'striped' ? 'border border-line-strong text-ink-soft2'
            : 'border border-line-strong text-ink-soft2'
          return (
            <div key={i} className="min-w-0" style={{ flex: `${Math.max(6, s.pct)} 1 0%` }}>
              <p className="mb-2 truncate text-xs font-medium text-ink-soft">{s.label}</p>
              <div
                className={`flex h-11 items-center justify-center rounded-[21px] px-2 text-sm font-semibold ${cls}`}
                style={s.variant === 'striped' ? { background: stripe } : undefined}
              >
                {s.value}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AnalyticsOverview({
  metrics,
  filter,
  csvHref,
  detailCharts = {},
  heatmap,
  sources,
  chartCards,
}: {
  metrics: OverviewMetric[]
  /** A szerver-oldalról kapott időszak-választó (PeriodFilter, CSV nélkül). */
  filter: React.ReactNode
  /** CSV export URL — desktopon külön gomb. */
  csvHref?: string
  /** A részlet-nézetek (target → kész grafikon). A deep-dive sheetben. */
  detailCharts?: Record<string, React.ReactNode>
  /** Nap×óra hőtérkép-adat (opcionális; hiányában a sorozatból közelít). */
  heatmap?: OverviewHeatmap
  /** Forrás-/összetétel-csík szegmensei (opcionális). */
  sources?: OverviewSourceSeg[]
  /** A col2 tetején lévő 2 kártyába VALÓ grafikonok (cím + kész embedded chart). */
  chartCards?: { title: string; node: React.ReactNode }[]
  /** Opcionális, a page-ből — visszafelé kompatibilitás (már nem használt). */
  bestDay?: string | null
  bestHour?: string | null
}) {
  // Elsődleges metrika = az első (étterem: foglalás; szalon: bevétel).
  const primary = metrics[0]
  // Donut fix összetételre: a teljesítés metrika, ha van; különben az elsődleges.
  const composition = metrics.find((m) => m.id === 'completion') ?? primary

  // A „Bontások" lista a FŐ metrikákra (nem az összes al-nézetre). Egy sor törzse
  // a trend-chartot váltja (master-detail); a sor kör-nyila a sidebart nyitja.
  const [selectedId, setSelectedId] = useState(metrics[0]?.id)
  const selected = metrics.find((m) => m.id === selectedId) ?? metrics[0]
  // Accordion: melyik bontás van kinyitva (alapból az első).
  const [openId, setOpenId] = useState<string | null>(metrics[0]?.id ?? null)
  // A fekete kártya több-szegmenses donutja a forrás-megoszlásból (online/telefon/beeső…).
  const DONUT_COLORS = ['#F1CE45', '#C9A24B', '#8A8378', '#4A4944']
  const donutSegs = (sources ?? []).map((s, i) => ({
    color: DONUT_COLORS[i % DONUT_COLORS.length],
    label: s.label,
    value: s.value,
    pct: Math.max(0, s.pct),
  }))

  // A deep-dive sidebar egy FŐ metrikára nyílik; benne az al-nézetek + grafikonjaik.
  const [sheetMetricId, setSheetMetricId] = useState<string | null>(null)
  const sheetMetric = metrics.find((m) => m.id === sheetMetricId) ?? metrics[0]

  if (!primary || !selected) return null

  const showPrevLegend = selected.deltaPct !== undefined && Number.isFinite(selected.deltaPct)

  // Forrás-szegmensek 2 kártyára osztva.
  const srcA = sources?.slice(0, 2) ?? []
  const srcB = sources?.slice(2) ?? []

  return (
    <section className="font-onest space-y-4">
      {/* Fejléc-cím NINCS (a page-ben már „Statisztikák") — csak időszak + CSV, jobbra */}
      <div className="flex items-center justify-end gap-2">
        {filter}
        {csvHref && (
          <a
            href={csvHref}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-[12px] border border-line bg-[var(--dav-glass-strong)] text-sm font-semibold text-ink-soft2 hover:text-ink transition-colors"
          >
            <Download className="h-4 w-4" /> CSV
          </a>
        )}
      </div>

      {/* (A KPI-szám sor a page stat-területén van — itt nincs, hogy ne duplikálódjon.) */}

      {/* Bento — col1 = „Bontások" lista (master) · col2 = 2 grafikon-kártya FELÜL +
          trend-chart (detail) ALUL · col3 = hőtérkép + donut. */}
      <div className="grid grid-cols-1 gap-[5px] lg:grid-cols-[280px_minmax(0,1fr)_312px]">
        {/* col1 — sötét donut + Bontások ACCORDION.
            Mobilon `contents`, hogy a két kártya a fő stack rendjébe illeszkedjen
            (donut felül, accordion legalul); desktopon flex-oszlop 2 sor magas. */}
        <div className="contents lg:flex lg:flex-col lg:gap-[5px] lg:row-span-2">
          {/* NAGY sötét kártya: foglalási arány (online/telefon/beeső) — donut + legenda */}
          <div className="order-1 lg:order-none flex flex-col rounded-[26px] bg-ink-dark p-6 text-white shadow-dav-card">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-medium text-white/55">Foglalási arány</div>
              <HeaderArrow dark label="Foglalási arány" onClick={() => setSheetMetricId(metrics.find((m) => m.id === 'source')?.id ?? primary.id)} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-5">
              {/* Legenda */}
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                {donutSegs.map((seg) => (
                  <div key={seg.label} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seg.color }} />
                    <span className="truncate text-[13px] text-white/80">{seg.label}</span>
                    <span className="ml-auto text-[13px] font-semibold tabular-nums">{seg.value}</span>
                  </div>
                ))}
              </div>
              {/* Több-szegmenses donut (recharts: animál + hover, ívelt szegmens-végek) */}
              <div className="h-[104px] w-[104px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutSegs} dataKey="pct" nameKey="label"
                      cx="50%" cy="50%" innerRadius={30} outerRadius={50}
                      startAngle={90} endAngle={-270} paddingAngle={2} cornerRadius={6} stroke="none"
                      isAnimationActive animationDuration={800}
                    >
                      {donutSegs.map((seg, i) => <Cell key={i} fill={seg.color} />)}
                    </Pie>
                    <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bontások accordion — kinyíló sorok (mobilon LEGALUL) */}
          <div className="order-6 lg:order-none flex flex-1 flex-col rounded-[26px] dav-card-glass p-4 lg:p-5">
            <div className="mb-3 text-[19px] font-medium text-[#22221e]">Bontások</div>
            <div className="flex flex-1 flex-col">
              {metrics.map((m, mi) => {
                const open = openId === m.id
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${open ? '' : 'flex-1 justify-center'} ${mi < metrics.length - 1 ? 'border-b border-[#efebdf]' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : m.id)}
                      className="flex w-full items-center justify-between gap-2 py-3.5 text-left"
                    >
                      <span className="min-w-0 truncate text-[15px] font-medium text-[#3a352a]">{m.label}</span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium text-ink-soft tabular-nums">{m.value}</span>
                        <ChevronDown className={`h-[18px] w-[18px] text-[#6a6354] transition-transform ${open ? 'rotate-180' : ''}`} />
                      </span>
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
                          <div className="flex flex-col pb-3">
                            {m.views.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setSheetMetricId(m.id)}
                                className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left text-[14px] text-ink-soft transition-colors hover:bg-[var(--dav-glass)] hover:text-ink"
                              >
                                <span className="truncate">{v.label}</span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" />
                              </button>
                            ))}
                            {m.deltaPct !== undefined && (
                              <div className="px-2.5 py-1.5 text-[13px] text-ink-soft">
                                Változás az előző időszakhoz: <DeltaText pct={m.deltaPct} />
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* col2 · sor1 — 2 GRAFIKON-kártya (mobilon a trend UTÁN: order-3) */}
        {chartCards && chartCards.length > 0 ? (
          <div className="order-3 lg:order-none grid grid-cols-1 gap-[5px] sm:grid-cols-2">
            {chartCards.slice(0, 2).map((c, i) => (
              <ChartCard key={i} title={c.title} onOpen={() => setSheetMetricId(selected.id)}>{c.node}</ChartCard>
            ))}
          </div>
        ) : sources && sources.length > 0 ? (
          <div className="order-3 lg:order-none grid grid-cols-1 gap-[5px] sm:grid-cols-2">
            <SourceStripCard title="Foglalási források" segments={srcA} />
            {srcB.length > 0 && <SourceStripCard title="Egyéb státusz" segments={srcB} />}
          </div>
        ) : <div className="hidden lg:block" />}

        {/* col3 · sor1 — sötét részletes hőtérkép (mobilon order-4) */}
        <div className="order-4 lg:order-none lg:contents">
          <HeatmapCard metric={primary} heatmap={heatmap} />
        </div>

        {/* col2 · sor2 — trend-chart (detail) — mobilon a donut UTÁN: order-2 */}
        <div onClick={() => setSheetMetricId(selected.id)} className="order-2 lg:order-none min-w-0 flex flex-col rounded-[26px] dav-card-glass p-4 lg:p-5 cursor-pointer transition-colors hover:border-line-strong">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="text-[19px] font-medium text-ink truncate">{selected.label}</div>
                <ChartLegend showPrev={showPrevLegend} />
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <p className="text-3xl lg:text-[30px] font-light tracking-[-0.02em] text-ink">{selected.value}</p>
                {selected.deltaPct !== undefined && <DeltaText pct={selected.deltaPct} />}
              </div>
            </div>
            <HeaderArrow onClick={() => setSheetMetricId(selected.id)} />
          </div>
          <div key={selected.id} className="mt-3 min-w-0 flex-1 h-48 lg:h-[208px]">
            <HiringChart unit={selected.unit} series={selected.series} deltaPct={selected.deltaPct} />
          </div>
        </div>

        {/* col3 · sor2 — donut (Employee Composition) — mobilon order-5 */}
        <div className="order-5 lg:order-none lg:contents">
          <CompositionDonut
            metric={composition}
            onOpen={() => setSheetMetricId(composition.id)}
          />
        </div>
      </div>


      {/* Részletek-sidebar (deep-dive) — a kör-nyílra kattintva, a FŐ metrikára */}
      <Sheet open={!!sheetMetricId} onOpenChange={(v) => { if (!v) setSheetMetricId(null) }}>
        <SheetContent className="font-onest w-full sm:max-w-lg overflow-y-auto bg-white">
          <SheetHeader className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-0.5">Részletek</p>
            <SheetTitle className="text-lg font-medium tracking-tight text-ink">{sheetMetric.label}</SheetTitle>
          </SheetHeader>

          <div className="mb-5 rounded-[18px] p-5 border border-line bg-[var(--dav-glass)]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-2">Aktuális érték</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-light tracking-[-0.02em] text-ink">{sheetMetric.value}</p>
              {sheetMetric.deltaPct !== undefined && <DeltaText pct={sheetMetric.deltaPct} />}
            </div>
          </div>

          {/* Fő trend a metrikára — MÉRETEZETT konténer, hogy látszódjon */}
          <div className="mb-6 h-56 w-full">
            <HiringChart
              unit={sheetMetric.unit}
              series={sheetMetric.series}
              deltaPct={sheetMetric.deltaPct}
            />
          </div>

          {/* Al-bontások + azok grafikonjai (méretezett konténerben) */}
          <div className="space-y-5">
            {sheetMetric.views.map((v) => {
              const chart = v.target ? detailCharts[v.target] : undefined
              const headValue = v.value ?? sheetMetric.value
              const ownSeries = v.series && v.series.length >= 2 ? v.series : null
              const Icon = ICONS[v.icon] ?? CalendarDays
              return (
                <div key={v.id} className="rounded-[18px] border border-line p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--dav-glass-strong)] border border-line">
                        <Icon className="h-4 w-4 text-ink" />
                      </span>
                      {v.label}
                    </span>
                    <span className="text-sm font-light text-ink">{headValue}</span>
                  </div>
                  {/* MÉRETEZETT konténer — a ResponsiveContainer alapú grafikonok itt látszódnak */}
                  <div className="h-64 w-full">
                    {chart ? chart : (
                      <HiringChart
                        unit=""
                        series={ownSeries ?? sheetMetric.series}
                        deltaPct={v.deltaPct ?? sheetMetric.deltaPct}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
