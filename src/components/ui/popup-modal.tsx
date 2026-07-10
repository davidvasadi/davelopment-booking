'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// Az avatar-menü (UserMenu) „genie" belépője — ugyanaz az érzés, mint a foglalás-panelnél
// (nagy scale-ugrás + overshoot = pulzáló pop, a régiók staggerrel folynak be).
const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
} as const
const PANEL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
} as const

/**
 * Középre úszó, üveges-hátterű felugró modal (a Radix Sheet oldalsáv helyett) — az étterem
 * foglalás-szerkesztőjével AZONOS „genie" érzés: enyhén elmosott dim háttér + pulzáló pop.
 * Mobilon alsó lap, desktopon középre úszó panel. A törzs görgethető.
 */
export function PopupModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'sm:max-w-[560px]',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Tailwind max-width osztály a panelhez (desktop). */
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4">
          {/* Finom, elmosott háttér (enyhe dim + 2px blur) */}
          <motion.div
            className="absolute inset-0 bg-black/[0.06] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
          />
          {/* Középre úszó panel — genie spring; mobilon alsó lap */}
          <motion.div
            variants={GENIE}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'center' }}
            className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_28px_80px_-24px_rgba(0,0,0,.55)] sm:rounded-[26px] ${maxWidth}`}
          >
            {/* Fejléc (fix) */}
            <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-light tracking-[-0.02em] text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Bezárás"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>

            {/* Törzs (görgethető) */}
            <motion.div variants={PANEL_ITEM} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {children}
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
