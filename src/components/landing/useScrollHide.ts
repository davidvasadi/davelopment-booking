'use client'

import { useRef } from 'react'
import { animate, useMotionValue, useMotionValueEvent, useScroll, type AnimationPlaybackControls } from 'framer-motion'
import { SPRING_SNAPPY } from '@/lib/motion'

/**
 * A landing menüinek görgetéshez kötött elrejtése (mint az iOS-appok fejléce): a visszaadott
 * `y` (px) közvetlenül követi a görgetést — lefelé pixelről pixelre kicsúszik (-height-ig),
 * felfelé visszajön —, megálláskor pedig rugóval a közelebbi végállapotba (látszik/rejtve) áll.
 * Nincs ki-be kapcsolgatás, így nem ugrál. `revealAbove` px alatt (lap teteje) mindig látszik.
 */
export function useScrollHide({ height = 96, startHidden = false, revealAbove = 0 } = {}) {
  const { scrollY } = useScroll()
  const y = useMotionValue(startHidden ? -height : 0)
  const snap = useRef<AnimationPlaybackControls | null>(null)

  const lastMove = useRef(0)
  const settleRaf = useRef(0)

  // megálláskor (~120 ms mozdulatlanság) a közelebbi végállapotba rugózik — egyetlen rAF-lánc,
  // nem minden görgetés-eseménynél új időzítő
  const settle = () => {
    if (performance.now() - lastMove.current < 120) { settleRaf.current = requestAnimationFrame(settle); return }
    settleRaf.current = 0
    const cur = y.get()
    if (cur === 0 || cur === -height) return
    snap.current = animate(y, cur < -height / 2 ? -height : 0, SPRING_SNAPPY)
  }

  useMotionValueEvent(scrollY, 'change', (v) => {
    snap.current?.stop()
    lastMove.current = performance.now()
    if (v <= revealAbove) { y.set(0); return }
    const prev = scrollY.getPrevious() ?? v
    y.set(Math.min(0, Math.max(-height, y.get() - (v - prev))))
    if (!settleRaf.current) settleRaf.current = requestAnimationFrame(settle)
  })
  return y
}
