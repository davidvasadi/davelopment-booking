'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, AlertTriangle, Loader2 } from 'lucide-react'

// Lehetséges állapotváltások az étteremben
const nextActions: Record<string, { label: string; status: string }[]> = {
  pending: [
    { label: 'Megerősítés', status: 'confirmed' },
    { label: 'Lemondás', status: 'cancelled' },
  ],
  confirmed: [
    { label: 'Leültetve', status: 'seated' },
    { label: 'Nem jött meg', status: 'no_show' },
    { label: 'Lemondás', status: 'cancelled' },
  ],
  seated: [
    { label: 'Befejezés', status: 'completed' },
  ],
  completed: [],
  no_show: [],
  cancelled: [],
}

export function ReservationActions({ reservationId, status }: { reservationId: number | string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const available = nextActions[status] ?? []

  if (available.length === 0) return null

  const updateStatus = async (newStatus: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success('Státusz frissítve')
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={loading}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {available.map(({ label, status: s }) => (
            <DropdownMenuItem
              key={s}
              onClick={() => (s === 'cancelled' ? setConfirmCancel(true) : updateStatus(s))}
              className={s === 'cancelled' ? 'text-red-600 focus:text-red-600' : undefined}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmCancel && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xl">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] p-6 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Biztosan lemondod a foglalást?</h3>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Ez a művelet a foglalást lemondottra állítja. A vendég értesülhet róla.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={loading}
                className="flex-1 h-11 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-700 dark:text-white/80 text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                Mégse
              </button>
              <button
                type="button"
                onClick={async () => {
                  await updateStatus('cancelled')
                  setConfirmCancel(false)
                }}
                disabled={loading}
                className="flex-1 h-11 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Lemondás...' : 'Igen, lemondom'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
