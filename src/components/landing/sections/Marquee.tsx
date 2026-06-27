'use client'

import { useRef } from 'react'
import { ScrollTrigger, useGSAP } from '@/lib/landing/gsap'

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
  const ref  = useRef<HTMLDivElement>(null)
  const row0 = useRef<HTMLDivElement>(null)
  const row1 = useRef<HTMLDivElement>(null)
  const row2 = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const el = ref.current
    if (!el) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress
        const offsets = [p * 300, -(p * 200), p * 250]
        ;[row0.current, row1.current, row2.current].forEach((row, i) => {
          if (row) row.style.setProperty('--sx', `${offsets[i]}px`)
        })
      },
    })
    return () => st.kill()
  }, { scope: ref })

  return (
    <div ref={ref} className="bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-5 space-y-1">
      <MarqueeRow items={MARQUEE_ROWS[0]} reverse shift={300} rowRef={row0} />
      <MarqueeRow items={MARQUEE_ROWS[1]} shift={200} rowRef={row1} />
      <MarqueeRow items={MARQUEE_ROWS[2]} reverse shift={250} rowRef={row2} />
    </div>
  )
}
