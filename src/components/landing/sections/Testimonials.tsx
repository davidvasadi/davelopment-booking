'use client'

import { motion } from 'framer-motion'
import { Activity, SquareKanban, CreditCard, ArrowDown, ArrowUp } from 'lucide-react'
import { float } from '@/components/landing/Motion'
import { RollButton, MorphButton } from '@/components/landing/sections/TestimonialButtons'
import { SectionLabel } from '@/components/landing/SectionLabel'

/**
 * „Most 30 napig ingyen" — Értékelések/CTA szekció. A Figma-node (287:670) alapján: egy folytonos
 * konténer, bal világos kártya (cím + CTA), jobb sárga kártya rács-háttérrel, lapos hullámvonallal
 * (a vonalon ülő ikon-buborékokkal) és avatar-stackkel. NEM végleges copy.
 *
 * A görbe path-ja a Figma vektorából (viewBox 0 0 379.649 149.743), a buborékok a Figma left/top
 * pozícióiból (a 351px-es grafikon-zónához mérve). A lucide ikonok kódból (nincs külső asset-függés).
 */

const CURVE =
  'M0.07 149.05C54.07 156.55 116.07 -53.95 207.07 14.05C298.07 82.05 272.57 116.05 379.57 98.55'

// A rács fix oszlop-/sor-számú (a cellaméret rugalmas) → az utolsó vonal MINDIG a zóna szélén ül,
// se túllógás, se félbevágott cella. A görbe és a buborékok ehhez a 0–1 arányhoz igazodnak.
const GRID_COLS = 5
const GRID_ROWS = 5

// A görbe (és a rajta ülő buborékok) függőleges sávja a grafikon-zónán belül.
const CURVE_BAND = 'bottom-[18%] h-[40%]'

// A buborékok PONT a görbén ülnek: x 0–1 a zóna szélességén, y a görbe path-értéke az adott x-nél
// (a görbe viewBox 0–149.743 magasságában, %-ban). Így a görbe és a buborékok ugyanabban a sávban
// (lásd CURVE_BAND) mozognak együtt — reszponzívan.
const BUBBLES = [
  { x: 0.10, y: 0.846, label: '2,6%', dir: 'down' as const, Icon: SquareKanban, amp: 6, dur: 5.5, delay: 0 },
  { x: 0.50, y: 0.028, label: '2,6%', dir: 'up' as const, Icon: Activity, amp: 7, dur: 6, delay: 0.4 },
  { x: 0.74, y: 0.553, label: '4,6%', dir: 'down' as const, Icon: CreditCard, amp: 6, dur: 5, delay: 0.8 },
]

// Placeholder avatar-színek (a Figma valódi fotókat használ — fotó-asset hiányában tömör körök).
const AVATAR_COLORS = ['#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46', '#27272a']

