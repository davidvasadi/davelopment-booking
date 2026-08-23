'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPRING_QUICK, SPRING_SNAPPY, EASE, buttonHover } from '@/lib/motion'
import { ftFmt, type LandingPricing } from '@/components/landing/types'
import { businessMonthlyFee, monthlyEmailCapForTier } from '@/lib/tier'
import { NotchedPricingCard } from '@/components/dashboard/NotchedPricingCard'
import { HeroButton } from '@/components/landing/HeroButton'

/**
 * Árazás — üzlettípus-váltó (a `SegmentToggle.tsx` pill-mintája, saját `layoutId`-val, hogy ne
 * ütközzön a "Látod mi történik" szekció toggle-jével) FÖLÖTT, alatta 3 kártyás létra
 * (Starter/Pro/Egyedi) mindkét oldalon. A hírlevél-küldés BEÉPÍTVE jár mindhárom csomagba —
 * csak a havi email-keret (a kártyák `sub`-ja) tér el köztük, nincs önálló hírlevél-fizetés.
 */

type Segment = 'salon' | 'restaurant'

const REGISTER_HREF: Record<Segment, string> = {
  salon: '/register',
  restaurant: '/register-restaurant',
}

function segmentLadder(seg: Segment, pricing: LandingPricing) {
  const noun = seg === 'restaurant' ? 'Étterem' : 'Szalon'
  const starterCap = monthlyEmailCapForTier(pricing, 'starter')
  const proCap = monthlyEmailCapForTier(pricing, 'pro')
  const starterFee = businessMonthlyFee(pricing, seg, 1, 'starter')
  const proFee = businessMonthlyFee(pricing, seg, 1, 'pro')

  // A Starter funkcionálisan MEGEGYEZIK a Próval — az egyetlen valós különbség a havi
  // hírlevél-email-keret, ezért ugyanaz a feat-lista, csak az utolsó sor kerete tér el.
  const baseFeats = seg === 'salon'
    ? [
      'Saját foglaló oldal, ami éjjel-nappal hoz neked időpontot',
      'Csapat-jogosultságkezelés — ki mit láthat és módosíthat',
      'Vendég-előleg beszedése foglaláskor (Stripe)',
      'Automata számlázás a saját Számlázz.hu/Billingo fiókodból',
      'Ajándékutalvány-értékesítés a foglaló oldaladon',
      'Élő analitika + vendég-térkép — lásd, honnan jönnek',
      'Emlékeztetők, várólista, értékelés-kérés — automatikusan',
    ]
    : [
      'Interaktív asztaltérkép, valós idejű kapacitással',
      'Csoportos foglalás és előleg-kezelés egy helyen',
      'Csapat-jogosultságkezelés — ki mit láthat és módosíthat',
      'Automata számlázás a saját Számlázz.hu/Billingo fiókodból',
      'Ajándékutalvány-értékesítés a foglaló oldaladon',
      'Élő analitika + vendég-térkép — lásd, honnan jönnek',
      'Napi forgalom- és vendégjelentés',
    ]
  const starterFeats = [
    ...baseFeats.map((label) => ({ label, included: true })),
    { label: `Hírlevél-küldés — ${starterCap.toLocaleString('hu-HU')} email/hó`, included: true },
  ]
  const proFeats = [
    ...baseFeats.map((label) => ({ label, included: true })),
    { label: `Hírlevél-küldés — ${proCap.toLocaleString('hu-HU')} email/hó`, included: true },
  ]

  // Egyedi: díjcsomag megegyezés alapján, ezért nincs kiírt keret-szám — a hírlevél-küldés
  // korlátlanként kommunikálva (a valós plafont a `pricing-settings` global magasra állítja).
  const customFeats = [
    { label: 'Minden a Próból', included: true },
    { label: 'Több telephely egy fiókban', included: true },
    { label: 'Egyedi fejlesztés az igényeidre', included: true },
    { label: 'Testreszabott foglaló + arculat', included: true },
    { label: 'Dedikált kapcsolattartó', included: true },
    { label: 'Prioritásos támogatás & SLA', included: true },
    { label: 'Korlátlan hírlevél-küldés', included: true },
    { label: 'API-hozzáférés egyedi integrációkhoz', included: true },
    { label: 'Egyedi riportok és exportálás', included: true },
    { label: 'Rugalmas, egyedi fizetési feltételek', included: true },
  ]

  return { noun, starterFee, proFee, starterFeats, proFeats, customFeats }
}

