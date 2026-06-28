'use client'

import { useState } from 'react'
import { CalendarCheck, Users, Gauge, CalendarRange, CalendarX, type LucideIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatCard, DiffBadge } from './StatCard'
import { ReservationTrendChart } from './DashboardCharts'
import type { DayData } from '@/lib/dashboardStats'

/**
 * Az ikon kulcsként érkezik (string), nem komponensként — így átadható a
 * Server Component oldalról a kliens-kártyának. A leképezés itt, kliens-oldalon történik.
 */
export type RestaurantKpiIcon = 'reservations' | 'pax' | 'occupancy' | 'period' | 'cancelled'

const ICONS: Record<RestaurantKpiIcon, LucideIcon> = {
  reservations: CalendarCheck,
  pax: Users,
  occupancy: Gauge,
  period: CalendarRange,
  cancelled: CalendarX,
}

interface Props {
  sub: string
  label: string
  value: string
  diff?: number
  /** A badge ikonja, kulcsként (a StatCard-nak komponensként adjuk tovább). */
  icon?: RestaurantKpiIcon
  /** Sheet fejléc */
  title: string
  description?: string
  period: number
  /** A trend-grafikonhoz használt napi adatsor (a `revenue` mezőben a pax/foglalás-szám utazik). */
  trend?: DayData[]
}

export function RestaurantKpiCard({ sub, label, value, diff, icon, title, description, period, trend }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <StatCard
        sub={sub}
        label={label}
        value={value}
        diff={diff}
        icon={icon ? ICONS[icon] : undefined}
        onClick={() => setOpen(true)}
      />

      <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false) }}>
        <SheetContent className="w-full sm:max-w-xl lg:max-w-2xl overflow-y-auto bg-white dark:bg-zinc-950">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl p-5 bg-zinc-50 dark:bg-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-1">{sub}</p>
              <p className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white">{value}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-sm text-zinc-500 dark:text-white/40">{label}</p>
                {diff !== undefined && <DiffBadge diff={diff} />}
              </div>
            </div>
            {description && <p className="text-sm text-zinc-500 dark:text-white/50">{description}</p>}
            {trend && trend.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-white/30 mb-3">
                  Alakulás ({period} nap)
                </p>
                <ReservationTrendChart data={trend} period={period} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
