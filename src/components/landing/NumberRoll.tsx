'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * „Odometer” számkijelzés: minden számjegy egy függőleges 0–9 szalag, ami rugóval a helyére
 * forog (nagyobb számjegynél felfelé, kisebbnél lefelé). Az oszlopok jobbról indexelve
 * maradnak meg, így a helyiértékek egy szám hosszának változásakor sem ugrálnak; a jobb szélső
 * indul először, a többi kicsit később. Csak transform animál. A képernyőolvasó a kész számot
 * kapja (sr-only), a szalagok rejtettek.
 */
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function Digit({ d, reduce, delay, fromZero }: { d: number; reduce: boolean; delay: number; /** később megjelenő helyiérték (pl. 9 → 10): 0-ról pörögjön a helyére, ne ugorjon be */ fromZero: boolean }) {
  return (
    <span className="relative inline-block h-[1em] overflow-hidden align-top">
      {/* láthatatlan helyfoglaló — a szélességet a font adja (tabular-nums) */}
      <span className="invisible">0</span>
      <motion.span
        className="absolute inset-x-0 top-0 flex flex-col"
        initial={fromZero && !reduce ? { y: '0%' } : false}
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
  // az első megjelenéskor meglévő számjegyek nem animálnak be; az utána érkező új helyiértékek 0-ról pörögnek
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true }, [])
  return (
    <span className={`relative inline-flex leading-none tabular-nums [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_82%,transparent)] ${className}`}
    >
      <span className="sr-only">{value.toLocaleString('hu-HU')}</span>
      {chars.map((c, i) => {
        const key = chars.length - i // jobbról számolt helyiérték
        return /\d/.test(c)
          ? <span key={key} aria-hidden><Digit d={Number(c)} reduce={reduce} delay={(key - 1) * 0.045} fromZero={mounted.current} /></span>
          : <span key={`s${key}`} aria-hidden className="inline-block h-[1em] whitespace-pre">{c === ' ' || c === ' ' ? ' ' : c}</span>
      })}
    </span>
  )
}
