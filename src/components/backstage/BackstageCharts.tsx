'use client'

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import type { TrendPoint } from '@/lib/backstageMetrics'

const C = { grid: '#efebdf', tick: '#A8A496', accent: '#F1CE45', ink: '#1D1C19' }

/**
 * Megoszlás-donut (a Statisztika „Foglalási arány" mintájára, világos kártyán). A legenda
 * alapból %-ot mutat; ha `unit` (pl. „ Ft") meg van adva, a nyers értéket az egységgel.
 * `vertical`: nagy donut FELÜL középen, legenda ALATTA (nem oldalt) — tágasabb elrendezés.
 */
export function StatusDonut({ data, unit, vertical }: { data: { label: string; value: number; color: string }[]; unit?: string; vertical?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const segs = data.filter(d => d.value > 0)
  const fmtVal = (v: number) => unit ? `${v.toLocaleString('hu-HU')}${unit}` : `${total ? Math.round((v / total) * 100) : 0}%`

  const donut = (size: number, inner: number, outer: number, numSize: string) => (
    <div className="relative shrink-0" style={{ height: size, width: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={segs.length ? segs : [{ label: '—', value: 1, color: '#EAE5D6' }]} dataKey="value" nameKey="label"
            cx="50%" cy="50%" innerRadius={inner} outerRadius={outer} startAngle={90} endAngle={-270} paddingAngle={2} cornerRadius={6} stroke="none" isAnimationActive animationDuration={800}>
            {(segs.length ? segs : [{ color: '#EAE5D6' }]).map((s, i) => <Cell key={i} fill={s.color} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p = payload[0].payload as { label: string; value: number }
            return <div className="rounded-[10px] bg-ink-dark px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg">{p.label}: {fmtVal(p.value)}</div>
          }} />
        </PieChart>
      </ResponsiveContainer>
      {/* Középen az összeg */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${numSize} font-light leading-none tracking-[-0.02em] text-ink`}>{unit ? `${total.toLocaleString('hu-HU')}` : total}</span>
        <span className="mt-0.5 text-[9px] text-ink-soft">{unit ? unit.trim() : 'összesen'}</span>
      </div>
    </div>
  )

  const legend = (
    <div className={`flex min-w-0 flex-col gap-1.5 ${vertical ? 'w-full' : 'flex-1'}`}>
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
          <span className="truncate text-[12px] text-ink-soft">{d.label}</span>
          <span className="ml-auto text-[12px] font-semibold tabular-nums text-ink">{fmtVal(d.value)}</span>
        </div>
      ))}
    </div>
  )

  // `vertical`: nagyobb donut FELÜL, legenda a KONTÉNER ALJÁRA tolva (justify-between).
  if (vertical) {
    return (
      <div className="flex h-full flex-col items-center justify-between gap-3">
        {donut(128, 40, 62, 'text-[20px]')}
        {legend}
      </div>
    )
  }
  return (
    <div className="flex h-full items-center gap-4">
      {donut(110, 32, 52, 'text-[19px]')}
      {legend}
    </div>
  )
}

/** Trend-vonaldiagram (a Statisztika trend-chart mintájára, gold vonal). `unit` a tooltiphez (alap: „ Ft"). */
export function MrrLineChart({ trend, unit = ' Ft' }: { trend: TrendPoint[]; unit?: string }) {
  const isCurrency = unit.trim() === 'Ft'
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={trend} margin={{ top: 8, right: 6, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.tick, fontWeight: 500 }} interval={6} />
        <YAxis width={38} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: C.tick, fontWeight: 500 }} tickFormatter={(v: number) => isCurrency && v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
        <Tooltip
          cursor={{ stroke: '#cdc9bd', strokeWidth: 1, strokeDasharray: '3 4' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return <div className="rounded-[10px] bg-ink-dark px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg"><p className="text-white/50">{label}</p><p>{Number(payload[0].value).toLocaleString('hu-HU')}{unit}</p></div>
          }}
        />
        <Line type="natural" dataKey="value" stroke={C.accent} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: C.accent, stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  )
}
