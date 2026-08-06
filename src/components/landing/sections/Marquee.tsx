'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  UtensilsCrossed, Scissors, HeartPulse, Dumbbell,
  Sparkles, Leaf, Wind, PawPrint, Brain, Camera,
  Wrench, BookOpen, Users, Stethoscope, Activity,
} from 'lucide-react'

// ── Főkategóriák → konkrétumok (SEO) ─────────────────────────────────────────
type Category = { name: string; Icon: LucideIcon }

const CATEGORIES: Category[] = [
  // Fő 5
  { name: 'Étterem',            Icon: UtensilsCrossed },
  { name: 'Szépségszalon',      Icon: Scissors },
  { name: 'Egészségügy',        Icon: HeartPulse },
  { name: 'Fitness',            Icon: Dumbbell },
  { name: 'Wellness & Spa',     Icon: Sparkles },
  // Konkrétumok
  { name: 'Fodrászat',          Icon: Scissors },
  { name: 'Borbély',            Icon: Scissors },
  { name: 'Masszázs',           Icon: Leaf },
  { name: 'Jóga & Pilates',     Icon: Wind },
  { name: 'Edzőterem',          Icon: Activity },
  { name: 'Kutyakozmetika',     Icon: PawPrint },
  { name: 'Állatorvos',         Icon: PawPrint },
  { name: 'Pszichológia',       Icon: Brain },
  { name: 'Coaching',           Icon: Users },
  { name: 'Fotózás',            Icon: Camera },
  { name: 'Autószerelő',        Icon: Wrench },
  { name: 'Oktatás',            Icon: BookOpen },
  { name: 'Fogászat',           Icon: Stethoscope },
]

const PAGE_BG = '#F7F7F7'

export function Marquee() {
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ['start end', 'start 0.35'],
  })
  const y       = useTransform(scrollYProgress, [0, 1], ['-100%', '0%'])
  const opacity = useTransform(scrollYProgress, [0, 0.15], [0, 1])
  const scale   = useTransform(scrollYProgress, [0, 1], [0.92, 1])

  const track: Category[] = [...CATEGORIES, ...CATEGORIES]

  return (
    <motion.div ref={wrapperRef} style={{ y, opacity, scale }}>
      <div className="mx-auto max-w-7xl px-4 lg:px-5 py-8 lg:py-12 flex flex-col lg:flex-row lg:items-center">

        {/* ── Bal — fix cím (HowItWorks-stílus) ──────────────────────────── */}
        <div className="shrink-0 flex flex-col items-start gap-4 pb-8 lg:pb-0 lg:w-[300px] lg:pr-10">
          <span className="inline-flex items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
            Kompatibilis
          </span>
          <h2 className="font-onest font-medium text-[clamp(2rem,5.5vw,3rem)] leading-[1.15] tracking-[-0.05em] text-brand-ink">
            Minden iparágban.
          </h2>
        </div>

        {/* ── Végtelen szalag ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden relative">
          {/* Bal fade */}
          <div
            className="absolute left-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
            style={{ background: `linear-gradient(to right, ${PAGE_BG}, transparent)` }}
          />
          {/* Jobb fade */}
          <div
            className="absolute right-0 top-0 bottom-0 w-24 z-10 pointer-events-none"
            style={{ background: `linear-gradient(to left, ${PAGE_BG}, transparent)` }}
          />

          <motion.div
            className="flex items-center gap-10 whitespace-nowrap py-2"
            style={{ width: 'max-content' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
          >
            {track.map(({ name, Icon }, i) => (
              <span
                key={i}
                className="inline-flex shrink-0 items-center gap-2.5 font-onest text-[26px] font-medium tracking-[-0.04em] text-brand-ink"
              >
                <Icon size={22} strokeWidth={1.5} />
                {name}
              </span>
            ))}
          </motion.div>
        </div>

      </div>
    </motion.div>
  )
}
