'use client'

import { motion } from 'framer-motion'
import { EASE, SPRING_QUICK, SPRING_SNAPPY } from '@/lib/motion'
import { HeroNav } from '@/components/landing/sections/Hero'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
import { GrainCanvas, DARK_SURFACE_BG } from '@/components/landing/GrainCanvas'

/**
 * A 404 oldal hero-ja — ugyanaz a sötét, középre zárt doboz, mint a funkció-oldalaké (benne a
 * menü), középen óriás, halványuló „404”, alatta a cím (h1), magyarázat és két gomb.
 */
export function NotFoundHero() {
  return (
    <section className="relative z-10 mx-auto px-4 pb-5 pt-3 lg:px-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={SPRING_QUICK}
        className="relative isolate flex min-h-[calc(100svh-32px)] flex-col overflow-hidden rounded-[30px] px-5 lg:px-8"
        style={{ background: DARK_SURFACE_BG }}
      >
        <GrainCanvas strength="light" opacity={0.8} zIndex={-1} />
        <motion.div className="relative z-10 pt-4 lg:pt-5" initial={{ y: -44, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SPRING_SNAPPY}>
          <HeroNav variant="plain" />
        </motion.div>

        <div className="relative z-10 mx-auto flex max-w-[1080px] flex-1 flex-col items-center justify-center px-2 pb-20 pt-10 text-center">
          <motion.p
            aria-hidden
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8, ease: EASE }}
            className="select-none bg-gradient-to-b from-white/70 to-white/15 bg-clip-text font-onest text-[clamp(7rem,24vw,280px)] font-medium leading-[0.9] tracking-[-0.06em] text-transparent"
          >
            404
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.6, ease: EASE }}
            className="mt-8 font-onest text-[clamp(1.75rem,3.4vw,44px)] font-medium leading-[1.1] tracking-[-0.045em] text-white"
          >
            Ez az oldal nem található.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.6, ease: EASE }}
            className="mt-5 max-w-[520px] font-onest text-[clamp(1rem,1.4vw,1.15rem)] leading-[1.6] tracking-[-0.02em] text-white/55"
          >
            A link elavult, a címet elgépelték, vagy az oldal már nem létezik. Innen visszatalálsz:
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.46, duration: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-3"
          >
            <HeroButton href="/" label="Vissza a főoldalra" light />
            <HeroButton href={'/funkciok'} label="Funkciók" />
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
