'use client'

import { useRef } from 'react'
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  type MotionValue,
} from 'framer-motion'

const MANIFESTO_LINES = [
  'Szalon és étterem.',
  'Egy rendszer.',
  'Több üzlet, egy fiók.',
  'Időpont vagy asztal.',
  'Minden egy helyen.',
]

const STEP_EM = 1.15

// n szövegsor + 1 "képsor" + 2 zoom-fázis = (n+1) + 2 viewport
const ZOOM_VH = 2

export function Vision() {
  const wrapper = useRef<HTMLDivElement>(null)
  const n = MANIFESTO_LINES.length
  // A scroll: n sor szövegre + 1 sor ahol a kép "gördül be" mint az utolsó sor + 2 vh zoom
  const totalVh = n + 1 + ZOOM_VH

  const { scrollYProgress } = useScroll({
    target: wrapper,
    offset: ['start start', 'end end'],
  })

  const { scrollYProgress: enterY } = useScroll({
    target: wrapper,
    offset: ['start end', 'start start'],
  })
  const cardScale = useTransform(enterY, [0, 1], [0.9, 1])
  const cardY = useTransform(enterY, [0, 1], [48, 0])

  // textEnd: a szöveg+képsor fázis vége (az első n+1 viewport)
  const textEnd = (n + 1) / totalVh

  // active: 0…n, ahol 0…n-1 = szövegsorok, n = képsor
  // Ugyanolyan lépcsős logika mint előtt, de n+1 "elemet" kezel
  const total = n + 1
  const lead = 0.04
  const tail = 0.04
  const move = 0.7
  const inRange: number[] = [0]
  const outRange: number[] = [0]
  for (let i = 0; i < total - 1; i++) {
    const segStart = lead + (i * (textEnd - lead - tail * textEnd)) / (total - 1)
    const segLen = (textEnd - lead - tail * textEnd) / (total - 1)
    inRange.push(segStart + segLen * move)
    outRange.push(i + 1)
    inRange.push(segStart + segLen)
    outRange.push(i + 1)
  }
  inRange.push(textEnd)
  outRange.push(total - 1)
  const active = useTransform(scrollYProgress, inRange, outRange, { clamp: true })

  // Szövegsorok opacity: az n-edik (képsor) fázisnál tűnnek el
  const textOpacity = useTransform(active, [n - 0.8, n - 0.3], [1, 0])

  // Kép: ugyanolyan dist-alapú opacity mint a szövegsoroknál
  const imgDist = useTransform(active, (a) => n - a)
  const imgRevealOpacity = useTransform(imgDist, [-0.99, -0.4, 0, 0.4, 0.99], [0, 1, 1, 1, 0])

  // Háttér sötétedés
  const c0 = useTransform(scrollYProgress, [0, textEnd], ['#3a3a3a', '#1f1f1f'])
  const c1 = useTransform(scrollYProgress, [0, textEnd], ['#2a2a2a', '#121212'])
  const c2 = useTransform(scrollYProgress, [0, textEnd], ['#1c1c1c', '#0a0a0a'])
  const bg = useMotionTemplate`radial-gradient(120% 120% at 50% 0%, ${c0} 0%, ${c1} 45%, ${c2} 100%)`

  // scrollYProgress-ben: amikor active eléri n-0.5-öt
  const zoomStart = textEnd - (textEnd / (n + 1)) * 0.5
  const imgScale = useTransform(scrollYProgress, [zoomStart, 1], [0.12, 1])
  const imgRadius = useTransform(scrollYProgress, [zoomStart, zoomStart + (1 - zoomStart) * 0.7], [20, 0])
  const outerRadius = useTransform(scrollYProgress, [zoomStart + (1 - zoomStart) * 0.5, 1], [32, 0])
  // padding eltűnik ahogy a kép teljes képernyős lesz
  const cardPad = useTransform(scrollYProgress, [zoomStart + (1 - zoomStart) * 0.4, 1], [16, 0])

  return (
    <div ref={wrapper} className="relative" style={{ height: `${totalVh * 100}vh` }}>
      <motion.div className="sticky top-0 h-screen" style={{ padding: cardPad }}>
        <motion.div
          className="relative w-full h-full text-white overflow-hidden flex flex-col items-center text-center px-8 py-10 sm:py-12"
          style={{
            backgroundImage: bg,
            scale: cardScale,
            y: cardY,
            borderRadius: outerRadius,
          }}
        >
          <p className="shrink-0 text-white text-sm sm:text-base font-geist font-medium tracking-widest">
            (Mit tud a Schedulio)
          </p>

          <div className="relative flex-1 flex flex-col items-center justify-center">
            <motion.div
              className="flex flex-col items-center justify-center font-geist font-medium tracking-[-0.04em] leading-tight"
              style={{
                fontSize: 'clamp(2.5rem, 8.5vw, 5rem)',
                rowGap: `${STEP_EM - 1}em`,
                opacity: textOpacity,
              }}
            >
              {MANIFESTO_LINES.map((text, i) => (
                <Line key={text} text={text} index={i} active={active} />
              ))}
            </motion.div>
          </div>

          {/* Kép — a card-on absolute, hogy teljes területét lefedje */}
          <motion.div
            className="absolute inset-0 overflow-hidden flex items-center justify-center"
            style={{
              scale: imgScale,
              borderRadius: imgRadius,
              opacity: imgRevealOpacity,
            }}
          >
            <img
              src="/phone-mockup.png"
              alt="Schedulio app"
              className="w-full h-auto"
            />
          </motion.div>

          <p className="relative z-10 shrink-0 text-white text-sm sm:text-base font-geist font-medium tracking-widest">
            (Görgess tovább)
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}

function Line({
  text,
  index,
  active,
}: {
  text: string
  index: number
  active: MotionValue<number>
}) {
  const chars = Array.from(text)
  const dist = useTransform(active, (a) => index - a)
  const lineOpacity = useTransform(dist, [-0.99, -0.4, 0, 0.4, 0.99], [0, 1, 1, 1, 0])

  return (
    <motion.div
      style={{ opacity: lineOpacity }}
      className="flex items-center justify-center text-[#f4f2ee] whitespace-nowrap"
    >
      {chars.map((ch, i) =>
        ch === ' ' ? (
          <span key={i}>&nbsp;</span>
        ) : (
          <RollChar key={i} ch={ch} dist={dist} charIndex={i} charCount={chars.length} />
        ),
      )}
    </motion.div>
  )
}

function RollChar({
  ch,
  dist,
  charIndex,
  charCount,
}: {
  ch: string
  dist: MotionValue<number>
  charIndex: number
  charCount: number
}) {
  const frac = charIndex / Math.max(1, charCount - 1)
  const SPREAD = 0.4
  const STEP = 0.3
  const delayIn = (1 - frac) * SPREAD
  const delayOut = frac * SPREAD
  const p = useTransform(dist, (d) => {
    const ad = Math.abs(d)
    const delay = d >= 0 ? delayIn : delayOut
    const v = (delay + STEP - ad) / STEP
    return Math.max(0, Math.min(1, v))
  })

  const y = useTransform([p, dist] as const, ([v, d]: number[]) => {
    const sign = d >= 0 ? 1 : -1
    return `${sign * (1 - v) * 110}%`
  })
  const opacity = useTransform(p, [0, 0.5, 1], [0, 0.6, 1])
  const filter = useTransform(p, (v) => `blur(${(1 - v) * 7}px)`)

  return (
    <span className="inline-block overflow-hidden align-bottom leading-[1.1]">
      <motion.span className="inline-block" style={{ y, opacity, filter }}>
        {ch}
      </motion.span>
    </span>
  )
}
