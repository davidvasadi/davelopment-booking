'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Loader2, Plus, MoreHorizontal, Monitor, Sun, Moon, LogOut, CreditCard, Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from './UserAvatar'
import { useNotifications, timeAgo, notificationVisual, type Notification } from '@/lib/useNotifications'

/**
 * A desktop sidebar aljára szánt fiók-blokk: avatar + név + „⋯". Az avatarra VAGY a
 * „⋯"-ra kattintva a felfelé nyíló fiók-popover jelenik meg, amely egyben tartalmazza
 * az ÉRTESÍTÉSEKET, a profilkép-szerkesztést, a téma-váltót, a gyorslinkeket és a
 * kijelentkezést. A „⋯" gombon piros pötty jelzi az olvasatlan értesítést.
 * Összecsukott (collapsed) navban csak az avatar + „⋯" látszik.
 */
export function UserMenu({
  name,
  email,
  avatarUrl,
  collapsed = false,
  subscriptionHref,
  settingsHref,
}: {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  collapsed?: boolean
  /** Linkek a fiók-popover gyorsmenüjéhez (előfizetés + beállítások/számlázás). */
  subscriptionHref?: string
  settingsHref?: string
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // A popovert a body-ra portáljuk (a sidebar overflow-ja különben levágja),
  // a fiók-sor pozíciójához igazítva — felfelé, balra-igazítva.
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)

  const { items, unread, groups, remove, clearAll, openItem } = useNotifications(() => setOpen(false))

  useEffect(() => setMounted(true), [])

  function toggleMenu() {
    setOpen((o) => {
      const next = !o
      if (next && anchorRef.current) {
        const r = anchorRef.current.getBoundingClientRect()
        const PANEL_W = 256
        const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8)
        setPos({ left, bottom: window.innerHeight - r.top + 8 })
      }
      return next
    })
  }

  // A kiválasztott képet a Payload Media-ba töltjük (mint a logó/borítókép a Beállításokban),
  // majd a kapott URL-t mentjük a felhasználó avatar_url mezőjébe.
  async function uploadAvatar(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.set('_payload', JSON.stringify({ alt: file.name }))
      const mediaRes = await fetch('/api/media', { method: 'POST', credentials: 'include', body: fd })
      if (!mediaRes.ok) throw new Error('media')
      const media = await mediaRes.json()
      const imageUrl: string | undefined = media?.doc?.url
      if (!imageUrl) throw new Error('url')

      const res = await fetch('/api/user/avatar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ avatar_url: imageUrl }),
      })
      if (!res.ok) throw new Error('save')
      toast.success('Profilkép frissítve')
      router.refresh()
    } catch {
      toast.error('Nem sikerült feltölteni a profilképet.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/signout-payload', { method: 'POST', credentials: 'include' })
    router.push('/login')
    toast.success('Kijelentkezve')
  }

  const themeOptions = [
    { value: 'system', icon: Monitor, label: 'Rendszer' },
    { value: 'light', icon: Sun, label: 'Világos' },
    { value: 'dark', icon: Moon, label: 'Sötét' },
  ] as const

  return (
    <div ref={anchorRef} className={cn('flex items-center gap-1.5', collapsed && 'flex-col')}>
      {/* Avatar + név — kattintásra nyílik a fiók-popover. */}
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="Fiók"
        aria-expanded={open}
        className={cn(
          'flex min-w-0 items-center gap-2.5 rounded-xl transition-colors',
          collapsed ? 'justify-center p-1' : 'flex-1 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.06]',
        )}
      >
        <UserAvatar name={name} src={avatarUrl} size={collapsed ? 32 : 34} />
        {!collapsed && (
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-white">{name ?? 'Fiók'}</span>
            {email && <span className="block truncate text-[11px] leading-tight text-zinc-400 dark:text-white/30">{email}</span>}
          </span>
        )}
      </button>

      {/* „⋯" gomb — a fiók-popovert nyitja; piros pötty jelzi az olvasatlan értesítést. */}
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="Fiók és értesítések"
        aria-expanded={open}
        className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
      >
        <MoreHorizontal className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black" />
        )}
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
          <div
            className="fixed w-72 max-w-[calc(100vw-1rem)] rounded-xl border border-zinc-100 bg-white shadow-lg dark:bg-zinc-950 dark:border-white/[0.08] z-[100] overflow-hidden"
            style={{ left: pos.left, bottom: pos.bottom }}
          >
          {/* Rejtett fájlválasztó — a profil-sorra/„+"-ra kattintva nyílik. */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadAvatar(f)
            }}
          />
          {/* Profil-sor — kattintásra képet tölthetsz fel a gépről. */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
          >
            <span className="relative shrink-0">
              <UserAvatar name={name} src={avatarUrl} size={40} />
              {/* „+" / spinner jelzi, hogy a kép cserélhető (feltöltés alatt pörög). */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black ring-2 ring-white dark:ring-zinc-950">
                {uploading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-white">{name ?? 'Fiók'}</span>
              <span className="block truncate text-[11px] leading-tight text-zinc-400 dark:text-white/30">{uploading ? 'Feltöltés…' : (email ?? '')}</span>
            </span>
          </button>

          <div className="border-t border-zinc-100 dark:border-white/[0.06]" />

          {/* Értesítések — egybeépítve a fiók-popoverbe. */}
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/30">Értesítések{items.length > 0 && ` (${items.length})`}</p>
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
          <div className="max-h-64 overflow-y-auto overscroll-contain px-2 pb-1" data-lenis-prevent>
            {items.length === 0 ? (
              <p className="px-3 pb-3 text-center text-xs text-zinc-400 dark:text-white/30">Nincs új értesítés</p>
            ) : (
              groups.map(({ label, rows }) => (
                <div key={label}>
                  <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 dark:text-white/20">{label}</p>
                  {rows.map((n) => (
                    <NotificationRow key={n.id} n={n} onOpen={() => openItem(n)} onRemove={() => remove(n.id)} />
                  ))}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-zinc-100 dark:border-white/[0.06]" />

          {/* Gyorslinkek: előfizetés + beállítások (számlázási/cégadatok). */}
          {(subscriptionHref || settingsHref) && (
            <div className="py-1">
              {subscriptionHref && (
                <Link
                  href={subscriptionHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  Előfizetés
                </Link>
              )}
              {settingsHref && (
                <Link
                  href={settingsHref}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  Beállítások
                </Link>
              )}
            </div>
          )}

          <div className="border-t border-zinc-100 dark:border-white/[0.06]" />

          {/* Téma-váltó: a háttér-pill layoutId-vel átsiklik az aktív téma alá. */}
          <div className="px-3 py-2.5">
            <div className="flex gap-0.5">
              {themeOptions.map(({ value, icon: Icon, label }) => {
                const isActive = mounted && theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    title={label}
                    className={cn(
                      'relative flex-1 flex items-center justify-center h-8 rounded-md transition-colors',
                      isActive
                        ? 'text-zinc-900 dark:text-white'
                        : 'text-zinc-400 hover:text-zinc-600 dark:text-white/25 dark:hover:text-white/50',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="theme-pill"
                        className="absolute inset-0 -z-0 rounded-md bg-zinc-100 dark:bg-white/[0.1]"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </div>

          <div className="border-t border-zinc-100 dark:border-white/[0.06]" />

          {/* Kijelentkezés. */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Kijelentkezés
          </button>
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

/** Egyetlen értesítés sor a fiók-popoverben: ikon + cím/idő + törlés (hoverre). */
function NotificationRow({ n, onOpen, onRemove }: { n: Notification; onOpen: () => void; onRemove: () => void }) {
  const { Icon, color } = notificationVisual(n.type)
  return (
    <div className={cn('group relative flex gap-2.5 rounded-xl px-3 py-2.5', !n.read && 'bg-zinc-50 dark:bg-white/[0.03]')}>
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', color)} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-white pr-6">{n.title}</p>
        {n.body && <p className="truncate text-xs text-zinc-500 dark:text-white/40">{n.body}</p>}
        <p className="text-[11px] text-zinc-400 dark:text-white/25 mt-0.5">{timeAgo(n.createdAt)}</p>
      </button>
      <button
        type="button"
        aria-label="Értesítés törlése"
        onClick={onRemove}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100 dark:text-white/20 dark:hover:bg-white/[0.08] dark:hover:text-white/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
