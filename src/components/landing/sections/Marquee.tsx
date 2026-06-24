'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'

const MARQUEE_ROWS = [
  ['FODRÁSZAT', 'KOZMETIKA', 'MASSZÁZS', 'TETOVÁLÓ', 'KÖRÖMSZALON', 'SMINKTETOVÁLÁS', 'SZOLÁRIUM', 'HAJDÍSZÍTÉS', 'ARCKEZELÉS', 'DEPILÁLÁS'],
  ['JÓGA', 'SZEMÉLYI EDZŐ', 'FOGÁSZAT', 'ÉTTEREM', 'CSONTKOVÁCS', 'PSZICHOLÓGUS', 'BORBÉLY', 'KÁVÉZÓ', 'LOGOPÉDUS', 'DIETETIKUS'],
  ['PILATES', 'CROSSFIT', 'ÚSZÁSOKTATÁS', 'KUTYAKOZMETIKA', 'AUTÓSZERELŐ', 'NYELVTANÁR', 'FOTÓS', 'KÖNYVELŐ', 'EDZŐTEREM', 'FIZIOTERÁPIA'],
]

function MarqueeRow({
  items,
  reverse = false,
  shift,
  scroll,
}: {
  items: string[]
  reverse?: boolean
  shift: number // a sor eltolása a teljes görgetés alatt (%) — soronként eltérő = parallax-érzet
  scroll: MotionValue<number>
}) {
  const row = [...items, ...items, ...items, ...items, ...items, ...items]
  const scrollX = useTransform(
    scroll,
    [0, 1],
    reverse
      ? [`${-800 + shift}px`, `${-800 - shift}px`]
      : [`${-800 - shift}px`, `${-800 + shift}px`],
  )
  return (
    <div>
      <motion.div className="flex whitespace-nowrap" style={{ x: scrollX }}>
        {row.map((item, i) => (
          <span
            key={i}
            className="flex items-baseline font-martian font-bold text-3xl lg:text-6xl tracking-tight uppercase px-8 py-2 lg:py-4 text-brand-ink"
          >
            {item}
            {/* Figma-hű elválasztó: sima csillag felső indexben, minden szó után */}
            <span className="ml-8 self-start text-3xl lg:text-5xl leading-none" aria-hidden>
              *
            </span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

export function Marquee() {
  const ref = useRef(null)
  // Közvetlenül a scroll-progresshez kötjük (NINCS useSpring), hogy a marquee
  // pontosan a görgetést kövesse, késleltetés/utánhúzás nélkül. A globális Lenis
  // adja a sima scrollt — azt máshol megtartjuk, csak itt nem teszünk rá rugót.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  return (
    <div ref={ref} className="bg-brand-accent border-y border-brand-ink/10 overflow-hidden py-5 space-y-1">
      <MarqueeRow items={MARQUEE_ROWS[0]} reverse shift={300} scroll={scrollYProgress} />
      <MarqueeRow items={MARQUEE_ROWS[1]} shift={200} scroll={scrollYProgress} />
      <MarqueeRow items={MARQUEE_ROWS[2]} reverse shift={250} scroll={scrollYProgress} />
    </div>
  )
}
