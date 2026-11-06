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

/** Foglalás státusza (szalon: bookings, étterem: reservations) — a jóváhagyó gombok és az Áttekintés kezelendői is ezt hívják.
 *  `decline`: elutasítás (a vendég e-mailt kap). Hibánál a szerver üzenetével dob. */
export async function setBookingStatus({ restaurant, id, status, decline = false }: { restaurant: boolean; id: string | number; status: string; decline?: boolean }) {
  const res = await fetch(restaurant ? '/api/restaurant/reservation-status' : '/api/salon/booking-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...(restaurant ? { reservationId: id } : { bookingId: id }), status, decline }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Nem sikerült')
}

/* ── Jóváhagyásra váró foglalás: Elfogadom / Elutasítom gyorsgombok ─────── */

export function ApprovalActions({ n, onHandled }: { n: Notification; onHandled?: () => void }) {
  const isRest = n.reservation != null

  // Már kezelték (itt vagy máshol) — gombok helyett az eredmény.
  if (n.target_status !== 'pending') {
    const accepted = n.target_status !== 'cancelled'
    return (
      <span className={cn('mt-2.5 inline-flex items-center gap-1.5 text-ui-meta font-medium', accepted ? 'text-ui-ok' : 'text-ui-bad')}>
        {accepted ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <X className="h-3.5 w-3.5" strokeWidth={2.6} />}
        {accepted ? 'Elfogadva' : 'Elutasítva'}
      </span>
    )
  }

  return <ApprovalButtons restaurant={isRest} id={(isRest ? n.reservation : n.booking)!} onHandled={onHandled} />
}

/** Elfogadom / Elutasítom (az elutasítás megerősítéssel) egy függő foglaláshoz — az értesítés-sor és az Értesítések ›
 *  Jóváhagyás fül (a valóban várakozó foglalások) is ezt használja. */
export function ApprovalButtons({ restaurant, id, onHandled }: { restaurant: boolean; id: string | number; onHandled?: () => void }) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null)
  const [confirmDecline, setConfirmDecline] = useState(false)

  async function act(kind: 'accept' | 'decline') {
    setBusy(kind)
    try {
      await setBookingStatus({ restaurant, id, status: kind === 'accept' ? 'confirmed' : 'cancelled', decline: kind === 'decline' })
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
        // a kit kis gombjának kinézete — <span>, mert az értesítés-sor maga is egy gomb (gombban nem lehet gomb)
        className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-ui-dark px-3.5 text-ui-meta font-medium text-white transition-transform active:scale-95" /* ui-allow: span-gomb a gomb-soron belül */
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
          'inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-ui-meta font-medium transition-transform active:scale-95', // ui-allow: span-gomb a gomb-soron belül
          confirmDecline ? 'bg-ui-bad-dot text-white' : 'bg-ui-cell text-ui-text',
        )}
      >
        {busy === 'decline' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {confirmDecline ? 'Biztosan?' : 'Elutasítom'}
      </span>
    </span>
  )
}
