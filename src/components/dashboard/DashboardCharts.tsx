'use client'

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DayData, ServiceStat, StaffStat, DowStat } from '@/lib/dashboardStats'
import { formatPrice } from '@/lib/utils'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}e`
  return String(n)
}

interface TrendProps {
  data: DayData[]
}

export function TrendChart({ data }: TrendProps) {
  const [tab, setTab] = useState<'revenue' | 'bookings'>('revenue')

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const val = payload[0].value
    return (
      <div className="bg-zinc-950 text-white text-xs rounded-xl px-3 py-2 shadow-xl">
        <p className="text-zinc-400 mb-0.5">{label}</p>
        <p className="font-black">
          {tab === 'revenue' ? formatPrice(val, 'HUF') : `${val} foglalás`}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Elmúlt 30 nap</p>
          <h3 className="text-lg font-black tracking-tight text-zinc-900">
            {tab === 'revenue' ? 'Bevétel' : 'Foglalások'}
          </h3>
        </div>
        <div className="flex gap-1 bg-zinc-100 rounded-xl p-1">
          <button
            onClick={() => setTab('revenue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'revenue' ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Bevétel
          </button>
          <button
            onClick={() => setTab('bookings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === 'bookings' ? 'bg-zinc-950 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Foglalások
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#09090b" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#09090b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#a1a1aa' }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#a1a1aa' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={tab === 'revenue' ? fmt : undefined}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#09090b', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <Area
            type="monotone"
            dataKey={tab}
            stroke="#09090b"
            strokeWidth={2}
            fill="url(#grad)"
            dot={false}
            activeDot={{ r: 4, fill: '#09090b', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DowChart({ data }: { data: DowStat[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Elmúlt 30 nap</p>
      <h3 className="text-lg font-black tracking-tight text-zinc-900 mb-6">Heti eloszlás</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: -28, bottom: 0 }} barSize={24}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: '#f4f4f5', radius: 6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-zinc-950 text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                  <p className="font-black">{payload[0].value} foglalás</p>
                </div>
              )
            }}
          />
          <Bar dataKey="bookings" fill="#09090b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ServiceChart({ data }: { data: ServiceStat[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.revenue))
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Elmúlt 30 nap</p>
      <h3 className="text-lg font-black tracking-tight text-zinc-900 mb-5">Szolgáltatások</h3>
      <div className="space-y-3">
        {data.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-800 truncate pr-2">{s.name}</span>
              <span className="text-xs font-black text-zinc-900 shrink-0">{formatPrice(s.revenue, 'HUF')}</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-950 rounded-full transition-all"
                style={{ width: max > 0 ? `${(s.revenue / max) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{s.bookings} foglalás</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StaffChart({ data }: { data: StaffStat[] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.bookings))
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">Elmúlt 30 nap</p>
      <h3 className="text-lg font-black tracking-tight text-zinc-900 mb-5">Munkatársak</h3>
      <div className="space-y-3">
        {data.map((s, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-800 truncate pr-2">{s.name}</span>
              <span className="text-xs font-black text-zinc-900 shrink-0">{s.bookings} foglalás</span>
            </div>
            <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-zinc-950 rounded-full transition-all"
                style={{ width: max > 0 ? `${(s.bookings / max) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{formatPrice(s.revenue, 'HUF')} bevétel</p>
          </div>
        ))}
      </div>
    </div>
  )
}
