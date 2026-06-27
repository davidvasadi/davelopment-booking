'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DayData, ServiceStat, StaffStat, DowStat, HourStat } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'
import { ArrowUpRight } from 'lucide-react'
import { KpiDetailsSheet } from './KpiDetailsSheet'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}e`
  return String(n)
}

function useIsDark() {
  const { resolvedTheme } = useTheme()
  return resolvedTheme === 'dark'
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
      className="flex items-center gap-1 text-xs font-semibold text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 transition-colors shrink-0"
    >
      <span className="hidden sm:inline">Részletek</span>
      <ArrowUpRight className="h-3.5 w-3.5" />
    </button>
  )
}

function xAxisInterval(days: number) {
  if (days <= 14) return 1
  if (days <= 30) return 4
  if (days <= 90) return 13
  if (days <= 180) return 26
  return 60
}

export function TrendChart({ data, period = 30 }: { data: DayData[]; period?: number }) {
  const [tab, setTab] = useState<'revenue' | 'bookings'>('revenue')
  const [sheetOpen, setSheetOpen] = useState(false)
  const dark = useIsDark()

  const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickColor = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'
  const cursorColor = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
        <p className="text-zinc-400 dark:text-white/40 mb-0.5">{label}</p>
        <p className="font-black">
          {tab === 'revenue' ? formatPrice(payload[0].value, 'HUF') : `${payload[0].value} foglalás`}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
            {tab === 'revenue' ? 'Bevétel' : 'Foglalások'}
          </h3>
        </div>
        <div className="flex items-center gap-3">
        <DetailsButton onClick={() => setSheetOpen(true)} />
        <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1">
          <button
            onClick={() => setTab('revenue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'revenue' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'}`}
          >
            Bevétel
          </button>
          <button
            onClick={() => setTab('bookings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'bookings' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'}`}
          >
            Foglalások
          </button>
        </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0099ff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0099ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} interval={xAxisInterval(period)} />
          <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={tab === 'revenue' ? fmt : undefined} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: cursorColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey={tab} stroke="#0099ff" strokeWidth={2} fill="url(#grad)" dot={false} activeDot={{ r: 4, fill: '#0099ff', strokeWidth: 0 }} />
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
  const dark = useIsDark()

  const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickColor = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'
  const cursorColor = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
        <p className="text-zinc-400 dark:text-white/40 mb-0.5">{label}</p>
        <p className="font-black">
          {tab === 'revenue' ? `${payload[0].value} vendég` : `${payload[0].value} foglalás`}
        </p>
      </div>
    )
  }

  return (
    <div className={embedded ? 'h-full' : 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
              {tab === 'revenue' ? 'Vendégszám' : 'Foglalások'}
            </h3>
          </div>
          <div className="flex gap-1 bg-zinc-100 dark:bg-white/[0.06] rounded-xl p-1">
            <button
              onClick={() => setTab('bookings')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'bookings' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'}`}
            >
              Foglalások
            </button>
            <button
              onClick={() => setTab('revenue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'revenue' ? 'bg-zinc-900 text-white dark:bg-white dark:text-black shadow-sm' : 'text-zinc-500 hover:text-zinc-900 dark:text-white/40 dark:hover:text-white/80'}`}
            >
              Vendégszám
            </button>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={embedded ? '100%' : 220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad-res" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0099ff" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0099ff" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} interval={xAxisInterval(period)} />
          <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: cursorColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area type="monotone" dataKey={tab} stroke="#0099ff" strokeWidth={2} fill="url(#grad-res)" dot={false} activeDot={{ r: 4, fill: '#0099ff', strokeWidth: 0 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DowChart({ data, period = 30, rawDays = [], moneyless = false, embedded = false }: { data: DowStat[]; period?: number; rawDays?: DayData[]; moneyless?: boolean; embedded?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const dark = useIsDark()
  const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickColor = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'

  return (
    <div className={embedded ? 'h-full' : 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Heti eloszlás</h3>
          </div>
          <DetailsButton onClick={() => setSheetOpen(true)} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={embedded ? '100%' : 160}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={24}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                  <p className="font-black">{payload[0].value} foglalás</p>
                </div>
              )
            }}
          />
          <Bar dataKey="bookings" fill="#0099ff" radius={[6, 6, 0, 0]} opacity={0.8} />
        </BarChart>
      </ResponsiveContainer>
      <KpiDetailsSheet kind="dow" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={rawDays} moneyless={moneyless} />
    </div>
  )
}

export function HourChart({ data, period = 30, rawDays = [], hourlyByDate, moneyless = false, embedded = false }: { data: HourStat[]; period?: number; rawDays?: DayData[]; hourlyByDate?: Record<string, number[]>; moneyless?: boolean; embedded?: boolean }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const dark = useIsDark()
  const hasData = data.some(d => d.bookings > 0)
  if (!hasData) return null

  // Csak a tényleges forgalmat tartalmazó óratartományt mutatjuk (első–utolsó foglalt óra),
  // így a hajnali nyitvatartás is látszik, de nem tölti a tengelyt üres órák tucatja.
  const first = data.findIndex(d => d.bookings > 0)
  const last = data.length - 1 - [...data].reverse().findIndex(d => d.bookings > 0)
  const visible = data.slice(first, last + 1)

  const gridColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'
  const tickColor = dark ? 'rgba(255,255,255,0.25)' : '#94a3b8'

  return (
    <div className={embedded ? 'h-full' : 'bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6'}>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
            <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Óránkénti forgalom</h3>
          </div>
          <DetailsButton onClick={() => setSheetOpen(true)} />
        </div>
      )}
      <ResponsiveContainer width="100%" height={embedded ? '100%' : 160}>
        <BarChart data={visible} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={16}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: tickColor }} tickLine={false} axisLine={false} interval={visible.length > 12 ? 1 : 0} />
          <YAxis tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', radius: 6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                  <p className="text-zinc-400 dark:text-white/40 mb-0.5">{label}</p>
                  <p className="font-black">{payload[0].value} foglalás</p>
                </div>
              )
            }}
          />
          <Bar dataKey="bookings" fill="#a855f7" radius={[4, 4, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
      <KpiDetailsSheet kind="hour" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} rawDays={rawDays} hourlyByDate={hourlyByDate} moneyless={moneyless} />
    </div>
  )
}

