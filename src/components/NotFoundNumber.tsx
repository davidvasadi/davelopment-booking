'use client'

import { motion } from 'framer-motion'
import { float } from '@/components/landing/Motion'

/** Nagy, lassan lebegő "404" felirat. */
export function NotFoundNumber() {
  return (
    <motion.p
      {...float(9, 4.5)}
      className="font-onest font-semibold text-[clamp(5rem,16vw,9rem)] leading-none tracking-[-0.04em] text-brand-ink"
    >
      404
    </motion.p>
  )
}
