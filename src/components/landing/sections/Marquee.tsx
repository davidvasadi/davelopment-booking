'use client'

// Marquee: CSS animation + scroll-linked offset CSS var-ral.
// A motion.div JS interpoláció helyett GPU-on fut, mobilon nem szaggat.

import { useRef } from 'react'
import { useScroll, useMotionValueEvent } from 'framer-motion'

const MARQUEE_ROWS = [
  ['FODRÁSZAT', 'KOZMETIKA', 'MASSZÁZS', 'TETOVÁLÓ', 'KÖRÖMSZALON', 'SMINKTETOVÁLÁS', 'SZOLÁRIUM', 'HAJDÍSZÍTÉS', 'ARCKEZELÉS', 'DEPILÁLÁS'],
  ['JÓGA', 'SZEMÉLYI EDZŐ', 'FOGÁSZAT', 'ÉTTEREM', 'CSONTKOVÁCS', 'PSZICHOLÓGUS', 'BORBÉLY', 'KÁVÉZÓ', 'LOGOPÉDUS', 'DIETETIKUS'],
  ['PILATES', 'CROSSFIT', 'ÚSZÁSOKTATÁS', 'KUTYAKOZMETIKA', 'AUTÓSZERELŐ', 'NYELVTANÁR', 'FOTÓS', 'KÖNYVELŐ', 'EDZŐTEREM', 'FIZIOTERÁPIA'],
]

const BASE_OFFSET = 800

function MarqueeRow({
  items,
  reverse = false,
  shift,
  rowRef,
}: {
  items: string[]
  reverse?: boolean
  shift: number
  rowRef: React.RefObject<HTMLDivElement | null>
}) {
  const row = [...items, ...items, ...items, ...items, ...items, ...items]
  // Az alap translateX amit a CSS animáció végrehajt, plusz a scroll offset CSS var-ból jön.
  // CSS var: --sx (scroll extra px), az egész row-ra egyszerre frissül JS-ből.
  const dir = reverse ? 1 : -1
  const baseX = (-BASE_OFFSET + dir * shift)

  return (
    <div className="overflow-hidden">
      <div
        ref={rowRef as React.RefObject<HTMLDivElement>}
        className="flex whitespace-nowrap will-change-transform"
        style={{
          transform: `translateX(calc(${baseX}px + var(--sx, 0px)))`,
        }}
      >
        {row.map((item, i) => (
          <span key={i} className="flex items-baseline font-martian font-bold text-3xl lg:text-6xl tracking-tight uppercase px-8 py-2 lg:py-4 text-brand-ink">
            {item}
            <span className="ml-8 self-start text-3xl lg:text-5xl leading-none" aria-hidden>*</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function Marquee() {
  const ref = useRef<HTMLDivElement>(null)
  const row0 = useRef<HTMLDivElement>(null)
  const row1 = useRef<HTMLDivElement>(null)
  const row2 = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })

  // Scroll progress → CSS var frissítés. Egyetlen JS hívás/frame az összes sorra,
  // a böngésző GPU-n alkalmazza a transform-ot — nincs layout thrashing.
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const rows = [row0.current, row1.current, row2.current]
    const offsets = [p * 300, -(p * 200), p * 250]
    rows.forEach((el, i) => {
      if (el) el.style.setProperty('--sx', `${offsets[i]}px`)
    })
  })

  return (
    <div ref={ref} className="bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-5 space-y-1">
      <MarqueeRow items={MARQUEE_ROWS[0]} reverse shift={300} rowRef={row0} />
      <MarqueeRow items={MARQUEE_ROWS[1]} shift={200} rowRef={row1} />
      <MarqueeRow items={MARQUEE_ROWS[2]} reverse shift={250} rowRef={row2} />
    </div>
  )
}