export function ServiceChart({ data, period = 30 }: { data: ServiceStat[]; period?: number }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.revenue))
  return (
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Szolgáltatások</h3>
        </div>
        <DetailsButton onClick={() => setSheetOpen(true)} />
      </div>
      <div className="space-y-3">
        {data.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-white/70 truncate pr-2">{s.name}</span>
              <span className="text-xs font-black text-zinc-900 dark:text-white shrink-0">{formatPrice(s.revenue, 'HUF')}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: max > 0 ? `${(s.revenue / max) * 100}%` : '0%', background: '#0099ff' }} />
            </div>
            <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">{s.bookings} foglalás</p>
          </div>
        ))}
      </div>
      <KpiDetailsSheet kind="service" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} />
    </div>
  )
}

export function StaffChart({ data, period = 30 }: { data: StaffStat[]; period?: number }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.bookings))
  return (
    <div className="bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-semibold text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Elmúlt {periodLabel(period)}</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Munkatársak</h3>
        </div>
        <DetailsButton onClick={() => setSheetOpen(true)} />
      </div>
      <div className="space-y-3">
        {data.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-700 dark:text-white/70 truncate pr-2">{s.name}</span>
              <span className="text-xs font-black text-zinc-900 dark:text-white shrink-0">{s.bookings} foglalás</span>
            </div>
            <div className="h-1.5 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: max > 0 ? `${(s.bookings / max) * 100}%` : '0%', background: '#00bb88' }} />
            </div>
            <p className="text-xs text-zinc-400 dark:text-white/30 mt-0.5">{formatPrice(s.revenue, 'HUF')} bevétel</p>
          </div>
        ))}
      </div>
      <KpiDetailsSheet kind="staff" open={sheetOpen} onClose={() => setSheetOpen(false)} period={period} data={data} />
    </div>
  )
}
