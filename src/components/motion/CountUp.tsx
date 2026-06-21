'use client'

import { useRef, useState, useEffect } from 'react'
import { useInView } from 'framer-motion'

/**
 * Nézetbe kerüléskor 0→`to` felszámláló (ease-out-cubic, magyar ezres-tagolással).
 * Eredetileg a landing social-proof számából — kiemelve közös komponensbe
 * (KPI-kártyák, statisztika is használhatja).
 */
export function CountUp({
  to,
  suffix = '',
  prefix = '',
  duration = 1500,
}: {
  to: number
  suffix?: string
  prefix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-40px' })
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    let start: number | null = null
    const tick = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.round(eased * to))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, to, duration])

  const fmt =
    count >= 1000 ? count.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : count.toString()

  return (
    <span ref={ref}>
      {prefix}
      {fmt}
      {suffix}
    </span>
  )
}
