'use client'

import { motion, useReducedMotion } from 'framer-motion'

/**
 * „Odometer” számkijelzés: minden számjegy egy függőleges 0–9 szalag, ami rugóval a helyére
 * forog (nagyobb számjegynél felfelé, kisebbnél lefelé). Az oszlopok jobbról indexelve
 * maradnak meg, így a helyiértékek egy szám hosszának változásakor sem ugrálnak; a jobb szélső
 * indul először, a többi kicsit később. Csak transform animál. A képernyőolvasó a kész számot
 * kapja (sr-only), a szalagok rejtettek.
 */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function Digit({ d, reduce, delay }: { d: number; reduce: boolean; delay: number }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden align-top">
      {/* láthatatlan helyfoglaló — a szélességet a font adja (tabular-nums) */}
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={false}
        animate={{ y: `${-d * 10}%` }}
        // lassú, jól követhető forgás: lágy rugó, enyhe lecsengéssel
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 20, mass: 1.1, delay }}
      >
        {DIGITS.map((n) => <span key={n} className="block h-[1em] leading-none">{n}</span>)}
      </motion.span>
    </span>
  )
}

export function NumberRoll({ value, className = '' }: { value: number; className?: string }) {
  const reduce = !!useReducedMotion()
  const chars = value.toLocaleString('hu-HU').split('')
  return (
    <span className={`relative inline-flex leading-none tabular-nums [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_82%,transparent)] ${className}`}
    >
      <span className="sr-only">{value.toLocaleString('hu-HU')}</span>
      {chars.map((c, i) => {
        const key = chars.length - i // jobbról számolt helyiérték
        return /\d/.test(c)
          ? <span key={key} aria-hidden><Digit d={Number(c)} reduce={reduce} delay={(key - 1) * 0.045} /></span>
          : <span key={`s${key}`} aria-hidden className="inline-block h-[1em] whitespace-pre">{c === ' ' || c === ' ' ? ' ' : c}</span>
      })}
    </span>
  )
}
