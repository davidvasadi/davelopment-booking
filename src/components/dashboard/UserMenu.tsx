'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { MoreHorizontal, Bell, Monitor, Sun, Moon, LogOut, CreditCard, Settings, X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from './UserAvatar'
import { useNotifications, timeAgo, notificationVisual, type Notification } from '@/lib/useNotifications'

/** A panel gyerek-elemeinek „folyami" belépője (a genie-spring stagger alá). */
const PANEL_ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
} as const

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
  publicUrl,
  csvHref,
}: {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
  collapsed?: boolean
  /** Linkek a fiók-popover gyorsmenüjéhez (előfizetés + beállítások/számlázás). */
  subscriptionHref?: string
  settingsHref?: string
  /** Nyilvános oldal URL — a fiók-menübe (davelopment-design: a top-navból ide került). */
  publicUrl?: string
  /** CSV export URL — a fiók-menübe. */
  csvHref?: string
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  // A popovert a body-ra portáljuk (a sidebar overflow-ja különben levágja).
  // collapsed (felső nav) → LEFELÉ, jobbra-igazítva; egyébként (alsó sidebar) → felfelé, balra.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  // A csengő ÉRTESÍTÉSEKET, az avatar FIÓK-menüt nyit — külön tartalom, nem ugyanaz.
  const [mode, setMode] = useState<'account' | 'notifications'>('account')

  const { items, unread, groups, remove, clearAll, openItem } = useNotifications(() => setOpen(false))

  useEffect(() => setMounted(true), [])

  function positionPanel() {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const PANEL_W = 288 // w-72
    if (collapsed) {
      const left = Math.min(Math.max(8, r.right - PANEL_W), window.innerWidth - PANEL_W - 8)
      setPos({ left, top: r.bottom + 8 })
    } else {
      const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8)
      setPos({ left, bottom: window.innerHeight - r.top + 8 })
    }
  }

  // Ugyanarra a gombra kattintva zár; másik gombra vált (a panel nyitva marad, csak a tartalom vált).
  function openMenu(m: 'account' | 'notifications') {
    if (open && mode === m) { setOpen(false); return }
    setMode(m)
    if (!open) { positionPanel(); setOpen(true) }
  }

  // Az avatar-feltöltés + profil-szerkesztés a közös <ProfileEditor>-ben él (a popover
  // account-módjában renderelve), így nincs itt duplikált feltöltő-logika.

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
    <div ref={anchorRef} className={cn('flex items-center', collapsed ? 'gap-2.5' : 'gap-1.5')}>
      {collapsed ? (
        <>
          {/* Csengő — kör gomb, gold pötty az olvasatlan értesítéshez (Crextio: bell + user). */}
          <button
            type="button"
            onClick={() => openMenu('notifications')}
            aria-label="Értesítések"
            aria-expanded={open}
            className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--dav-glass-strong)] text-ink shadow-[0_2px_8px_rgba(0,0,0,.05)] outline-none backdrop-blur-lg transition-colors hover:bg-white/70"
          >
            <Bell className="h-[19px] w-[19px]" strokeWidth={2} />
            {unread > 0 && (
              <span className="absolute right-[13px] top-[13px] h-[8px] w-[8px] rounded-full bg-gold ring-2 ring-white" />
            )}
          </button>

          {/* Avatar — kör, kattintásra nyílik a fiók-popover. */}
          <button
            type="button"
            onClick={() => openMenu('account')}
            aria-label="Fiók"
            aria-expanded={open}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[0_2px_8px_rgba(0,0,0,.05)] outline-none transition-transform hover:scale-[1.03]"
          >
            <UserAvatar name={name} src={avatarUrl} size={52} />
          </button>
        </>
      ) : (
        <>
          {/* Avatar + név — kattintásra nyílik a fiók-popover. */}
          <button
            type="button"
            onClick={() => openMenu('account')}
            aria-label="Fiók"
            aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
          >
            <UserAvatar name={name} src={avatarUrl} size={34} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-white">{name ?? 'Fiók'}</span>
              {email && <span className="block truncate text-[11px] leading-tight text-zinc-400 dark:text-white/30">{email}</span>}
            </span>
          </button>

          {/* „⋯" gomb — a fiók-popovert nyitja; piros pötty jelzi az olvasatlan értesítést. */}
          <button
            type="button"
            onClick={() => openMenu('notifications')}
            aria-label="Fiók és értesítések"
            aria-expanded={open}
            className="relative shrink-0 flex items-center justify-center h-9 w-9 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
          >
            <MoreHorizontal className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black" />
            )}
          </button>
        </>
      )}

      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <>
              {/* Backdrop — iOS context-menu érzés: enyhe dim + blur a háttéren. */}
              <motion.div
                key="um-backdrop"
                className="fixed inset-0 z-[99] bg-black/[0.06] backdrop-blur-[2px]"
                onClick={() => setOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
              {/* Panel — erős iOS-„genie" spring: nagy scale-ugrás + overshoot,
                  a triggerből kinőve; a gyerekek staggerrel folyanak be. */}
              <motion.div
                key="um-panel"
                variants={{
                  hidden: { opacity: 0, scale: 0.7, y: collapsed ? -14 : 14 },
                  show: {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.035, delayChildren: 0.06 },
                  },
                  exit: { opacity: 0, scale: 0.9, y: collapsed ? -8 : 8, transition: { duration: 0.14, ease: 'easeIn' } },
                }}
                initial="hidden"
                animate="show"
                exit="exit"
                className="fixed w-[300px] max-w-[calc(100vw-1rem)] rounded-[26px] border border-[#ececec] bg-white shadow-[0_18px_50px_-18px_rgba(0,0,0,.35)] z-[100] overflow-hidden"
                style={{ left: pos.left, ...(pos.top !== undefined ? { top: pos.top } : { bottom: pos.bottom }), transformOrigin: collapsed ? 'top right' : 'bottom left' }}
              >
          {/* ── FIÓK mód (avatar) — profil + gyorslinkek + téma + kijelentkezés ── */}
          {mode === 'account' && (
          <>
          {/* Profil-sor — NEM inline szerkesztő; kattintásra a Saját profil oldalra navigál
              (a Beállítások „self" fülére). Ott van minden szerkesztés (név, avatar, jelszó, adatok). */}
          {settingsHref && (
            <motion.div variants={PANEL_ITEM}>
              <Link
                href={`${settingsHref}?tab=self`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#f4f4f5]"
              >
                <UserAvatar name={name} src={avatarUrl} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold leading-tight text-[#2a2620]">{name ?? 'Fiók'}</span>
                  <span className="block truncate text-xs leading-tight text-[#9b9788] mt-0.5">{email ?? 'Saját profil megnyitása'}</span>
                </span>
                <ExternalLink className="h-[16px] w-[16px] shrink-0 text-[#b0ac9e]" />
              </Link>
            </motion.div>
          )}

          <div className="border-t border-[#efefef]" />

          {/* Gyorslinkek: nyilvános oldal + előfizetés + beállítások. (CSV export a Vendégek/
              Statisztikák oldalon van, nem a fiók-menüben.) */}
          {(subscriptionHref || settingsHref || publicUrl) && (
            <motion.div variants={PANEL_ITEM} className="py-1.5">
              {publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#3a352a] transition-colors hover:bg-[#f4f4f5]"
                >
                  <ExternalLink className="h-[17px] w-[17px] shrink-0 text-[#8a8779]" />
                  Nyilvános oldal
                </a>
              )}
              {subscriptionHref && (
                <Link
                  href={subscriptionHref}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#3a352a] transition-colors hover:bg-[#f4f4f5]"
                >
                  <CreditCard className="h-[17px] w-[17px] shrink-0 text-[#8a8779]" />
                  Előfizetés
                </Link>
              )}
              {settingsHref && (
                <Link
                  href={settingsHref}
                  onClick={() => setOpen(false)}
                  className="group flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-[#3a352a] transition-colors hover:bg-[#f4f4f5]"
                >
                  <Settings className="h-[17px] w-[17px] shrink-0 text-[#8a8779]" />
                  Beállítások
                </Link>
              )}
            </motion.div>
          )}

          <div className="border-t border-[#efefef]" />

          {/* Téma-váltó: a háttér-pill layoutId-vel átsiklik az aktív téma alá. */}
          <motion.div variants={PANEL_ITEM} className="px-3 py-3">
            <div className="flex gap-0.5 rounded-[30px] bg-[#f1f1f1] p-1">
              {themeOptions.map(({ value, icon: Icon, label }) => {
                const isActive = mounted && theme === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    title={label}
                    className={cn(
                      'relative flex h-8 flex-1 items-center justify-center rounded-[30px] transition-colors',
                      isActive ? 'text-white' : 'text-[#8a8779] hover:text-[#3a352a]',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="theme-pill"
                        className="absolute inset-0 -z-0 rounded-[30px] bg-[#1d1d1b]"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </motion.div>

          <div className="border-t border-[#efefef]" />

          {/* Kijelentkezés. */}
          <motion.button
            variants={PANEL_ITEM}
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-sm font-medium text-[#3a352a] transition-colors hover:bg-[#f4f4f5]"
          >
            <LogOut className="h-[17px] w-[17px] shrink-0 text-[#8a8779]" />
            Kijelentkezés
          </motion.button>
          </>
          )}

          {/* ── ÉRTESÍTÉSEK mód (csengő) — csak az értesítés-lista ── */}
          {mode === 'notifications' && (
          <>
          <motion.div variants={PANEL_ITEM} className="flex items-center justify-between px-4 py-3.5">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[#2a2620]">
              Értesítések
              {items.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f1ce45] px-1.5 text-[11px] font-bold text-[#23230f]">{items.length}</span>
              )}
            </p>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-medium text-[#8a8779] transition-colors hover:text-[#3a352a]"
              >
                Összes törlése
              </button>
            )}
          </motion.div>
          <div className="border-t border-[#efefef]" />
          <motion.div variants={PANEL_ITEM} className="max-h-72 overflow-y-auto overscroll-contain px-2 py-1" data-lenis-prevent>
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 px-3 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#8a8779] shadow-[0_1px_5px_rgba(0,0,0,.07)]">
                  <Bell className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <p className="text-sm text-[#9b9788]">Nincs új értesítés</p>
              </div>
            ) : (
              groups.map(({ label, rows }) => (
                <div key={label}>
                  <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#b0ac9e]">{label}</p>
                  {rows.map((n) => (
                    <NotificationRow key={n.id} n={n} onOpen={() => openItem(n)} onRemove={() => remove(n.id)} />
                  ))}
                </div>
              ))
            )}
          </motion.div>
          </>
          )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}

/** Egyetlen értesítés sor a fiók-popoverben: kör ikon-badge + cím/idő + törlés (hoverre). */
function NotificationRow({ n, onOpen, onRemove }: { n: Notification; onOpen: () => void; onRemove: () => void }) {
  const { Icon, color } = notificationVisual(n.type)
  return (
    <div className="group flex items-center gap-3 rounded-[16px] px-2.5 py-2.5 transition-colors hover:bg-[#f4f4f5]">
      {/* Semleges kör-ikon (Crextio lista-nyelv), típus szerinti akcentus-színnel. */}
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] shadow-[0_1px_4px_rgba(0,0,0,.05)]">
        <Icon className={cn('h-[17px] w-[17px]', color)} strokeWidth={2.2} />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate text-sm font-semibold text-[#2a2620]">{n.title}</p>
        {n.body && <p className="truncate text-xs text-[#9b9788]">{n.body}</p>}
        <p className="mt-0.5 text-[11px] text-[#b0ac9e]">{timeAgo(n.createdAt)}</p>
      </button>
      {/* Jobb-oldali sáv: olvasatlan gold pötty; hoverre törlés-X váltja. */}
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        {!n.read && (
          <span className="h-[7px] w-[7px] rounded-full bg-[#f1ce45] transition-opacity group-hover:opacity-0" />
        )}
        <button
          type="button"
          aria-label="Értesítés törlése"
          onClick={onRemove}
          className="absolute inset-0 flex items-center justify-center rounded-full text-[#b0ac9e] opacity-0 transition-opacity hover:bg-[#e8e8e8] hover:text-[#3a352a] group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  )
}
