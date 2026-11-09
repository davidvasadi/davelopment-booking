'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { EASE, buttonHover } from '@/lib/motion'
import { IconCircle } from '@/components/ui-kit'

/* A FeatureHeroCentered.tsx HeroButton-jának tokenes másolata (a főoldal ezt használja; a funkció-oldali hero a
 * következő körben jön ide). */

/** A főoldali hero gombja: kapszula + sárga kör, rámutatásra átcsúszó nyíllal. `light`: fehér test (sötét alapon). */
export function HeroButton({ href, label, light = false }: { href: string; label: string; light?: boolean }) {
  return (
    <motion.a
      href={href}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 font-onest text-ui-row font-medium ${light ? 'bg-white text-ui-text' : 'bg-ui-dark text-white'}`}
    >
      {label}
      <IconCircle tone="yellow" size="sm" className="relative overflow-hidden">
        <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 32 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-4 w-4 text-ui-dark" />
        </motion.div>
        <motion.div className="absolute flex" variants={{ rest: { x: -32 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
          <ArrowRight className="h-4 w-4 text-ui-dark" />
        </motion.div>
      </IconCircle>
    </motion.a>
  )
}
