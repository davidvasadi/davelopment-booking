'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronsUpDown, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Fejléc store-switcher: körben a logó (vagy monogram), mellette az üzlet neve és a
 * csomag címkéje, jobbra egy ⇅. Kattintásra dropdown az elérhető üzletekkel — egyelőre
 * csak az aktuális üzlet + egy „Hamarosan" placeholder (a több-fiók logika később jön).
 * Az `unread` igaz esetén egy piros pont jelzik a logón az olvasatlan értesítést.
 */
export function StoreSwitcher({
  name,
  logoUrl,
  planLabel,
  unread = false,
}: {
  name: string
  logoUrl?: string | null
  planLabel?: string | null
  unread?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?'

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
          {/* Aktuális üzlet. */}
          <div className="flex items-center gap-2.5 px-3 py-2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={name} className="h-7 w-7 rounded-full object-cover bg-zinc-100 dark:bg-white/[0.06]" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold">{initial}</span>
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900 dark:text-white">{name}</span>
            <Check className="h-4 w-4 shrink-0 text-zinc-900 dark:text-white" />
          </div>
          <div className="border-t border-zinc-100 dark:border-white/[0.06]" />
          {/* Placeholder: a több-üzlet hozzáadás logikája később jön. */}
          <button
            type="button"
            disabled
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-zinc-400 dark:text-white/30 cursor-not-allowed"
            title="Hamarosan"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Üzlet hozzáadása
            <span className="ml-auto text-[10px] font-semibold rounded-full bg-zinc-100 dark:bg-white/[0.06] px-1.5 py-0.5">hamarosan</span>
          </button>
        </div>
      )}
    </div>
  )
}
