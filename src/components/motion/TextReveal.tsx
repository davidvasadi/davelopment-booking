'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Szóról-szóra felúszó szöveg-reveal (scroll-vezérelt opacity-ramp).
 * Eredetileg a landing Vision-szekciójából — kiemelve közös komponensbe,
 * hogy a dashboard/backstage is használhassa. A `prefers-reduced-motion`
 * ágat a hívó oldal kezeli (a Framer `useReducedMotion` a hívóban), itt
 * a sima scroll-progresszió a viselkedés.
 */

function RevealWord({
  word,
  progress,
  index,
  total,
}: {
  word: string
  progress: MotionValue<number>
  index: number
  total: number
}) {
  const opacity = useTransform(
    progress,
    [index / total, Math.min((index + 1.5) / total, 1)],
    [0.12, 1],
  )
  return (
    <motion.span style={{ opacity }} className="inline-block mr-[0.28em]">
      {word}
    </motion.span>
  )
}

export function TextReveal({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'end 0.4'],
  })
  const words = text.split(' ')
  return (
    <div ref={ref} className={cn(className)}>
      {words.map((word, i) => (
        <RevealWord key={i} word={word} progress={scrollYProgress} index={i} total={words.length} />
      ))}
    </div>
  )
}
