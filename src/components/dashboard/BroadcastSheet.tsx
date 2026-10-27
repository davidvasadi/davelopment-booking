'use client'

import { SHEET_SPRING } from '@/lib/motion'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Megaphone } from 'lucide-react'
import { notifDate, type Notification } from '@/lib/useNotifications'

/** Egyszerű, teljes-szövegű megjelenítő admin körüzenethez — ugyanaz a portál/sheet-váz,
 *  mint a `DigestSheet`-nél (mobilon alulról felcsúszó, desktopon középre animálódó modal). */
export function BroadcastSheet({ n, open, onClose }: { n: Notification; open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const upd = () => setIsDesktop(mq.matches)
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])

  if (!mounted) return null

  const sheetMotion = isDesktop
    ? { initial: { opacity: 0, scale: 0.96, y: 12 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.96, y: 12 }, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } }
    : { initial: { opacity: 0, y: 40, scale: 0.97 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 40, scale: 0.97 }, transition: SHEET_SPRING }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[201] flex items-end justify-center lg:items-center lg:p-6">
            <motion.div
              key="sheet"
              {...sheetMotion}
              className="max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-[28px] bg-white font-onest shadow-[0_18px_60px_-20px_rgba(29,28,25,.35)] lg:max-w-[440px] lg:rounded-[28px]"
              data-lenis-prevent
            >
              <div className="sticky top-0 flex justify-center bg-white pb-1 pt-3 lg:hidden">
                <div className="h-[4px] w-10 rounded-full bg-line-strong" />
              </div>

              <div className="mx-6 mb-6 mt-2 lg:mt-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: '#FBF1C9' }}>
                    <Megaphone className="h-5 w-5" style={{ color: '#8A6D12' }} strokeWidth={1.9} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold leading-tight text-ink">{n.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-soft2">{notifDate(n.createdAt)}</p>
                  </div>
                </div>

                {n.body && (
                  <p className="mt-5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">{n.body}</p>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-7 w-full rounded-[18px] bg-ink-dark py-3 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Rendben
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
