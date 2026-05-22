'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
