'use client'

import { motion } from 'framer-motion'
import { EASE, DUR } from '@/lib/motion'

/**
 * A /[slug]/book oldal belépő-átmenete. Külön template kell a book mappában,
 * mert a [slug] szintű template a profiloldal → /book navigációnál NEM mountol
 * újra (a [slug] szegmens nem változik, csak mélyebbre lépünk).
 */
export default function BookTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.slow, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
