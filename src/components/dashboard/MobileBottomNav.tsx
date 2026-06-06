'use client'

import Link from 'next/link'
import { useState, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { LogOut, Monitor, Sun, Moon, MoreHorizontal, Lock, Plus, Loader2 } from 'lucide-react'
import { getNavConfig, type DashboardVariant } from './navConfig'
import { NotificationBell } from './NotificationBell'
import { UserAvatar } from './UserAvatar'

type SubInfo = {
  plan: 'trial' | 'pro' | 'restaurant_pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

export default function MobileBottomNav({
  subscription,
  variant = 'salon',
  userName = null,
  userEmail = null,
  userAvatarUrl = null,
}: {
  subscription?: SubInfo
  variant?: DashboardVariant
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
}) {
  const { items: navItems, settingsHref } = getNavConfig(variant)
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // A kiválasztott képet a Payload Media-ba töltjük (mint a desktopon / Beállításokban),
  // majd a kapott URL-t mentjük a felhasználó avatar_url mezőjébe.
  async function uploadAvatar(file: File) {
    setUploadingAvatar(true)
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
      setUploadingAvatar(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // A harang elfoglal egy helyet a sávban, ezért csak 3 fő nav-elem fér ki;
  // a 4. (és a többi) a „Több" menübe kerül.
  const primaryNav = navItems.slice(0, 3)
  const secondaryNav = navItems.slice(3)

  const handleLogout = async () => {
    await fetch('/api/auth/signout-payload', { method: 'POST', credentials: 'include' })
    router.push('/login')
    toast.success('Kijelentkezve')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const hasSecondaryActive = secondaryNav.some(({ href, exact }) => isActive(href, exact))

  const isLocked = subscription?.status === 'past_due' || subscription?.status === 'canceled' || subscription?.status === 'paused'
  const isAllowedWhenLocked = (href: string) => href === settingsHref

  return (
    <>
      <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-black/[0.12] dark:shadow-black/50 border border-zinc-100 dark:border-white/[0.08] flex items-center px-4 py-3 gap-1.5">
        {primaryNav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          const dim = isLocked && !isAllowedWhenLocked(href)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              data-tour={href}
              className="relative flex items-center justify-center"
            >
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 ease-out',
                active
                  ? 'bg-zinc-900 dark:bg-white shadow-md shadow-black/20'
                  : 'hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
              )}>
                <Icon className={cn(
                  'transition-all duration-300 ease-out',
                  active
                    ? 'h-6 w-6 text-white dark:text-black'
                    : dim
                      ? 'h-[22px] w-[22px] text-zinc-300 dark:text-white/15'
                      : 'h-[22px] w-[22px] text-zinc-400 dark:text-white/30'
                )} />
              </div>
              {dim && (
                <Lock className="absolute -top-0.5 -right-0.5 h-3 w-3 text-zinc-400 dark:text-white/30 bg-white dark:bg-zinc-900 rounded-full p-0.5 box-content" />
              )}
            </Link>
          )
        })}
        <NotificationBell variant="sheet" />
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Több"
          className="relative flex items-center justify-center"
        >
          <div className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 ease-out',
            hasSecondaryActive
              ? 'bg-zinc-900 dark:bg-white shadow-md shadow-black/20'
              : 'hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
          )}>
            <MoreHorizontal className={cn(
              'transition-all duration-300 ease-out',
              hasSecondaryActive
                ? 'h-[22px] w-[22px] text-white dark:text-black'
                : 'h-5 w-5 text-zinc-400 dark:text-white/30'
            )} />
          </div>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40 dark:bg-black/60"
            onClick={() => setMoreOpen(false)}
          />
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-950 rounded-t-2xl border border-zinc-100 dark:border-white/[0.08] border-b-0">
            <div className="w-10 h-1 bg-zinc-200 dark:bg-white/[0.1] rounded-full mx-auto mt-3 mb-2" />

            {/* Fiók-blokk: az avatar+név sorra koppintva képet tölthetsz fel a gépről
                (Payload Media — mint a desktopon). „+"/spinner jelzi a lehetőséget. */}
            <div className="px-5 pt-2 pb-3">
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadingAvatar}
                className="flex w-full items-center gap-3 rounded-xl text-left disabled:opacity-60"
              >
                <span className="relative shrink-0">
                  <UserAvatar name={userName} src={userAvatarUrl} size={44} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-white dark:text-black ring-2 ring-white dark:ring-zinc-950">
                    {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-zinc-900 dark:text-white">{userName ?? 'Fiók'}</span>
                  <span className="block truncate text-xs text-zinc-400 dark:text-white/30">{uploadingAvatar ? 'Feltöltés…' : (userEmail ?? '')}</span>
                </span>
              </button>
            </div>

            <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

            <div className="px-3 py-2">
              {secondaryNav.map(({ href, label, icon: Icon, exact }) => {
                const dim = isLocked && !isAllowedWhenLocked(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                      isActive(href, exact)
                        ? 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-white'
                        : dim
                          ? 'text-zinc-300 dark:text-white/15'
                          : 'text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{label}</span>
                    {dim && <Lock className="h-3.5 w-3.5 shrink-0" />}
                  </Link>
                )
              })}
            </div>
            <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />
            <div className="px-6 py-3">
              <div className="flex gap-0.5 px-0.5">
                {([
                  { value: 'system', icon: Monitor },
                  { value: 'light', icon: Sun },
                  { value: 'dark', icon: Moon },
                ] as const).map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex-1 flex items-center justify-center h-7 rounded-md transition-colors',
                      theme === value
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-white/[0.1] dark:text-white'
                        : 'text-zinc-400 hover:text-zinc-600 dark:text-white/25 dark:hover:text-white/50'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />
            <div className="px-3 py-2 pb-8">
              <button
                onClick={() => { setMoreOpen(false); handleLogout() }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl w-full text-sm font-medium text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Kijelentkezés
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
