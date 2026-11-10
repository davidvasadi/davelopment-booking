'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { RevealText } from '@/components/landing/Motion'
import { SPRING_QUICK, SPRING_SNAPPY, EASE, buttonHover } from '@/lib/motion'
import { ftFmt, type LandingPricing } from '@/components/landing/types'
import { planCards, PLAN_META, REGISTER_HREF, CONTACT_EMAIL, type Segment } from '@/lib/pricingContent'
import { NotchedPricingCard } from './landing-pricingcard'
import { HeroButton } from './landing-herobtn'

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
  look,
}: {
  pricing: LandingPricing
  /** Iparági landingeknél a szegmens fix (pl. mindig "salon") — ilyenkor nincs értelme a
   *  szakember/étterem váltónak, azt el is rejtjük. Homepage-en marad az interaktív toggle. */
  segment?: Segment
  /** Az /arak oldalon más a szekció címe (ott a H1 már az „Árak”). */
  title?: string
  /** Az /arak oldal sűrűbb ritmusa: kisebb térköz és cím (a főoldal változatlan). */
  compact?: boolean
  /** 'k2': a 2. landing-koncepció stílusa — középre zárt pill + cím, világosszürke sáv a kártyák mögött */
  look?: 'k2'
}) {
  const [internalActive, setInternalActive] = useState<Segment>(fixedSegment ?? 'salon')
  // a kapszula csak váltáskor csússzon (betöltéskor a fejléc beúszik — ne kövesse külön)
  const [touched, setTouched] = useState(false)
  const active = fixedSegment ?? internalActive
  const { noun, starterFee, proFee, starterFeats, proFeats, customFeats } = planCards(active, pricing)

  const k2 = look === 'k2'
  const body = (
    <section id="arazas" className={`mx-auto max-w-7xl px-4 lg:px-5 flex flex-col ${compact ? 'py-10 lg:py-14 gap-8' : 'py-20 lg:py-28 gap-12'}`}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, transform: 'scale(0.96)' }}
        whileInView={{ opacity: 1, transform: 'scale(1)' }}
        viewport={{ once: true, amount: 0.4 }}
        transition={SPRING_QUICK}
        className={`flex flex-col gap-6 ${k2 ? 'items-center text-center' : ''}`}
      >
        <span className={k2 ? 'inline-flex items-center rounded-[8px] bg-ui-yellow/15 px-3.5 py-1.5 font-onest text-[14px] font-medium text-ui-text/80' : 'inline-flex self-start items-center rounded-ui-control bg-white px-3 py-1.5 font-onest text-ui-body font-medium text-ui-text'}>
          Árak
        </span>
        <div className={k2 ? 'flex flex-col items-center gap-4' : 'flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5'}>
          <RevealText text={title} className={k2 ? 'font-onest text-[clamp(2rem,3.6vw,48px)] font-medium leading-[1.08] tracking-[-0.035em] text-ui-text' : `font-light text-ui-text ${compact ? 'text-ui-num lg:text-ui-page' : 'text-ui-num lg:text-ui-page'}`} />
          <p className={`text-ui-row text-ui-muted ${k2 ? 'max-w-[560px]' : 'max-w-sm lg:pb-1'}`}>
            Válaszd ki, melyik passzol a vállalkozásodhoz. Mindegyik {pricing.trial_days} napig ingyenes, kártya nélkül.
          </p>
        </div>

        {/* Üzlettípus-váltó — a "Látod mi történik" szekció pill-mintája, saját layoutId-val.
            Iparági landingnél a szegmens fix, ott nincs értelme a váltónak. */}
        {!fixedSegment && (
          <div className={`flex items-center gap-1 rounded-full p-1.5 ${k2 ? 'self-center bg-ui-cell' : 'self-start bg-white'}`}>
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
                  className={`relative rounded-full px-4 py-2 text-ui-row font-onest font-normal transition-colors duration-200 sm:px-5 sm:py-2.5 ${isActive ? 'text-white' : 'text-ui-text'}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId={touched ? 'pricing-seg-pill' : undefined}
                      className="absolute inset-0 rounded-full bg-ui-dark"
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
      <div className="relative">
      {k2 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-0">
          <div className="absolute left-[6%] top-[25%] h-[50%] w-[30%] rounded-full bg-ui-dark/15 blur-[70px]" /> {/* ui-allow: üveg mögötti színfolt */}
          <div className="absolute right-[6%] top-[30%] h-[50%] w-[30%] rounded-full bg-ui-dark/25 blur-[70px]" /> {/* ui-allow: üveg mögötti színfolt */}
          <div className="absolute bottom-0 left-[38%] h-[40%] w-[28%] rounded-full bg-ui-grey/60 blur-[80px]" /> {/* ui-allow: üveg mögötti színfolt */}
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, transform: 'translateY(18px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          exit={{ opacity: 0, transform: 'translateY(-10px)' }}
          transition={{ duration: 0.35, ease: EASE }}
          // k2: mobilon oldalra lapozható sáv (snap), mint a tippek — desktopon a 3 oszlopos rács
          className={k2
            ? 'relative -mx-4 flex snap-x snap-mandatory scroll-px-4 items-stretch gap-3 overflow-x-auto px-4 py-2 font-onest [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:w-[94%] [&>*]:shrink-0 [&>*]:snap-start lg:mx-auto lg:grid lg:w-full lg:max-w-[1400px] lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:py-0 lg:[&>*]:w-auto'
            : 'relative grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch max-w-[1400px] mx-auto w-full font-onest'}
        >
          <NotchedPricingCard
            featured={false}
            badgeLabel={PLAN_META.starter.badge}
            dotClass="bg-ui-grey"
            title={PLAN_META.starter.title}
            priceMain={ftFmt(starterFee).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub={PLAN_META.starter.sub[active]}
            extra={active === 'salon' ? (
              <p className="text-ui-meta font-medium text-ui-muted">
                + {ftFmt(pricing.salon_extra_staff_huf)}/hó minden további munkatársért.
              </p>
            ) : undefined}
            feats={starterFeats}
            glass={k2}
            cta={<HeroButton href={`${REGISTER_HREF[active]}?tier=starter`} label="Kipróbálom ingyen" variant="dark" />}
          />

          <NotchedPricingCard
            featured
            badgeLabel={PLAN_META.pro.badge}
            dotClass="bg-ui-yellow"
            title={PLAN_META.pro.title}
            priceMain={ftFmt(proFee).replace(/\s*Ft$/, '')}
            priceUnit="Ft / hó"
            sub={PLAN_META.pro.sub[active]}
            extra={active === 'salon' ? (
              <p className="text-ui-meta font-medium text-white/50">
                + {ftFmt(pricing.salon_extra_staff_huf)}/hó minden további munkatársért.
              </p>
            ) : undefined}
            feats={proFeats}
            glass={k2}
            cta={<HeroButton href={`${REGISTER_HREF[active]}?tier=pro`} label="Kipróbálom ingyen" variant="gold" />}
          />

          <NotchedPricingCard
            featured={false}
            badgeLabel={PLAN_META.egyedi.badge}
            dotClass="bg-ui-dark"
            title={PLAN_META.egyedi.title}
            priceMain="Árajánlat"
            priceUnit=""
            sub={PLAN_META.egyedi.sub[active]}
            feats={customFeats}
            glass={k2}
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
      </div>

      {/* a kártyák csak a kulcspontokat mutatják — a teljes lista az /arak táblázatában */}
      <Link href={compact ? '#osszehasonlitas' : '/arak#osszehasonlitas'} className="group inline-flex items-center gap-1.5 self-center text-ui-row font-medium text-ui-text">
        Minden funkció összehasonlítása
        <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
      </Link>
    </section>
  )
  return body
}
