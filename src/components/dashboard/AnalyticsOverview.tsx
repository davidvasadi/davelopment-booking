'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  ChevronRight, Download, ArrowUpRight,
  CalendarCheck, Users, CheckCircle2, Megaphone, CalendarX,
  Clock, CalendarRange, CalendarDays, Timer, Globe, DoorOpen, Phone, UserX,
  type LucideIcon,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const ICONS: Record<string, LucideIcon> = {
  reservations: CalendarCheck, pax: Users, completion: CheckCircle2, source: Megaphone, cancelled: CalendarX,
  hour: Clock, dow: CalendarRange, daily: CalendarDays, dwell: Timer, nat: Globe,
  online: Globe, walkin: DoorOpen, phone: Phone, noshow: UserX, done: CheckCircle2,
}

export type OverviewSeriesPoint = { label: string; value: number }
export type OverviewView = {
  id: string
  label: string
  icon: string
  status?: 'done' | 'in_progress' | 'pending'
  /** Meglévő grafikon kulcsa (detailCharts). */
  target?: string
  /** Saját idősor — ekkor a nagy kártyában area-chartként jelenik meg. */
  series?: OverviewSeriesPoint[]
  /** Saját érték — ekkor a nagy kártya fejléce erre vált (pl. „86 fő"). */
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

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Hosszú/ritka sorozatot kevesebb pontba átlagol (simább mini-görbe). */
function bucket(data: number[], max = 24): number[] {
  if (data.length <= max) return data
  const size = data.length / max
  const out: number[] = []
  for (let i = 0; i < max; i++) {
    const a = Math.floor(i * size), b = Math.floor((i + 1) * size)
    const slice = data.slice(a, Math.max(a + 1, b))
    out.push(slice.reduce((s, v) => s + v, 0) / slice.length)
  }
  return out
}

/** Catmull–Rom → cubic bezier: sima görbe a pontokon át. */
function smoothPath(pts: number[][]): string {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d
}

function Sparkline({ data: raw, color }: { data: number[]; color: string }) {
  const data = bucket(raw)
  if (data.length < 2) return null
  const w = 100, h = 34
  const max = Math.max(...data), min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * (h - 4) - 2])
  const line = smoothPath(pts)
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-9">
      <path d={area} fill={color} opacity={0.14} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function DeltaText({ pct }: { pct: number }) {
  const cls = pct > 0 ? 'text-[#00bb88]' : pct < 0 ? 'text-red-400' : 'text-zinc-400 dark:text-white/30'
  return <span className={`text-xs font-bold ${cls}`}>{pct > 0 ? '+' : ''}{pct}%</span>
}

