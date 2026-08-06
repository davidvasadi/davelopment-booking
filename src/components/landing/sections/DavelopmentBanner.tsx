'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { FadeUp } from '@/components/landing/Motion'
import { EASE, buttonHover } from '@/lib/motion'
import { SERVICES } from '@/components/landing/sections/Nav'

export function DavelopmentBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-5 pb-8">
      <FadeUp>
        <div className="relative rounded-[30px] overflow-hidden bg-white border border-brand-ink/[0.07] px-8 lg:px-14 py-10 lg:py-14">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">

            {/* Bal — brand + leírás + service tagek */}
            <div className="flex flex-col gap-5 max-w-2xl">
              <span className="inline-flex self-start items-center rounded-full bg-brand-ink/[0.05] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-brand-ink/40">
                Powered by
              </span>

              <div>
                <p className="font-onest font-bold leading-[0.9] tracking-[-0.05em] text-brand-ink"
                  style={{ fontSize: 'clamp(2.75rem, 7vw, 5.5rem)' }}>
                  [davelopment]®
                </p>
                <p className="mt-4 text-[17px] leading-[1.55] tracking-[-0.02em] text-brand-ink/55 max-w-lg">
                  Digitális ügynökség — weboldal, design, marketing és üzleti rendszerek egy helyen.
                </p>
              </div>

              {/* Service tagek */}
              <div className="flex flex-wrap gap-2 pt-1">
                {SERVICES.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-full border border-brand-ink/[0.1] px-3.5 py-1.5 text-[13px] font-medium text-brand-ink/55 transition-colors hover:border-brand-ink/25 hover:text-brand-ink"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Jobb — CTA gomb */}
            <motion.a
              href="https://davelopment.hu/hu"
              target="_blank"
              rel="noopener noreferrer"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex shrink-0 items-center gap-2.5 rounded-full py-3 pl-6 pr-3 font-onest font-medium text-[16px] self-start lg:self-center"
              style={{ background: '#1d1c19', color: '#ffffff' }}
            >
              Megnézem
              <span className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#F1CE45' }}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 42 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[17px] w-[17px]" style={{ color: '#1d1c19' }} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -42 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[17px] w-[17px]" style={{ color: '#1d1c19' }} />
                </motion.div>
              </span>
            </motion.a>

          </div>
        </div>
      </FadeUp>
    </section>
  )
}
