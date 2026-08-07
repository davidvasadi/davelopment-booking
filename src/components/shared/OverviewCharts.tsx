'use client'

import { useEffect, useRef, useState } from 'react'
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
    <div className="relative h-[168px] w-[188px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="pct" nameKey="label" cx="50%" cy="50%" innerRadius={56} outerRadius={78} startAngle={90} endAngle={-270} cornerRadius={6} stroke="none" isAnimationActive animationDuration={800}>
            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip content={<DonutTip />} wrapperStyle={{ zIndex: 60, opacity: 1 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink">{clamped}%</div>
        <div className="mt-1 text-[11px] font-medium leading-tight text-ink-soft">{centerLabel}</div>
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

/**
 * A mini oszlopdiagram alatti nap-feliratok a bento-kártyán. ResizeObserverrel figyeli SAJÁT
 * szélességét: ha a kártya annyira összeszűkül, hogy a 3-betűs rövidítés (Hét/Ked/Sze…) már
 * nem férne el kényelmesen, a kezdőbetűre vált (H/K/Sz…); egyébként marad a teljes rövidítés.
 */
export function WeekDayLabels({ bars }: { bars: { label: string }[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 180))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className="mt-2 flex justify-between gap-1.5">
      {bars.map((b, i) => (
        <span key={i} className="flex-1 text-center text-[10px] font-medium text-ink-soft">
          {compact ? b.label[0] : b.label}
        </span>
      ))}
    </div>
  )
}

/**
 * A bento-kártya mini oszlop-sávja (pont a tetején hover-tooltippal + rúd + pont alul) — a
 * "Foglalások a héten" (szalon) / "Köv. 7 nap" (étterem) kártya közös, EGYETLEN implementációja,
 * hogy a két oldal ne csússzon szét (pl. csak az egyiken volt eddig hover-tooltip). `unit` a
 * tooltip mértékegysége ("fő" / "foglalás").
 */
export function WeekMiniBars({ bars, weekMax, unit }: { bars: WeekBar[]; weekMax: number; unit: string }) {
  return (
    <div className="relative flex items-end justify-between gap-1.5" style={{ minHeight: '118px' }}>
      <div className="pointer-events-none absolute inset-x-0 bottom-[3px] border-t border-dashed border-[#d9d4c5]" />
      {bars.map((b, i) => (
        <div key={i} className="group relative z-10 flex flex-1 cursor-default flex-col items-center justify-end">
          {/* Tooltip */}
          <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <div className="rounded-[8px] bg-ink px-2.5 py-1.5 text-center shadow-md">
              <div className="text-[11px] font-semibold leading-none text-white whitespace-nowrap">{b.value} {unit}</div>
            </div>
            <div className="mx-auto h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-ink" />
          </div>
          {b.peak ? <span className="mb-1.5 rounded-[8px] bg-gold px-2 py-0.5 text-[10px] font-bold text-ink-dark">{b.value}</span> : null}
          <div className="w-[6px] rounded-full" style={{ height: `${Math.max(8, (b.value / weekMax) * 92)}px`, background: b.peak ? '#F1CE45' : '#1D1C19' }} />
          <span className="mt-1.5 h-[6px] w-[6px] rounded-full" style={{ background: b.peak ? '#F1CE45' : '#c9c3b4' }} />
        </div>
      ))}
    </div>
  )
}
