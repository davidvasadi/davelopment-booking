'use client'

/**
 * Beállítások-fülek mobil fejléc-vezérlője — a BookingPageEditor nyelv-választójával AZONOS
 * minta: egy kör alakú ikon-gomb a globális mobil fejlécbe portálozva (`#settings-subnav-slot`,
 * lásd DashboardNav), kattintásra alulról felcsúszó sheet-tel. Desktopon (lg+) nem jelenik meg —
 * ott a hívó saját, inline választója (pill-sor) fut, bőven elfér a fejléc alatt.
 *
 * Ezt használja: a Vendég e-mailek fül sablon-választója (EmailTemplatesEditor) és a Csapat &
 * jogok fül Tagok/Szerepek váltója (SettingsHub) — mindkettő korábban egy önálló sorban
 * zsúfolódott a tartalom tetejére, ami mobilon nem fért ki rendesen.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, type LucideIcon } from 'lucide-react'
import { sheetSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function SubnavPicker({
  items, activeId, onSelect, title, icon: Icon,
}: {
  items: { id: string; label: string }[]
  activeId: string
  onSelect: (id: string) => void
  title: string
  icon: LucideIcon
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setSlot(document.getElementById('settings-subnav-slot'))
    setIsMounted(true)
  }, [])

  const control = (
    <div className="relative lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={title}
        className="flex items-center justify-center h-[52px] w-[52px] shrink-0 rounded-full bg-[var(--dav-glass-strong)] text-ink shadow-[0_2px_8px_rgba(0,0,0,.05)] backdrop-blur-lg outline-none transition-colors hover:bg-white/70 active:scale-95"
      >
        <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
      </button>
      {isMounted && createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-[160] font-onest">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0 bg-ink-dark/40 backdrop-blur-sm"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={sheetSpring.transition}
                data-lenis-prevent
                className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              >
                <div className="sticky top-0 z-10 bg-white px-4 pb-3 pt-3">
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" />
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-soft2">{title}</span>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Bezárás" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F2EC] text-ink-soft transition-opacity hover:opacity-70">
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="px-3 pb-4">
                  {items.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => { onSelect(it.id); setOpen(false) }}
                      className={cn('flex h-12 w-full items-center rounded-[14px] px-3.5 text-left text-[14px] font-medium', it.id === activeId ? 'bg-ink-dark text-white' : 'text-ink hover:bg-black/[0.04]')}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )

  return slot ? createPortal(control, slot) : null
}
