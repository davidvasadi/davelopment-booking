'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'

/** A sárga, három-soros futószalag a célközönség-szakmákkal. CSAK görgetésre/érintés-mozgásra
    mozog (nincs folyamatos auto-loop) — a sorok X-e a szekció scroll-progresséhez kötött. */
// Minden SOR más szakmákat mutat (nem ugyanaz a lista eltolva), így görgetésre
// háromszor annyiféle célközönség villan fel → konverzió-barátabb. Étterem az
// 1. sor elején; soronként szándékosan vegyes típusok (vendéglátás / szépség /
// wellness / sport / egészség), hogy egyik sor se tűnjön „csak fodrász"-nak.
// A KÖZÉPSŐ sor a legfeltűnőbb (a szem középre néz), ezért az ÉTTEREM oda,
// annak az elejére kerül, és az a sor balról stabilan csúszik be (nem reverse).
// Tartalom + sorrend a Figma (node 287:503) szerint: minden sor más sorrendben
// hozza ugyanazt a 8 szakmát, az ÉTTEREM mindháromban más pozícióban (a középső
// sorban elöl, jól látható helyen).
const MARQUEE_ROWS = [
  ['KOZMETIKA', 'JÓGA', 'TETOVÁLÁS', 'CSONTKOVÁCS', 'ÉTTEREM', 'FODRÁSZAT', 'SZEMÉLYI EDZŐ', 'FOGÁSZAT'],
  ['ÉTTEREM', 'FOGÁSZAT', 'SZEMÉLYI EDZŐ', 'KOZMETIKA', 'JÓGA', 'TETOVÁLÁS', 'FODRÁSZAT', 'CSONTKOVÁCS'],
  ['TETOVÁLÁS', 'ÉTTEREM', 'JÓGA', 'FOGÁSZAT', 'SZEMÉLYI EDZŐ', 'CSONTKOVÁCS', 'FODRÁSZAT', 'KOZMETIKA'],
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
  const row = [...items, ...items]
  // Az X kizárólag a scroll-progressből jön: görgetés nélkül áll, görgetésre/érintésre csúszik.
  // A duplázott sorból eltolunk (a reverse irány ellentétes), a kezdő-eltolás miatt mindkét
  // irányban van „tartalék", így nem ér véget üres résszel.
  // A 0% körül indul, hogy a sor eleje a látható területen legyen, és onnan
  // csúszik el a görgetéssel (reverse = ellenirány). Mérsékelt amplitúdó, hogy
  // a kulcs-szakmák ne csússzanak ki teljesen a képből.
  const scrollX = useTransform(
    scroll,
    [0, 1],
    reverse ? [`-${shift}%`, `${shift}%`] : [`${shift}%`, `-${shift}%`],
  )
  return (
    <div className="overflow-hidden">
      <motion.div className="flex whitespace-nowrap" style={{ x: scrollX }}>
        {row.map((item, i) => (
          <span
            key={i}
            className="flex items-baseline font-martian font-bold text-2xl lg:text-4xl tracking-tight uppercase px-6 py-2 lg:py-4 text-brand-ink"
          >
            {item}
            {/* Figma-hű elválasztó: sima csillag felső indexben, minden szó után */}
            <span className="ml-6 self-start text-2xl lg:text-3xl leading-none" aria-hidden>
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
      <MarqueeRow items={MARQUEE_ROWS[0]} reverse shift={14} scroll={scrollYProgress} />
      <MarqueeRow items={MARQUEE_ROWS[1]} shift={10} scroll={scrollYProgress} />
      <MarqueeRow items={MARQUEE_ROWS[2]} reverse shift={12} scroll={scrollYProgress} />
    </div>
  )
}
