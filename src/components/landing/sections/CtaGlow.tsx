'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { FadeUp, RevealText } from '@/components/landing/Motion'
import { EASE, buttonHover } from '@/lib/motion'
import { PaintedBackground } from '@/components/landing/PaintedBackground'

/**
 * Világos, „festett” hátterű CTA: a háttér egy WebGL shader (SilkGradient) — meleg
 * narancs–sárga selymes sávok, alul világosszürkébe fut. Statikus, nincs extra mozgás.
 */
const BUTTONS = {
  yellow: { btn: 'bg-[#F1CE45] text-[#1D1C19] shadow-[0_10px_30px_-12px_rgba(180,120,20,.5)]', dot: 'bg-[#1D1C19]', arrow: 'text-[#F1CE45]' },
  white: { btn: 'bg-white text-[#1D1C19] shadow-[0_10px_30px_-12px_rgba(120,80,20,.35)]', dot: 'bg-[#1D1C19]', arrow: 'text-[#F1CE45]' },
  dark: { btn: 'bg-ui-dark text-white shadow-[0_10px_30px_-12px_rgba(56,56,56,.5)]', dot: 'bg-ui-yellow', arrow: 'text-ui-dark' },
} as const

export function CtaGlow({
  trial_days,
  label = 'Kezdd el ma',
  title = 'Ne vesszen el több foglalás a telefonnál.',
  lead,
  button = 'yellow',
  bg,
  strong = false,
  plain = false,
  bgPosition = 'object-center',
}: {
  trial_days: number
  label?: string
  title?: string
  lead?: string
  button?: keyof typeof BUTTONS
  /** opcionális háttérkép a festett shader helyett (pl. a landing-koncepciókban) */
  bg?: string
  /** mozgalmas, teljes erejű fotó: enyhébb színezés, és sötétebb szövegek, hogy olvasható maradjon */
  strong?: boolean
  /** a háttérkép színezés nélkül (pl. világos, fehér fotó — a szépia bézsre húzná) */
  plain?: boolean
  /** a háttérkép vágása (object-position osztály) */
  bgPosition?: string
}) {
  const b = BUTTONS[button]
  return (
    <section className="mx-auto px-4 pb-8 lg:px-5">
      <FadeUp>
        <div className="relative isolate overflow-hidden rounded-[30px] bg-[#F2F2F2]">
          {/* festett háttér */}
          {bg
            ? <img src={bg} alt="" aria-hidden loading="lazy" className={`absolute inset-0 -z-10 h-full w-full object-cover ${bgPosition} ${plain ? '' : strong ? '[filter:sepia(.1)_saturate(.95)]' : '[filter:sepia(.22)_saturate(.8)_hue-rotate(-8deg)_brightness(1.02)]'}`} /> /* eslint-disable-line @next/next/no-img-element */
            : <PaintedBackground />}
          {strong && <div aria-hidden className="absolute inset-0 -z-10 bg-white/25 backdrop-blur-[14px] [mask-image:radial-gradient(ellipse_46%_62%_at_50%_50%,#000_0%,#000_45%,transparent_85%)] [-webkit-mask-image:radial-gradient(ellipse_46%_62%_at_50%_50%,#000_0%,#000_45%,transparent_85%)]" />}

          <div className="relative flex flex-col items-center px-6 pb-24 pt-20 text-center lg:pb-32 lg:pt-28">
            <span className="rounded-[8px] bg-white px-3.5 py-1.5 text-[14px] font-medium text-brand-ink/80">{label}</span>
            <RevealText text={title} className="mt-6 max-w-[16ch] font-geist font-medium text-[clamp(1.9rem,4vw,52px)] leading-[1.04] tracking-[-0.05em] text-[#1D1C19]" />
            <p className={`mt-5 max-w-xl text-[16px] leading-[1.6] lg:text-[18px] ${strong ? 'font-medium text-[#1D1C19]/85' : 'text-brand-ink/60'}`}>
              {lead ?? 'Saját foglalóoldal, naptár, vendégek, előleg és marketing — egy rendszerben.'}
            </p>
            <motion.a
              href="/register"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className={`mt-10 inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 font-onest text-[15px] font-medium ${b.btn}`}
            >
              Kipróbálom ingyen
              <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full ${b.dot}`}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 40 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className={`h-[18px] w-[18px] ${b.arrow}`} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -40 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className={`h-[18px] w-[18px] ${b.arrow}`} />
                </motion.div>
              </span>
            </motion.a>
            <p className={`mt-4 text-[13px] ${strong ? 'font-medium text-[#1D1C19]/75' : 'text-brand-ink/45'}`}>{trial_days} napig ingyenes · kártya nélkül · bármikor lemondható</p>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}
