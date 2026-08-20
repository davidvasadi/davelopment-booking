'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { EASE, buttonHover } from '@/lib/motion'

/** Landing-oldali pill CTA, körös nyíllal (hoverre becsúszó animáció).
 *  `white`: fehér test, sötét szöveg — világos kártyán. `dark`: sötét test, fehér szöveg —
 *  szintén világos hátteren, erősebb kontraszttal. `gold`: arany test, sötét szöveg — sötét
 *  (bemart-sarkú, ink-dark) kártyán, mint a dashboard Pro-kártyáján. A kör mindig a testtel
 *  ELLENTÉTES színt kapja, hogy a nyíl-kör mindig kiugorjon. */
export function HeroButton({ href, label, variant = 'white' }: { href: string; label: string; variant?: 'white' | 'dark' | 'gold' }) {
  const bodyBg = variant === 'gold' ? '#f1ce45' : variant === 'dark' ? '#2a2720' : '#ffffff'
  const bodyText = variant === 'gold' ? '#1d1c19' : variant === 'dark' ? '#f5f5f5' : '#3b3b3b'
  const circleBg = variant === 'gold' ? '#1d1c19' : '#f1ce45'
  const arrowColor = variant === 'gold' ? '#f5f5f5' : '#1d1c19'
  return (
    <motion.a
      href={href}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      className="inline-flex w-full items-center justify-between gap-2.5 rounded-full py-2.5 pl-5 pr-2.5 font-onest font-medium text-[17px]"
      style={{ background: bodyBg, color: bodyText }}
    >
      {label}
      <span className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full overflow-hidden" style={{ background: circleBg }}>
        <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 36 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-[18px] w-[18px]" style={{ color: arrowColor }} />
        </motion.div>
        <motion.div className="absolute flex" variants={{ rest: { x: -36 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-[18px] w-[18px]" style={{ color: arrowColor }} />
        </motion.div>
      </span>
    </motion.a>
  )
}
