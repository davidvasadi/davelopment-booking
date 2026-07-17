'use client'

import { useState } from 'react'
import { ArrowUpRight, CreditCard, Users, Building2, CalendarCheck, TrendingUp, type LucideIcon } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

/** Egy napi pont az idősorban: címke + érték (kumulált vagy napi). */
export type TrendPoint = { label: string; value: number }

/**
 * Ikon-kulcs → komponens map. FONTOS: a lucide-ikonok maguk függvények, ezért a szerver-
 * komponens NEM adhatja át őket propként a kliensnek — csak string-kulcsot küldünk, azt
 * itt a kliensben oldjuk fel.
 */
export type KpiIconKey = 'mrr' | 'accounts' | 'places' | 'bookings' | 'revenue'
const ICONS: Record<KpiIconKey, LucideIcon> = {
  mrr: CreditCard, accounts: Users, places: Building2, bookings: CalendarCheck, revenue: TrendingUp,
}

interface Props {
  /** Kis felirat a kártya tetején (pl. „Havi bevétel (MRR)"). */
  label: string
  /** A nagy szám (már formázva, pl. „12" vagy „148 000 Ft"). */
  value: string
  /** Alsó kiegészítő sor (pl. „8 aktív · 5 szalon / 3 étterem"). */
  sub: string
  /** 30 napos idősor a sparkline-hoz + a sheet nagy chartjához. */
  trend: TrendPoint[]
  /** A sheet fejléc-címe és magyarázó szövege. */
  title: string
  description?: string
  /** A grafikon színe (hex), kártyánként eltérő lehet. Alap: tinta. */
  color?: string
  /** Opcionális bal-felső ikon-badge (string-kulcs, nem komponens — l. ICONS). */
  icon?: KpiIconKey
  /** A chart Y-értékeit forintként formázza a tooltipben (MRR-kártyához). */
  currency?: boolean
}

function fmt(v: number, currency?: boolean): string {
  return currency ? `${v.toLocaleString('hu-HU')} Ft` : v.toLocaleString('hu-HU')
}

export function BackstageKpiCard({ label, value, sub, trend, title, description, color = '#1D1C19', icon, currency }: Props) {
  const [open, setOpen] = useState(false)
  const hasTrend = trend.length > 1
  const Icon = icon ? ICONS[icon] : null

  // Mini sparkline a kártyán (üveges háttéren) — a részletes chart a sheetben.
  const spark = trend.length > 1 ? (
    <div className="pointer-events-none mt-3 h-9 w-full opacity-90">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group dav-hover-lift w-full rounded-[20px] p-4 text-left dav-card-glass sm:rounded-[24px] sm:p-5"
      >
        <div className="mb-3 flex items-start justify-between">
          <span className="flex items-center gap-2">
            {Icon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-gold/20">
                <Icon className="h-4 w-4 text-ink-dark" strokeWidth={1.9} />
              </span>
            )}
            <p className="text-[12px] font-medium text-ink-soft sm:text-[13px]">{label}</p>
          </span>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft transition-colors group-hover:text-ink" strokeWidth={1.8} />
        </div>
        <p className="mb-1 truncate text-[26px] font-light leading-none tracking-[-0.02em] text-ink sm:text-[36px]">{value}</p>
        <p className="text-[12px] font-medium text-ink-soft">{sub}</p>
        {spark}
      </button>

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full overflow-y-auto bg-white font-onest sm:max-w-xl lg:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-ink">{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="rounded-[24px] border border-line bg-paper p-5">
              <p className="mb-1 text-[13px] font-medium text-ink-soft">{label}</p>
              <p className="text-[38px] font-light leading-none tracking-[-0.02em] text-ink">{value}</p>
              <p className="mt-2 text-[13.5px] font-medium text-ink-soft">{sub}</p>
            </div>
            {description && <p className="text-[13.5px] leading-relaxed text-ink-soft">{description}</p>}
            {hasTrend && (
              <div>
                <p className="mb-3 text-[13px] font-medium text-ink-soft">Alakulás (30 nap)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, left: currency ? 8 : -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,110,70,.14)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#86826F' }} tickLine={false} axisLine={false} interval={6} />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#86826F' }} tickLine={false} axisLine={false} allowDecimals={false}
                      width={currency ? 52 : 34}
                      tickFormatter={currency ? (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) : undefined}
                    />
                    <Tooltip
                      cursor={{ stroke: 'rgba(120,110,70,.25)', strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={({ active, payload, label: l }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-[12px] bg-ink-dark px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                            <p className="text-white/50">{l}</p>
                            <p>{fmt(Number(payload[0].value), currency)}</p>
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
