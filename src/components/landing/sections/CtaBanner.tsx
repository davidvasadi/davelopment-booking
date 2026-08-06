'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { FadeUp } from '@/components/landing/Motion'
import { EASE, buttonHover } from '@/lib/motion'
import { Grain } from '@/components/landing/Grain'

export function CtaBanner({ trial_days }: { trial_days: number }) {
  return (
    <section className=" mx-auto max-w-7xl px-4 lg:px-5 pb-8">
      <FadeUp>
        <div className="relative rounded-[30px] overflow-hidden bg-gradient-to-br from-[#2e2e2e] to-[#000000]">
          <Grain />

          <div className="relative flex flex-col-reverse lg:flex-row min-h-[300px] lg:min-h-[380px]">

            {/* Bal fél — szöveg */}
            <div className="flex items-center w-full lg:w-1/2 px-8 lg:px-12 py-8 lg:py-16 gap-8 lg:gap-10">
              {/* Hullámvonal */}
              <div className="shrink-0 hidden lg:block">
                <svg className="w-[100px] lg:w-[140px] h-auto" width="200" height="160" viewBox="0 0 200 160" fill="none" aria-hidden>
                  <motion.path
                    d="M0 130 C30 130 40 30 80 50 C120 70 130 110 160 90 C185 75 195 60 200 55"
                    stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: EASE }}
                  />
                </svg>
              </div>

              <div className="flex flex-col items-start gap-7 w-full">
                <h2
                  className="font-geist font-medium text-[#f4f2ee] leading-[1.05] tracking-[-0.05em]"
                  style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}
                >
                  Tartsd kézben a vállalkozásod minden percét.
                </h2>
                <motion.a
                  href="/register"
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  className="inline-flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-5 pr-2.5 font-onest font-medium text-base text-[#3b3b3b]"
                >
                  Kipróbálom ingyen
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
            </div>

            {/* Jobb fél — laptop kép */}
            <motion.div
              className="flex items-center justify-center w-full lg:w-1/2 px-5   lg:p-5 overflow-hidden"
              initial={{ y: 30, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <img
                src="/landing/cta/cta-laptop-davelopment-booking.webp"
                alt="davelopment booking dashboard"
                className="w-full h-auto rounded-[16px] lg:rounded-none"
              />
            </motion.div>

          </div>
        </div>
      </FadeUp>
    </section>
  )
}
