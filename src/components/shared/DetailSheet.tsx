'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { IconButton } from '@/components/ui-kit'

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
      <IconButton icon={ArrowUpRight} label={`${title} — bővebben`} onClick={() => setOpen(true)} />

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
                <div className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm" onClick={() => setOpen(false)} />
                <motion.aside
                  className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-ui-popup sm:inset-y-2 sm:right-2 sm:max-w-[440px] sm:rounded-ui-card"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 36 }}
                >
                  <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
                    <div className="min-w-0">
                      <h2 className="truncate text-ui-sub font-light text-ui-text">{title}</h2>
                      {subtitle ? <p className="mt-0.5 text-ui-meta text-ui-muted">{subtitle}</p> : null}
                    </div>
                    <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={() => setOpen(false)} />
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
