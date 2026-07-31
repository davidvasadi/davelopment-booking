'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CalendarX, CalendarClock, UserPlus, Sparkles, Sunrise, Sunset, CalendarRange, type LucideIcon } from 'lucide-react'

export type Notification = {
  id: number | string
  type: 'new_booking' | 'cancellation' | 'modification' | 'new_signup' | 'new_subscriber' | 'digest_morning' | 'digest_evening' | 'schedule_change'
  title: string
  body?: string | null
  read?: boolean | null
  metadata?: Record<string, unknown> | null
  createdAt: string
  reservation?: number | string | null
  booking?: number | string | null
  salon?: number | string | null
  restaurant?: number | string | null
}

export type DigestMetadata = {
  bookings: number
  guests: number
  date?: string
  team_count?: number
  occasions?: Record<string, number>
  shift_manager?: { name: string; avatar_url?: string | null }
  staff_breakdown?: { name: string; bookings: number }[]
  /** Esti összefoglalónál: foglalás-forrás breakdown */
  source?: { walk_in?: number; phone?: number; online?: number }
  /** Esti összefoglalónál: státusz breakdown */
  status?: { completed?: number; cancelled?: number; no_show?: number }
}

export function notificationVisual(type: Notification['type'], metadata?: Record<string, unknown> | null): { Icon: LucideIcon; color: string; bg: string } {
  if (type === 'schedule_change') {
    const event = metadata?.event as string | undefined
    if (event === 'deleted')  return { Icon: CalendarX,     color: 'text-[#C0392B]', bg: 'bg-[#F6E7E4]' }
    if (event === 'modified') return { Icon: CalendarClock,  color: 'text-[#D4760A]', bg: 'bg-[#FEF3E2]' }
    if (event === 'created')  return { Icon: CalendarPlus,  color: 'text-[#1D9D63]', bg: 'bg-[#E4F2E9]' }
    return { Icon: CalendarRange, color: 'text-[#6B4FA8]', bg: 'bg-[#F0EBF9]' }
  }
  switch (type) {
    case 'cancellation':    return { Icon: CalendarX,     color: 'text-[#C0392B]', bg: 'bg-[#F6E7E4]' }
    case 'modification':    return { Icon: CalendarClock,  color: 'text-[#D4760A]', bg: 'bg-[#FEF3E2]' }
    case 'new_signup':      return { Icon: UserPlus,       color: 'text-ink',       bg: 'bg-[#EDEBE3]' }
    case 'new_subscriber':  return { Icon: Sparkles,       color: 'text-[#8A6D12]', bg: 'bg-[#FBF1C9]' }
    case 'digest_morning':   return { Icon: Sunrise,       color: 'text-[#B45309]', bg: 'bg-[#FFFBEB]' }
    case 'digest_evening':   return { Icon: Sunset,        color: 'text-[#4B6CB7]', bg: 'bg-[#EEF2FC]' }
    default:                 return { Icon: CalendarPlus,  color: 'text-[#1D9D63]', bg: 'bg-[#E4F2E9]' }
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

const MONTHS_HU = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.']

export function notifDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const month = MONTHS_HU[d.getMonth()]
  const day = d.getDate()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const yearPrefix = d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}. ` : ''
  return `${yearPrefix}${month} ${day}. · ${hh}:${mm}`
}

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
    window.addEventListener('booking-changed', load)
    return () => {
      clearInterval(t)
      window.removeEventListener('booking-changed', load)
    }
  }, [load])

  const remove = useCallback(async (id: number | string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    setUnread((u) => Math.max(0, u - 1))
    await fetch(`/api/notifications?id=${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
  }, [])

  const markRead = useCallback(async (id: number | string) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
    setUnread((u) => Math.max(0, u - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
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

  const openItem = useCallback((n: Notification) => {
    onNavigate?.()
    remove(n.id)
    const t = Date.now()
    if (n.reservation != null) {
      router.push(`/restaurant/bookings?reservation=${encodeURIComponent(String(n.reservation))}&t=${t}`)
    } else if (n.booking != null) {
      router.push(`/dashboard/bookings?booking=${encodeURIComponent(String(n.booking))}&t=${t}`)
    } else if (n.type === 'digest_morning' || n.type === 'digest_evening') {
      const isRest = n.restaurant != null
      const base = isRest ? '/restaurant/bookings' : '/dashboard/bookings'
      const date = (n.metadata as { date?: string } | null)?.date
      router.push(date ? `${base}?date=${date}&t=${t}` : `${base}?t=${t}`)
    } else if (n.type === 'schedule_change') {
      const isRest = n.restaurant != null
      const base = isRest ? '/restaurant/schedule' : '/dashboard/schedule'
      const date = (n.metadata as { date?: string } | null)?.date
      router.push(date ? `${base}?date=${date}&t=${t}` : `${base}?t=${t}`)
    } else if (n.type === 'new_signup') {
      router.push(`/backstage/salons?t=${t}`)
    } else if (n.type === 'new_subscriber') {
      router.push(`/backstage/subscriptions?t=${t}`)
    }
  }, [onNavigate, remove, router])

  const groups = [
    { label: 'Új', rows: items.filter((n) => !n.read) },
    { label: 'Korábbi', rows: items.filter((n) => n.read) },
  ].filter((g) => g.rows.length > 0)

  return { items, unread, groups, remove, markRead, clearAll, openItem, reload: load }
}
