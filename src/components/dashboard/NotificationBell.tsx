'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CalendarPlus, CalendarX, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Notification = {
  id: number | string
  type: 'new_booking' | 'cancellation'
  title: string
  body?: string | null
  read?: boolean | null
  createdAt: string
  reservation?: number | string | null
  booking?: number | string | null
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'most'
  if (m < 60) return `${m} perce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} órája`
  const d = Math.floor(h / 24)
  return `${d} napja`
}

export function NotificationBell({ align = 'right' }: { align?: 'left' | 'right' } = {}) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  // Kattintás kívülre → bezár
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // A megnyitás NEM jelöl semmit olvasottnak — egy értesítés csak akkor lesz
  // olvasott, ha rákattintasz (openItem) vagy törlöd (remove). Így a badge addig
  // marad, amíg ténylegesen foglalkozol a tételekkel.
  const toggle = () => setOpen((o) => !o)

  const remove = async (id: number | string) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    setUnread((u) => Math.max(0, u - 1))
    await fetch(`/api/notifications?id=${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      credentials: 'include',
    }).catch(() => null)
  }

  const clearAll = async () => {
    const ids = items.map((n) => n.id)
    setItems([])
    setUnread(0)
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/notifications?id=${encodeURIComponent(String(id))}`, {
          method: 'DELETE',
          credentials: 'include',
        }).catch(() => null),
      ),
    )
  }

  // Értesítésre kattintva a kapcsolódó foglaláshoz navigálunk, és az értesítést
  // eltüntetjük a listából (elintézettnek tekintjük). A reservation/booking query
  // nyitja meg a kártyát; a `t` időbélyeg garantálja, hogy ugyanarra az értesítésre
  // ismét kattintva is új URL keletkezzen, így a sheet biztosan újranyílik.
  const openItem = (n: Notification) => {
    setOpen(false)
    const clickable = n.reservation != null || n.booking != null
    if (!clickable) return
    remove(n.id)
    const t = Date.now()
    if (n.reservation != null) {
      router.push(`/restaurant/bookings?reservation=${encodeURIComponent(String(n.reservation))}&t=${t}`)
    } else if (n.booking != null) {
      router.push(`/dashboard/bookings?booking=${encodeURIComponent(String(n.booking))}&t=${t}`)
    }
  }

  // Sor-renderelő — egyetlen értesítés. Kattintásra navigál + eltünteti (openItem).
  const renderRow = (n: Notification) => {
    const Icon = n.type === 'cancellation' ? CalendarX : CalendarPlus
    const clickable = n.reservation != null || n.booking != null
    return (
      <div
        key={n.id}
        className={cn(
          'group relative flex gap-3 px-4 py-3 border-b border-zinc-50 dark:border-white/[0.04] last:border-0',
          !n.read && 'bg-zinc-50/60 dark:bg-white/[0.03]'
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 mt-0.5 shrink-0',
            n.type === 'cancellation' ? 'text-red-500' : 'text-green-600 dark:text-green-400'
          )}
        />
        <button
          type="button"
          disabled={!clickable}
          onClick={() => openItem(n)}
          className={cn('min-w-0 flex-1 text-left', clickable && 'cursor-pointer')}
        >
          <p className="text-sm font-medium text-zinc-900 dark:text-white pr-5">{n.title}</p>
          {n.body && <p className="text-xs text-zinc-500 dark:text-white/40 truncate">{n.body}</p>}
          <p className="text-[11px] text-zinc-400 dark:text-white/25 mt-0.5">{timeAgo(n.createdAt)}</p>
        </button>
        <button
          type="button"
          aria-label="Értesítés törlése"
          onClick={() => remove(n.id)}
          className="absolute right-2 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:text-white/20 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // Csoportosítás: olvasatlanok elöl ("Új"), majd a már olvasottak ("Korábbi").
  // A megnyitás már nem jelöl olvasottnak, így a csoportok a tényleges read
  // állapotot tükrözik. Üres csoportot nem jelenítünk meg.
  const groups = [
    { label: 'Új', rows: items.filter((n) => !n.read) },
    { label: 'Korábbi', rows: items.filter((n) => n.read) },
  ].filter((g) => g.rows.length > 0)

  return (
    <div ref={ref} className={cn('relative', open && 'z-[100]')}>
      <button
        onClick={toggle}
        aria-label="Értesítések"
        className="relative flex items-center justify-center h-9 w-9 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-100 bg-white shadow-lg dark:bg-zinc-950 dark:border-white/[0.08] z-[100] overflow-hidden',
            align === 'left' ? 'left-0' : 'right-0'
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/[0.06]">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Értesítések</p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:text-white/30 dark:hover:text-white/70 transition-colors"
              >
                Összes törlése
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-white/30">
                Nincs értesítés
              </p>
            ) : (
              groups.map(({ label, rows }) => (
                <div key={label}>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/25">
                    {label}
                  </p>
                  {rows.map(renderRow)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
