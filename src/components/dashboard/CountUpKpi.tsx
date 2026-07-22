'use client'

import { useEffect, useRef, useState } from 'react'
import { Users, Clock, CalendarOff, CalendarDays, CalendarCheck, Gauge, Wallet, DoorOpen, CheckCircle2, XCircle, Globe, Home, Scissors, Layers, Tag, type LucideIcon } from 'lucide-react'

/**
 * Animált KPI-pillér: ikon + FELSZÁMOLÓ szám (0 → érték, ease-out, láthatóváváláskor indul) +
 * címke. Ugyanaz a ritmus, mint az Áttekintés StatusPills számlálója — konzisztens UX.
 *
 * FONTOS: az ikont NÉV szerint kapja (nem függvényként) — szerver-komponensből kliens-
 * komponensnek nem adható át függvény-prop (Lucide ikon). A név itt, kliens-oldalon mappelt.
 */
const DURATION = 900
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

const ICONS: Record<string, LucideIcon> = {
  users: Users, clock: Clock, off: CalendarOff, calendar: CalendarDays,
  check: CalendarCheck, gauge: Gauge, wallet: Wallet, walkin: DoorOpen,
  done: CheckCircle2, cancelled: XCircle, globe: Globe, home: Home,
  scissors: Scissors, layers: Layers, tag: Tag,
}
export type KpiIcon = keyof typeof ICONS

export function CountUpKpi({
  icon,
  value,
  label,
  suffix = '',
  decimals = 0,
  group = false,
}: {
  icon: KpiIcon
  value: number
  label: string
  suffix?: string
  decimals?: number
  /** Ezres tagolás (pl. bevétel: 125 000). A count-up közben is tagolva jelenik meg. */
  group?: boolean
}) {
  const Icon = ICONS[icon] ?? Users
  const [n, setN] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(value)
      return
    }
    let raf = 0
    let start: number | null = null
    let started = false
    const run = () => {
      if (started) return
      started = true
      const tick = (ts: number) => {
        if (start === null) start = ts
        const t = Math.min(1, (ts - start) / DURATION)
        setN(value * easeOut(t))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { run(); io.disconnect() } },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])

  const shown = decimals > 0
    ? (group ? n.toLocaleString('hu-HU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals))
    : (group ? Math.round(n).toLocaleString('hu-HU') : String(Math.round(n)))

  return (
    <div ref={ref} className="flex flex-col items-start">
      <div className="flex items-center gap-2.5">
        <Icon className="h-6 w-6 shrink-0 text-ink-soft" strokeWidth={1.6} />
        <div className="text-4xl lg:text-[42px] font-light leading-none tracking-[-0.02em] text-ink tabular-nums">
          {shown}{suffix}
        </div>
      </div>
      <div className="mt-1.5 text-[13px] font-medium text-ink-soft">{label}</div>
    </div>
  )
}
