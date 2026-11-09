'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { RevealText } from '@/components/landing/Motion'
import { SPRING_QUICK, SPRING_SNAPPY, EASE, buttonHover } from '@/lib/motion'
import { ftFmt, type LandingPricing } from '@/components/landing/types'
import { planCards, PLAN_META, REGISTER_HREF, CONTACT_EMAIL, type Segment } from '@/lib/pricingContent'
import { NotchedPricingCard } from '@/components/dashboard/NotchedPricingCard'
import { HeroButton } from '@/components/landing/HeroButton'

/**
 * Árazás — üzlettípus-váltó (a `SegmentToggle.tsx` pill-mintája, saját `layoutId`-val, hogy ne
 * ütközzön a "Látod mi történik" szekció toggle-jével) FÖLÖTT, alatta 3 kártyás létra
 * (Starter/Pro/Egyedi) mindkét oldalon. A hírlevél-küldés BEÉPÍTVE jár mindhárom csomagba —
 * csak a havi email-keret (a kártyák `sub`-ja) tér el köztük, nincs önálló hírlevél-fizetés.
 */

// A tartalom (csomagnevek, funkciólisták, alcímek) a közös forrásból jön: `src/lib/pricingContent.ts`.

export function Pricing({
  pricing,
  segment: fixedSegment,
  title = 'Egyszerű, tiszta árazás.',
  compact = false,
}: {
  pricing: LandingPricing
  /** Iparági landingeknél a szegmens fix (pl. mindig "salon") — ilyenkor nincs értelme a
   *  szakember/étterem váltónak, azt el is rejtjük. Homepage-en marad az interaktív toggle. */
  segment?: Segment
  /** Az /arak oldalon más a szekció címe (ott a H1 már az „Árak”). */
  title?: string
  /** Az /arak oldal sűrűbb ritmusa: kisebb térköz és cím (a főoldal változatlan). */
  compact?: boolean
}) {
  const [internalActive, setInternalActive] = useState<Segment>(fixedSegment ?? 'salon')
  // a kapszula csak váltáskor csússzon (betöltéskor a fejléc beúszik — ne kövesse külön)
  const [touched, setTouched] = useState(false)
  const active = fixedSegment ?? internalActive
  const { noun, starterFee, proFee, starterFeats, proFeats, customFeats } = planCards(active, pricing)

  return (
    <section id="arazas" className={`mx-auto max-w-7xl px-4 lg:px-5 flex flex-col ${compact ? 'py-10 lg:py-14 gap-8' : 'py-20 lg:py-28 gap-12'}`}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className="flex flex-col gap-6"
      >
        <span className="inline-flex self-start items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">
          Árak
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <RevealText text={title} className={`font-semibold tracking-[-0.05em] text-brand-ink ${compact ? 'text-[clamp(2rem,4.2vw,52px)] leading-[0.98]' : 'text-[clamp(2rem,4.2vw,52px)] leading-[0.98]'}`} />
          <p className="text-[16px] leading-[1.6] text-brand-ink/55 max-w-sm lg:pb-1">
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindegyik {pricing.trial_days} napig ingyenes, kártya nélkül.
          </p>
        </div>

        {/* Üzlettípus-váltó — a "Látod mi történik" szekció pill-mintája, saját layoutId-val.
            Iparági landingnél a szegmens fix, ott nincs értelme a váltónak. */}
        {!fixedSegment && (
          <div className="flex items-center gap-1 self-start rounded-full bg-white p-1.5">
            {(['salon', 'restaurant'] as const).map((seg) => {
              const label = seg === 'salon' ? 'Szakembereknek' : 'Éttermeknek'
              const isActive = active === seg
              return (
                <motion.button
                  key={seg}
                  type="button"
                  onClick={() => { setTouched(true); setInternalActive(seg) }}
                  variants={buttonHover}
                  initial="rest"
                  whileHover="hover"
                  className="relative rounded-full px-4 py-2 text-[14.5px] font-onest font-normal tracking-[-0.03em] transition-colors duration-200 sm:px-5 sm:py-2.5 sm:text-[15px]"
                  style={{ color: isActive ? '#ffffff' : '#3B3B3B' }}
                >
                  {isActive && (
                    <motion.span
                      layoutId={touched ? 'pricing-seg-pill' : undefined}
                      className="absolute inset-0 rounded-full bg-brand-ink"
                      transition={SPRING_SNAPPY}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </motion.button>
              )
            })}
          </div>
        )}
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
            badgeLabel={PLAN_META.starter.badge}
            dotColor={PLAN_META.starter.dot}
            title={PLAN_META.starter.title}
            priceMain={ftFmt(starterFee).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub={PLAN_META.starter.sub[active]}
            extra={active === 'salon' ? (
              <p className="text-[12px] font-medium text-ink-soft">
                + {ftFmt(pricing.salon_extra_staff_huf)}/hó minden további munkatársért.
              </p>
            ) : undefined}
            feats={starterFeats}
            cta={<HeroButton href={`${REGISTER_HREF[active]}?tier=starter`} label="Kipróbálom ingyen" variant="dark" />}
          />

          <NotchedPricingCard
            featured
            badgeLabel={PLAN_META.pro.badge}
            dotColor={PLAN_META.pro.dot}
            title={PLAN_META.pro.title}
            priceMain={ftFmt(proFee).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub={PLAN_META.pro.sub[active]}
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
            badgeLabel={PLAN_META.egyedi.badge}
            dotColor={PLAN_META.egyedi.dot}
            title={PLAN_META.egyedi.title}
            priceMain="Árajánlat"
            priceUnit=""
            sub={PLAN_META.egyedi.sub[active]}
            feats={customFeats}
            cta={
              <HeroButton
                href={`mailto:${CONTACT_EMAIL}?subject=Egyedi%20${encodeURIComponent(noun.toLowerCase())}%20csomag`}
                label="Kapcsolatfelvétel"
                variant="dark"
              />
            }
          />
        </motion.div>
      </AnimatePresence>

      {/* a kártyák csak a kulcspontokat mutatják — a teljes lista az /arak táblázatában */}
      <Link href={compact ? '#osszehasonlitas' : '/arak#osszehasonlitas'} className="group inline-flex items-center gap-1.5 self-center text-[15px] font-semibold text-brand-ink">
        Minden funkció összehasonlítása
        <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
      </Link>
    </section>
  )
}
