'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { FadeUp } from '@/components/landing/Motion'
import { SpinButton } from '@/components/landing/LandingButton'
import { DashboardSVG, PhoneMockupSVG, TabletMockupSVG } from '@/components/landing/Mockups'
import { TextReveal } from '@/components/motion/TextReveal'

/** „Hogyan működik" szekció: dashboard-, telefon- és tablet-mockup, parallax-os telefon. */
export function Demo() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [30, -30])

  return (
    <section ref={ref} className="mx-auto px-4 lg:px-5 py-20 lg:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left: Dashboard SVG card */}
        <FadeUp>
          <div className="rounded-[2rem] bg-[#111] p-4 shadow-2xl shadow-black/30 overflow-hidden">
            <DashboardSVG />
          </div>
        </FadeUp>

        {/* Right: copy */}
        <div className="lg:pl-6">
          <FadeUp>
            <span className="inline-block rounded-full bg-brand-surface px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-6">
              Dashboard
            </span>
          </FadeUp>
          <TextReveal
            text="Minden adat egy helyen. Azonnal."
            className="text-3xl lg:text-5xl font-black tracking-tighter leading-[1]"
          />
          <FadeUp delay={0.15}>
            <p className="mt-6 text-zinc-500 leading-relaxed">
              A Schedulio dashboard-on egyetlen pillantással látod a napi foglalásokat,
              a havi bevételt és a kihasználtságot. Nincs több szétszórt Excel-táblázat,
              telefon-egyeztetés vagy elveszett papír.
            </p>
            <p className="mt-4 text-zinc-500 leading-relaxed">
              Beállítod, és megy magától — te csak a munkádra figyelj.
            </p>
            <div className="mt-8">
              <SpinButton href="/davelopment" label="Megnyitom a demót" variant="dark" />
            </div>
          </FadeUp>
        </div>
      </div>

      {/* Phone mockup below — yellow card */}
      <FadeUp className="mt-16" delay={0.1}>
        <div className="rounded-[2rem] bg-brand-accent overflow-hidden p-8 lg:p-14 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 order-2 lg:order-1">
            <span className="inline-block rounded-full bg-brand-ink/10 px-3 py-1 text-[11px] font-semibold text-brand-ink mb-5">
              Mobilalkalmazás
            </span>
            <h3 className="text-3xl lg:text-4xl font-black tracking-tighter text-brand-ink leading-tight">
              Foglaláslista a zsebedben.
            </h3>
            <p className="mt-4 text-brand-ink/70 leading-relaxed max-w-sm">
              Az ügyfeled telefonról foglal — te telefonon látod. Bármikor, bárhol.
              Az értesítések azonnal megérkeznek, a módosításokat valós időben követheted.
            </p>
          </div>
          <div className="flex-shrink-0 order-1 lg:order-2 w-[200px] lg:w-[240px]">
            <motion.div style={{ y }}>
              <PhoneMockupSVG />
            </motion.div>
          </div>
        </div>
      </FadeUp>

      {/* Tablet mockup */}
      <FadeUp className="mt-8" delay={0.05}>
        <div className="rounded-[2rem] bg-brand-surface overflow-hidden p-6 lg:p-10">
          <div className="mb-6">
            <span className="inline-block rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-zinc-500 mb-3">
              Asztalfoglalás
            </span>
            <h3 className="text-2xl lg:text-3xl font-black tracking-tighter text-brand-ink">
              Éttermeknek: vizuális asztaltérkép.
            </h3>
            <p className="mt-2 text-zinc-500 text-sm max-w-lg">
              Lista, időszalagos vagy teremnézet — ahogy neked kényelmes. Minden asztal,
              minden időpont egy képernyőn.
            </p>
          </div>
          <TabletMockupSVG />
        </div>
      </FadeUp>
    </section>
  )
}
