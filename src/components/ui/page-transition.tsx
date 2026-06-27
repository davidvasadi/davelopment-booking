'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { pageTransition } from '@/lib/motion'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <motion.div key={pathname} {...pageTransition}>
      {children}
    </motion.div>
  )
}
