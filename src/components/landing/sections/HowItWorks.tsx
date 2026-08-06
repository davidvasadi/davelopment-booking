'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { motion, useInView } from 'framer-motion'
import { EASE, SPRING_QUICK } from '@/lib/motion'

const SPRING = { type: 'spring', stiffness: 300, damping: 60, mass: 1 } as const

// ── Lépések ────────────────────────────────────────────────────────────────
const STEPS = [
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

export function HowItWorks() {
  const [active, setActive] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const cardInView = useInView(cardRef, { once: true, margin: '-80px 0px' })

  return (
    <section id="hogyan" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28">
      {/* Fejléc */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className="flex flex-col gap-6 mb-12 lg:mb-14"
      >
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
          Hogyan működik
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <h2 className="font-semibold text-[clamp(2.25rem,5.5vw,72px)] leading-[0.94] tracking-[-0.05em] text-brand-ink max-w-2xl">
            Kezd el 3 egyszerű lépésben.
          </h2>
          <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-sm lg:pb-1">
            5 perc és éles vagy
          </p>
        </div>
      </motion.div>

      {/* Kártyák */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={cardInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.55, ease: EASE }}
        className="bg-white rounded-[13px] p-3 lg:p-5"
      >

        {/* ── Egységes layout: mobilon flex-col, desktopon flex-row ── */}
        <div className="flex flex-col gap-3 lg:flex-row lg:h-[360px]">
          {STEPS.map((step, i) => {
            const isActive = active === i
            return (
              <motion.div
                key={step.title}
                layout
                transition={SPRING}
                onMouseEnter={() => setActive(i)}
                className={[
                  'relative overflow-hidden rounded-[13px] bg-[#f7f7f7] cursor-pointer h-[360px] max-[520px]:h-auto max-[520px]:flex max-[520px]:flex-col',
                  isActive ? 'lg:flex-[2_1_0%]' : 'lg:flex-[1_1_0%]',
                ].join(' ')}
              >
                {/* Pontok — csak <520px, a kép felett */}
                <span className="hidden max-[520px]:flex items-center gap-1.5 px-5 pt-5 shrink-0">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <span key={j} className={`h-2.5 w-2.5 rounded-full ${j <= i ? 'bg-brand-accent' : 'bg-white'}`} />
                  ))}
                </span>

                {/* Screenshot — <520px: flex-1 középen; >=520px: abszolút jobb félben */}
                <div
                  className={[
                    'overflow-hidden transition-opacity duration-200 bg-[#f7f7f7]',
                    'absolute left-[calc(50%+6px)] right-0 top-0 bottom-0 rounded-r-[13px]',
                    'max-[520px]:relative max-[520px]:h-[400px] max-[520px]:left-0 max-[520px]:right-0 max-[520px]:top-0 max-[520px]:bottom-0 max-[520px]:mx-5 max-[520px]:mt-3 max-[520px]:rounded-[10px]',
                    isActive ? 'lg:opacity-100' : 'lg:opacity-0 lg:pointer-events-none',
                  ].join(' ')}
                >
                  <div className="relative w-full h-full bg-[#f7f7f7]">
                    <Image
                      src={step.img}
                      alt={step.alt}
                      fill
                      className="object-cover object-left-top"
                      sizes="(max-width: 520px) 90vw, (max-width: 1024px) 50vw, 30vw"
                    />
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
                      <span key={j} className={`h-2.5 w-2.5 rounded-full ${j <= i ? 'bg-brand-accent' : 'bg-white'}`} />
                    ))}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-onest font-medium text-[22px] leading-[1.25] tracking-[-0.05em] text-brand-ink">
                      {step.title}
                    </h3>
                    <p className="font-onest font-medium text-sm leading-relaxed text-brand-ink/60">
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
