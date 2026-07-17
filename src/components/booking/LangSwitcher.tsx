'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LANG_COOKIE, type Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Vendég nyelv-kapcsoló a publikus foglalón. Csak a tulaj által engedélyezett nyelveket (`available`,
 * HU mindig benne) kínálja; 1 nyelvnél nem renderel. A `davelopment_lang` cookie-t állítja (1 év, lax),
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
    <div className={cn('font-onest inline-flex items-center rounded-dav-pill border border-line bg-white/85 backdrop-blur p-0.5 text-[11px] font-semibold shadow-dav-card', pending && 'opacity-60', className)}>
      {available.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => set(loc)}
          aria-pressed={current === loc}
          className={cn(
            'px-2.5 py-1 rounded-dav-pill uppercase tracking-wide transition-colors',
            current === loc ? 'bg-ink-dark text-white' : 'text-ink-soft hover:text-ink',
          )}
        >
          {loc}
        </button>
      ))}
    </div>
  )
}
