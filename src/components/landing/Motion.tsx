'use client'

import { Fragment, useRef } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

/** Lebegő (loop) animáció-prop: y oda-vissza úszik. Hero-kártyák, mockupok. */
export function float(amplitude = 10, duration = 6, delay = 0) {
  return {
    animate: { y: [0, -amplitude, 0] },
    transition: { duration, delay, ease: 'easeInOut' as const, repeat: Infinity },
  }
}

/** Nézetbe-kerüléskor egyszer felúszó konténer (opacity+y). A landing fő reveal-eszköze.
 *  Csak opacity/transform (kompozitor-réteg, nincs layout), egyszer fut; csökkentett mozgásnál
 *  csak rövid áttűnés, elmozdulás nélkül. */
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
  const reduce = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      className={className}
      // egy `transform` (nem y): a framer így WAAPI-val, a böngészővel animálja
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 24}px)` }}
      animate={inView ? { opacity: 1, transform: 'translateY(0px)' } : {}}
      transition={{ duration: reduce ? 0.25 : 0.6, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const
// később indul (az elem kb. 15%-kal már bent van), hogy látszódjon is a mozgás
const LATE_MARGIN = '0px 0px -15% 0px' as const

/** A FadeUp „késleltetett” változata (funkció-oldalak): később indul, kicsit lassabb. */
export function Reveal({
  children,
  delay = 0,
  className,
  style,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: LATE_MARGIN })
  const reduce = useReducedMotion()
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, transform: `translateY(${reduce ? 0 : 36}px)` }}
      animate={inView ? { opacity: 1, transform: 'translateY(0px)' } : {}}
      transition={{ duration: reduce ? 0.25 : 0.9, delay: reduce ? 0 : delay, ease: REVEAL_EASE }}
    >
      {children}
    </motion.div>
  )
}

/**
 * Címsor szavankénti előtűnése: minden szó egy maszk (overflow-hidden) mögül emelkedik ki,
 * lépcsőzve. Egy figyelő címsoronként, csak transform animál; a szöveg végig a DOM-ban van
 * (SEO), csökkentett mozgásnál sima szöveg.
 */
export function RevealText({
  text,
  as: Tag = 'h2',
  className,
  delay = 0,
}: {
  text: string
  as?: 'h1' | 'h2' | 'h3' | 'p'
  className?: string
  delay?: number
}) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: LATE_MARGIN })
  const reduce = useReducedMotion()
  // `\n` = sortörés csak sm felett (mobilon folyik a szöveg), mint a korábbi <br className="hidden sm:block" />
  const lines = text.split('\n')
  if (reduce) {
    return (
      <Tag className={className}>
        {lines.map((l, li) => <Fragment key={li}>{li > 0 && <><br className="hidden sm:block" />{' '}</>}{l}</Fragment>)}
      </Tag>
    )
  }
  let n = 0
  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, li) => {
        const words = line.split(' ').filter(Boolean)
        return (
          <Fragment key={li}>
            {li > 0 && <><br className="hidden sm:block" />{' '}</>}
            {words.map((w, wi) => {
              const i = n++
              return (
                <Fragment key={wi}>
                  <span className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-top">
                    <motion.span
                      className="inline-block"
                      initial={{ transform: 'translateY(110%)' }}
                      animate={inView ? { transform: 'translateY(0%)' } : {}}
                      transition={{ duration: 0.85, delay: delay + i * 0.045, ease: REVEAL_EASE }}
                    >
                      {w}
                    </motion.span>
                  </span>
                  {wi < words.length - 1 && ' '}
                </Fragment>
              )
            })}
          </Fragment>
        )
      })}
    </Tag>
  )
}
