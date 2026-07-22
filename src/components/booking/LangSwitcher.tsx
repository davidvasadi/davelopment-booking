'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState, useRef, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { LANG_COOKIE, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ITEM = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

export function LangSwitcher({
  current,
  available,
  className,
  variant = 'dark',
}: {
  current: Locale
  available: Locale[]
  className?: string
  variant?: 'dark' | 'light'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (available.length <= 1) return null

  const set = (loc: Locale) => {
    if (loc === current) { setOpen(false); return }
    document.cookie = `${LANG_COOKIE}=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    setOpen(false)
    startTransition(() => router.refresh())
  }

  const triggerCls = variant === 'light'
    ? cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all',
        'border border-black/15 bg-black/[0.06] text-[#1D1C19] hover:bg-black/[0.10]',
        open && 'bg-black/[0.10]',
        pending && 'opacity-50',
      )
    : cn(
        'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all',
        'border border-white/25 bg-white/12 text-white backdrop-blur-sm hover:bg-white/22',
        open && 'bg-white/22',
        pending && 'opacity-50',
      )

  return (
    <div ref={ref} className={cn('relative', className)}>
      <motion.button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={triggerCls}
        whileTap={{ scale: 0.88 }}
        transition={{ type: 'spring', stiffness: 520, damping: 26, mass: 0.9 }}
      >
        <Globe className="h-3.5 w-3.5" />
        {current}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="lang-panel"
            variants={{
              hidden: { opacity: 0, scale: 0.8, y: -8 },
              show: {
                opacity: 1,
                scale: 1,
                y: 0,
                transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.04, delayChildren: 0.05 },
              },
              exit: { opacity: 0, scale: 0.9, y: -6, transition: { duration: 0.14, ease: 'easeIn' } },
            }}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute right-0 top-full z-50 mt-2 min-w-[110px] overflow-hidden rounded-[14px] py-1"
            style={{
              background: 'rgba(22,22,26,0.92)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.09)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
              transformOrigin: 'top right',
            }}
          >
            {available.map(loc => (
              <motion.button
                key={loc}
                variants={ITEM}
                type="button"
                onClick={() => set(loc)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/10"
              >
                <span
                  className="text-[12px] font-semibold uppercase tracking-wide"
                  style={{ color: loc === current ? '#FFD85F' : 'rgba(255,255,255,0.8)' }}
                >
                  {loc}
                </span>
                {loc === current && <Check className="h-3.5 w-3.5" style={{ color: '#FFD85F' }} />}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
