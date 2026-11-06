'use client'

import { motion } from 'framer-motion'
import { EASE } from '@/lib/motion'

/**
 * Lenyíló tartalom (accordion) — a landing GYIK-jával azonos mozgás: sima magasság + áttűnés + enyhe felcsúszás,
 * rugó / bounce NÉLKÜL. Zárva is a DOM-ban marad (0 magasság), így nyitáskor és záráskor is animál.
 */
export function Collapse({ open, children, className = '' }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={false}
      animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
      transition={{ height: { duration: 0.4, ease: EASE }, opacity: { duration: 0.3, ease: 'easeOut' } }}
      className="overflow-hidden"
      aria-hidden={!open}
      inert={!open}
    >
      <motion.div initial={false} animate={{ y: open ? 0 : 8 }} transition={{ duration: 0.4, ease: EASE }} className={className}>
        {children}
      </motion.div>
    </motion.div>
  )
}
