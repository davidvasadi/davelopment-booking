'use client'

import { useEffect, useRef, useState } from 'react'
import { Pill } from './index'
import type { Segment } from './index'

/**
 * Betöltési animáció (kit, design 2.11.2) — a régi Áttekintés viselkedése az új arculatban: betöltéskor a pillek 0-ról
 * nőnek a végleges szélességükre, a számok közben felszámolnak, a grafikonok oszlopai felnőnek, a gyűrű körberajzolódik —
 * mind EGY ütemben (850 ms, lassuló), hogy együtt mozogjanak. „Csökkentett mozgás” beállításnál azonnal a végállapot.
 */
export const LOAD_MS = 850
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/** 0 → 1 haladás betöltéskor (rAF). `eager`: azonnal indul (mindig látható fejléc); különben amikor láthatóvá válik. */
export function useLoadProgress<T extends HTMLElement>(eager = true) {
  const ref = useRef<T | null>(null)
  const [p, setP] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setP(1); return }
    let raf = 0; let started = false
    const run = () => {
      if (started) return
      started = true
      let start: number | null = null
      const tick = (ts: number) => {
        if (start === null) start = ts
        const t = Math.min(1, (ts - start) / LOAD_MS)
        setP(easeOut(t))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    if (eager || !ref.current) { const id = requestAnimationFrame(run); return () => { cancelAnimationFrame(id); cancelAnimationFrame(raf) } }
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) { run(); io.disconnect() } }, { threshold: 0.1 })
    io.observe(ref.current)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [eager])
  return { ref, p }
}

/** A szövegben lévő számok felszámolnak 0-tól (pl. „28 db”, „186 e”, „56%”, „12 400 Ft”) — a többi karakter marad. */
export function CountText({ text, className }: { text: string; className?: string }) {
  const { ref, p } = useLoadProgress<HTMLSpanElement>(true)
  const out = p >= 1 ? text : text.replace(/\d[\d   ]*\d|\d/g, (m) => {
    const sep = m.match(/[   ]/)?.[0]
    const n = Number(m.replace(/[   ]/g, ''))
    const v = Math.round(n * p)
    return sep ? v.toLocaleString('hu-HU').replace(/\s/g, sep) : String(v)
  })
  return <span ref={ref} className={className}>{out}</span>
}

/** A SegmentBar (nem összefüggő) betöltéskor: a pillek 0-ról nőnek az arányos szélességükre, a cím beúszik, a szám felszámol. */
export function GrowSegments({ segments, size = 'lg', className }: { segments: Segment[]; size?: 'md' | 'lg'; className?: string }) {
  const { ref, p } = useLoadProgress<HTMLDivElement>(true)
  const total = segments.reduce((a, s) => a + Math.max(s.weight, 1), 0) || 1
  return (
    <div ref={ref} className={['flex min-w-0 items-end gap-2', className].filter(Boolean).join(' ')}>
      {segments.map((s) => (
        <div key={s.label} className="min-w-0" style={{ flexGrow: 0, flexShrink: 1, flexBasis: `${(Math.max(s.weight, 1) / total) * 100 * p}%`, minWidth: p >= 1 ? 'max-content' : 64 * p }}>
          <div className="mb-2 truncate whitespace-nowrap text-ui-body text-ui-muted" style={{ opacity: p }}>{s.label}</div>
          <Pill tone={s.tone} size={size} className="w-full">{typeof s.value === 'string' ? <CountText text={s.value} /> : s.value}</Pill>
        </div>
      ))}
    </div>
  )
}
