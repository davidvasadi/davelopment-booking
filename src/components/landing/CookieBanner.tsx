'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '@/lib/motion'

const STORAGE_KEY = 'davelopment-cookie-consent'

/**
 * Egyszerű süti-tájékoztató banner. A döntést (accept/reject) localStorage-ban tárolja,
 * így legközelebb nem jelenik meg. Landing design-nyelv: sötét pill-kártya alul.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // csak akkor jelenjen meg, ha még nincs döntés
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
  }, [])

  function decide(value: 'accepted' | 'rejected') {
    localStorage.setItem(STORAGE_KEY, value)
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-2xl"
        >
          <div className="rounded-2xl bg-brand-ink text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <p className="flex-1 text-sm leading-relaxed text-white/70">
              Sütiket használunk az oldal működéséhez és a felhasználói élmény javításához.
              Részletek a{' '}
              <Link href="/cookies" className="font-semibold text-white underline underline-offset-2 hover:text-brand-accent transition-colors">
                süti-tájékoztatóban
              </Link>
              .
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => decide('rejected')}
                className="h-10 px-4 rounded-full text-sm font-semibold text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                Elutasítom
              </button>
              <button
                type="button"
                onClick={() => decide('accepted')}
                className="h-10 px-5 rounded-full text-sm font-semibold bg-brand-accent text-brand-ink hover:brightness-105 transition"
              >
                Elfogadom
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
