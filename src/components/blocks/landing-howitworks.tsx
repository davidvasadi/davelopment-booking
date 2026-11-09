'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import { RevealText } from '@/components/landing/Motion'
import { ImageIcon } from 'lucide-react'
import { EASE, SPRING_QUICK } from '@/lib/motion'

const SPRING = { type: 'spring', stiffness: 300, damping: 60, mass: 1 } as const

// ── Lépések ────────────────────────────────────────────────────────────────
export const STEPS = [
  {
    dots: 1,
    title: 'Válaszd ki az üzleted típusát',
    body: 'A rendszer betölt egy kész sablont — vagy kösd össze Google Business fiókoddal, és az adataid automatikusan kitöltődnek.',
    img: '/landing/howitworks/steps/valaszd-ki-az-uzleted-tipusat-davelopment-booking.webp',
    alt: 'Üzlettípus-választó képernyő',
  },
  {
    dots: 2,
    title: 'Megosztod a foglalási linket',
    body: 'A vendégeid megnyitják, kiválasztják az időpontot és foglalnak — mindenféle app nélkül.',
    img: '/landing/howitworks/steps/megosztod-a-foglalasi-linket-davelopment-booking.webp',
    alt: 'Publikus foglalási oldal',
  },
  {
    dots: 3,
    title: 'Indulj el — egyedül vagy csapatban',
    body: 'Hívd meg a munkatársaidat, mindenki a saját naptárán dolgozik. Ha most egyedül indulsz, bármikor bővítheted.',
    img: '/landing/howitworks/steps/indulj-el-egyedul-vagy-csapatban-davelopment-booking.webp',
    alt: 'Napi nézet csapattal',
  },
]