function StatusDot({ status }: { status: OverviewView['status'] }) {
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 text-[#00bb88]" />
  if (status === 'in_progress') return <span className="block h-4 w-4 rounded-full border-2 border-[#0099ff] border-t-transparent animate-spin" />
  return <ChevronRight className="h-4 w-4 text-zinc-300 dark:text-white/20" />
}

function MetricTile({ m, active, onClick }: { m: OverviewMetric; active: boolean; onClick: () => void }) {
  const Icon = ICONS[m.icon] ?? CalendarCheck
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl bg-white dark:bg-white/[0.03] p-3.5 lg:p-5 transition-shadow shrink-0 w-[132px] sm:w-[150px] lg:w-auto ${
        active ? 'shadow-sm' : 'border border-[#ECECEE] dark:border-white/[0.06] hover:border-zinc-300 dark:hover:border-white/[0.16]'
      }`}
      style={active ? { boxShadow: `0 0 0 2px ${m.color}` } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 lg:h-10 lg:w-10 items-center justify-center rounded-xl" style={{ background: hexA(m.color, 0.12) }}>
          <Icon className="h-[18px] w-[18px] lg:h-5 lg:w-5" style={{ color: m.color }} />
        </span>
        {m.deltaPct !== undefined && <DeltaText pct={m.deltaPct} />}
      </div>
      <p className="mt-3 lg:mt-4 text-xl lg:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white truncate">{m.value}</p>
      <p className="mt-0.5 lg:mt-1 text-xs lg:text-sm text-[#8A8A8E] dark:text-white/40 truncate">{m.label}</p>
      <div className="mt-4 hidden lg:block"><Sparkline data={m.series.map(s => s.value)} color={m.color} /></div>
    </button>
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

function BigChart({ id, color, unit, series, dark }: { id: string; color: string; unit: string; series: OverviewSeriesPoint[]; dark: boolean }) {
  if (series.length < 2) {
    return <div className="h-full flex items-center justify-center text-sm text-[#8A8A8E]">Nincs elég adat a diagramhoz ezen az időszakon.</div>
  }
  const data = bucketSeries(series)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id={`ov-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.22} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: dark ? 'rgba(255,255,255,0.25)' : '#8A8A8E' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: dark ? 'rgba(255,255,255,0.25)' : '#8A8A8E' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="bg-white dark:bg-black border border-[#ECECEE] dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                <p className="text-[#8A8A8E] mb-0.5">{label}</p>
                <p className="font-bold">{payload[0].value}{unit ? ` ${unit}` : ''}</p>
              </div>
            )
          }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#ov-${id})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function ViewRow({ v, active, onClick }: { v: OverviewView; active: boolean; onClick: () => void }) {
  const Icon = ICONS[v.icon] ?? CalendarDays
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-2 py-3 text-left rounded-xl transition-colors ${
        active ? 'bg-zinc-100 dark:bg-white/[0.06]' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/[0.06]">
        <Icon className="h-[18px] w-[18px] text-zinc-900 dark:text-white" />
      </span>
      <span className="flex-1 min-w-0 text-sm font-semibold text-zinc-900 dark:text-white truncate">{v.label}</span>
      {v.status && <StatusDot status={v.status} />}
      {(v.target || v.series) && <ChevronRight className={`h-4 w-4 ${active ? 'text-zinc-500 dark:text-white/50' : 'text-zinc-300 dark:text-white/20'}`} />}
    </button>
  )
}

