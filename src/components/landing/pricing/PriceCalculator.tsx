'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { COVER_OFFSET } from '@/lib/scrollOffset'
import { Minus, Plus } from 'lucide-react'
import { ftFmt, type LandingPricing } from '@/components/landing/types'
import { applyCycle, businessMonthlyFee, type BillingCycle } from '@/lib/tier'
import { PLAN_META, REGISTER_HREF, type Segment } from '@/lib/pricingContent'
import { HeroButton } from '@/components/landing/FeatureHeroCentered'
import { NumberRoll } from '@/components/landing/NumberRoll'
import { GrainCanvas, DARK_SURFACE_BG } from '@/components/landing/GrainCanvas'
import { Reveal, RevealText } from '@/components/landing/Motion'
import { EASE } from '@/lib/motion'

/**
 * Díjkalkulátor — egyetlen sötét, grain-es blokk a davelopment.hu árazási blokkjának mintájára
 * (fejléc, fehér pill-váltók, áttetsző belső kártyák). Ugyanazokkal a függvényekkel számol, mint
 * a valós számlázás (`businessMonthlyFee`, `applyCycle`), így az eredmény egyezik a számlával.
 */
type Plan = 'starter' | 'pro'
const PILL_SPRING = { type: 'spring', stiffness: 400, damping: 35 } as const

