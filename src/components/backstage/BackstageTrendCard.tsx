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
export function BackstageTrendCard({ title, value, caption, trend, color = '#1D1C19', currency, wide, line }: {
  title: string
  value: string
  caption: string
  trend: TrendPoint[]
  color?: string
  currency?: boolean
  wide?: boolean
  /** Tiszta vonaldiagram tengelyekkel (kitöltés nélkül) — a széles kártyához. */
  line?: boolean
}) {
  const gradId = `bstrend-${title.replace(/\W/g, '')}`
  const fmt = (v: number) => (currency ? `${v.toLocaleString('hu-HU')} Ft` : v.toLocaleString('hu-HU'))
  const tip = (
    <Tooltip
      cursor={{ stroke: 'rgba(120,110,70,.25)', strokeWidth: 1, strokeDasharray: '4 4' }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null
        return (
          <div className="rounded-[12px] bg-ink-dark px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
            <p className="text-white/50">{label}</p>
            <p>{fmt(Number(payload[0].value))}</p>
          </div>
        )
      }}
    />
  )
  return (
    <div className={`${CARD} flex flex-col p-[22px]`}>
      <p className="text-[17px] font-medium text-ink">{title}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[32px] font-light leading-none tracking-[-0.02em] text-ink">{value}</span>
        <span className="text-[11.5px] leading-[1.15] text-ink-soft">{caption}</span>
      </div>
      <div className={`mt-4 w-full min-w-0 ${wide ? 'h-[150px]' : 'h-[80px] flex-1'}`}>
        {trend.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            {line ? (
              <LineChart data={trend} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#efebdf" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} interval={6} />
                <YAxis width={34} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#A8A496', fontWeight: 500 }} />
                {tip}
                <Line type="natural" dataKey="value" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: color, stroke: '#fff', strokeWidth: 2 }} isAnimationActive animationDuration={900} />
              </LineChart>
            ) : (
              <AreaChart data={trend} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={['dataMin', 'dataMax']} />
                {tip}
                <Area type="natural" dataKey="value" stroke={color} strokeWidth={2.2} strokeLinejoin="round" fill={`url(#${gradId})`} dot={false} />
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
