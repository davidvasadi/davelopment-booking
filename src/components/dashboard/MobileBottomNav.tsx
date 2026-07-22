'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LogOut, MoreHorizontal, Lock, Plus, Loader2, CreditCard } from 'lucide-react'
import { getNavConfig, navItemsForCapabilities, type DashboardVariant } from './navConfig'
import type { Capability } from '@/lib/permissions'
import { UserAvatar } from './UserAvatar'
import { compressImage } from '@/lib/compressImage'

type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

export default function MobileBottomNav({
  subscription,
  variant = 'salon',
  capabilities = [],
  userName = null,
  userEmail = null,
  userAvatarUrl = null,
}: {
  subscription?: SubInfo
  variant?: DashboardVariant
  capabilities?: Capability[]
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
}) {
  const { settingsHref, subscriptionHref } = getNavConfig(variant)
  const navItems = navItemsForCapabilities(variant, capabilities)
  const pathname = usePathname()
  const router = useRouter()
const [moreOpen, setMoreOpen] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastScrollY = useRef(0)
  const [navVisible, setNavVisible] = useState(true)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      if (y < 10) setNavVisible(true)
      else if (y < lastScrollY.current - 4) setNavVisible(true)
      else if (y > lastScrollY.current + 4) setNavVisible(false)
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // A kiválasztott képet a Payload Media-ba töltjük (mint a desktopon / Beállításokban),
  // majd a kapott URL-t mentjük a felhasználó avatar_url mezőjébe.
  async function uploadAvatar(file: File) {
    setUploadingAvatar(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
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

  // A sávban 4 fő nav-elem + a „Több" gomb fér ki; a többi a „Több" menübe kerül.
  const primaryNav = navItems.slice(0, 4)
  const secondaryNav = navItems.slice(4)

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
      <div className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40">
      <motion.nav
        animate={{ y: navVisible ? 0 : 120 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="bg-[var(--dav-glass-strong)] backdrop-blur-xl rounded-2xl border border-white/50 shadow-[0_8px_24px_rgba(0,0,0,.10)] flex items-center px-4 py-3 gap-1.5"
      >
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
                  ? 'bg-[#1d1c19] shadow-md shadow-black/20'
                  : 'hover:bg-black/[0.06]'
              )}>
                <Icon className={cn(
                  'transition-all duration-300 ease-out',
                  active
                    ? 'h-6 w-6 text-white'
                    : dim
                      ? 'h-[22px] w-[22px] text-[#c8c4b8]'
                      : 'h-[22px] w-[22px] text-[#3a352a]'
                )} />
              </div>
              {dim && (
                <Lock className="absolute -top-0.5 -right-0.5 h-3 w-3 text-zinc-400 dark:text-white/30 bg-white dark:bg-zinc-900 rounded-full p-0.5 box-content" />
              )}
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Több"
          className="relative flex items-center justify-center"
        >
          <div className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 ease-out',
            hasSecondaryActive
              ? 'bg-[#1d1c19] shadow-md shadow-black/20'
              : 'hover:bg-black/[0.06]'
          )}>
            <MoreHorizontal className={cn(
              'transition-all duration-300 ease-out',
              hasSecondaryActive
                ? 'h-[22px] w-[22px] text-white'
                : 'h-5 w-5 text-[#3a352a]'
            )} />
          </div>
        </button>
      </motion.nav>
      </div>

      <AnimatePresence>
      {moreOpen && (
        <>
          <motion.div
            key="mob-backdrop"
            className="lg:hidden fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.div
            key="mob-panel"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-[26px] border-t border-x border-white/50 bg-white/75 backdrop-blur-2xl"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9 } }}
            exit={{ opacity: 0, y: 40, scale: 0.97, transition: { duration: 0.14, ease: 'easeIn' } }}
            style={{ transformOrigin: 'bottom center' }}
          >
            <button
              type="button"
              aria-label="Bezárás"
              onClick={() => setMoreOpen(false)}
              className="shrink-0 w-full py-3"
            >
              <span className="block w-10 h-1 bg-[#e0ddd6] rounded-full mx-auto" />
            </button>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" data-lenis-prevent>

            <div className="px-4 pt-2 pb-3">
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
                className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-[#f4f1eb] disabled:opacity-60"
              >
                <span className="relative shrink-0">
                  <UserAvatar name={userName} src={userAvatarUrl} size={44} />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#1d1c19] text-white ring-2 ring-white/80">
                    {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" strokeWidth={3} />}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-[#1d1c19]">{userName ?? 'Fiók'}</span>
                  <span className="block truncate text-[13px] text-[#a8a496]">{uploadingAvatar ? 'Feltöltés…' : (userEmail ?? '')}</span>
                </span>
              </button>
            </div>

            <div className="mx-4 h-px bg-[#efefef]" />

            <div className="px-3 py-2">
              {secondaryNav.map(({ href, label, icon: Icon, exact }) => {
                const dim = isLocked && !isAllowedWhenLocked(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-3.5 rounded-[14px] text-[15px] font-medium transition-colors',
                      isActive(href, exact)
                        ? 'bg-[#1d1c19] text-white'
                        : dim
                          ? 'text-[#c8c4b8]'
                          : 'text-[#3a352a] hover:bg-[#f4f1eb]'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{label}</span>
                    {dim && <Lock className="h-3.5 w-3.5 shrink-0" />}
                  </Link>
                )
              })}
            </div>

            {variant !== 'backstage' && (
              <div className="px-3 pb-1">
                <Link
                  href={subscriptionHref}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-[14px] text-sm font-medium transition-colors',
                    pathname.startsWith(subscriptionHref)
                      ? 'bg-[#1d1c19] text-white'
                      : 'text-[#3a352a] hover:bg-[#f4f1eb]'
                  )}
                >
                  <CreditCard className="h-[18px] w-[18px]" />
                  <span className="flex-1">Előfizetés</span>
                </Link>
              </div>
            )}

            <div className="mx-4 h-px bg-[#efefef]" />
            <div className="px-3 py-2 pb-8">
              <button
                onClick={() => { setMoreOpen(false); handleLogout() }}
                className="flex items-center gap-3 px-3 py-3.5 rounded-[14px] w-full text-[15px] font-medium text-[#3a352a] hover:bg-[#f4f1eb] transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Kijelentkezés
              </button>
            </div>
            </div>
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </>
  )
}
