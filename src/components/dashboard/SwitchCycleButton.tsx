'use client'

import { useState } from 'react'
import { ArrowLeftRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export function SwitchCycleButton({ currentCycle }: { currentCycle: 'monthly' | 'annual' }) {
  const [busy, setBusy] = useState(false)
  const newCycle = currentCycle === 'monthly' ? 'annual' : 'monthly'
  const label = currentCycle === 'monthly' ? 'Váltás éves csomagra (−20%)' : 'Váltás havi csomagra'

  const handleSwitch = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/switch-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cycle: newCycle }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Hiba történt a váltás során.')
      toast.success(`Sikeresen átváltottál ${newCycle === 'annual' ? 'éves' : 'havi'} csomagra!`)
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSwitch}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-white px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-paper disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
      {label}
    </button>
  )
}
