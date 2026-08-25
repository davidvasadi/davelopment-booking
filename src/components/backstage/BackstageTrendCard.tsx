'use client'

import { AreaChart, Area, LineChart, Line, XAxis, ResponsiveContainer, Tooltip, YAxis, CartesianGrid } from 'recharts'
import { CARD } from '@/components/dashboard/overview-ui'
import type { TrendPoint } from '@/lib/backstageMetrics'

/**
 * Trend-kártya a backstage Áttekintőhöz — a dashboard „Vendégek a héten" bento-kártya
 * mintájára: keret nélküli üveg-rail (CARD), 17px medium cím, nagy font-light szám, alul
 * grafikon. Kicsi kártyán kitöltött area-sparkline; `line`-nal tiszta vonaldiagram
 * (tengelyekkel, a széles kártyához). Kliens-komponens; csak plain adatot kap.
 */
export function BackstageTrendCard({ title, value, caption, trend, color = '#1D1C19', currency, wide, line, prevValues }: {
  title: string
  value: string
  caption: string
  trend: TrendPoint[]
  color?: string
  currency?: boolean
  wide?: boolean
  /** Tiszta vonaldiagram tengelyekkel (kitöltés nélkül) — a széles kártyához. */
  line?: boolean
  /** Az előző azonos hosszúságú időszak napi értékei, nap-pozíció szerint illesztve a `trend`-hez
   *  — ha meg van adva, egy pontozott ink-színű összehasonlító vonal is megjelenik (csak `line` módban). */
  prevValues?: number[]
}) {
  const gradId = `bstrend-${title.replace(/\W/g, '')}`
  const fmt = (v: number) => (currency ? `${v.toLocaleString('hu-HU')} Ft` : v.toLocaleString('hu-HU'))
  const hasPrev = !!prevValues && prevValues.length === trend.length
  const chartData = hasPrev ? trend.map((t, i) => ({ ...t, prev: prevValues![i] })) : trend
  const tip = (
    <Tooltip
      cursor={{ stroke: 'rgba(120,110,70,.25)', strokeWidth: 1, strokeDasharray: '4 4' }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null
        const cur = payload.find(p => p.dataKey === 'value')
        const prev = payload.find(p => p.dataKey === 'prev')
        return (
          <div className="rounded-[12px] bg-ink-dark px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
            <p className="text-white/50">{label}</p>
            {cur && <p>{fmt(Number(cur.value))}</p>}
            {prev && <p className="text-white/50">Előző hónap: {fmt(Number(prev.value))}</p>}
          </div>
        )
      }}
    />
  )
  return (
    <div className={`${CARD} flex min-w-0 flex-col p-[22px]`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[17px] font-medium text-ink">{title}</p>
        {hasPrev && (
          <div className="flex shrink-0 items-center gap-3 text-[11px] text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-[2px] w-3 rounded-full" style={{ background: color }} />Most</span>
            <span className="flex items-center gap-1.5"><span className="h-[2px] w-3 rounded-full opacity-40" style={{ background: '#1D1C19', backgroundImage: 'repeating-linear-gradient(90deg, #1D1C19 0 3px, transparent 3px 6px)' }} />Előző hónap</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink">{value}</span>
        <span className="text-[11.5px] leading-[1.15] text-ink-soft">{caption}</span>
      </div>
      {/* Fix magasság, `flex-1` NÉLKÜL: flex-kontextusban a flex-1 mobilon 0-ra eshet, MIELŐTT a
          Recharts ResponsiveContainer megméri — az örökre láthatatlanná teszi a grafikont
          (ugyanez a hiba-osztály + fix, mint AnalyticsOverview.tsx-ben, ami ott bevált). */}
      <div className={`mt-4 w-full min-w-0 ${wide ? 'h-[150px]' : 'h-[190px]'}`}>
        {trend.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%" debounce={50} initialDimension={{ width: 300, height: wide ? 150 : 190 }}>
            {line ? (
              <LineChart data={chartData} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#efebdf" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} interval={6} />
                <YAxis width={40} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} tickFormatter={(v: number) => v.toLocaleString('hu-HU')} />
                {tip}
                {hasPrev && (
                  <Line type="monotone" dataKey="prev" stroke="#1D1C19" strokeOpacity={0.4} strokeWidth={2} strokeDasharray="2 6" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive animationDuration={800} />
                )}
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={900} />
              </LineChart>
            ) : (
              <AreaChart data={trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* Halvány vízszintes rács + minimál Y-tengely (2-3 szám) + alsó X-tengely (első/
                    utolsó nap) — üresen, viszonyítási pont nélkül a sparkline semmitmondónak tűnt. */}
                <CartesianGrid horizontal vertical={false} stroke="#efebdf" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fontSize: 9.5, fill: '#B5B1A2', fontWeight: 500 }} />
                <YAxis width={22} tickLine={false} axisLine={false} tickCount={3} allowDecimals={false} tick={{ fontSize: 9.5, fill: '#B5B1A2', fontWeight: 500 }} domain={[0, 'dataMax']} />
                {tip}
                {/* monotone, NEM natural: a natural köbös spline túllő a pontok között, ami a
                    nulla körül hamis, kis hullámokat rajzolt oda, ahol valójában nincs adat. */}
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.2} strokeLinejoin="round" fill={`url(#${gradId})`} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 4.5, fill: color, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-end">
            <div className="h-px w-full bg-line-strong" />
          </div>
        )}
      </div>
    </div>
  )
}
