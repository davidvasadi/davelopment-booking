'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { EASE, buttonHover } from '@/lib/motion'
import { IconCircle } from '@/components/ui-kit'

/** Landing-oldali pill CTA, körös nyíllal (hoverre becsúszó animáció).
 *  `white`: fehér test, sötét szöveg — világos kártyán. `dark`: sötét test, fehér szöveg —
 *  szintén világos hátteren, erősebb kontraszttal. `gold`: arany test, sötét szöveg — sötét
 *  (bemart-sarkú, sötét) kártyán, mint a dashboard Pro-kártyáján. A kör mindig a testtel
 *  ELLENTÉTES színt kapja, hogy a nyíl-kör mindig kiugorjon. */
export function HeroButton({ href, label, variant = 'white' }: { href: string; label: string; variant?: 'white' | 'dark' | 'gold' }) {
  const body = variant === 'gold' ? 'bg-ui-yellow text-ui-dark' : variant === 'dark' ? 'bg-ui-dark text-white' : 'bg-white text-ui-text'
  const arrow = variant === 'gold' ? 'text-white' : 'text-ui-dark'
  return (
    <motion.a
      href={href}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      className={`inline-flex w-full items-center justify-between gap-2 rounded-full py-1.5 pl-4 pr-1.5 font-onest font-medium text-ui-row ${body}`}
    >
      {label}
      <IconCircle tone={variant === 'gold' ? 'dark' : 'yellow'} size="sm" className="relative overflow-hidden">
        <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 32 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className={`h-4 w-4 ${arrow}`} />
        </motion.div>
        <motion.div className="absolute flex" variants={{ rest: { x: -32 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className={`h-4 w-4 ${arrow}`} />
        </motion.div>
      </IconCircle>
    </motion.a>
  )
}
