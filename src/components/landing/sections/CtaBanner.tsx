'use client'

import { motion } from 'framer-motion'
import { FadeUp } from '@/components/landing/Motion'
import { RollButton } from '@/components/landing/sections/TestimonialButtons'
import { EASE } from '@/lib/motion'

export function CtaBanner({ trial_days }: { trial_days: number }) {
  return (
    <section className="mx-auto px-4 lg:px-5 pb-8">
      <FadeUp>
        <div className="relative pt-[60px]">
          <div
            className="relative rounded-[30px] overflow-hidden"
            style={{ background: '#222222' }}
          >
            <div className="relative z-10 flex items-center min-h-[280px] px-8 lg:px-12 py-10 lg:py-20 gap-8 lg:gap-12">
              {/* Hullámvonal — mobilon alul, desktopra bal */}
              <div className="shrink-0 hidden sm:block">
                <svg className="w-[120px] lg:w-[200px] h-auto" width="200" height="160" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <motion.path
                    d="M0 130 C30 130 40 30 80 50 C120 70 130 110 160 90 C185 75 195 60 200 55"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    fill="none"
                    initial={{ pathLength: 0, opacity: 0 }}
                    whileInView={{ pathLength: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.2, ease: EASE }}
                  />
                </svg>
              </div>

              {/* Cím + gomb */}
              <div className="flex flex-col items-start gap-7 lg:max-w-[40%]">
                <h2
                  className="font-geist font-medium text-[#f4f2ee] leading-[1.05] tracking-[-0.05em]"
                  style={{ fontSize: 'clamp(2rem, 5vw, 3.125rem)' }}
                >
                  Tartsd kézben a vállalkozásod minden percét.
                </h2>
                <RollButton href="/register" label="Kipróbálom ingyen" variant="accent" size="md" icon />
              </div>
            </div>
          </div>

          {/* Telefon — csak desktop */}
          <div className="hidden lg:block absolute right-[15%] top-0 w-[260px]">
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: EASE }}
              className="relative z-10"
              style={{ rotate: 3.7 }}
            >
              <img src="/app_screen.png" alt="davelopment booking app" className="w-full h-auto drop-shadow-2xl" />
            </motion.div>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}
