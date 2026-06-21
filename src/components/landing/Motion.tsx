'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

/** Lebegő (loop) animáció-prop: y oda-vissza úszik. Hero-kártyák, mockupok. */
export function float(amplitude = 10, duration = 6, delay = 0) {
  return {
    animate: { y: [0, -amplitude, 0] },
    transition: { duration, delay, ease: 'easeInOut' as const, repeat: Infinity },
  }
}

/** Nézetbe-kerüléskor egyszer felúszó konténer (opacity+y). A landing fő reveal-eszköze. */
export function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
