'use client'

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/useNotifications'

/** Jóváhagyásra váró foglalásról szóló értesítés (az API hozzáteszi a foglalás státuszát). */
export function isAwaitingApproval(n: Notification): boolean {
  return !!(n.metadata as { awaiting_approval?: boolean } | null)?.awaiting_approval && !!n.target_status
}

/* ── Jóváhagyásra váró foglalás: Elfogadom / Elutasítom gyorsgombok ─────── */

export function ApprovalActions({ n, onHandled }: { n: Notification; onHandled?: () => void }) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)
  const isRest = n.reservation != null

  // Már kezelték (itt vagy máshol) — gombok helyett az eredmény.
  if (n.target_status !== 'pending') {
    const accepted = n.target_status !== 'cancelled'
    return (
      <span className={cn('mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold', accepted ? 'text-[#1D7A3C]' : 'text-[#B3261E]')}>
        {accepted ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <X className="h-3.5 w-3.5" strokeWidth={2.6} />}
        {accepted ? 'Elfogadva' : 'Elutasítva'}
      </span>
    )
  }

  async function act(kind: 'accept' | 'decline') {
    setBusy(kind)
    try {
      const res = await fetch(isRest ? '/api/restaurant/reservation-status' : '/api/salon/booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(isRest ? { reservationId: n.reservation } : { bookingId: n.booking }),
          status: kind === 'accept' ? 'confirmed' : 'cancelled',
          decline: kind === 'decline',
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Nem sikerült')
      toast.success(kind === 'accept' ? 'Elfogadva — a vendég megkapta a visszaigazolást' : 'Elutasítva — a vendég e-mailben értesült')
      onHandled?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült')
    } finally {
      setBusy(null)
      setConfirmDecline(false)
    }
  }

  // A sor maga egy gomb (megnyitás) — a gyorsgombok kattintása ne nyissa meg a foglalást.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <span className="mt-2.5 flex flex-nowrap items-center gap-1.5" onClick={stop} onKeyDown={stop}>
      <span
        role="button"
        tabIndex={0}
        aria-disabled={busy !== null}
        onClick={() => busy === null && act('accept')}
        className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-[#74AA19] px-3 text-[12.5px] font-semibold text-ink-dark transition-opacity hover:opacity-90"
      >
        {busy === 'accept' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
        Elfogadom
      </span>
      <span
        role="button"
        tabIndex={0}
        aria-disabled={busy !== null}
        onClick={() => { if (busy !== null) return; if (confirmDecline) act('decline'); else setConfirmDecline(true) }}
        className={cn(
          'inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-[12.5px] font-semibold transition-colors',
          confirmDecline ? 'border-[#B3261E] bg-[#B3261E] text-white' : 'border-line-strong text-ink hover:bg-black/[0.04]',
        )}
      >
        {busy === 'decline' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {confirmDecline ? 'Biztosan?' : 'Elutasítom'}
      </span>
    </span>
  )
}
