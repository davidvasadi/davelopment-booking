'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/** Fix méretű (800×474, a borító 1600/948-as aránya) jelenet a doboz szélességéhez kicsinyítve — így a design-kártyák
 *  rendes arányokkal, de bármekkora borító-helyen ugyanúgy néznek ki. Kép-szerepű: nem kattintható. */
const W = 800
export function CoverStage({ children }: { children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [k, setK] = useState(0.5)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setK(el.clientWidth / W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden>
      <div className="relative origin-top-left" style={{ width: W, height: W * (948 / 1600), transform: `scale(${k})` }}>{children}</div>
    </div>
  )
}
