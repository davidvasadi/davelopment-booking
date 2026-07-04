'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Arányos szélességű státusz-pillek (Megerősített/Függő/Lemondva stb.) — a szélesség az
 * értékkel arányos (100% ≠ 0%). BETÖLTÉSKOR, a diagramokkal EGYSZERRE (mount-kor indul, mint a
 * recharts) 0-ról nőnek ki, és a százalék KÖZBEN felszámol. Egyetlen rAF-tween hajtja a
 * szélességet és a számot is, így tökéletesen szinkronban van. Áttekintés ÉS Statisztikák közös.
 */
export type StatusSeg = {
  label: string
  pct: number
  background: string
  color: string
  border?: string
  align?: 'start' | 'end'
  /** Ha meg van adva, a pill SZÁMOT mutat (felszámol) a % helyett. A szélesség továbbra is `pct`-arányos. */
  value?: number
  /** A szám mögé írt egység (pl. „ fő"), csak `value` esetén. */
  suffix?: string
}

const DURATION = 850 // ~ a recharts animationDuration
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

export function StatusPills({ segments, className = '' }: { segments: StatusSeg[]; className?: string }) {
  const [p, setP] = useState(0) // 0 → 1 haladás
  const raf = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // Reduced-motion: azonnal a végállapot.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setP(1)
      return
    }
    let started = false
    const run = () => {
      if (started) return
      started = true
      let start: number | null = null
      const tick = (ts: number) => {
        if (start === null) start = ts
        const t = Math.min(1, (ts - start) / DURATION)
        setP(easeOut(t))
        if (t < 1) raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    }
    // A számlálás csak akkor indul, amikor az elem LÁTHATÓVÁ válik — így a diagramokkal
    // (Reveal) EGYSZERRE fut, és nem „ugrik be" a végén a láthatatlan alatt lefutott szám.
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) { run(); io.disconnect() } },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf.current) }
  }, [])

  return (
    <div ref={rootRef} className={`flex min-w-0 items-end gap-2.5 ${className}`}>
      {segments.map((s) => (
        <div
          key={s.label}
          style={{
            flexGrow: Math.max(s.pct, 1) * p,
            flexBasis: 0,
            minWidth: 64 * p,
          }}
        >
          <p className="mb-2 truncate text-xs font-medium text-ink-soft" style={{ opacity: p }}>{s.label}</p>
          <div
            className={`flex h-11 items-center overflow-hidden whitespace-nowrap rounded-[21px] px-5 text-sm font-semibold ${s.align === 'end' ? 'justify-end' : 'justify-start'}`}
            style={{ background: s.background, color: s.color, border: s.border }}
          >
            {s.value != null ? `${Math.round(s.value * p)}${s.suffix ?? ''}` : `${Math.round(s.pct * p)}%`}
          </div>
        </div>
      ))}
    </div>
  )
}
