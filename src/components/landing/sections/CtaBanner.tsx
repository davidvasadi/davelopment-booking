'use client'

import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { FadeUp } from '@/components/landing/Motion'
import { SpinButton } from '@/components/landing/LandingButton'
import { PhoneMockupSVG } from '@/components/landing/Mockups'

const CHECKLIST = [
  'Automatikus visszaigazolás',
  'Valós idejű naptár',
  'Munkatárs-kezelés',
  'Bevétel-statisztikák',
]

/** Sötét záró-CTA banner: copy + checklist + kilógó telefon-mockup, dekoratív hullámmal. */
export function CtaBanner({ trial_days }: { trial_days: number }) {
  return (
    <section className="mx-auto px-4 lg:px-5 pb-8">
      <FadeUp>
        <div className="rounded-[2rem] bg-brand-ink overflow-hidden relative">
          {/* Decorative wave */}
          <svg className="absolute left-0 bottom-0 opacity-10 pointer-events-none" viewBox="0 0 400 220" width="400" height="220">
            <path d="M0,160 Q80,60 160,120 Q240,180 320,80 Q380,20 400,60" fill="none" stroke="#ecf95a" strokeWidth="2" />
            <path d="M0,190 Q80,90 160,150 Q240,210 320,110 Q380,50 400,90" fill="none" stroke="#ecf95a" strokeWidth="1" opacity="0.5" />
            <path d="M0,130 Q80,30 160,90 Q240,150 320,50 Q380,0 400,30" fill="none" stroke="#ecf95a" strokeWidth="0.5" opacity="0.3" />
          </svg>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center">
            {/* Left copy */}
            <div className="p-10 lg:p-14 relative z-10">
              <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/60 mb-5">
                Kezdj el ma
              </span>
              <h2 className="text-3xl lg:text-5xl font-black tracking-tighter text-white leading-tight">
                Tartsd kézben
                <br />a vállalkozásod
                <br />minden percét.
              </h2>
              <p className="mt-5 text-white/50 leading-relaxed max-w-sm">
                {trial_days} nap ingyen, bankkártya nélkül. Beállítás 5 perc. Lemondás egy kattintás.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <SpinButton href="/register" label="Ingyenes próba" variant="light" />
                <SpinButton href="/davelopment" label="Demó megnézése" variant="dark" />
              </div>

              {/* Checklist */}
              <ul className="mt-8 space-y-2">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-white/60">
                    <CheckCircle2 className="h-4 w-4 text-brand-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Phone mockup spilling out */}
            <div className="flex justify-center lg:justify-end lg:pr-0 overflow-hidden relative">
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-[220px] lg:w-[260px] lg:mr-12 lg:-mb-8"
              >
                <PhoneMockupSVG />
              </motion.div>
            </div>
          </div>
        </div>
      </FadeUp>
    </section>
  )
}