export function HowItWorks({
  id = 'hogyan',
  title,
  subtitle,
  steps,
  ownImages = false,
  visuals,
  look,
}: {
  id?: string
  /** Iparági landingeknél felülírja a homepage-alapértelmezett fejlécet. */
  title?: string
  subtitle?: string
  /** Iparági landingeknél felülírja a 3 lépés cím/szövegét (a képek megmaradnak — azok
   *  általános termék-screenshotok, nincs hozzájuk iparáganként külön asset). */
  steps?: { title: string; body: string; img?: string; alt?: string }[]
  /** Funkció-oldalak: a lépések saját képet kapnak; amíg nincs, helyőrző (nem a főoldali kép). */
  ownImages?: boolean
  /** Funkció-oldalak: kép helyett a dashboard design-kártyája lépésenként (src/components/blocks), kicsinyítve. */
  visuals?: React.ReactNode[]
  /** 'k2': a 2. landing-koncepció stílusa — középre zárt pill + cím, a lépések egyenesen a fehér oldalon */
  look?: 'k2'
} = {}) {
  const k2 = look === 'k2'
  const [active, setActive] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const cardInView = useInView(cardRef, { once: true, margin: '-80px 0px' })
  const resolvedSteps: { dots: number; title: string; body: string; img?: string; alt: string }[] = steps
    ? STEPS.map((s, i) => ({
        ...s,
        title: steps[i].title,
        body: steps[i].body,
        img: ownImages ? steps[i].img : s.img,
        alt: ownImages ? (steps[i].alt ?? steps[i].title) : s.alt,
      }))
    : STEPS

  return (
    <section id={id} className={`mx-auto px-4 lg:px-5 ${k2 ? 'max-w-6xl py-16 lg:py-24' : 'max-w-7xl py-20 lg:py-28'}`}>
      {/* Fejléc */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className={`flex flex-col gap-6 mb-12 lg:mb-14 ${k2 ? 'items-center text-center' : ''}`}
      >
        <span className={k2 ? 'inline-flex items-center rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 font-onest text-[14px] font-medium text-ui-text/80' : 'inline-flex self-start items-center rounded-ui-control bg-white px-3 py-1.5 font-onest text-ui-body font-medium text-ui-text'}>
          Hogyan működik
        </span>
        <div className={k2 ? 'flex flex-col items-center gap-4' : 'flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5'}>
          <RevealText text={title ?? 'Kezd el 3 egyszerű lépésben.'} className={k2 ? 'font-onest text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.08] tracking-[-0.035em] text-ui-text' : 'font-light text-ui-num lg:text-ui-page text-ui-text max-w-2xl'} />
          <p className={`text-ui-row text-ui-muted ${k2 ? '' : 'max-w-sm lg:pb-1'}`}>
            {subtitle ?? '5 perc és éles vagy'}
          </p>
        </div>
      </motion.div>

      {/* Kártyák */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={cardInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.55, ease: EASE }}
        className={k2 ? '' : 'bg-white rounded-ui-inner p-3 lg:p-5'}
      >

        {/* ── Egységes layout: mobilon flex-col, desktopon flex-row ── */}
        <div className={`flex flex-col gap-3 lg:flex-row ${k2 ? 'lg:h-[300px]' : 'lg:h-[360px]'}`}>
          {resolvedSteps.map((step, i) => {
            const isActive = active === i
            return (
              <motion.div
                key={step.title}
                layout
                transition={SPRING}
                onMouseEnter={() => setActive(i)}
                className={[
                  k2 ? 'relative overflow-hidden rounded-ui-container bg-ui-cell cursor-pointer h-[300px] max-[520px]:h-auto max-[520px]:flex max-[520px]:flex-col' : 'relative overflow-hidden rounded-ui-inner bg-ui-cell cursor-pointer h-[360px] max-[520px]:h-auto max-[520px]:flex max-[520px]:flex-col',
                  isActive ? 'lg:flex-[2_1_0%]' : 'lg:flex-[1_1_0%]',
                ].join(' ')}
              >
                {/* Pontok — csak <520px, a kép felett */}
                <span className="hidden max-[520px]:flex items-center gap-1.5 px-5 pt-5 shrink-0">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <span key={j} className={`h-2.5 w-2.5 rounded-full ${j <= i ? 'bg-ui-yellow' : 'bg-white'}`} />
                  ))}
                </span>

                {/* Screenshot — <520px: flex-1 középen; >=520px: abszolút jobb félben */}
                <div
                  className={[
                    'overflow-hidden transition-opacity duration-200 bg-ui-cell',
                    'absolute left-[calc(50%+6px)] right-0 top-0 bottom-0 rounded-r-ui-inner',
                    'max-[520px]:relative max-[520px]:h-[400px] max-[520px]:left-0 max-[520px]:right-0 max-[520px]:top-0 max-[520px]:bottom-0 max-[520px]:mx-5 max-[520px]:mt-3 max-[520px]:rounded-ui-control',
                    isActive ? 'lg:opacity-100' : 'lg:opacity-0 lg:pointer-events-none',
                  ].join(' ')}
                >
                  <div className="relative w-full h-full bg-ui-cell">
                    {visuals?.[i] ? (
                      <FitVisual>{visuals[i]}</FitVisual>
                    ) : step.img ? (
                      <Image
                        src={step.img}
                        alt={step.alt}
                        fill
                        className="object-cover object-left-top"
                        sizes="(max-width: 520px) 90vw, (max-width: 1024px) 50vw, 30vw"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-ui-cell text-ui-grey">
                        <ImageIcon className="h-10 w-10" strokeWidth={1.1} />
                        <span className="text-ui-meta font-medium">Kép hamarosan</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Szöveg — <520px: alul; >=520px: abszolút bal oldalon */}
                <div
                  className={[
                    'flex flex-col z-10',
                    'absolute left-5 w-[210px] top-5 bottom-5 justify-between',
                    'max-[520px]:static max-[520px]:w-auto max-[520px]:px-5 max-[520px]:pb-5 max-[520px]:pt-3 max-[520px]:shrink-0',
                  ].join(' ')}
                >
                  {/* Pontok — >=520px */}
                  <span className="flex max-[520px]:hidden items-center gap-1.5">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <span key={j} className={`h-2.5 w-2.5 rounded-full ${j <= i ? 'bg-ui-yellow' : 'bg-white'}`} />
                    ))}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-onest font-medium text-ui-title text-ui-text">
                      {step.title}
                    </h3>
                    <p className="font-onest font-medium text-ui-body leading-relaxed text-ui-muted">
                      {step.body}
                    </p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

      </motion.div>
    </section>
  )
}

/** A lépés design-kártyája a képhelyen, mint egy levágott képernyőkép: eredeti méretben (rendes betűkkel), a bal felső
 *  saroktól indul, kitölti a dobozt, és jobbra-lefelé túlnyúlik a kereten (ott levágódik). Kép-szerepű: nem kattintható. */
function FitVisual({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none overflow-hidden" aria-hidden>
      <div className="absolute -bottom-10 left-5 top-5 w-[460px] [&>*]:h-full">{children}</div>
    </div>
  )
}
