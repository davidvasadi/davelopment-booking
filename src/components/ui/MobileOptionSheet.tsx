'use client'

import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Option<T extends string> {
  mode: T
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
}

/**
 * Mobil "alulról fade-up" választó-sheet — a Foglalások nézet-váltóját (Idősáv/Lista/Terem)
 * viszi ide a fejléc-ikon (a `davelopment:open-bookings-view` window-eseményt a DashboardNav
 * dispatch-eli, ugyanúgy mint a Beállítások/Tippek fejléc-ikonjai), ugyanazzal a belépő-nyelvvel mint
 * a többi sheet az appban (backdrop blur + spring felcsúszás).
 *
 * Opcionálisan egy MÁSODIK csoportot is felvesz (pl. Nap/Hét/Hónap időszak-váltó) — ugyanide,
 * a nézet-választó alá kerül egy saját alcímmel, hogy mobilon ne kelljen külön, mindig
 * látható pill-sorban helyet szorítani neki a fejlécben.
 */
export function MobileOptionSheet<T extends string, U extends string = never>({
  open,
  onClose,
  title,
  options,
  value,
  onChange,
  secondaryTitle,
  secondaryOptions,
  secondaryValue,
  secondaryOnChange,
}: {
  open: boolean
  onClose: () => void
  title: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
  secondaryTitle?: string
  secondaryOptions?: Option<U>[]
  secondaryValue?: U
  secondaryOnChange?: (v: U) => void
}) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[92]">
          <motion.div
            className="absolute inset-0 bg-black/[0.15] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
          />
          {/* `inset-x-0 bottom-0` — mindig a viewport TELJES szélességét foglalja el mobilon (nem
              flex-center + max-width-ből számolt szélesség), a max-width csak `sm:`-től szűkíti
              középre úszó panellé, ha valaha desktopon is megnyitnánk. */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full rounded-t-[28px] bg-white p-4 pb-[max(96px,calc(88px+env(safe-area-inset-bottom)))] shadow-[0_-12px_40px_-12px_rgba(0,0,0,.3)] sm:max-w-[520px]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-zinc-200" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Bezárás"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5">
              {options.map(({ mode, icon: Icon, label }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { onChange(mode); onClose() }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition-colors',
                    value === mode
                      ? 'border-ink-dark bg-ink-dark text-white'
                      : 'border-line text-ink hover:bg-zinc-50'
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  {label}
                </button>
              ))}
            </div>

            {secondaryOptions && secondaryOptions.length > 0 && (
              <>
                {secondaryTitle && <h3 className="mt-4 mb-3 text-sm font-bold text-ink">{secondaryTitle}</h3>}
                <div className="space-y-1.5">
                  {secondaryOptions.map(({ mode, icon: Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => { secondaryOnChange?.(mode); onClose() }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold transition-colors',
                        secondaryValue === mode
                          ? 'border-ink-dark bg-ink-dark text-white'
                          : 'border-line text-ink hover:bg-zinc-50'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
