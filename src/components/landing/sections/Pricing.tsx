'use client'

import { motion } from 'framer-motion'
import { WalletMinimal, SquareKanban, Check, ArrowRight } from 'lucide-react'
import { EASE, SPRING_QUICK, buttonHover } from '@/lib/motion'
import { ftFmt, type LandingPricing } from '@/components/landing/types'

function HeroButton({ href, label, dark }: { href: string; label: string; dark?: boolean }) {
  return (
    <motion.a
      href={href}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      className={`inline-flex w-full items-center justify-between gap-2.5 rounded-full py-2.5 pl-5 pr-2.5 font-onest font-medium text-[17px] ${dark ? 'text-[#f5f5f5]' : 'text-[#3b3b3b] bg-white'}`}
      style={dark ? { background: '#2a2720' } : undefined}
    >
      {label}
      <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: '#f1ce45' }}>
        <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
        </motion.div>
        <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-[18px] w-[18px]" style={{ color: '#1d1c19' }} />
        </motion.div>
      </span>
    </motion.a>
  )
}

export function Pricing({ pricing }: { pricing: LandingPricing }) {
  const salonFeatures = [
    'Korlátlan időpont és ügyfél',
    'Több munkatárs, saját naptárral',
    `Extra naptár: +${ftFmt(pricing.salon_extra_staff_huf)}/hó`,
    'Automatikus email visszaigazolás',
    'Publikus foglalási link azonnal megosztható',
    'Valós idejű naptár-szinkron',
    'Mobilbarát rendszerfelület',
  ]

  const restaurantFeatures = [
    'Korlátlan asztal és foglaló',
    'Interaktív asztaltérkép és kapacitáskezelés',
    'Csoportos foglalás és előleg-kezelés',
    'Automatikus vendégemlékeztető emailben',
    'Publikus asztalfoglaló oldal',
    'Napi forgalom- és vendégjelentés',
    'Prioritásos ügyfélszolgálat',
  ]

  return (
    <section id="arazas" className="mx-auto max-w-7xl px-4 lg:px-5 py-20 lg:py-28 flex flex-col gap-12">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className="flex flex-col gap-6"
      >
        <span className="inline-flex self-start items-center rounded-full bg-white px-4 py-2 font-onest text-[20px] tracking-[-0.06em] text-brand-ink">
          Árak
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <h2 className="font-semibold text-[clamp(2.25rem,5.5vw,72px)] leading-[0.94] tracking-[-0.05em] text-brand-ink">
            Egyszerű, tiszta árazás.
          </h2>
          <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-sm lg:pb-1">
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindkettő {pricing.trial_days} napig ingyenes, kártya nélkül.
          </p>
        </div>
      </motion.div>

      {/* Kártyák */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch max-w-[1200px] mx-auto w-full">

        {/* Szakemberek */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px 0px' }}
          transition={{ duration: 0.55, ease: EASE, delay: 0 }}
          className="flex flex-col gap-7 rounded-[24px] bg-white px-7 py-7"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#f4f1e9]">
            <WalletMinimal className="h-5 w-5 text-brand-ink" strokeWidth={1.75} />
          </span>

          <div>
            <p className="font-semibold text-[22px] tracking-[-0.03em] text-brand-ink">Szakemberek</p>
            <p className="text-[14px] text-brand-ink/50 mt-1">Fodrász, masszőr, kozmetikus, edzőterem</p>
          </div>

          <p className="font-semibold text-[clamp(2.25rem,4.5vw,52px)] leading-[0.95] tracking-[-0.06em] text-brand-ink">
            {ftFmt(pricing.salon_pro_huf)}<span className="text-[0.4em] tracking-normal font-medium"> /hó</span>
          </p>

          <ul className="flex flex-col gap-3 flex-1">
            {salonFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px] leading-[1.4] text-brand-ink/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: '#4a7a2a' }}>
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <HeroButton href="/register" label="Kipróbálom ingyen" dark />
        </motion.div>

        {/* Étterem */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px 0px' }}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          className="flex flex-col gap-7 rounded-[24px] bg-brand-accent px-7 py-7"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white">
            <SquareKanban className="h-5 w-5 text-brand-ink" strokeWidth={1.75} />
          </span>

          <div>
            <p className="font-semibold text-[22px] tracking-[-0.03em] text-brand-ink">Éttermek</p>
            <p className="text-[14px] text-brand-ink/55 mt-1">Asztaltérkép, csoportok, előleg</p>
          </div>

          <p className="font-semibold text-[clamp(2.25rem,4.5vw,52px)] leading-[0.95] tracking-[-0.06em] text-brand-ink">
            {ftFmt(pricing.restaurant_pro_huf)}<span className="text-[0.4em] tracking-normal font-medium"> /hó</span>
          </p>

          <ul className="flex flex-col gap-3 flex-1">
            {restaurantFeatures.map((f) => (
              <li key={f} className="flex items-start gap-3 text-[15px] leading-[1.4] text-brand-ink/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: '#4a7a2a' }}>
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {f}
              </li>
            ))}
          </ul>

          <HeroButton href="/register-restaurant" label="Kipróbálom ingyen" />
        </motion.div>

      </div>
    </section>
  )
}
