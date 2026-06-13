'use client'

import { motion } from 'framer-motion'
import { EASE, DUR } from '@/lib/motion'

/**
 * Oldal-átmenet a publikus [slug] aloldalakra (profiloldal ↔ /book stb.).
 * A template.tsx minden navigációnál újra-mountol → a tartalom finoman beúszik
 * (fade + enyhe felfelé csúszás), ahelyett hogy ugrana. A korábbi oldal kilépő
 * animációja nélkül (App Router), de a belépő már sokkal simább érzetet ad.
 */
export default function SlugTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DUR.base, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
