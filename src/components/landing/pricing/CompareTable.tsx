'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Minus } from 'lucide-react'
import type { LandingPricing } from '@/components/landing/types'
import { compareSections, PLAN_META, type Cell, type PlanId } from '@/lib/pricingContent'
import { Reveal, RevealText } from '@/components/landing/Motion'
import { SPRING_SNAPPY } from '@/lib/motion'

/**
 * Csomag-összehasonlító táblázat (a `pricingContent.ts` `compareSections`-éből). Desktopon három
 * oszlop, ragadós fejléccel; mobilon csomagválasztó, és csak a választott oszlop látszik — de
 * minden cella a DOM-ban van (kereső/AI is olvassa). Valódi <table>, oszlop- és sorfejlécekkel.
 */
const PLANS: PlanId[] = ['starter', 'pro', 'egyedi']

function CellView({ v }: { v: Cell }) {
  if (v === true) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ok-fill text-[#1D1C19]">
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        <span className="sr-only">Benne van</span>
      </span>
    )
  }
  if (v === false) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F4F4F4] text-brand-ink/35">
        <Minus className="h-3 w-3" strokeWidth={3} aria-hidden />
        <span className="sr-only">Nincs benne</span>
      </span>
    )
  }
  return <span className="inline-flex rounded-[8px] bg-[#F4F4F4] px-2.5 py-1 text-[13.5px] font-medium tabular-nums text-brand-ink">{v}</span>
}

export function CompareTable({ pricing }: { pricing: LandingPricing }) {
  const sections = compareSections(pricing)
  const [mobilePlan, setMobilePlan] = useState<PlanId>('pro')
  const colCls = (p: PlanId) => (p === mobilePlan ? 'table-cell' : 'hidden md:table-cell')

  return (
    <section id="osszehasonlitas" className="mx-auto max-w-7xl scroll-mt-[88px] px-4 py-10 lg:px-5 lg:py-14">
      <div className="mb-7 flex flex-col gap-4">
        <Reveal><span className="inline-flex items-center rounded-[8px] bg-white px-3 py-1.5 font-onest text-[14px] font-medium text-[#1D1C19]">Összehasonlítás</span></Reveal>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <RevealText text="Minden funkció, minden csomagban." delay={0.1} className="max-w-3xl font-semibold text-[clamp(2rem,4.2vw,52px)] leading-[0.98] tracking-[-0.05em] text-brand-ink" />
          <Reveal delay={0.25} className="max-w-sm text-[16px] leading-[1.6] text-brand-ink/55 lg:pb-1">
            A Starter és a Pro ugyanazt tudja — csak az ár és a beépített hírlevél-keret más. Az Egyedi csomag az egyedi igényekre szól.
          </Reveal>
        </div>
      </div>

      {/* mobil csomagválasztó */}
      <div role="radiogroup" aria-label="Csomag" className="mb-3 flex gap-1 rounded-full bg-white p-1 md:hidden">
        {PLANS.map((p) => {
          const on = p === mobilePlan
          return (
            <button key={p} type="button" role="radio" aria-checked={on} onClick={() => setMobilePlan(p)} className="relative flex-1 rounded-full px-3 py-2.5 text-[14.5px] font-medium">
              {on && <motion.span layoutId="cmp-plan" transition={SPRING_SNAPPY} className="absolute inset-0 rounded-full bg-brand-ink" />}
              <span className={`relative ${on ? 'text-white' : 'text-brand-ink/55'}`}>{PLAN_META[p].title}</span>
            </button>
          )
        })}
      </div>

      <Reveal className="rounded-[20px] bg-white p-2 sm:p-3 lg:p-4">
        <table className="w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">A davelopment booking csomagjainak összehasonlítása</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 z-10 bg-white py-3 pl-3 pr-4 align-bottom text-[13px] font-semibold uppercase tracking-[0.06em] text-brand-ink/40">Funkció</th>
              {PLANS.map((p) => (
                <th key={p} scope="col" className={`${colCls(p)} sticky top-0 z-10 w-[24%] bg-white px-3 py-3 align-bottom`}>
                  <span className="flex items-center gap-2 text-[clamp(1.1rem,1.6vw,22px)] font-semibold tracking-[-0.03em] text-brand-ink">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: PLAN_META[p].dot }} />
                    {PLAN_META[p].title}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] font-normal text-brand-ink/45">{PLAN_META[p].badge}</span>
                </th>
              ))}
            </tr>
          </thead>
          {sections.map((sec) => (
            <tbody key={sec.title}>
              <tr>
                <th scope="colgroup" colSpan={4} className="px-3 pb-1.5 pt-7 text-[clamp(1.05rem,1.4vw,19px)] font-semibold tracking-[-0.03em] text-brand-ink">
                  {sec.title}
                </th>
              </tr>
              {sec.rows.map((r) => (
                <tr key={r.label} className="group">
                  <th scope="row" className="border-t border-black/[0.06] py-2.5 pl-3 pr-4 align-top font-normal">
                    <span className="block text-[14.5px] font-medium text-brand-ink">{r.label}</span>
                    {r.hint && <span className="block text-[12.5px] leading-snug text-brand-ink/45">{r.hint}</span>}
                  </th>
                  {PLANS.map((p, i) => (
                    <td key={p} className={`${colCls(p)} border-t border-black/[0.06] px-3 py-2.5 align-top`}>
                      <CellView v={r.cells[i]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </Reveal>
    </section>
  )
}
