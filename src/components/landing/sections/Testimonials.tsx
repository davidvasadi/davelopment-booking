'use client'

import { motion } from 'framer-motion'
import { Activity, SquareKanban, CreditCard, ArrowDown, ArrowUp, ArrowRight } from 'lucide-react'
import { float } from '@/components/landing/Motion'
import { MorphButton } from '@/components/landing/sections/TestimonialButtons'
import { SectionLabel } from '@/components/landing/SectionLabel'
import { EASE, buttonHover } from '@/lib/motion'

/**
 * „Most N napig ingyen" — Értékelések/CTA szekció.
 * trial_days a Backstage-ből jön (pricing.trial_days), nem hardkódolt.
 */

const CURVE =
  'M0,118 C50,95 75,42 118,48 C152,54 162,88 208,80 C248,72 288,22 379,16'

const GRID_COLS = 5
const GRID_ROWS = 5

const CURVE_BAND = 'bottom-[18%] h-[40%]'

const BUBBLES = [
  { x: 0.07, y: 0.677, label: '-4,2%',  dir: 'down' as const, Icon: SquareKanban, amp: 6, dur: 5.5, delay: 0 },
  { x: 0.28, y: 0.320, label: '+12,4%', dir: 'up'   as const, Icon: Activity,     amp: 7, dur: 6,   delay: 0.4 },
  { x: 0.78, y: 0.243, label: '+28,6%', dir: 'up'   as const, Icon: CreditCard,   amp: 6, dur: 5,   delay: 0.8 },
]

const AVATARS = [
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=96&h=96&fit=crop&crop=faces',
]


export function Testimonials({ trial_days }: { trial_days: number }) {
  return (
    <section id="velemenyek" className="mx-auto max-w-7xl px-4 lg:px-5 pb-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="flex flex-col-reverse lg:flex-row items-stretch overflow-hidden rounded-[30px]"
      >

        {/* BAL — scale-in belépő */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="bg-white lg:w-[36%] lg:max-w-[480px] shrink-0 flex flex-col justify-between p-8 lg:p-10 min-h-[435px]"
        >
          <SectionLabel>(Értékelések)</SectionLabel>
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-[clamp(2.5rem,4.5vw,49px)] leading-[1.05] tracking-[-1.47px] text-brand-ink">
              Most {trial_days} napig ingyen.
            </h2>
            <p className="text-[20px] tracking-[-0.6px] text-brand-ink/70">
              Próbáld ki kötelezettség nélkül — bankkártya sem kell.
            </p>
          </div>
          <div>
            <motion.a
              href="/register"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex items-center gap-2.5 rounded-full py-2.5 pl-5 pr-2.5 font-onest font-medium text-base text-[#f5f5f5]"
              style={{ background: '#2a2720' }}
            >
              Ingyenes regisztráció
              <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#f1ce45' }}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
              </span>
            </motion.a>
          </div>
        </motion.div>

        {/* JOBB — sárga kártya */}
        <div className="relative bg-brand-accent flex-1 flex flex-col lg:flex-row items-stretch overflow-hidden min-h-[240px] lg:min-h-[383px]">

          {/* Grafikon-zóna */}
          <div className="relative w-full lg:w-[44%] shrink-0 self-stretch min-h-[240px] lg:min-h-[383px]">

            {/* Rács — fade-in */}
            <motion.div
              aria-hidden
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.25 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.6, ease: EASE }}
              style={{
                backgroundImage:
                  'linear-gradient(to left, #191314 1px, transparent 1px), linear-gradient(to top, #191314 1px, transparent 1px)',
                backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
                backgroundPosition: 'right bottom',
              }}
            />

            {/* Görbe + buborékok */}
            <div className={`absolute inset-x-0 ${CURVE_BAND}`}>
              <svg
                viewBox="0 0 379.649 149.743"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                fill="none"
                aria-hidden
              >
                {/* Görbe draw-in */}
                <motion.path
                  d={CURVE}
                  stroke="#191314"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 1.4, ease: EASE, delay: 0.15 }}
                />
              </svg>

              {BUBBLES.map((b, i) => (
                // Külső wrapper: belépő (opacity+scale), nem ütközik a float translate-vel
                <motion.div
                  key={b.label + b.x}
                  className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.6 + i * 0.18 }}
                >
                  {/* Belső wrapper: folyamatos lebegés */}
                  <motion.div className="relative h-full w-full" {...float(b.amp, b.dur, b.delay)}>
                    <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 shadow-sm">
                      {b.dir === 'up' ? (
                        <ArrowUp className="h-3.5 w-3.5 text-[#10b97f]" />
                      ) : (
                        <ArrowDown className="h-3.5 w-3.5 text-[#d90b0b]" />
                      )}
                      <span
                        className={`text-[14px] font-semibold tracking-[-0.42px] ${
                          b.dir === 'up' ? 'text-[#10b97f]' : 'text-[#d90b0b]'
                        }`}
                      >
                        {b.label}
                      </span>
                    </span>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md">
                      <b.Icon className="h-5 w-5 text-brand-ink" strokeWidth={1.75} />
                    </span>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Avatar-blokk */}
          <div className="flex-1 flex flex-col justify-center gap-4 lg:gap-6 px-6 py-6 lg:py-10 sm:px-8">
            <motion.p
              className="font-semibold text-[clamp(1.25rem,2vw,28px)] leading-[1.1] tracking-[-0.84px] text-brand-ink"
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              Csatlakozz a vállalkozásokhoz, akik már minket használnak.
            </motion.p>

            {/* Avatar stack — staggerelt belépő */}
            <div className="flex items-center">
              {AVATARS.map((src, i) => (
                <motion.img
                  key={i}
                  src={src}
                  alt=""
                  className="block h-12 w-12 shrink-0 -mr-[13px] rounded-full border-[3px] border-brand-accent object-cover bg-zinc-200"
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.38, ease: EASE, delay: 0.1 + i * 0.07 }}
                />
              ))}
              <motion.span
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-accent bg-white text-[17px] font-semibold tracking-[-0.6px] text-brand-ink"
                initial={{ opacity: 0, x: -14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.38, ease: EASE, delay: 0.1 + AVATARS.length * 0.07 }}
              >
                +1K
              </motion.span>
            </div>

            <motion.div
              className="flex items-center"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, ease: EASE, delay: 0.6 }}
            >
              <MorphButton href="/register" label="Értékelj minket" variant="light" />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
