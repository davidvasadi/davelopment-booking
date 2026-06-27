'use client'

import { useRef } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { ScrollTrigger, useGSAP } from '@/lib/landing/gsap'

const MARQUEE_ITEMS = ['ÉTTEREM', 'CSONTKOVÁCS', 'FODRÁSZAT', 'SZEMÉLYI EDZŐ', 'JÓGA', 'KOZMETIKA', 'MASSZŐR', 'KÖRÖMSZALON']

function MarqueeRow({
  reverse = false,
  duration = 18,
  scroll,
  emphasis = false,
}: {
  reverse?: boolean
  duration?: number
  scroll: MotionValue<number>
  emphasis?: boolean
}) {
  const row = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  const scrollX = useTransform(scroll, [0, 1], reverse ? ['-6%', '14%'] : ['6%', '-14%'])
  return (
    <div className="overflow-hidden">
      <motion.div style={{ x: scrollX }}>
        <motion.div
          className="flex whitespace-nowrap will-change-transform"
          animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
          transition={{ duration, ease: 'linear', repeat: Infinity }}
        >
          {row.map((item, i) => (
            <span
              key={i}
              className="flex items-center font-black text-[2rem] sm:text-4xl lg:text-6xl tracking-tighter uppercase px-4 lg:px-6"
            >
              <span className={emphasis ? 'text-brand-ink' : 'text-brand-ink/85'}>{item}</span>
              <span className="mx-4 lg:mx-6 text-brand-ink/30 text-2xl lg:text-4xl">✳</span>
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}

export function Marquee() {
  const ref = useRef<HTMLDivElement>(null)
  const scrollYProgress = useMotionValue(0)

  useGSAP(() => {
    const el = ref.current
    if (!el) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => scrollYProgress.set(self.progress),
    })
    return () => st.kill()
  }, { scope: ref })

  return (
    <div
      ref={ref}
      className="relative bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-6 lg:py-8 space-y-5"
    >
      <MarqueeRow duration={22} scroll={scrollYProgress} />
      <MarqueeRow reverse duration={28} scroll={scrollYProgress} emphasis />
      <MarqueeRow duration={18} scroll={scrollYProgress} />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-16 lg:w-32 bg-gradient-to-r from-brand-accent to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-16 lg:w-32 bg-gradient-to-l from-brand-accent to-transparent" />
    </div>
  )
}