export function AnalyticsOverview({
  metrics,
  filter,
  csvHref,
  detailCharts = {},
}: {
  metrics: OverviewMetric[]
  /** A szerver-oldalról kapott időszak-választó (PeriodFilter, CSV nélkül). */
  filter: React.ReactNode
  /** CSV export URL — desktopon külön gomb, mobilon a „…" menüben. */
  csvHref?: string
  /** A részlet-nézetek (target → kész grafikon). Scroll helyett slotban váltjuk. */
  detailCharts?: Record<string, React.ReactNode>
}) {
  const [selectedId, setSelectedId] = useState(metrics[0]?.id)
  const selected = metrics.find((m) => m.id === selectedId) ?? metrics[0]
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  // Alapból a metrika saját trendje látszik; egy részlet-sorra kattintva vált
  // (meglévő grafikonra VAGY al-idősorra). Metrika-váltáskor visszaáll a trendre.
  const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined)
  const [sheetOpen, setSheetOpen] = useState(false)
  useEffect(() => { setActiveViewId(undefined) }, [selectedId])

  if (!selected) return null

  const activeView = selected.views.find((v) => v.id === activeViewId)
  const showExisting = !!(activeView?.target && detailCharts[activeView.target])
  const showSeries = !showExisting && !!(activeView?.series && activeView.series.length >= 2)
  const toggleView = (id: string) => setActiveViewId((cur) => (cur === id ? undefined : id))

  // A fejléc érték/változás: ha az aktív al-sornak van SAJÁT értéke, arra vált; egyébként a metrikáé.
  const hasOwnValue = activeView?.value !== undefined
  const headValue = hasOwnValue ? activeView!.value! : selected.value
  const headDelta = hasOwnValue ? activeView!.deltaPct : selected.deltaPct

  return (
    <section className="font-geist rounded-3xl bg-white dark:bg-white/[0.03] border border-[#ECECEE] dark:border-white/[0.06] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 lg:px-6 py-5">
        <h2 className="font-bold text-sm uppercase tracking-widest text-zinc-700 dark:text-white/80">Áttekintés</h2>
        <div className="flex items-center gap-2">
          {filter}
          {/* Desktop: külön CSV gomb (mobilon a header „…" menüjében van) */}
          {csvHref && (
            <a
              href={csvHref}
              className="hidden lg:flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-[#ECECEE] dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-sm font-semibold text-[#8A8A8E] dark:text-white/60 hover:text-zinc-900 dark:hover:text-white"
            >
              <Download className="h-4 w-4" /> CSV
            </a>
          )}
        </div>
      </div>

      {/* Metrika-kártyák: mobil görgethető sor, desktopon rács sparkline-nal.
          A px-2 fent/lent kell, különben a görgetés levágja az aktív kártya keretét. */}
      <div className="flex gap-3 overflow-x-auto px-5 lg:px-6 pt-1.5 pb-3 lg:grid lg:grid-cols-5 lg:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {metrics.map((m) => (
          <MetricTile key={m.id} m={m} active={selected.id === m.id} onClick={() => setSelectedId(m.id)} />
        ))}
      </div>

      {/* Master–detail: bal oldalt a KIVÁLASZTOTT meglévő grafikon (változatlan
          kinézet), jobbra a részlet-választó. Ha nincs meglévő chart, a metrika
          saját trend-area fallback. */}
      <div className="grid lg:grid-cols-3 gap-5 lg:gap-6 p-5 lg:p-6 items-stretch">
        {/* Nagy kártya — a fejléc (címke + érték + változás + Trend + nyíl) MINDIG benn,
            alatta a kiválasztott meglévő chart vagy a trend-area fallback. */}
        <div className="lg:col-span-2 min-w-0 flex flex-col rounded-3xl bg-white dark:bg-white/[0.02] border border-[#ECECEE] dark:border-white/[0.06] p-4 lg:p-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#8A8A8E] dark:text-white/40 truncate">
                {selected.label}{activeView ? ` · ${activeView.label}` : ''}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl lg:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">{headValue}</p>
                {headDelta !== undefined && <DeltaText pct={headDelta} />}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-label="Részletek"
              className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-[#ECECEE] dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 h-64 lg:h-80">
            {showExisting ? (
              <div key={activeView!.id} className="h-full w-full">{detailCharts[activeView!.target!]}</div>
            ) : showSeries ? (
              <div key={activeView!.id} className="h-full"><BigChart id={activeView!.id} color={selected.color} unit="" series={activeView!.series!} dark={dark} /></div>
            ) : (
              <div className="h-full"><BigChart id={selected.id} color={selected.color} unit={selected.unit} series={selected.series} dark={dark} /></div>
            )}
          </div>
        </div>

        {/* Jobb panel — azonos magasságú (items-stretch), a bontás-sorokkal */}
        <div className="rounded-3xl bg-white dark:bg-white/[0.02] border border-[#ECECEE] dark:border-white/[0.06] p-4 lg:p-5 flex flex-col">
          {selected.views.map((v) => (
            <ViewRow
              key={v.id}
              v={v}
              active={activeViewId === v.id}
              onClick={() => toggleView(v.id)}
            />
          ))}
        </div>
      </div>

      {/* Részletek sidebar — a nagy chart nyilára nyílik */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="font-geist w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-950">
          <SheetHeader className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8E] dark:text-white/30 mb-0.5">Részletek</p>
            <SheetTitle className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{selected.label}</SheetTitle>
          </SheetHeader>

          <div className="mb-5 rounded-2xl p-5 border border-[#ECECEE] dark:border-white/[0.08]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8A8A8E] dark:text-white/30 mb-2">Aktuális érték</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{headValue}</p>
              {headDelta !== undefined && <DeltaText pct={headDelta} />}
            </div>
          </div>

          <div className="h-48 mb-5"><BigChart id={selected.id} color={selected.color} unit={selected.unit} series={selected.series} dark={dark} /></div>

          <div className="rounded-2xl border border-[#ECECEE] dark:border-white/[0.06] p-2">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-[#8A8A8E] dark:text-white/30">Bontások</p>
            {selected.views.map((v) => (
              <ViewRow
                key={v.id}
                v={v}
                active={activeViewId === v.id}
                onClick={() => { setActiveViewId(v.id); setSheetOpen(false) }}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  )
}
