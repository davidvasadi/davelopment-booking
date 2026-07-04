'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'

/** Lazán tipizált recharts-tooltip payload (verzió-független). */
type TipEntry = { dataKey?: string | number; name?: string; value?: number; payload?: Record<string, unknown> }
type TipProps = { active?: boolean; payload?: TipEntry[]; label?: string | number }

const C = { ink: '#1D1C19', accent: '#F1CE45', track: '#33322e' }

export type SeriesPoint = { label: string; value: number }

/** Sötét pill-tooltip a vonaldiagramhoz (aktuális + előző). Azonos a Statisztika stílusával. */
function LineTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  const cur = payload.find((p) => p.dataKey === 'cur')
  const prev = payload.find((p) => p.dataKey === 'prev')
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card">
      <p className="mb-1 text-white/55">{label}</p>
      {cur?.value !== undefined && (
        <p className="flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
          Aktuális {Math.round(cur.value)}
        </p>
      )}
      {prev?.value !== undefined && (
        <p className="mt-0.5 flex items-center gap-1.5 text-white/70">
          <span className="h-2 w-2 rounded-full" style={{ background: '#8a8880' }} />
          Előző {Math.round(prev.value)}
        </p>
      )}
    </div>
  )
}

/**
 * „Foglalások alakulása" trend-chart RECHARTS-szal (betöltés-animáció + hover) — a Statisztika
 * `HiringChart`-jával egyező vizuál: gold folytonos (aktuális) + fekete pontozott (előző).
 */
export function TrendLineChart({ series, deltaPct }: { series: SeriesPoint[]; deltaPct?: number }) {
  if (series.length < 2) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-soft">Nincs elég adat a diagramhoz.</div>
  }
  const hasPrev = deltaPct !== undefined && Number.isFinite(deltaPct)
  const prevScale = hasPrev ? 1 / (1 + (deltaPct as number) / 100) : 1
  const data = series.map((p) => ({
    label: p.label,
    cur: p.value,
    ...(hasPrev ? { prev: Math.round(p.value * prevScale * 10) / 10 } : {}),
  }))
  const xInterval = Math.max(0, Math.round(data.length / 7) - 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#efebdf" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} interval={xInterval} minTickGap={12} />
        <YAxis width={30} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} allowDecimals={false} />
        <Tooltip content={<LineTip />} cursor={{ stroke: '#cdc9bd', strokeWidth: 1, strokeDasharray: '3 4' }} />
        {hasPrev && (
          <Line type="monotone" dataKey="prev" stroke={C.ink} strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive animationDuration={800} />
        )}
        <Line type="monotone" dataKey="cur" stroke={C.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: C.accent, stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Fehér/sötét pill-tooltip a donuthoz. */
function DonutTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const pp = p.payload as { color?: string; label?: string } | undefined
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card ring-1 ring-white/15">
      <p className="flex items-center gap-1.5 font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: pp?.color ?? C.accent }} />
        {pp?.label ?? p.name}
      </p>
      {typeof p.value === 'number' && <p className="mt-0.5 text-white/70">{Math.round(p.value)}%</p>}
    </div>
  )
}

/**
 * „Kihasználtság" telítettség-gyűrű RECHARTS-szal (animál + hover) — a Statisztika
 * `CompositionDonut`-jával egyező: gold ív + sötét track, közép a % / label.
 */
export function OccupancyDonut({ pct, centerLabel }: { pct: number; centerLabel: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const rest = 100 - clamped
  const pieData = [
    { label: 'Kihasznált', pct: clamped, color: C.accent },
    { label: 'Szabad', pct: rest, color: C.track },
  ]
  return (
    <div className="relative h-[150px] w-[170px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="pct" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} cornerRadius={6} stroke="none" isAnimationActive animationDuration={800}>
            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink">{clamped}%</div>
        <div className="mt-1 text-xs font-medium text-ink-soft">{centerLabel}</div>
      </div>
    </div>
  )
}

export type DonutSeg = { label: string; value: number; color: string }

/** Státusz-tooltip (címke + darabszám). */
function StatusTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const pp = p.payload as { color?: string; label?: string } | undefined
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card ring-1 ring-white/15">
      <p className="flex items-center gap-1.5 font-semibold">
        <span className="h-2 w-2 rounded-full" style={{ background: pp?.color ?? C.accent }} />
        {pp?.label ?? p.name}
      </p>
      {typeof p.value === 'number' && <p className="mt-0.5 text-white/70">{Math.round(p.value)} foglalás</p>}
    </div>
  )
}

/**
 * Mai foglalások státusz-összetétele RECHARTS donuttal (animál + hover) — több szegmens
 * (megerősített / függő / lemondva), közép a fő szám + címke.
 */
export function StatusDonut({ segments, centerValue, centerLabel }: { segments: DonutSeg[]; centerValue: string; centerLabel: string }) {
  const data = segments.filter((s) => s.value > 0)
  return (
    <div className="relative h-[170px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data.length ? data : [{ label: 'Nincs', value: 1, color: C.track }]} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={52} outerRadius={74} startAngle={90} endAngle={-270} cornerRadius={6} paddingAngle={data.length > 1 ? 3 : 0} stroke="none" isAnimationActive animationDuration={800}>
            {(data.length ? data : [{ color: C.track }]).map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<StatusTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="text-[34px] font-light leading-none tracking-[-0.02em] text-ink">{centerValue}</div>
        <div className="mt-1 text-xs font-medium text-ink-soft">{centerLabel}</div>
      </div>
    </div>
  )
}

export type WeekBar = { label: string; value: number; peak?: boolean }

/** Oszlop-tooltip (nap + vendégszám). */
function BarTip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div className="rounded-[12px] bg-[#1D1C19] px-3 py-2 text-xs text-white shadow-dav-card">
      <p className="mb-0.5 text-white/55">{label}</p>
      {typeof v === 'number' && (
        <p className="flex items-center gap-1.5 font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: C.accent }} />
          {Math.round(v)} vendég
        </p>
      )}
    </div>
  )
}

/**
 * „Vendégek a héten" napi oszlopdiagram RECHARTS-szal (betöltés-animáció + hover) — a csúcsnap
 * gold, a többi tompa; a Statisztika oszlop-ritmusával egyező.
 */
export function WeekBarChart({ bars }: { bars: WeekBar[] }) {
  if (!bars.length) {
    return <div className="flex h-full items-center justify-center text-sm text-ink-soft">Nincs adat a diagramhoz.</div>
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bars} margin={{ top: 8, right: 6, left: -18, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#efebdf" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} />
        <YAxis width={30} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} allowDecimals={false} />
        <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(200,195,180,.16)' }} />
        <Bar dataKey="value" radius={[7, 7, 7, 7]} isAnimationActive animationDuration={850} animationEasing="ease-out">
          {bars.map((b, i) => <Cell key={i} fill={b.peak ? C.accent : '#d9d4c5'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
