'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { EASE, DUR } from '@/lib/motion'
import { makeT, type Locale } from '@/lib/i18n'
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
  locale = 'hu',
}: {
  sections?: Section[] | null
  company?: CompanyInfo | null
  triggerClassName?: string
  locale?: Locale
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()
  const tt = makeT(locale)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  useEffect(() => {
    if (searchParams.get('terms') === '1') setOpen(true)
  }, [searchParams])

  const items = buildTermsItems(sections, company, locale)
  if (items.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={triggerClassName ?? 'text-[12px] text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors'}
      >
        {tt('public.terms.title')}
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DUR.fast, ease: EASE }}
            >
              <motion.div
                className="w-full max-w-lg h-[88dvh] sm:h-[80dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl"
                style={{
                  background: 'rgba(22,22,26,0.92)',
                  backdropFilter: 'blur(28px) saturate(1.4)',
                  WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                initial={{ y: 40, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 40, opacity: 0, scale: 0.98 }}
                transition={{ duration: DUR.base, ease: EASE }}
              >
                <div className="sm:hidden flex justify-center pt-3 pb-1">
                  <div className="h-1 w-10 rounded-full bg-white/20" />
                </div>
                <div className="flex items-center justify-between gap-3 px-6 pt-4 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{tt('goodToKnow.title')}</p>
                    <h3 className="text-xl font-black tracking-tight text-white">{tt('public.terms.title')}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={tt('openingHours.close')}
                    className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors bg-white/10 text-white/60 hover:bg-white/15"
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
