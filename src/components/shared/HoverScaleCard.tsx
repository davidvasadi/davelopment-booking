'use client'

import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { buttonHover } from '@/lib/motion'

/**
 * Egy egész (klikkelhető) kártya közös hover-nyelve — ugyanaz az enyhe "press" scale, mint a
 * landing Hero gombjain (ld. lib/motion.ts `buttonHover`). A profil/avatar-kártyán a teljes
 * kártya reagál, nem csak a benne lévő (stretched) link.
 */
export function HoverScaleCard({
  className, style, children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={buttonHover}
      initial="rest"
      whileHover="hover"
      whileTap="hover"
    >
      {children}
    </motion.div>
  )
}
