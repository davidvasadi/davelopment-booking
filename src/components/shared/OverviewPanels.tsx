'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui-kit'

/** `count`: darabszám-jelvény a cím mellett (az első, kiemelt sor sárga). */
export type AccItem = { label: string; count?: number; body: React.ReactNode }

/** Élő (nyitható) akkordeon-kártya (a /design 4.1 kezelendők-kártyája): soronként cím (+ darabszám), lenyitva
 *  a tartalom; szaggatott elválasztó. */
export function OverviewAccordion({ items, defaultOpen = 0 }: { items: AccItem[]; defaultOpen?: number }) {
  const [openIdx, setOpenIdx] = useState<number | null>(defaultOpen)
  const anyOpen = openIdx !== null && openIdx >= 0 && openIdx < items.length
  return (
    <Card pad="xs" className="flex h-full max-h-[360px] flex-col lg:max-h-none">
      {items.map((item, i) => {
        const open = openIdx === i
        // Csukva a sorok egyenletesen kitöltik a kártyát; nyitáskor a nyitott sor növekszik a maradék helyre, a többi a
        // fejlécére húzódik — a flex-grow folyamatosan animál (nem ugrik). A kártya nem nő: a tartalom a soron belül görget.
        const grow = open ? 1 : anyOpen ? 0 : 1
        return (
          <div
            key={i}
            className={`flex min-h-[46px] flex-col overflow-hidden px-3 transition-[flex-grow] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${i ? 'border-t border-dashed border-ui-divider' : ''} ${!anyOpen ? 'justify-center' : ''}`}
            style={{ flex: `${grow} 1 0%` }}
          >
            <button type="button" onClick={() => setOpenIdx(open ? null : i)} className="flex min-h-[46px] w-full shrink-0 items-center justify-between gap-2 text-left text-ui-body text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
              <span className="flex items-center gap-2">
                {item.label}
                {item.count != null && <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-ui-label ${i === 0 ? 'bg-ui-yellow text-ui-dark' : 'bg-ui-cell text-ui-muted'}`}>{item.count}</span>}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-ui-muted transition-transform duration-500 ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.25, delay: 0.12 } }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-3"
                  data-lenis-prevent
                >
                  {item.body}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </Card>
  )
}
