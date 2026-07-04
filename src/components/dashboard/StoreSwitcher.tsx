'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Check, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// „Staggered spring" belépő (etalon: a UserMenu popover) — a dropdown a triggerből
// rugósan pattan ki, az üzletek egymás után úsznak be.
const POP_PANEL = {
  hidden: { opacity: 0, scale: 0.85, y: -8 },
  show: {
    opacity: 1, scale: 1, y: 0,
    transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.035, delayChildren: 0.04 },
  },
  exit: { opacity: 0, scale: 0.92, y: -6, transition: { duration: 0.12, ease: 'easeIn' as const } },
}
const POP_ITEM = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

/** Egy üzlet a switcherben (a szerver `Business`-éből leszűkítve a megjelenítéshez). */
export interface SwitcherBusiness {
  type: 'restaurant' | 'salon'
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

/**
 * Fejléc store-switcher: körben a logó (vagy monogram), mellette az üzlet neve és a
 * csomag címkéje, jobbra egy ⇅. Kattintásra dropdown a felhasználó ÖSSZES üzletével
 * (étterem + szalon vegyesen). Másik üzletre kattintva a /api/business/switch beállítja
 * az aktív üzletet (cookie + DB), majd a visszakapott útra navigál.
 * Az `unread` igaz esetén egy piros pont jelzi a logón az olvasatlan értesítést.
 */
export function StoreSwitcher({
  name,
  logoUrl,
  planLabel,
  unread = false,
  businesses = [],
  activeKey = null,
  compact = false,
  hero = null,
}: {
  name: string
  logoUrl?: string | null
  planLabel?: string | null
  unread?: boolean
  businesses?: SwitcherBusiness[]
  activeKey?: string | null
  /** Kompakt változat a mobil top-barhoz: kisebb logó, nincs plan-sor, szűkebb padding. */
  compact?: boolean
  /** Hero-változat: sötét köszönő-kártya trigger (mobil kezdőlap). */
  hero?: { greeting: string; subtitle: string } | null
}) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?'
  const keyOf = (b: SwitcherBusiness) => `${b.type}:${b.id}`

  async function switchTo(b: SwitcherBusiness) {
    if (keyOf(b) === activeKey || switching) return
    setSwitching(keyOf(b))
    try {
      const res = await fetch('/api/business/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: b.type, id: b.id }),
      })
      const data = (await res.json().catch(() => null)) as { redirectTo?: string } | null
      if (res.ok && data?.redirectTo) {
        router.push(data.redirectTo)
        router.refresh()
        setOpen(false)
      }
    } finally {
      setSwitching(null)
    }
  }

  const monogram = (n: string) => n?.trim()?.[0]?.toUpperCase() ?? '?'

  return (
    <div ref={ref} className="relative">
      {hero ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full rounded-3xl bg-zinc-900 dark:bg-white/[0.04] text-white p-5 shadow-lg text-left"
        >
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="flex items-center gap-2 min-w-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-7 w-7 rounded-lg object-cover bg-white/10" />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-xs font-bold">{initial}</span>
              )}
              <span className="text-sm font-semibold text-white/80 truncate">{name}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/50" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{hero.greeting}</h1>
          <p className="mt-1 text-sm text-white/55">{hero.subtitle}</p>
        </button>
      ) : (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'flex items-center rounded-dav-pill border border-line bg-[var(--dav-glass)] hover:border-line-strong transition-colors',
          compact ? 'w-full gap-2 px-2 py-1.5' : 'gap-2.5 px-2.5 py-2',
        )}
      >
        {/* Logó körben + olvasatlan-jelző piros pont. */}
        <span className="relative shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className={cn('rounded-full object-cover bg-zinc-100 dark:bg-white/[0.06]', compact ? 'h-7 w-7' : 'h-9 w-9')} />
          ) : (
            <span className={cn('flex items-center justify-center rounded-full bg-ink-dark text-white font-bold', compact ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm')}>
              {initial}
            </span>
          )}
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </span>

        <span className="min-w-0 flex-1 text-left">
          <span className={cn('block truncate font-semibold text-ink', compact ? 'text-xs' : 'text-sm')}>{name}</span>
          {!compact && planLabel && <span className="block truncate text-[11px] text-ink-soft">{planLabel}</span>}
        </span>

        <ChevronsUpDown className="h-4 w-4 shrink-0 text-ink-soft" />
      </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            variants={POP_PANEL}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: 'top left' }}
            className="absolute top-full left-0 mt-2 w-full min-w-[13rem] rounded-[18px] border border-[#ececec] bg-white shadow-[0_18px_50px_-18px_rgba(0,0,0,.35)] z-[60] overflow-hidden p-1.5"
          >
            <motion.p variants={POP_ITEM} className="px-2.5 pt-1.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#b0ac9e]">Üzletek</motion.p>
            {/* A felhasználó összes üzlete (étterem + szalon vegyesen). */}
            {businesses.map((b) => {
              const k = keyOf(b)
              const isActive = k === activeKey
              const isBusy = switching === k
              return (
                <motion.button
                  key={k}
                  variants={POP_ITEM}
                  type="button"
                  onClick={() => switchTo(b)}
                  disabled={isBusy}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[13px] px-2.5 py-2 text-left transition-colors',
                    isActive ? 'cursor-default bg-[#f4f4f5]' : 'hover:bg-[#f4f4f5]',
                  )}
                >
                  {b.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logoUrl} alt={b.name} className="h-7 w-7 rounded-full object-cover bg-[#f5f5f4]" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-dark text-white text-xs font-bold">{monogram(b.name)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#2a2620]">{b.name}</span>
                    <span className="block truncate text-[10px] uppercase tracking-wide text-[#9b9788]">
                      {b.type === 'restaurant' ? 'Étterem' : 'Szalon'}
                    </span>
                  </span>
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#b0ac9e]" />
                  ) : isActive ? (
                    <Check className="h-4 w-4 shrink-0 text-ink" />
                  ) : null}
                </motion.button>
              )
            })}
            <div className="my-1 border-t border-[#efefef]" />
            {/* Új üzlet hozzáadása meglévő fiókhoz — jelszó nélkül, saját előfizetéssel. */}
            <motion.a
              variants={POP_ITEM}
              href="/business/new"
              className="flex w-full items-center gap-2.5 rounded-[13px] px-2.5 py-2.5 text-sm font-medium text-[#3a352a] hover:bg-[#f4f4f5] transition-colors"
            >
              <Plus className="h-4 w-4 shrink-0 text-[#8a8779]" />
              Üzlet hozzáadása
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
