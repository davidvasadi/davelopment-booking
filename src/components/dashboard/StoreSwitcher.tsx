'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Check, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}: {
  name: string
  logoUrl?: string | null
  planLabel?: string | null
  unread?: boolean
  businesses?: SwitcherBusiness[]
  activeKey?: string | null
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
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] px-2 py-2 hover:border-zinc-300 dark:hover:border-white/[0.16] hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
      >
        {/* Logó körben + olvasatlan-jelző piros pont. */}
        <span className="relative shrink-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name} className="h-9 w-9 rounded-full object-cover bg-zinc-100 dark:bg-white/[0.06]" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-sm font-bold">
              {initial}
            </span>
          )}
          {unread && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-black" />
          )}
        </span>

        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-bold text-zinc-900 dark:text-white">{name}</span>
          {planLabel && <span className="block truncate text-[11px] text-zinc-400 dark:text-white/30">{planLabel}</span>}
        </span>

        <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[12rem] rounded-xl border border-zinc-100 bg-white shadow-lg dark:bg-zinc-950 dark:border-white/[0.08] z-[60] overflow-hidden">
          <p className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/25">Üzletek</p>
          {/* A felhasználó összes üzlete (étterem + szalon vegyesen). */}
          {businesses.map((b) => {
            const k = keyOf(b)
            const isActive = k === activeKey
            const isBusy = switching === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => switchTo(b)}
                disabled={isBusy}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  isActive ? 'cursor-default' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.04]',
                )}
              >
                {b.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.logoUrl} alt={b.name} className="h-7 w-7 rounded-full object-cover bg-zinc-100 dark:bg-white/[0.06]" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold">{monogram(b.name)}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-white">{b.name}</span>
                  <span className="block truncate text-[10px] uppercase tracking-wide text-zinc-400 dark:text-white/30">
                    {b.type === 'restaurant' ? 'Étterem' : 'Szalon'}
                  </span>
                </span>
                {isBusy ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                ) : isActive ? (
                  <Check className="h-4 w-4 shrink-0 text-zinc-900 dark:text-white" />
                ) : null}
              </button>
            )
          })}
          <div className="border-t border-zinc-100 dark:border-white/[0.06]" />
          {/* Új üzlet hozzáadása meglévő fiókhoz — jelszó nélkül, saját előfizetéssel. */}
          <a
            href="/business/new"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-white/70 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Üzlet hozzáadása
          </a>
        </div>
      )}
    </div>
  )
}
