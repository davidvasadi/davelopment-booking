'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

/**
 * „Fizetés bankkártyával" — elindítja a Stripe Checkoutot a fiók-előfizetéshez, majd átirányít.
 * A `returnPath` az aktuális oldal (a Checkout ide tér vissza `?checkout=success|cancel`-lel).
 * Ha a Stripe nincs konfigurálva (nincs kulcs), a szerver 503-at ad → érthető toast.
 */
export function StripeCheckoutButton({ cycle }: { cycle: 'monthly' | 'annual' }) {
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cycle, returnPath: window.location.pathname }),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error || 'Nem sikerült elindítani a fizetést.')
      window.location.href = data.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt a fizetés indításakor.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-dav-pill bg-ink-dark px-6 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4 text-gold" strokeWidth={1.9} />}
      Fizetés bankkártyával
    </button>
  )
}
