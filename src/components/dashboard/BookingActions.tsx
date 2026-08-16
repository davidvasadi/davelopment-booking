'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, FileSignature } from 'lucide-react'
import { markLocalMutation } from '@/lib/localMutationTracker'

// Ugyanaz a 4 státusz, mint a teljes szerkesztő <select>-jében (BookingEditSheet) — a gyors
// menü ne legyen szűkebb annál, amit a sheetben amúgy is szabadon be lehet állítani.
// Szalonoknál nincs "függő" munkafolyamat — csak megerősítve/befejezett/lemondva.
const statusOptions: { label: string; status: string }[] = [
  { label: 'Megerősítés', status: 'confirmed' },
  { label: 'Befejezés', status: 'completed' },
  { label: 'Lemondás', status: 'cancelled' },
]

export default function BookingActions({
  bookingId, status, consentEnabled = false, consentAccepted = false,
}: { bookingId: string; status: string; consentEnabled?: boolean; consentAccepted?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const available = statusOptions.filter((o) => o.status !== status)

  if (available.length === 0 && !(consentEnabled && !consentAccepted)) return null

  const updateStatus = async (newStatus: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/salon/booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bookingId, status: newStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success('Státusz frissítve')
      markLocalMutation()
      router.refresh()
    } catch {
      toast.error('Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={loading}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {available.map(({ label, status: s }) => (
          <DropdownMenuItem key={s} onClick={() => updateStatus(s)}>
            {label}
          </DropdownMenuItem>
        ))}
        {consentEnabled && !consentAccepted && (
          <DropdownMenuItem onClick={() => router.push(`/dashboard/bookings/consent/${bookingId}`)}>
            <FileSignature className="mr-2 h-4 w-4" /> Nyilatkozat aláíratása helyszínen
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
