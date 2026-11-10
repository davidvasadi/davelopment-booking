'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { RevealText } from '@/components/landing/Motion'
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


/** A régi, szöveges iparág-szalag (ikon + név) — tartaléknak megmarad. */
export function MarqueeWords() {
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
          <span className="inline-flex items-center rounded-ui-control bg-white px-3 py-1.5 font-onest text-ui-body font-medium text-ui-text">
            Kompatibilis
          </span>
          <RevealText text="Minden iparágban." className="font-onest font-medium tracking-tighter text-ui-num lg:text-ui-page text-ui-text" />
        </div>

        {/* ── Végtelen szalag ──────────────────────────────────────────────── */}
        {/* a két szélen elhalványul — maszkkal, így bármilyen háttéren jó */}
        <div className="relative flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]">

          <motion.div
            className="flex items-center gap-10 whitespace-nowrap py-2"
            style={{ width: 'max-content' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
          >
            {track.map(({ name, Icon }, i) => (
              <span
                key={i}
                className="inline-flex shrink-0 items-center gap-2.5 font-onest text-ui-sub font-medium tracking-tight text-ui-text"
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

/* ── Fotós iparág-szalag (az appnext-féle képsor, a mi képeinkkel) ─────────────────────────────────────────────────
 * Teljes kijelző-szélességben, végtelenül forog; egy képre mutatva (telefonon koppintva) finoman felemelkedik, a
 * szalag megáll, és alatta kiíródik az iparág neve. Minden kép az iparági oldalára linkel (belső link — SEO), az
 * alt szöveg „<iparág> időpontfoglalás / asztalfoglalás”. Alatta a cím. */
const PHOTO_INDUSTRIES: { slug: string; name: string }[] = [
  { slug: 'fodrasz-idopontfoglalas', name: 'Fodrász' },
  { slug: 'kavezo-asztalfoglalas', name: 'Kávézó' },
  { slug: 'pilates-idopontfoglalas', name: 'Pilates' },
  { slug: 'kozmetikus-idopontfoglalas', name: 'Kozmetikus' },
  { slug: 'fine-dining-asztalfoglalas', name: 'Fine dining' },
  { slug: 'joga-idopontfoglalas', name: 'Jóga' },
  { slug: 'masszor-idopontfoglalas', name: 'Masszőr' },
  { slug: 'etterem-asztalfoglalas', name: 'Étterem' },
  { slug: 'mukormos-idopontfoglalas', name: 'Műkörmös' },
  { slug: 'csontkovacs-idopontfoglalas', name: 'Csontkovács' },
  { slug: 'pizzeria-asztalfoglalas', name: 'Pizzéria' },
  { slug: 'maganrendelo-idopontfoglalas', name: 'Magánrendelő' },
  { slug: 'barber-idopontfoglalas', name: 'Barber' },
  { slug: 'fogorvos-idopontfoglalas', name: 'Fogorvos' },
  { slug: 'szemelyi-edzo-idopontfoglalas', name: 'Személyi edző' },
]

/** Babérág (a díj-jelvény két oldala): leveles ív, alulról felfelé; `flip` a jobb oldali tükörkép.
 *  A levelek koordinátái előre kiszámolva és kerekítve — futásidejű trigonometria szerver ↔ kliens lebegőpontos eltérést (hydration-hibát) okozott. */
function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="2 2 62 98" aria-hidden className={`h-20 w-auto fill-current ${flip ? '-scale-x-100' : ''}`}>
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(57.9 87.2) rotate(216.0) scale(0.62)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(57.9 87.2) rotate(300.0) scale(0.62)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(47.6 87.9) rotate(-128.4) scale(0.67)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(47.6 87.9) rotate(-44.4) scale(0.67)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(37.5 85.9) rotate(-112.7) scale(0.72)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(37.5 85.9) rotate(-28.7) scale(0.72)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(28.3 81.2) rotate(-97.1) scale(0.76)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(28.3 81.2) rotate(-13.1) scale(0.76)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(20.7 74.1) rotate(-81.5) scale(0.78)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(20.7 74.1) rotate(2.5) scale(0.78)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(15.2 65.3) rotate(-65.8) scale(0.8)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(15.2 65.3) rotate(18.2) scale(0.8)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(12.4 55.4) rotate(-50.2) scale(0.8)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(12.4 55.4) rotate(33.8) scale(0.8)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(12.3 45.1) rotate(-34.5) scale(0.78)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(12.3 45.1) rotate(49.5) scale(0.78)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(15.0 35.1) rotate(-18.9) scale(0.76)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(15.0 35.1) rotate(65.1) scale(0.76)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(20.4 26.2) rotate(-3.3) scale(0.72)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(20.4 26.2) rotate(80.7) scale(0.72)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(27.9 19.1) rotate(12.4) scale(0.67)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(27.9 19.1) rotate(96.4) scale(0.67)" />
      <path d="M0 0C3.2-2.6 3.6-8.6 0-13.5C-3.6-8.6-3.2-2.6 0 0Z" transform="translate(37.0 14.3) rotate(70.0) scale(0.62)" />
    </svg>
  )
}

export function Marquee({ pill, laurel }: { /** koncepció 2: pill-címke a cím fölött */ pill?: string; /** koncepció 2: babérágas „díj”-jelvény a cím helyén (két sor) */ laurel?: [string, string] } = {}) {
  const track = [...PHOTO_INDUSTRIES, ...PHOTO_INDUSTRIES]
  // érintőképernyőn az első koppintás csak kiemeli a képet és kiírja a szakma nevét (a szalag megáll); a NÉV a link
  // (különben a koppintás azonnal elvinne, és a felugró név sosem látszana). Gépen: rámutatásra felugrik, kattintásra visz.
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    if (open === null) return
    const close = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest('[data-mq-card]')) setOpen(null) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <section className="w-full overflow-hidden py-10 lg:py-16">
      {/* a teljes kijelző szélességében; a két szélen enyhén elhalványul */}
      <div className="[mask-image:linear-gradient(to_right,transparent,black_4rem,black_calc(100%-4rem),transparent)]">
        <div className="ui-photo-marquee flex w-max gap-2.5 pb-4 pt-11 lg:gap-3" style={open !== null ? { animationPlayState: 'paused' } : undefined}>
          {track.map((it, i) => {
            const dup = i >= PHOTO_INDUSTRIES.length, on = open === i, href = `/${it.slug}`
            return (
              <div key={i} data-mq-card aria-hidden={dup || undefined} className="group relative block w-[150px] shrink-0 lg:w-[200px]">
                <button type="button" tabIndex={-1} aria-label={it.name}
                  onClick={() => { if (window.matchMedia('(hover: hover)').matches) { window.location.href = href; return } setOpen(on ? null : i) }}
                  className="block w-full cursor-pointer outline-none">
                  <span className={`block aspect-square overflow-hidden rounded-ui-card transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-y-9 group-focus-within:-translate-y-9 ${on ? '-translate-y-9' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/landing/marquee/${it.slug}-davelopment-booking.webp`} alt={`${it.name} ${it.slug.endsWith('asztalfoglalas') ? 'asztalfoglalás' : 'időpontfoglalás'} — davelopment booking`} loading="lazy" decoding="async" width={400} height={400} className="h-full w-full object-cover" />
                  </span>
                </button>
                {/* az iparág neve — EZ a link: felemelkedéskor (rámutatás / koppintás) beúszik a kép alá */}
                <a href={href} tabIndex={dup ? -1 : undefined}
                  className={`absolute inset-x-0 top-full -mt-8 inline-flex items-center justify-center gap-1 text-center font-onest text-ui-title font-medium leading-none tracking-tight text-ui-text outline-none transition-all duration-500 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 ${on ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'}`}>
                  {it.name}<span aria-hidden className="text-ui-muted">›</span>
                </a>
              </div>
            )
          })}
        </div>
      </div>
      {laurel ? (
        <div className="mt-12 flex items-center justify-center gap-3 px-4 font-onest text-ui-grey">
          <Laurel />
          <div className="text-center text-ui-title font-medium leading-tight tracking-[-0.02em] lg:text-ui-sub">{laurel[0]}<br />{laurel[1]}</div>
          <Laurel flip />
        </div>
      ) : (
      <div className="mt-10 px-4 text-center">
        {pill && <span className="mb-5 inline-flex items-center rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 font-onest text-[14px] font-medium text-ui-text/80">{pill}</span>} {/* ui-allow: a CtaGlow pillje (8 / 14 px) */}
        <RevealText text="Minden iparágban." className="font-onest font-medium tracking-tighter text-ui-num text-ui-muted lg:text-ui-page" />
      </div>
      )}
    </section>
  )
}