export function Pricing({ pricing }: { pricing: LandingPricing }) {
  const [active, setActive] = useState<Segment>('salon')
  const { noun, starterFee, proFee, starterFeats, proFeats, customFeats } = segmentLadder(active, pricing)

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
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindegyik {pricing.trial_days} napig ingyenes, kártya nélkül.
          </p>
        </div>

        {/* Üzlettípus-váltó — a "Látod mi történik" szekció pill-mintája, saját layoutId-val. */}
        <div className="flex items-center gap-1 self-start rounded-full bg-white p-2.5">
          {(['salon', 'restaurant'] as const).map((seg) => {
            const label = seg === 'salon' ? 'Szakembereknek' : 'Éttermeknek'
            const isActive = active === seg
            return (
              <motion.button
                key={seg}
                type="button"
                onClick={() => setActive(seg)}
                variants={buttonHover}
                initial="rest"
                whileHover="hover"
                className="relative rounded-full px-5 py-3 text-[15px] font-onest font-light tracking-[-0.04em] transition-colors duration-200 sm:px-6 sm:py-4 sm:text-[17px]"
                style={{ color: isActive ? '#ffffff' : '#3B3B3B' }}
              >
                {isActive && (
                  <motion.span
                    layoutId="pricing-seg-pill"
                    className="absolute inset-0 rounded-full bg-brand-ink"
                    transition={SPRING_SNAPPY}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Kártyák — a dashboard bemart-sarkú `NotchedPricingCard`-ja, egységes stílus */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch max-w-[1400px] mx-auto w-full font-onest"
        >
          <NotchedPricingCard
            featured={false}
            badgeLabel="Belépő"
            dotColor="#A8A496"
            title="Starter"
            priceMain={ftFmt(starterFee).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub={active === 'salon' ? '1 munkatárs/naptár' : 'A legfontosabb alapok'}
            feats={starterFeats}
            cta={<HeroButton href={`${REGISTER_HREF[active]}?tier=starter`} label="Kipróbálom ingyen" variant="dark" />}
          />

          <NotchedPricingCard
            featured
            badgeLabel="Népszerű"
            dotColor="#F1CE45"
            title="Pro"
            priceMain={ftFmt(proFee).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub={active === 'salon' ? 'Fodrász, masszőr, kozmetikus, edzőterem' : 'Asztaltérkép, csoportok, előleg'}
            extra={active === 'salon' ? (
              <p className="text-[12px] font-medium text-white/50">
                + {ftFmt(pricing.salon_extra_staff_huf)}/hó minden további munkatársért.
              </p>
            ) : undefined}
            feats={proFeats}
            cta={<HeroButton href={`${REGISTER_HREF[active]}?tier=pro`} label="Kipróbálom ingyen" variant="gold" />}
          />

          <NotchedPricingCard
            featured={false}
            badgeLabel="Egyedi"
            dotColor="#1D1C19"
            title="Egyedi"
            priceMain="Egyedi"
            priceUnit="ajánlat"
            sub="a megrendelővel egyeztetve"
            feats={customFeats}
            cta={
              <HeroButton
                href={`mailto:hello@davelopment.hu?subject=Egyedi%20${encodeURIComponent(noun.toLowerCase())}%20csomag`}
                label="Kapcsolatfelvétel"
                variant="dark"
              />
            }
          />
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
