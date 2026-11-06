'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Pillből kinövő panel (kit) — a Fiók menü (UserMenu) „staggered spring” nyitása: a panel a triggerből
 * rugósan pattan ki (scale .7 → 1, a bal felső sarokból), a háttér elsötétül; a sorok egymás után úsznak be
 * (`ui-stagger` + `data-stagger` a soroknál). A tartalom children-ként jön (szerver-komponens is lehet).
 */
export function SpringPopover({ trigger, children }: { trigger: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={() => setOpen((v) => !v)} className="transition-transform active:scale-95">{trigger}</button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="dim" className="fixed inset-0 z-40 bg-ui-dark/25 backdrop-blur-sm" onClick={() => setOpen(false)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} />
            <motion.div key="panel" className="absolute left-0 top-full z-50 mt-2 origin-top-left"
              initial={{ opacity: 0, scale: 0.7, y: -14 }}
              animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9 } }}
              exit={{ opacity: 0, scale: 0.9, y: -8, transition: { duration: 0.14, ease: 'easeIn' } }}>
              <div className="ui-stagger">{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </span>
  )
}
