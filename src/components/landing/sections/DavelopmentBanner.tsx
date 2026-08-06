'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { FadeUp } from '@/components/landing/Motion'
import { EASE, buttonHover } from '@/lib/motion'
import { SERVICES } from '@/components/landing/sections/Nav'

// Kép/videó belépő — mint a SegmentToggle imgV variánsa: alulról jön fel, kicsit később
const videoReveal = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: EASE, delay: 0.2 } },
} as const

// Szöveg-oszlop staggerelt belépője — mint a SegmentToggle cardV/imgV párosa
const textStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
} as const

const textItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
} as const

export function DavelopmentBanner() {
  const videoRef = useRef(null)
  const videoInView = useInView(videoRef, { once: true, margin: '-60px' })
  const textRef = useRef(null)
  const textInView = useInView(textRef, { once: true, margin: '-60px' })

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-5 pb-8">
      <FadeUp>
        {/* overflow visible — telefon kinyúlhat felfelé */}
        <div
          className="relative rounded-[30px] flex flex-col lg:flex-row lg:items-center"
          style={{ border: '1px solid rgba(59,59,59,0.08)' }}
        >
          {/* Háttér — mobilon függőleges (videó fent → sötét fent, szöveg lent → melegebb), desktopon vízszintes */}
          <div
            className="absolute inset-0 rounded-[30px] lg:hidden"
            style={{ background: 'linear-gradient(to bottom, #000000 0px, #000000 280px, #606060 700px)' }}
          />
          <div
            className="absolute inset-0 rounded-[30px] hidden lg:block"
            style={{ background: 'linear-gradient(to right, #606060 0%, #000000 calc(100% - 460px), #000000 100%)' }}
          />

          {/* Bal — szöveg sötét háttéren, staggerelt belépő */}
          <motion.div
            ref={textRef}
            variants={textStagger}
            initial="hidden"
            animate={textInView ? 'show' : 'hidden'}
            className="order-2 lg:order-none flex flex-col gap-4 flex-1 px-8 lg:px-12 py-7 lg:py-8 relative z-10"
          >
            <motion.span variants={textItem} className="font-onest font-bold text-[13px] tracking-[-0.01em] text-white">
              [davelopment]®
            </motion.span>

            <motion.h2
              variants={textItem}
              className="font-geist font-semibold leading-[1.04] tracking-[-0.05em] text-white"
              style={{ fontSize: 'clamp(1.75rem, 3.6vw, 2.9rem)' }}
            >
              Kinőtted az<br className="hidden sm:block" /> időpontfoglalást?
            </motion.h2>

            <motion.p variants={textItem} className="text-[16px] leading-[1.6] tracking-[-0.02em] text-white/80 max-w-sm">
              Ha már itt tartasz, ideje az egészet rendbe tenni. Teljes digitális jelenlét — weboldal, arculat, marketing és üzleti rendszerek egy ügynökségtől.
            </motion.p>

            <motion.div variants={textItem} className="flex flex-wrap gap-2">
              {SERVICES.filter((s) => s.label !== 'Időpontfoglaló rendszer').map((s) => (
                <motion.a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/90 transition-colors hover:text-white"
                  style={{ background: '#3a3a3a' }}
                >
                  {s.label}
                </motion.a>
              ))}
            </motion.div>

            <motion.div variants={textItem}>
              <motion.a
                href="https://davelopment.hu/hu"
                target="_blank"
                rel="noopener noreferrer"
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                className="inline-flex items-center gap-2.5 self-start rounded-full py-2.5 pl-5 pr-2.5 font-onest font-medium text-base"
                style={{ background: '#ffffff', color: '#1d1c19' }}
              >
                Ismerj meg minket
                <span
                  className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden"
                  style={{ background: '#F1CE45' }}
                >
                  <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                    <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                  </motion.div>
                  <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                    <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                  </motion.div>
                </span>
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Jobb — telefon, konténerbe klippelve (clip content), ránagyítva; mobilon fent, desktopon jobbra; a konténer maga fix, csak a videó úszik fel bent, picivel később, mint a SegmentToggle képei */}
          <div
            ref={videoRef}
            className="order-1 lg:order-none block w-full h-[300px] sm:h-[360px] lg:h-auto lg:w-[360px] xl:w-[420px] shrink-0 lg:self-stretch relative overflow-hidden rounded-tl-[30px] rounded-tr-[30px] lg:rounded-tl-none lg:rounded-bl-none lg:rounded-tr-[30px] lg:rounded-br-[30px]"
          >
            <motion.div
              variants={videoReveal}
              initial="hidden"
              animate={videoInView ? 'show' : 'hidden'}
              className="absolute inset-0"
            >
              <video
                autoPlay muted loop playsInline aria-hidden
                className="absolute inset-0 w-full h-full object-cover object-top"
                style={{ transform: 'scale(1.9) translateY(-10%)', transformOrigin: 'top center' }}
              >
                <source src="/landing/cta/ctavideo-davelopment-booking.webm" type="video/webm" />
              </video>
            </motion.div>
            {/* Mobilon alul fut bele a szöveg-oldal hátterébe (függőleges), desktopon balról (vízszintes) */}
            <div
              className="absolute inset-x-0 bottom-0 h-24 pointer-events-none z-10 lg:hidden"
              style={{ background: 'linear-gradient(to top, #000000, transparent)' }}
            />
            <div
              className="absolute inset-y-0 left-0 w-32 pointer-events-none z-10 hidden lg:block"
              style={{ background: 'linear-gradient(to right, #000000, transparent)' }}
            />
          </div>

        </div>
      </FadeUp>
    </section>
  )
}