export function Testimonials() {
  return (
    /* Értékelések / „Most 30 napig ingyen" CTA */
    <section id="velemenyek" className="mx-auto px-4 lg:px-5 pb-8">
      {/* Desktopon (lg+) egymás mellett a 3 blokk — az arányok úgy szabva, hogy 1024px-en is kiférjen.
          lg alatt egymás alá esik, és a SORREND megfordul: előbb a sárga (grafikon + értékelés),
          utána a szürke kártya — flex-col-reverse. */}
      <div className="flex flex-col-reverse lg:flex-row items-stretch overflow-hidden rounded-[30px]">
        {/* BAL — világos kártya (fafafa→f5f5f5 gradient). Rugalmas szélesség (nem fix 596px),
            hogy a jobb oldali blokkoknak is jusson hely a desktop-egysorban. */}
        <div className="bg-gradient-to-r from-[#fafafa] to-[#f5f5f5] lg:w-[36%] lg:max-w-[480px] shrink-0 flex flex-col justify-between p-8 lg:p-10 min-h-[435px]">
          <SectionLabel>(Értékelések)</SectionLabel>
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-[clamp(2.5rem,4.5vw,49px)] leading-[1.05] tracking-[-1.47px] text-brand-ink">
              Most 30 napig ingyen.
            </h2>
            <p className="text-[20px] tracking-[-0.6px] text-brand-ink/70">
              Próbáld ki kötelezettség nélkül — bankkártya sem kell.
            </p>
          </div>
          <div>
            <RollButton href="/register" label="Ingyenes regisztráció" variant="accent" icon />
          </div>
        </div>

        {/* JOBB — sárga kártya: bal grafikon-zóna (rács+görbe, a sárga széléig) | jobb avatar-blokk.
            min-h adja a kártya alap-magasságát; a graph-zóna self-stretch-csel a TELJES magasságra nyúlik. */}
        <div className="relative bg-brand-accent flex-1 flex flex-col lg:flex-row items-stretch overflow-hidden min-h-[383px]">
          {/* Grafikon-zóna: a sárga BAL szélétől a fél-kártyáig, a kártya TELJES magasságában.
              A rács és a görbe közös koordinátában (inset-0) → pont ugyanaddig érnek, alulról felülig. */}
          <div className="relative w-full lg:w-[44%] shrink-0 self-stretch min-h-[383px]">
            {/* Rács — N×N cella a zóna teljes méretében (background-size = 100%/N).
                Az utolsó vonal pont a szélen ül, semmi nem lóg túl, reszponzív. */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'linear-gradient(to left, #191314 1px, transparent 1px), linear-gradient(to top, #191314 1px, transparent 1px)',
                backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
                backgroundPosition: 'right bottom',
              }}
            />

            {/* Görbe + buborékok KÖZÖS sávja (CURVE_BAND): a zóna alsó részén. A buborék y-ja
                ezen a sávon belüli arány = pont a path-on, mert az SVG is ezt a sávot tölti ki. */}
            <div className={`absolute inset-x-0 ${CURVE_BAND}`}>
              {/* Hullámvonal (Figma vektor): preserveAspectRatio=none → kitölti a sávot, vége = jobb él. */}
              <svg
                viewBox="0 0 379.649 149.743"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
                fill="none"
                aria-hidden
              >
                <path d={CURVE} stroke="#191314" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>

            {/* Ikon-buborékok — a görbén ülve (x 0–1 szélesség, y 0–1 a sávon belül = a path-on) */}
            {BUBBLES.map((b) => (
              // KÜLSŐ wrapper: csak a horgonyzás (a path-pontra, a kör közepével). NEM animált,
              // hogy a float transform-ja ne ütközzön a -translate-1/2-vel.
              <div
                key={b.label + b.x}
                className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
              >
                {/* BELSŐ: fixen a vonalon (lebegés nélkül — az csúsztatta le a vonalról) */}
                <div className="relative h-full w-full">
                  {/* Címke-pill — a kör fölött, vízszintesen középre */}
                  <span className="absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 shadow-sm">
                    {b.dir === 'up' ? (
                      <ArrowUp className="h-3.5 w-3.5 text-[#10b97f]" />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5 text-[#d90b0b]" />
                    )}
                    <span
                      className={`text-[14px] font-semibold tracking-[-0.42px] ${
                        b.dir === 'up' ? 'text-[#10b97f]' : 'text-[#d90b0b]'
                      }`}
                    >
                      {b.label}
                    </span>
                  </span>
                  {/* Ikon-kör — EZ ül a vonalon */}
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md">
                    <b.Icon className="h-5 w-5 text-brand-ink" strokeWidth={1.75} />
                  </span>
                </div>
              </div>
            ))}
            </div>
          </div>

          {/* Avatar-blokk (flex-1): cím + avatar-stack + CTA. Reszponzív méretek, hogy a desktop-
              egysorban (lg, 1024px) is kiférjen — a cím clamp, az avatarok kicsit kisebbek. */}
          <div className="flex-1 flex flex-col justify-center gap-6 px-6 py-10 sm:px-8">
            <p className="font-semibold text-[clamp(1.25rem,2vw,28px)] leading-[1.1] tracking-[-0.84px] text-brand-ink">
              Csatlakozz a vállalkozásokhoz, akik már minket használnak.
            </p>
            <div className="flex items-center">
              {AVATAR_COLORS.map((c, i) => (
                <span
                  key={i}
                  className="h-12 w-12 -mr-[13px] rounded-full border-2 border-brand-accent"
                  style={{ background: c }}
                />
              ))}
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-accent bg-white text-[17px] font-semibold tracking-[-0.6px] text-brand-ink">
                +1K
              </span>
            </div>
            <div className="flex items-center">
              <MorphButton href="/register" label="Értékelj minket" variant="light" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
