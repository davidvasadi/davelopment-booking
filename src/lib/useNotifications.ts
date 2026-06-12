'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CalendarX, UserPlus, Sparkles, type LucideIcon } from 'lucide-react'

export type Notification = {
  id: number | string
  type: 'new_booking' | 'cancellation' | 'new_signup' | 'new_subscriber'
  title: string
  body?: string | null
  read?: boolean | null
  createdAt: string
  reservation?: number | string | null
  booking?: number | string | null
}

/** Egy értesítés-típushoz tartozó ikon + szín (a harang-soroknál, owner és admin típusra is). */
export function notificationVisual(type: Notification['type']): { Icon: LucideIcon; color: string } {
  switch (type) {
    case 'cancellation': return { Icon: CalendarX, color: 'text-red-500' }
    case 'new_signup': return { Icon: UserPlus, color: 'text-violet-500' }
    case 'new_subscriber': return { Icon: Sparkles, color: 'text-amber-500' }
    default: return { Icon: CalendarPlus, color: 'text-green-600 dark:text-green-400' } // new_booking
  }
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'most'
  if (m < 60) return `${m} perce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} órája`
  const d = Math.floor(h / 24)
  return `${d} napja`
}

/**
 * Az értesítés-állapot és -műveletek közös forrása (a fiók-popover és a mobil sheet
 * is ezt használja). Percenként frissít. A `onNavigate` callback (ha kapott) lefut,
 * amikor egy értesítésre kattintva navigálunk — pl. a popover bezárásához.
 */
export function useNotifications(onNavigate?: () => void) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnread(data.unread ?? 0)
    } catch {
      /* csendben — best-effort */
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  const remove = useCallback(async (id: number | string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    setUnread((u) => Math.max(0, u - 1))
    await fetch(`/api/notifications?id=${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
  }, [])

  const clearAll = useCallback(async () => {
    setItems((prev) => {
      Promise.all(
        prev.map((n) =>
          fetch(`/api/notifications?id=${encodeURIComponent(String(n.id))}`, {
            method: 'DELETE',
            credentials: 'include',
          }).catch(() => null),
        ),
      )
      return []
    })
    setUnread(0)
  }, [])

  // Értesítésre kattintva a kapcsolódó foglaláshoz navigálunk, és az értesítést
  // eltüntetjük (elintézettnek tekintjük). A `t` időbélyeg garantálja az új URL-t.
  const openItem = useCallback((n: Notification) => {
    onNavigate?.()
    remove(n.id)
    const t = Date.now()
    if (n.reservation != null) {
      router.push(`/restaurant/bookings?reservation=${encodeURIComponent(String(n.reservation))}&t=${t}`)
    } else if (n.booking != null) {
      router.push(`/dashboard/bookings?booking=${encodeURIComponent(String(n.booking))}&t=${t}`)
    } else if (n.type === 'new_signup') {
      router.push(`/backstage/salons?t=${t}`)
    } else if (n.type === 'new_subscriber') {
      router.push(`/backstage/subscriptions?t=${t}`)
    }
  }, [onNavigate, remove, router])

  // Csoportosítás: olvasatlanok elöl („Új"), majd az olvasottak („Korábbi").
  const groups = [
    { label: 'Új', rows: items.filter((n) => !n.read) },
    { label: 'Korábbi', rows: items.filter((n) => n.read) },
  ].filter((g) => g.rows.length > 0)

  return { items, unread, groups, remove, clearAll, openItem }
}
