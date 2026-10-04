'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, CalendarX, CalendarClock, UserPlus, Sparkles, Sunrise, Sunset, CalendarRange, MailWarning, Mail, Megaphone, type LucideIcon } from 'lucide-react'

export type Notification = {
  id: number | string
  type: 'new_booking' | 'cancellation' | 'modification' | 'new_signup' | 'new_subscriber' | 'digest_morning' | 'digest_evening' | 'schedule_change' | 'email_not_opened' | 'contact_message' | 'admin_broadcast'
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
  occasions?: Record<string, { count: number; icon?: string | null }>
  shift_manager?: { name: string; avatar_url?: string | null }
  staff_breakdown?: { name: string; bookings: number }[]
  /** Esti összefoglalónál: foglalás-forrás breakdown */
  source?: { walk_in?: number; phone?: number; online?: number }
  /** Esti összefoglalónál: státusz breakdown */
  status?: { completed?: number; cancelled?: number; no_show?: number }
  /** Ma beszedett előleg (Ft) — a `deposit_paid` foglalások összege. */
  revenue_huf?: number
  /** Top 3 legtöbbet foglalt szolgáltatás ma (szalon-only). */
  top_services?: { name: string; bookings: number }[]
  /** Ma egyedi vendégei közül hány új (nincs korábbi, nem-lemondott foglalása) / hány visszatérő. */
  new_guests?: number
  returning_guests?: number
  /** Ország-bontás (ISO kód → darabszám) — étterem-only, a `country` mezőből. */
  countries?: Record<string, number>
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
    case 'email_not_opened': return { Icon: MailWarning,   color: 'text-[#C2410C]', bg: 'bg-[#FFEDD5]' }
    case 'contact_message':  return { Icon: Mail,          color: 'text-ink',       bg: 'bg-[#EDEBE3]' }
    case 'admin_broadcast':  return { Icon: Megaphone,     color: 'text-[#8A6D12]', bg: 'bg-[#FBF1C9]' }
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

  // Az „ÉPP MOST érkezett digest" felugró popuphoz: a legutóbbi pollingból ismert id-k
  // (null = még nem volt betöltés) — csak az ELSŐ betöltés UTÁN érkező, tehát ÚJ digest
  // triggerel automatikus popupot, a bejelentkezéskor már meglévő, régi digest nem.
  const seenIdsRef = useRef<Set<Notification['id']> | null>(null)
  const newestSeenRef = useRef<string | null>(null)
  const [newDigest, setNewDigest] = useState<Notification | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const next: Notification[] = data.notifications ?? []
      if (seenIdsRef.current) {
        // Csak a legfrissebb ismertnél ÚJABB digest számít érkezettnek — törlés után a lista
        // alján felbukkanó régi (eddig a 20-as limiten kívüli) digest ne nyisson popupot.
        const newestSeen = newestSeenRef.current
        const arrived = next.find(
          (n) => (n.type === 'digest_morning' || n.type === 'digest_evening') && !seenIdsRef.current!.has(n.id)
            && (!newestSeen || n.createdAt > newestSeen),
        )
        if (arrived) setNewDigest(arrived)
      }
      seenIdsRef.current = new Set([...(seenIdsRef.current ?? []), ...next.map((n) => n.id)])
      for (const n of next) if (!newestSeenRef.current || n.createdAt > newestSeenRef.current) newestSeenRef.current = n.createdAt
      setItems(next)
      setUnread(data.unread ?? 0)
    } catch {
      /* csendben — best-effort */
    }
  }, [])

  const clearNewDigest = useCallback(() => setNewDigest(null), [])

  useEffect(() => {
    load()
    // A 60mp-es polling csak biztonsági háló — az SSE (LiveRefreshProvider →
    // 'notification-changed') azonnal frissít, amint tényleg érkezik valami.
    const t = setInterval(load, 60_000)
    window.addEventListener('booking-changed', load)
    window.addEventListener('notification-changed', load)
    return () => {
      clearInterval(t)
      window.removeEventListener('booking-changed', load)
      window.removeEventListener('notification-changed', load)
    }
  }, [load])

  // A szerver egyszerre csak a legutóbbi 20-at adja: törlés után újratöltünk, hogy a régebbiek
  // a helyükre csússzanak (különben pár törlés után üres lett a lista, holott volt még értesítés).
  // Az olvasatlan-számlálót is az újratöltés állítja be (a szerver-oldali pontos értékre) — a
  // korábbi helyi „-1" olvasott elem törlésekor is csökkentette.
  const remove = useCallback(async (id: number | string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/notifications?id=${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
    await load()
  }, [load])

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

  // Az összes törlése szerver-oldalon (`?all=1`) — nem csak a betöltött 20-at.
  const clearAll = useCallback(async () => {
    setItems([])
    setUnread(0)
    await fetch('/api/notifications?all=1', {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
    await load()
  }, [load])

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
      router.push(`/backstage/accounts?t=${t}`)
    } else if (n.type === 'contact_message') {
      router.push(`/backstage/contact?t=${t}`)
    }
  }, [onNavigate, remove, router])

  const groups = [
    { label: 'Új', rows: items.filter((n) => !n.read) },
    { label: 'Korábbi', rows: items.filter((n) => n.read) },
  ].filter((g) => g.rows.length > 0)

  return { items, unread, groups, remove, markRead, clearAll, openItem, reload: load, newDigest, clearNewDigest }
}
