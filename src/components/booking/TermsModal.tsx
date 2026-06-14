'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { EASE, DUR } from '@/lib/motion'
import { TermsContent, buildTermsItems, type Section, type CompanyInfo } from './TermsContent'

export type { CompanyInfo }

/**
 * „Foglalási feltételek" megjelenítése a vendégnek: egy diszkrét link/gomb, ami
 * egy glass-modalt nyit a szakaszokkal (cím + szöveg), szépen formázva. A
 * „Szolgáltató adatai" blokkot a cégadatokból automatikusan a lista élére teszi.
 * Üres szakaszlistánál (és üres cégadatnál) nem renderel semmit.
 */
export function TermsModal({
  sections,
  company,
  triggerClassName,
}: {
  sections?: Section[] | null
  company?: CompanyInfo | null
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => setMounted(true), [])

  // Amíg a modal nyitva van, a háttér (body) ne görögjön — különben a
  // görgetés a lapon landol, nem a modal tartalmán.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Az emailből érkező link (?terms=1) betöltéskor azonnal felnyitja a modált.
  useEffect(() => {
    if (searchParams.get('terms') === '1') setOpen(true)
  }, [searchParams])

  const items = buildTermsItems(sections, company)
  if (items.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? 'text-sm font-medium text-zinc-500 hover:text-zinc-800 underline underline-offset-2 transition-colors'}
      >
        Foglalási feltételek
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-md"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.fast, ease: EASE }}
            >
              <motion.div
                className="w-full max-w-lg h-[88dvh] sm:h-[80dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white/90 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-inset ring-white/30 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                initial={{ y: 40, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 40, opacity: 0, scale: 0.98 }}
                transition={{ duration: DUR.base, ease: EASE }}
              >
                {/* Fogantyú (mobil, lefelé-húzás vizuális jelzés) */}
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                  <div className="h-1 w-10 rounded-full bg-zinc-300" />
                </div>
                <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Jó tudni</p>
                    <h3 className="text-xl font-black tracking-tight text-zinc-900">Foglalási feltételek</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Bezárás"
                    className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center bg-zinc-100/70 text-zinc-500 hover:bg-zinc-200 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6" data-lenis-prevent>
                  <TermsContent items={items} />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
