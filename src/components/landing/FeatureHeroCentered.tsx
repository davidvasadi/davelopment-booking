'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useInView, useMotionTemplate, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { EASE, SPRING_QUICK, SPRING_SNAPPY, buttonHover } from '@/lib/motion'
import { HeroNav } from '@/components/landing/sections/Hero'
import { useScrollHide } from '@/components/landing/useScrollHide'
import { FEATURE_GROUPS, type FeatureGroupId } from '@/lib/landingFeatures'

/** A főoldali hero gombja: kapszula + arany kör, rámutatásra átcsúszó nyíllal. */
export function HeroButton({ href, label, light = false, onDark = false, plain = false }: { href: string; label: string; light?: boolean; /** sötét felületen: áttetsző fehér (a ui-dark gomb beleolvadna) */ onDark?: boolean; /** letisztult: csak a felirat, a sárga nyíl-kör nélkül (főoldali hero) */ plain?: boolean }) {
  return (
    <motion.a
      href={href}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      className={`inline-flex items-center gap-2 rounded-full font-onest text-ui-row font-medium ${plain ? 'px-6 py-3' : 'py-1.5 pl-4 pr-1.5'} ${light ? 'bg-white text-ui-text' : onDark ? 'bg-[#4a4a4a] text-white transition-colors hover:bg-[#525252]' : 'bg-ui-dark text-white'}`}
    >
      {label}
      {!plain && <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ui-yellow">
        <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 32 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-4 w-4 text-ui-dark" />
        </motion.div>
        <motion.div className="absolute flex" variants={{ rest: { x: -32 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-4 w-4 text-ui-dark" />
        </motion.div>
      </span>}
    </motion.a>
  )
}

/**
 * Letisztult, középre zárt hero (sötét doboz, benne a menü, középen kis krém címke + nagy fehér
 * címsor + halvány alcím). Görgetésre ugyanúgy lejön a fix világos menüsor, mint a főoldalon.
 */
export function FeatureHeroCentered({ groupId, label, h1, lead, trialDays, breadcrumb, secondary = { href: '/arak', label: 'Árak' } }: {
  /** funkció-oldalon a csoport (a címke a neve); más oldalon (pl. /arak) helyette `label` */
  groupId?: FeatureGroupId
  label?: string
  /** a második (sötét) gomb */
  secondary?: { href: string; label: string }
  h1: string
  lead: string
  trialDays: number
  breadcrumb: React.ReactNode
}) {
  const pillLabel = label ?? FEATURE_GROUPS.find((g) => g.id === groupId)?.label ?? ''
  const [mounted, setMounted] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const heroInView = useInView(sectionRef, { once: false, amount: 0 })
  useEffect(() => setMounted(true), [])
  // a fix menü a hero után a görgetést követve bújik el / jön elő (lefelé ki, felfelé vissza)
  const navY = useScrollHide({ startHidden: true })
  // parallax: lefelé görgetve a hero tartalma lassabban megy, mint az oldal, és az ALJÁTÓL fölfelé fokozatosan eltűnik
  // (maszk, nem opacity — az egész szöveg áttetszővé válna, és átütne rajta a szemcse)
  const reduce = useReducedMotion()
  // (target: a szakaszt kitöltő, a tartalom ELŐTT álló réteg — a framer natív görgetés-idővonalához; ld. landing-concepts)
  const tl = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: tl, offset: ['start start', 'end start'] })
  // egy transform (nem y): így a framer natívan, hardveresen futtatja
  const contentY = useTransform(scrollYProgress, [0, 1], ['translateY(0px)', `translateY(${reduce ? 0 : 160}px)`])
  const fadeEdge = useTransform(scrollYProgress, [0.05, 1], [reduce ? 130 : 110, reduce ? 130 : -20])
  const fadeEnd = useTransform(fadeEdge, (v) => v + 35)
  const contentMask = useMotionTemplate`linear-gradient(to bottom, #000 ${fadeEdge}%, transparent ${fadeEnd}%)`

  return (
    <>
      {mounted && createPortal(
        <AnimatePresence>
          {!heroInView && (
            <motion.div
              className="fixed inset-x-0 top-0 z-[60]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', y: navY }}
            >
              <div className="px-4 lg:px-5 py-2.5">
                <HeroNav theme="light" pillId="feature-fixed-nav-pill-c" variant="plain" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <section ref={sectionRef} className="relative z-10 mx-auto px-4 lg:px-5 pt-3 pb-5">
        <div ref={tl} aria-hidden className="pointer-events-none absolute inset-0" />
        {/* belépők: framer, egy `transform`-mal (nem külön y/scale) — így a böngésző animálja (WAAPI) */}
        <motion.div
          initial={{ opacity: 0, transform: 'scale(0.96)' }}
          animate={{ opacity: 1, transform: 'scale(1)' }}
          transition={SPRING_QUICK}
          className="relative isolate flex min-h-[min(calc(100svh-32px),620px)] flex-col overflow-hidden rounded-[30px] px-5 lg:rounded-[48px] lg:px-8"
          // a design sötétje (ui-dark #383838), finom fény a jobb felső és árnyék a bal alsó sarokban
          // egyszínű, majdnem fekete (#1A1A1C), grain nélkül — Dave, 2026-11-10 (az Optivio hero-jának mintájára)
          style={{ background: '#1A1A1C' }}
        >
          <motion.div className="relative z-10 pt-4 lg:px-14 lg:pt-9" initial={{ opacity: 0, transform: 'translateY(-44px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={SPRING_SNAPPY}>
            <HeroNav variant="plain" />
          </motion.div>

          <motion.div style={{ transform: contentY, maskImage: contentMask, WebkitMaskImage: contentMask }} className="relative z-10 mx-auto flex max-w-[1080px] flex-1 flex-col items-center justify-center px-2 pb-14 pt-10 text-center lg:pb-16 lg:pt-10">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12, duration: 0.35 }} className="mb-6 [&_*]:!text-white/45 [&_a:hover]:!text-white [&_nav]:justify-center">
              {breadcrumb}
            </motion.div>
            <motion.span
              initial={{ opacity: 0, transform: 'translateY(8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ delay: 0.18, duration: 0.4, ease: EASE }}
              className="rounded-[8px] bg-[#FFF9E7] px-3 py-1.5 font-onest text-[14px] font-medium text-ui-text"
            >
              {pillLabel}
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, transform: 'translateY(16px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ delay: 0.24, duration: 0.6, ease: EASE }}
              className="mt-6 font-onest text-[clamp(2.2rem,4.2vw,56px)] font-medium leading-[1.06] tracking-[-0.045em] text-white"
            >
              {h1}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, transform: 'translateY(12px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ delay: 0.32, duration: 0.6, ease: EASE }}
              className="mt-5 max-w-[600px] font-onest text-[clamp(1rem,1.4vw,1.2rem)] leading-[1.6] tracking-[-0.02em] text-white/55"
            >
              {lead}
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.42, duration: 0.4 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <HeroButton href="/register" label="Ingyenes regisztráció" light />
              <HeroButton href={secondary.href} label={secondary.label} onDark />
            </motion.div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.4 }} className="mt-4 text-[13px] text-white/35">{trialDays} napig ingyenes · bármikor lemondható</motion.p>
          </motion.div>
        </motion.div>
      </section>
    </>
  )
}
