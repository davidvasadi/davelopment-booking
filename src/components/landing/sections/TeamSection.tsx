'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, useInView, animate } from 'framer-motion'
import { EASE, SPRING_QUICK, staggerContainer, fadeUp, buttonHover } from '@/lib/motion'
import { ArrowRight } from 'lucide-react'
import { Grain } from '@/components/landing/Grain'

const cardV = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.06 },
  },
} as const

const imgV = {
  hidden: { opacity: 0, y: 36 },
  show: { opacity: 1, y: 0, transition: { duration: 0.62, ease: EASE } },
} as const

function useCard() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px 0px' })
  return { ref, animate: inView ? 'show' : 'hidden' } as const
}

// ─── Viewport-triggered count-up ─────────────────────────────────────────────

function CountUp({
  to,
  prefix = '',
  suffix = '',
  duration = 1.3,
  decimals = 0,
}: {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  decimals?: number
}) {
  const [val, setVal] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, {
      duration,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      onUpdate: (v) => setVal(parseFloat(v.toFixed(decimals))),
    })
    return c.stop
  }, [inView, to, duration, decimals])

  const display = decimals > 0 ? val.toFixed(decimals) : val.toLocaleString('hu-HU')
  return <span ref={ref}>{prefix}{display}{suffix}</span>
}

// ─── 4 stat kártya ────────────────────────────────────────────────────────────

const STATS = [
  {
    label: '(Saját nézet)',
    render: () => <CountUp to={100} suffix="%" />,
    sub: 'Mindenki csak a saját beosztását és foglalásait látja — semmi felesleges zaj.',
  },
  {
    label: '(Kevesebb ütközés)',
    render: () => <CountUp to={40} prefix="−" suffix="%" />,
    sub: 'Kevesebb beosztási ütközés — a rendszer azonnal jelez, ha két foglalás fedi egymást.',
  },
  {
    label: '(Gyors beállítás)',
    render: () => <CountUp to={5} suffix=" perc" />,
    sub: 'Ennyi idő alatt kap saját hozzáférést és naptárat minden munkatárs.',
  },
  {
    label: '(Heti megtakarítás)',
    render: () => <CountUp to={8} prefix="+" suffix=" óra" />,
    sub: 'A szakember maga kezeli a szabadnapjait — nincs telefonos egyeztetés.',
  },
]


// ─── Section ──────────────────────────────────────────────────────────────────

export function TeamSection() {
  const cImg = useCard()
  const cCta = useCard()

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-4">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className="flex flex-col gap-6 mb-12 lg:mb-14"
      >
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
          Csapat
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <h2 className="font-semibold text-[clamp(2.25rem,5.5vw,72px)] leading-[0.94] tracking-[-0.05em] text-brand-ink max-w-2xl">
            Az egész csapat,<br className="hidden sm:block" /> egy képernyőn.
          </h2>
          <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-sm lg:pb-1">
            Beosztások, teljesítmény, kommunikáció — mindenki látja, ami rá tartozik.
          </p>
        </div>
      </motion.div>

      {/* 4 stat kártya — stagger belépő */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-80px 0px' }}
      >
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            whileHover={{ y: -5, transition: { duration: 0.18, ease: EASE } }}
            className="relative overflow-hidden flex flex-col justify-between rounded-[22px] bg-gradient-to-b from-[#3a3835] to-[#0d0c0a] px-6 py-6 min-h-[220px] lg:min-h-[260px] cursor-default"
          >

            {/* Top row: label + dots */}
            <div className="relative flex items-start justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-widest" style={{ color: '#F1CE45' }}>
                {s.label}
              </span>
              <div className="flex items-center gap-[5px] shrink-0 pt-0.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <span key={j} className="h-[8px] w-[8px] rounded-full"
                    style={{ background: j <= i ? '#ffffff' : 'rgba(255,255,255,0.18)' }} />
                ))}
              </div>
            </div>

            <div className="relative">
              <p className="font-semibold text-white text-[clamp(1.9rem,4vw,2.75rem)] leading-[1.05] tracking-[-0.06em]">
                {s.render()}
              </p>
              <p className="font-semibold text-[#cbcbcb] text-[11px] tracking-[-0.02em] mt-2">
                {s.sub}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Screenshot + CTA sor */}
      <div className="flex flex-col lg:flex-row gap-3">

        {/* Nagy kép */}
        <motion.div
          ref={cImg.ref} variants={cardV} initial="hidden" animate={cImg.animate}
          className="lg:w-[65%] rounded-[22px] overflow-hidden min-h-[320px] lg:min-h-[500px]"
        >
          <motion.div variants={imgV} className="w-full h-full rounded-[13px] bg-[#f7f7f7] overflow-hidden">
            <img
              src="/landing/teamsection/munkatarsak-davelopment-booking.jpg"
              alt="Munkatársak — davelopment booking"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </motion.div>

        {/* CTA kártya */}
        <motion.div
          ref={cCta.ref} variants={cardV} initial="hidden" animate={cCta.animate}
          className="lg:w-[35%] rounded-[22px] min-h-[320px] lg:min-h-[500px] p-8 flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#3a3835] to-[#000000]"
        >
          <Grain />
          <motion.span variants={imgV} className="relative text-[11px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>
            (Próbáld ki)
          </motion.span>
          <motion.div variants={imgV} className="relative flex flex-col gap-4">
            <h3 className="font-semibold text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.05em] text-white">
              Adj hozzáférést minden munkatársnak.
            </h3>
            <p className="text-[16px] leading-[1.6]" style={{ color: 'rgba(255,255,255,.5)' }}>
              5 perc alatt mindenki a saját nézetén dolgozik — nincs IT, nincs telepítés.
            </p>
          </motion.div>
          <motion.div variants={imgV} className="relative">
            <motion.a
              href="/register"
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              className="inline-flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-5 pr-2.5 font-onest font-medium text-base text-[#3b3b3b] self-start"
            >
              Ingyenes regisztráció
              <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#f1ce45' }}>
                <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
                <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                  <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
                </motion.div>
              </span>
            </motion.a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
