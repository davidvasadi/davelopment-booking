'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { popPanelCenter } from '@/lib/motion'
import { HiringView } from './HiringView'

type Variant = 'salon' | 'restaurant'

/**
 * Munkavállalók (Hiring) OVERLAY — a Munkatársak LISTÁRÓL nyílik: egy sorra kattintva ráúszik a
 * képernyőre az adott munkatárs adatlapja (`initialIndex` → a bal-lista előre-kiválasztva). A panel
 * staggered-spring nyitás (`popPanelCenter`), mögötte `backdrop-blur` dim — ugyanaz az „Apple-szerű"
 * nyelv, mint az avatar/értesítés popover (UserMenu). `createPortal` a body-ra, hogy a fixed pozíció +
 * a teljes-képernyős blur helyesen üljön (nem tör meg a transform-context).
 */
export function HiringOverlay({ open, onClose, variant, initialIndex = 0 }: { open: boolean; onClose: () => void; variant: Variant; initialIndex?: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[95] bg-black/25 backdrop-blur-[5px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[96] flex items-start justify-center overflow-y-auto p-3 sm:p-6" onClick={onClose}>
            <motion.div
              variants={popPanelCenter}
              initial="hidden"
              animate="show"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
              style={{ transformOrigin: 'center' }}
              className="my-auto w-full max-w-[1120px] rounded-[30px] border border-line bg-dav-container p-5 shadow-dav-container sm:p-7 xl:max-w-[1360px]"
              data-lenis-prevent
            >
              <HiringView variant={variant} onClose={onClose} initialIndex={initialIndex} />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
