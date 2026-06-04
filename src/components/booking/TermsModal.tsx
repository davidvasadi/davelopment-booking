'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { FileText, X } from 'lucide-react'
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
        className={`inline-flex items-center gap-1.5 align-middle ${triggerClassName ?? 'text-sm font-medium text-zinc-500 hover:text-zinc-800 dark:text-white/50 dark:hover:text-white underline underline-offset-2 transition-colors'}`}
      >
        <FileText className="h-3.5 w-3.5 shrink-0" />
        Foglalási feltételek
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg h-[80dvh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-zinc-100 dark:border-white/[0.06]">
              <h3 className="font-black tracking-tight text-zinc-900 dark:text-white">Foglalási feltételek</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-5" data-lenis-prevent>
              <TermsContent items={items} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
