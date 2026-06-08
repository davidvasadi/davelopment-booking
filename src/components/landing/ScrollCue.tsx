'use client'

import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'

/** Forgó körív-feliratos „görgess lejjebb” jelző, középen pattogó nyíllal. */
export function ScrollCue() {
  const text = '✳ GÖRGESS LEJJEBB '.repeat(2)
  return (
    <div className="relative h-28 w-28 select-none">
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 18, ease: 'linear', repeat: Infinity }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full">
          <defs>
            <path id="cue-circle" d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
          </defs>
          <text className="fill-brand-ink text-[8.5px] font-bold uppercase" style={{ letterSpacing: '0.2em' }}>
            <textPath href="#cue-circle" startOffset="0">
              {text}
            </textPath>
          </text>
        </svg>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
        >
          <ArrowDown className="h-5 w-5 text-brand-ink" strokeWidth={2.4} />
        </motion.div>
      </div>
    </div>
  )
}
