'use client'

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal } from 'lucide-react'
import { SHEET_MOBILE } from '@/lib/motion'

/**
 * Mobil szűrő-lap (a Vendégek oldal mintája) — a mappa-fülön csak a kereső + „Szűrők” gomb marad,
 * a szűrők ide kerülnek pill-csoportokban. Alulról nyílik a közös mobilos lap-mozgással,
 * fogantyúval (koppintásra zár), X nélkül.
 */
export type FilterGroup = { title: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }

export function MobileFilterButton({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-9 flex-shrink-0 items-center gap-1.5 rounded-[18px] bg-white px-3.5 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] lg:hidden"
    >
      <SlidersHorizontal className="h-4 w-4" strokeWidth={1.8} /> Szűrők
      {count > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink-dark px-1 text-[10.5px] font-bold text-gold">{count}</span>}
    </button>
  )
}

export function MobileFilterSheet({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: FilterGroup[] }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[92] font-onest lg:hidden">
          <motion.div className="absolute inset-0 bg-black/[0.15] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose} />
          <motion.div
            variants={SHEET_MOBILE}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'bottom center' }}
            className="fixed inset-x-0 bottom-0 z-10 max-h-[85dvh] overflow-y-auto rounded-t-[28px] bg-white px-4 pb-[calc(16px+env(safe-area-inset-bottom))] will-change-transform"
            data-lenis-prevent
          >
            <button type="button" aria-label="Bezárás" onClick={onClose} className="w-full py-3"><span className="mx-auto block h-1 w-10 rounded-full bg-[#e0ddd6]" /></button>
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.title}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{g.title}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => g.onChange(o.value)}
                        className={`h-9 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${g.value === o.value ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink'}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={onClose} className="h-11 w-full rounded-dav-pill bg-ink-dark text-[14px] font-semibold text-white">Kész</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
