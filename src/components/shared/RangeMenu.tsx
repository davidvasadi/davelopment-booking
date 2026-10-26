'use client'

// Nap / Hét / Hónap választó a dátum-pill VÉGÉN („Nap ▾”) — a korábbi külön háromgombos pill
// helyett (szalon + étterem Foglalások fejléce közös). Kattintásra kis menü nyílik.

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'

export type RangeValue = 'day' | 'week' | 'month'
const OPTIONS: { value: RangeValue; label: string }[] = [
  { value: 'day', label: 'Nap' },
  { value: 'week', label: 'Hét' },
  { value: 'month', label: 'Hónap' },
]

export function RangeMenu({ value, onChange, className = '' }: { value: RangeValue; onChange: (v: RangeValue) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  const current = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0]
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Nézet: nap / hét / hónap"
        className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-white"
      >
        {current.label}
        <ChevronDown className={`h-3.5 w-3.5 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 480, damping: 30 } }}
            exit={{ opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.12 } }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-2 w-36 rounded-[16px] border border-line bg-white p-1.5 shadow-dav-container"
          >
            {OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value) }}
                className="flex w-full items-center justify-between rounded-[11px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-[#F4F4F4]"
              >
                {o.label}
                {o.value === value && <Check className="h-4 w-4 text-ink" strokeWidth={2} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
