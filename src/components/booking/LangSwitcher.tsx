'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LANG_COOKIE, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Vendég nyelv-kapcsoló a publikus foglalón. Csak a tulaj által engedélyezett nyelveket (`available`,
 * HU mindig benne) kínálja; 1 nyelvnél nem renderel. A `schedulio_lang` cookie-t állítja (1 év, lax),
 * majd `router.refresh()` — a szerver-komponensek újraolvassák a nyelvet.
 */
export function LangSwitcher({ current, available, className }: { current: Locale; available: Locale[]; className?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // 1 (vagy 0) engedélyezett nyelv → nincs mit váltani.
  if (available.length <= 1) return null

  const set = (loc: Locale) => {
    if (loc === current) return
    document.cookie = `${LANG_COOKIE}=${loc}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <div className={cn('inline-flex items-center rounded-full border border-zinc-200 bg-white/80 backdrop-blur p-0.5 text-xs font-bold', pending && 'opacity-60', className)}>
      {available.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => set(loc)}
          aria-pressed={current === loc}
          className={cn(
            'px-2.5 py-1 rounded-full uppercase transition-colors',
            current === loc ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:text-zinc-900',
          )}
        >
          {loc}
        </button>
      ))}
    </div>
  )
}
