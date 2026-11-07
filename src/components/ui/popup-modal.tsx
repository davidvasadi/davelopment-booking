'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { IconButton, MarqueeText, SheetHandle } from '@/components/ui-kit'
import { SHEET_MOBILE } from '@/lib/motion'

// Az avatar-menü (UserMenu) „genie" belépője — ugyanaz az érzés, mint a foglalás-panelnél
// (nagy scale-ugrás + overshoot = pulzáló pop, a régiók staggerrel folynak be).
export const GENIE = {
  hidden: { opacity: 0, scale: 0.7, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.92, y: 8, transition: { duration: 0.14, ease: 'easeIn' as const } },
} as const
// jobbról felugró változat (részletes lap, design 5.2): ugyanaz a rugó, a jobb széltől
const GENIE_RIGHT = {
  hidden: { opacity: 0, scale: 0.8, x: 60 },
  show: { opacity: 1, scale: 1, x: 0, transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.045, delayChildren: 0.06 } },
  exit: { opacity: 0, scale: 0.94, x: 30, transition: { duration: 0.14, ease: 'easeIn' as const } },
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
  headerAction,
  headerExtra,
  aside,
  footer,
  panel,
  side = 'center',
}: {
  open: boolean
  onClose: () => void
  /** `panel`-nél nem kell (a kész ablak hozza a fejlécét) */
  title?: string
  subtitle?: string
  children?: React.ReactNode
  /** Tailwind max-width osztály a panelhez (desktop). */
  maxWidth?: string
  /** gomb a cím mellett jobbra (pl. „Alaphelyzet”) — az X előtt */
  headerAction?: React.ReactNode
  /** a cím alatti sor (pl. állapot-pillek) */
  headerExtra?: React.ReactNode
  /** jobb oldali sáv (pl. az új foglalás összegzése, design 6.9): desktopon külön oszlop szürke háttérrel, mobilon a
   *  tartalom végén */
  aside?: React.ReactNode
  /** a gombok sora alul (jobbra igazítva) */
  footer?: React.ReactNode
  /** kész ablak (a kit Modal-ja, pl. a vendég-szerkesztő blokk) — ugyanazzal a háttérrel, animációval és mobil-lappal,
   *  mint minden más felugró ablak; ilyenkor a cím / törzs / aside nem kell */
  panel?: React.ReactNode
  /** desktopon hol ugrik fel: középen (alap) vagy a jobb szélen, teljes magasságban görgethetően (a Statisztikák részletes
   *  lapjai, design 5.2); mobilon mindig alsó lap */
  side?: 'center' | 'right'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Mobilon (sm alatt) valódi alulról felcsúszó lap a közös mozgással; asztalon a genie-pop.
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-[95] flex items-end justify-center sm:p-4 ${side === 'right' ? 'sm:items-stretch sm:justify-end sm:p-3' : 'sm:items-center'}`}>
          {/* a kit Overlay-e: sötétít és enyhén elmos */}
          <motion.div
            className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
          />
          {/* Középre úszó panel — genie spring; mobilon alsó lap. `panel`: a kész ablak ugyanígy */}
          {panel ? (
            <motion.div variants={isDesktop ? (side === 'right' ? GENIE_RIGHT : GENIE) : SHEET_MOBILE} initial="hidden" animate="show" exit="exit"
              style={{ transformOrigin: isDesktop ? (side === 'right' ? 'right center' : 'center') : 'bottom center' }}
              className={`relative z-10 w-full will-change-transform ${side === 'right' ? 'max-h-[85dvh] overflow-y-auto overflow-x-hidden sm:max-h-full sm:w-[460px]' : 'sm:w-auto'}`} data-lenis-prevent={side === 'right' ? true : undefined}>
              {panel}
            </motion.div>
          ) : (
          <motion.div
            variants={isDesktop ? GENIE : SHEET_MOBILE}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: isDesktop ? 'center' : 'bottom center' }}
            className={`relative z-10 flex max-h-[85dvh] w-full overflow-hidden rounded-t-ui-card bg-white shadow-ui-popup will-change-transform sm:max-h-[92vh] sm:rounded-ui-card ${maxWidth}`}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Mobilon fogantyú (koppintásra bezár) az X helyett — az alsó menü „…” lapjának mintája */}
            <button type="button" aria-label="Bezárás" onClick={onClose} className="w-full shrink-0 pt-2.5 sm:hidden"><SheetHandle /></button>
            {/* Fejléc (fix) */}
            <motion.div variants={PANEL_ITEM} className="flex shrink-0 items-start justify-between gap-3 px-6 pt-4 sm:pt-6">
              <div className="min-w-0">
                <h2 className="text-ui-sub font-light text-ui-text"><MarqueeText>{title}</MarqueeText></h2>
                {subtitle && <p className="mt-0.5 text-ui-meta text-ui-muted">{subtitle}</p>}
                {headerExtra && <div className="mt-2 flex flex-wrap items-center gap-1.5">{headerExtra}</div>}
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {headerAction}
                <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onClose} className={aside ? 'max-sm:hidden lg:hidden' : 'max-sm:hidden'} />
              </span>
            </motion.div>

            {/* Törzs (görgethető) */}
            <motion.div variants={PANEL_ITEM} className="min-h-0 flex-1 overflow-y-auto px-6 py-5" data-lenis-prevent>
              {children}
              {aside && <div className="-mx-6 -mb-5 mt-4 lg:hidden">{aside}</div>}
            </motion.div>
            {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 px-6 pb-6">{footer}</div>}
            </div>
            {aside && (
              <motion.div variants={PANEL_ITEM} className="hidden w-[300px] shrink-0 flex-col overflow-y-auto bg-ui-cell lg:flex" data-lenis-prevent>
                <div className="flex justify-end px-6 pt-6"><IconButton icon={X} label="Bezárás" variant="glass" size="sm" onClick={onClose} /></div>
                {aside}
              </motion.div>
            )}
          </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
