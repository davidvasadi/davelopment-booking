'use client'

import { useRouter } from 'next/navigation'
import { useTransition, useState, useRef, useEffect } from 'react'
import { Globe, Check } from 'lucide-react'
import { LANG_COOKIE, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function LangSwitcher({ current, available, className }: { current: Locale; available: Locale[]; className?: string }) {
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

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all',
          'border border-white/25 bg-white/12 text-white backdrop-blur-sm hover:bg-white/22',
          open && 'bg-white/22',
          pending && 'opacity-50',
        )}
      >
        <Globe className="h-3.5 w-3.5" />
        {current}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[110px] overflow-hidden rounded-[14px] py-1"
          style={{
            background: 'rgba(22,22,26,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
          }}
        >
          {available.map(loc => (
            <button
              key={loc}
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
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
