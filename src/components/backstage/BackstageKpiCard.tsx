'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

export function BackstageKpiCard({ label, value, sub, trend, title, description, color = '#1D1C19' }: Props) {
  const [open, setOpen] = useState(false)
  const hasTrend = trend.length > 1

  return (
    <>
      {/* Letisztult KPI-kártya az étterem/salon app mintájára: a kis kártyán NINCS grafikon
          (csak szám + felirat), a grafikon a kattintásra nyíló sheetben jelenik meg. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full rounded-[20px] border border-line bg-white p-3.5 text-left shadow-dav-card transition-colors hover:bg-[#FCFAF1] sm:rounded-[24px] sm:p-5"
      >
        <div className="mb-1 flex items-start justify-between">
          <p className="text-[12px] font-medium text-ink-soft sm:text-[13px]">{label}</p>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft transition-colors group-hover:text-ink" strokeWidth={1.8} />
        </div>
        <p className="mb-1.5 truncate text-[26px] font-light leading-none tracking-[-0.02em] text-ink sm:text-[38px]">{value}</p>
        <p className="text-[12px] font-medium text-ink-soft">{sub}</p>
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full overflow-y-auto bg-white font-onest sm:max-w-xl lg:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-ink">{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="rounded-[24px] border border-line bg-[#FCFAF1] p-5">
              <p className="mb-1 text-[13px] font-medium text-ink-soft">{label}</p>
              <p className="text-[38px] font-light leading-none tracking-[-0.02em] text-ink">{value}</p>
              <p className="mt-2 text-[13.5px] font-medium text-ink-soft">{sub}</p>
            </div>
            {description && <p className="text-[13.5px] leading-relaxed text-ink-soft">{description}</p>}
            {hasTrend && (
              <div>
                <p className="mb-3 text-[13px] font-medium text-ink-soft">Alakulás (30 nap)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,110,70,.14)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#86826F' }} tickLine={false} axisLine={false} interval={6} />
                    <YAxis tick={{ fontSize: 10, fill: '#86826F' }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: 'rgba(120,110,70,.25)', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-[12px] bg-ink-dark px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                            <p className="text-white/50">{label}</p>
                            <p>{payload[0].value}</p>
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