/** Fehér, csúszó kapszulás váltó a sötét felületen (a davelopment árazás mintája). */
function Toggle<T extends string>({ id, value, options, onChange, size = 'md' }: {
  id: string; value: T; options: [T, string][]; onChange: (v: T) => void; size?: 'md' | 'sm'
}) {
  // a kapszula csak váltáskor csússzon — betöltéskor a blokk beúszik, ne kövesse külön
  const [touched, setTouched] = useState(false)
  return (
    <div role="radiogroup" className="relative inline-flex gap-1 rounded-full bg-white/10 p-1">
      {options.map(([v, label]) => {
        const on = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => { setTouched(true); onChange(v) }}
            className={`relative z-10 whitespace-nowrap rounded-full font-medium transition-colors ${size === 'md' ? 'px-4 py-2.5 text-[14px] md:px-5' : 'px-3.5 py-2 text-[13.5px]'}`}
            style={{ color: on ? '#000' : 'rgba(255,255,255,.8)' }}
          >
            {on && <motion.span layoutId={touched ? `calc-${id}` : undefined} transition={PILL_SPRING} className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,.25)]" />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function PriceCalculator({ pricing }: { pricing: LandingPricing }) {
  const [seg, setSeg] = useState<Segment>('salon')
  const [plan, setPlan] = useState<Plan>('pro')
  const [staff, setStaff] = useState(3)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  const list = businessMonthlyFee(pricing, seg, staff, plan)
  const monthly = applyCycle(list, cycle, pricing.annual_discount_pct)
  const base = businessMonthlyFee(pricing, seg, 1, plan)
  const extra = list - base
  const pct = ((staff - 1) / 29) * 100

  const parTl = useRef<HTMLDivElement>(null)
  const { scrollYProgress: parP } = useScroll({ target: parTl, offset: COVER_OFFSET })
  const parT = useTransform(parP, [0, 1], ['translateY(60px)', 'translateY(-60px)'])
  return (
    // teljes szélességű sötét sáv (grain-nel); a tartalom középen, max-w-7xl-ben, enyhe parallaxszal (framer natív görgetés:
    // COVER_OFFSET, egy transform, a target a tartalom ELŐTT álló réteg, a sávon overflow-clip — ld. landing-concepts)
    <section id="kalkulator" className="relative isolate scroll-mt-[88px] overflow-clip" style={{ background: DARK_SURFACE_BG }}>
      <div ref={parTl} aria-hidden className="pointer-events-none absolute inset-0" />
      <GrainCanvas strength="light" opacity={0.8} zIndex={-1} />
      <motion.div style={{ transform: parT }} className="will-change-transform">
      <Reveal className="mx-auto max-w-7xl px-4 py-16 lg:px-5 lg:py-24">

        {/* Fejléc */}
        <div className="flex flex-col items-start gap-3.5 md:items-center md:text-center">
          <span className="flex items-center gap-2">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white"><Plus className="h-2.5 w-2.5 text-black" strokeWidth={3} /></span>
            <span className="text-[12.5px] text-white/80">Kalkulátor</span>
          </span>
          <RevealText text="Mennyit fizetnél?" className="font-semibold text-[clamp(1.9rem,3.8vw,46px)] leading-[1] tracking-[-0.05em] text-white" />
          <p className="max-w-xl text-[15px] leading-[1.55] text-white/60">Állítsd be az üzleted típusát és a csapatod méretét — ugyanígy számolunk a számládon is.</p>
          <div className="mt-2">
            <Toggle id="seg" value={seg} onChange={setSeg} options={[['salon', 'Szakembereknek'], ['restaurant', 'Éttermeknek']]} />
          </div>
        </div>

        <div className="mt-7 grid items-stretch gap-3 lg:grid-cols-3">
          {/* Bal: csapat */}
          <div className="order-2 flex flex-col justify-between rounded-[16px] bg-white/5 p-5 lg:order-1">
            <div>
              <h3 className="text-[18px] font-medium text-white">Csapat</h3>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={seg} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25, ease: EASE }} className="mt-1 text-[14.5px] leading-[1.55] text-white/65">
                  {seg === 'salon'
                    ? `Az alapdíj az első munkatársat tartalmazza, minden további +${ftFmt(pricing.salon_extra_staff_huf)}/hó.`
                    : 'Étteremnél a havidíj fix — akárhány munkatársat veszel fel.'}
                </motion.p>
              </AnimatePresence>
            </div>

            {seg === 'salon' ? (
              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <span className="text-[34px] font-medium leading-none tracking-[-0.04em] text-white tabular-nums">{staff}<span className="ml-1.5 text-[15px] font-normal tracking-normal text-white/50">fő</span></span>
                  <div className="flex gap-1.5">
                    <motion.button whileTap={{ scale: 0.92 }} type="button" aria-label="Kevesebb munkatárs" onClick={() => setStaff((n) => Math.max(1, n - 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15"><Minus className="h-4 w-4" /></motion.button>
                    <motion.button whileTap={{ scale: 0.92 }} type="button" aria-label="Több munkatárs" onClick={() => setStaff((n) => Math.min(30, n + 1))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"><Plus className="h-4 w-4" /></motion.button>
                  </div>
                </div>
                {/* csúszka: a látvány saját, a kezelést átlátszó natív range végzi (billentyűzet, érintés) */}
                <div className="relative mt-5 h-6">
                  <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
                  <motion.div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white" animate={{ width: `${pct}%` }} transition={PILL_SPRING} />
                  <motion.div className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,.5)]" animate={{ left: `calc(${pct}% - 10px)` }} transition={PILL_SPRING} />
                  <input type="range" min={1} max={30} value={staff} onChange={(e) => setStaff(Number(e.target.value))} aria-label="Munkatársak száma" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </div>
              </div>
            ) : (
              <p className="mt-6 text-[34px] font-medium leading-none tracking-[-0.04em] text-white">Fix díj</p>
            )}
          </div>

          {/* Jobb: csomag + számlázás + ár + CTA */}
          <div className="order-1 flex flex-col justify-between gap-6 rounded-[16px] bg-white/5 p-5 md:p-6 lg:order-2 lg:col-span-2" aria-live="polite">
            <div className="flex flex-wrap gap-2">
              <Toggle id="plan" size="sm" value={plan} onChange={setPlan} options={[['starter', PLAN_META.starter.title], ['pro', PLAN_META.pro.title]]} />
              <Toggle id="cycle" size="sm" value={cycle} onChange={setCycle} options={[['monthly', 'Havonta'], ['annual', `Évente −${pricing.annual_discount_pct}%`]]} />
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <NumberRoll value={monthly} className="font-onest text-[clamp(2.6rem,5.5vw,68px)] font-medium tracking-[-0.05em] text-white" />
                <span className="text-[18px] text-white/55">Ft / hó</span>
              </div>
              <ul className="mt-4 max-w-md space-y-1 text-[14px] text-white/55">
                <li className="flex justify-between gap-4"><span>{PLAN_META[plan].title} alapdíj</span><span className="tabular-nums text-white/85">{ftFmt(base)}</span></li>
                {seg === 'salon' && staff > 1 && <li className="flex justify-between gap-4"><span>+ {staff - 1} további munkatárs</span><span className="tabular-nums text-white/85">{ftFmt(extra)}</span></li>}
                {cycle === 'annual' && <li className="flex justify-between gap-4"><span>Éves kedvezmény (−{pricing.annual_discount_pct}%)</span><span className="tabular-nums text-ok-fill">−{ftFmt(list - monthly)}</span></li>}
                {cycle === 'annual' && <li className="flex justify-between gap-4"><span>Évente terhelve</span><span className="tabular-nums text-white/85">{ftFmt(monthly * 12)}</span></li>}
              </ul>
            </div>

            <div>
              <HeroButton href={`${REGISTER_HREF[seg]}?tier=${plan}`} label={`${pricing.trial_days} nap ingyen, kártya nélkül`} light />
              <p className="mt-3 text-[13px] text-white/40">A próbaidő alatt nem terhelünk semmit.</p>
            </div>
          </div>
        </div>
      </Reveal>
      </motion.div>
    </section>
  )
}
