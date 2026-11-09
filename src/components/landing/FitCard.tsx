'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/** Egy design-kártya (src/components/blocks) a landing kép-helyén: `w` szélességben, eredeti elrendezésben rajzolódik,
 *  és kicsinyül, hogy elférjen — `fit="width"`: a doboz szélességéhez (a magasság követi), `fit="contain"`: a fix méretű
 *  dobozba egészben, középre. Soha nem nagyít. Kép-szerepű: nem kattintható, a képernyőolvasó elől rejtve. */
export function FitCard({ w = 420, fit = 'width', className = '', children }: { w?: number; fit?: 'width' | 'contain'; className?: string; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [s, setS] = useState({ k: 1, ih: 0, bh: 0 })
  // csak a böngészőben rajzoljuk ki: a minta-szövegek (nevek, összegek) ne kerüljenek az oldal HTML-jébe (SEO)
  const [on, setOn] = useState(false)
  useLayoutEffect(() => {
    const b = box.current, i = inner.current
    setOn(true)
    if (!b || !i) return
    const measure = () => {
      const ih = i.offsetHeight, bh = b.clientHeight
      let k = Math.min(1, b.clientWidth / w)
      if (fit === 'contain' && bh > 0 && ih > 0) k = Math.min(k, bh / ih)
      setS({ k, ih, bh })
    }
    const ro = new ResizeObserver(measure)
    ro.observe(b); ro.observe(i)
    return () => ro.disconnect()
  }, [w, fit, on])
  const top = fit === 'contain' ? Math.max(0, (s.bh - s.ih * s.k) / 2) : 0
  return (
    // a `relative` csak akkor, ha a hívó nem ad saját helyzetet: a CSS-ben a `relative` a későbbi szabály, így felülírta az
    // `absolute inset-0`-t — a doboz csak a belső margónyi magas lett, és a kártya apróra kicsinyült
    <div ref={box} className={`pointer-events-none select-none ${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} ${className}`} style={fit === 'width' ? { height: s.ih * s.k || undefined } : undefined} aria-hidden>
      <div ref={inner} className="absolute left-1/2" style={{ width: w, top, transform: `translateX(-50%) scale(${s.k})`, transformOrigin: 'top center' }}>{on && children}</div>
    </div>
  )
}
