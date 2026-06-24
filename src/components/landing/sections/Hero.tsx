'use client'

import { motion } from 'framer-motion'
import { EASE } from '@/lib/motion'
import { MorphButton, RollButton } from '@/components/landing/sections/TestimonialButtons'
import { PhoneMockupSVG, ScrollCue } from '@/components/landing/Mockups'
import { ftFmt, type LandingPricing } from '@/components/landing/types'

/** Nyitó hero: bal oldali sötét copy-kártya + jobb oldali sárga, lebegő mockup-kártya. */
export function Hero({ pricing }: { pricing: LandingPricing }) {
  return (
    <section className="mx-auto px-4 lg:px-5 pt-3 pb-5">
      <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="rounded-[30px] bg-[#f5f5f5] p-8 sm:p-12 lg:p-14 flex flex-col justify-between min-h-[560px] lg:min-h-[600px] lg:h-[calc(100svh-100px)] lg:max-h-[760px]"
        >
          <div>
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
              className="inline-flex h-8 items-center rounded-full bg-white px-5 text-xs font-semibold text-brand-ink"
            >
              Próbáld ki {pricing.trial_days} napig ingyen.
            </motion.span>

            <h1 className="mt-5 font-geist font-bold leading-[1.05] tracking-[-0.05em] text-[clamp(2.5rem,6vw,3.5rem)] text-brand-ink overflow-hidden">
              {['Online', 'Időpontfoglaló.'].map((w, i) => (
                <span key={w} className="block overflow-hidden">
                  <motion.span
                    className="block"
                    initial={{ y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.8, delay: 0.15 + i * 0.09, ease: EASE }}
                  >
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
              className="mt-5 max-w-md text-base leading-6 text-brand-ink"
            >
              Hagyd, hogy az ügyfeleid maguk foglaljanak – te csak a munkádra figyelj.
              Éttermeknek, fodrászatoknak, kis vállalkozásoknak.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
              className="mt-8"
            >
              <MorphButton href="/register" label="Regisztrálj ingyen" variant="accent" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7, ease: EASE }}
            className="mt-12"
          >
            <p className="mb-4 text-base text-brand-ink">Van már fiókod?</p>
            <div className="flex flex-wrap items-center gap-3">
              <RollButton href="/login" label="Bejelentkezés" variant="inkLight" icon />
              <RollButton href="/davelopment" label="Demó megtekintése" variant="light" />
            </div>
          </motion.div>
        </motion.div>

        {/* Right card — yellow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="relative rounded-[30px] bg-brand-accent overflow-hidden min-h-[560px] lg:min-h-[600px] lg:h-[calc(100svh-100px)] lg:max-h-[760px]"
        >
          {/* Mobilon: középre — sima div, NEM motion.div, hogy a transform:none ne törje el */}
          <div className="lg:hidden absolute bottom-0 z-10 w-[78vw] max-w-[320px]" style={{ left: '50%', transform: 'translateX(-50%)' }}>
            <PhoneMockupSVG />
          </div>
          {/* Desktopon: Figma-pozíció */}
          <div className="hidden lg:block absolute bottom-0 left-[22%] z-10 w-[69%] min-w-[360px]">
            <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.35, ease: EASE }} style={{ willChange: 'transform, opacity' }} className="transform-gpu">
              <PhoneMockupSVG />
            </motion.div>
          </div>

          <motion.div
            initial={{ y: 18 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
            className="absolute left-6 right-6 top-24 sm:top-28 lg:right-auto lg:top-[18%] z-20 transform-gpu"
          >
            <div className="rounded-[20px] bg-white/[0.67] backdrop-blur-[23px] p-5 lg:max-w-xs">
              <p className="font-medium text-3xl leading-[1.1] tracking-[-0.06em] text-brand-ink">
                Kezeld okosan a vállalkozásod
              </p>
              <p className="mt-2 flex gap-6 font-martian text-sm text-brand-ink whitespace-nowrap">
                <span className="text-[#10b97f]">{ftFmt(pricing.salon_pro_huf)}-tól</span>
              </p>
            </div>
          </motion.div>

          <div className="absolute bottom-0 right-0 z-20 hidden lg:block w-[260px] h-[114px]">
            <svg viewBox="0 0 260 114" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <path
                fill="#ffffff"
                d="M55.7409 53.3418C61.4249 46.0385 70.1614 41.7672 79.4159 41.7672H230C246.569 41.7672 260 28.3358 260 11.7672V0V84C260 100.569 246.569 114 230 114H60.2317H0C5.38405 114 10.4667 111.515 13.7735 107.266L55.7409 53.3418Z"
              />
            </svg>
            <p className="absolute bottom-5 right-6 text-right font-martian text-base leading-6 text-brand-ink">
              Regisztrálj és
              <br />
              próbáld ki ingyen
            </p>
          </div>
        </motion.div>

        <div className="hidden lg:block absolute left-1/2 top-full -mt-[120px] -translate-x-1/2 z-30">
          <ScrollCue />
        </div>
      </div>
    </section>
  )
}
