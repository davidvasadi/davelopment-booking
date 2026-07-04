'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Check, Loader2, Plus } from 'lucide-react'
import type { SwitcherBusiness } from './StoreSwitcher'

/**
 * Fiók-banner az Előfizetés oldalon: fejléc (Fiókod: N üzlet + havidíj) egy jobb-széli lenyíló
 * gombbal. Kattintásra a TELJES SZÉLESSÉGŰ panel nyílik le a banner alatt (accordion — nem kis
 * buborék), listázva a fiók összes üzletét; egy üzletre kattintva a /api/business/switch beállítja
 * az aktív üzletet (cookie + DB) és átnavigál oda.
 */
export function AccountSwitcher({
  count,
  breakdown,
  businesses,
  activeKey = null,
  right,
}: {
  count: number
  breakdown: string
  businesses: SwitcherBusiness[]
  activeKey?: string | null
  /** A fejléc jobb oldala (havidíj / próba-hátralék). */
  right?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const router = useRouter()

  const keyOf = (b: SwitcherBusiness) => `${b.type}:${b.id}`
  const monogram = (n: string) => n?.trim()?.[0]?.toUpperCase() ?? '?'

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

  const canOpen = businesses.length > 0

  return (
    <div className="overflow-hidden rounded-[26px] border border-line bg-white shadow-dav-card">
      {/* ── Fejléc ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-ink-dark">
            <Building2 className="h-5 w-5 text-gold" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink">Fiókod: {count} üzlet</div>
            <div className="truncate text-[13px] text-ink-soft">{breakdown}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {right}
          {canOpen && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label="Üzletváltás"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-line-strong hover:text-ink"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ── Lenyíló TELJES-SZÉLESSÉGŰ panel ── */}
      {open && canOpen && (
        <div className="border-t border-line bg-[#FBFAF6] px-2.5 py-2">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft2">Üzletváltás</p>
          <div className="grid gap-1 sm:grid-cols-2">
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
                  className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'cursor-default bg-white shadow-dav-card' : 'hover:bg-white'
                  }`}
                >
                  {b.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.logoUrl} alt={b.name} className="h-9 w-9 rounded-full bg-paper object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-dark text-sm font-bold text-white">{monogram(b.name)}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{b.name}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-ink-soft2">{b.type === 'restaurant' ? 'Étterem' : 'Szalon'}</span>
                  </span>
                  {isBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-soft" /> : isActive ? <Check className="h-4 w-4 shrink-0 text-ink" /> : null}
                </button>
              )
            })}
          </div>
          <a
            href="/business/new"
            className="mt-1 flex items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[13.5px] font-medium text-ink-soft transition-colors hover:bg-white hover:text-ink"
          >
            <Plus className="h-4 w-4" />
            Üzlet hozzáadása
          </a>
        </div>
      )}
    </div>
  )
}
