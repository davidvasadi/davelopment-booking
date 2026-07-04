'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'

/**
 * Kártya-nyíl (↗) → jobb oldali SIDEBAR a bővebb infókért. A trigger a kártya fejlécében ülő
 * kis nyíl-gomb; kattintásra egy portálon (body) full-screen blur-overlay + jobbról becsúszó
 * drawer nyílik a `title`/`subtitle` fejléccel és a `children` részletekkel. A body-portál kell,
 * hogy a felső nav is elhomályosodjon (lásd overlay-portal-blur elv).
 */
export function DetailSheet({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title} — bővebben`}
        title="Bővebben"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f0ed] text-ink shadow-[0_1px_3px_rgba(40,40,40,.08)] transition-colors hover:bg-[#e6e5e1]"
      >
        <ArrowUpRight className="h-[15px] w-[15px]" strokeWidth={2.2} />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="ov"
                className="fixed inset-0 z-[120] font-onest"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={() => setOpen(false)} />
                <motion.aside
                  className="absolute right-0 top-0 flex h-full w-full max-w-[440px] flex-col bg-white shadow-[0_0_60px_-10px_rgba(30,30,30,.35)]"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 36 }}
                >
                  <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
                    <div className="min-w-0">
                      <h2 className="truncate text-[24px] font-light leading-tight tracking-[-0.02em] text-ink">{title}</h2>
                      {subtitle ? <p className="mt-1 text-[13px] text-ink-soft">{subtitle}</p> : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Bezárás"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-line-strong"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-5" data-lenis-prevent>
                    {children}
                  </div>
                </motion.aside>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
