'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useTheme } from 'next-themes'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/** Egy napi pont az idősorban: címke + érték (kumulált vagy napi). */
export type TrendPoint = { label: string; value: number }

interface Props {
  /** Kis felirat a kártya tetején (pl. „Összes hely"). */
  label: string
  /** A nagy szám (már formázva, pl. „12" vagy „14 800 Ft"). */
  value: string
  /** Alsó kiegészítő sor (pl. „8 aktív · 5 szalon / 3 étterem"). */
  sub: string
  /** 30 napos idősor a sparkline-hoz + a sheet nagy chartjához. */
  trend: TrendPoint[]
  /** A sheet fejléc-címe és magyarázó szövege. */
  title: string
  description?: string
  /** A grafikon színe (hex), kártyánként eltérő lehet. Alap: kék. */
  color?: string
}

export function BackstageKpiCard({ label, value, sub, trend, title, description, color = '#0099ff' }: Props) {
  const [open, setOpen] = useState(false)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  const hasTrend = trend.length > 1

  return (
    <>
      {/* Letisztult KPI-kártya az étterem/salon app mintájára: a kis kártyán NINCS grafikon
          (csak szám + felirat), a grafikon a kattintásra nyíló sheetben jelenik meg. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group rounded-2xl p-5 lg:p-7 bg-white shadow-sm border border-zinc-100 dark:bg-white/[0.04] dark:border-white/[0.08] dark:shadow-none hover:border-zinc-300 dark:hover:border-white/[0.16] transition-colors text-left w-full"
      >
        <div className="flex items-start justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30">{label}</p>
          <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 dark:text-white/30 group-hover:text-zinc-700 dark:group-hover:text-white/60 transition-colors shrink-0 mt-0.5" />
        </div>
        <p className="text-xl lg:text-4xl font-black tracking-tight leading-none mb-2 text-zinc-900 dark:text-white truncate">{value}</p>
        <p className="text-xs text-zinc-500 dark:text-white/40">{sub}</p>
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-950">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl p-5 bg-zinc-50 dark:bg-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{label}</p>
              <p className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</p>
              <p className="text-sm text-zinc-500 dark:text-white/40 mt-2">{sub}</p>
            </div>
            {description && <p className="text-sm text-zinc-500 dark:text-white/50">{description}</p>}
            {hasTrend && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-3">Alakulás (30 nap)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: dark ? 'rgba(255,255,255,0.25)' : '#94a3b8' }} tickLine={false} axisLine={false} interval={6} />
                    <YAxis tick={{ fontSize: 10, fill: dark ? 'rgba(255,255,255,0.25)' : '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="bg-white dark:bg-black border border-zinc-200 dark:border-white/[0.1] text-zinc-900 dark:text-white text-xs rounded-xl px-3 py-2 shadow-xl">
                            <p className="text-zinc-400 dark:text-white/40 mb-0.5">{label}</p>
                            <p className="font-black">{payload[0].value}</p>
                          </div>
                        )
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
