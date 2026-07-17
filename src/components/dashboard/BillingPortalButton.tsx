'use client'

import { useState } from 'react'
import { Settings2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * „Fizetés kezelése" — a Stripe Billing Portalra irányít, ahol a fizető ügyfél a bankkártyáját
 * cserélheti, letöltheti a számláit és lemondhat. A `returnPath` az aktuális oldal (a portál ide
 * tér vissza). Ha még nincs Stripe-customer (trial), a szerver 400-at ad → érthető toast.
 * A `variant` a kétféle megjelenéshez: 'button' (teljes gomb) vagy 'link' (finom szöveg-link).
 */
export function BillingPortalButton({ variant = 'button', label = 'Fizetés kezelése' }: { variant?: 'button' | 'link'; label?: string }) {
  const [busy, setBusy] = useState(false)

  const open = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ returnPath: window.location.pathname }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Nem sikerült megnyitni a fizetési portált.')
      window.location.href = data.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt a portál megnyitásakor.')
      setBusy(false)
    }
  }

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft underline-offset-2 transition-colors hover:text-ink disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5" />}
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-dav-pill border border-line-strong px-5 text-sm font-semibold text-ink transition-opacity hover:opacity-80 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4 text-gold" strokeWidth={1.9} />}
      {label}
    </button>
  )
}
