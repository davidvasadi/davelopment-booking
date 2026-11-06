'use client'

import { motion } from 'framer-motion'

/**
 * Lapozás — csúszó váltás (kit, design 2.11.1): lapozós / lépésenkénti tartalomnál a keret áll, csak a tartalom csúszik
 * át rugósan, enyhe ráhúzással. `dir` = 1: előre (jobbról érkezik), -1: vissza (balról), 0: nincs csúszás (pl. a
 * nyitáskor). `k`: az aktuális lap kulcsa — változásakor csúszik. A szülő vágja le a kilógó részt (`overflow-hidden`).
 */
export const SLIDE_SPRING = { type: 'spring', stiffness: 420, damping: 22, mass: 0.8 } as const

export function SlideSwap({ k, dir, children, className }: { k: string | number; dir: number; children: React.ReactNode; className?: string }) {
  return (
    <motion.div key={k} className={className} initial={dir ? { x: dir * 56, opacity: 0 } : false} animate={{ x: 0, opacity: 1 }} transition={SLIDE_SPRING}>
      {children}
    </motion.div>
  )
}
