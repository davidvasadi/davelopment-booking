'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { IconCircle } from '@/components/ui-kit'
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
  hiddenHrefs = [],
}: {
  subscription?: SubInfo
  variant?: DashboardVariant
  capabilities?: Capability[]
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
  /** Nav-hrefek, amiket egy kikapcsolt funkció miatt el kell rejteni (pl. utalványok). */
  hiddenHrefs?: string[]
}) {
  const { settingsHref, subscriptionHref } = getNavConfig(variant)
  const navItems = navItemsForCapabilities(variant, capabilities, hiddenHrefs)
  const canBilling = !capabilities || capabilities.includes('billing.manage')
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
      {/* a design mobil alsó menüje (/design 2.12): üveg pill a teljes szélességben, 4 fő elem + Több, az aktív sötét */}
      <div className="lg:hidden print:hidden fixed inset-x-4 bottom-4 z-40">
      <motion.nav
        animate={{ y: navVisible ? 0 : 120 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="flex items-center rounded-full bg-white/80 p-1.5 shadow-ui-float backdrop-blur-xl"
      >
        {primaryNav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          const dim = isLocked && !isAllowedWhenLocked(href)
          const inner = (
            <>
              <div className={cn('flex h-11 w-full items-center justify-center rounded-full transition-colors duration-300', active && 'bg-ui-dark')}>
                <Icon className={cn('h-5 w-5', active ? 'text-white' : dim ? 'text-ui-muted/40' : 'text-ui-muted')} strokeWidth={1.8} />
              </div>
              {dim && (
                <Lock className="absolute right-[30%] top-1 box-content h-3 w-3 rounded-full bg-white p-0.5 text-ui-muted" />
              )}
            </>
          )
          if (dim) {
            return (
              <span key={href} aria-disabled aria-label={label} className="relative flex flex-1 cursor-not-allowed items-center justify-center">
                {inner}
              </span>
            )
          }
          return (
            <Link key={href} href={href} aria-label={label} data-tour={href} className="relative flex flex-1 items-center justify-center">
              {inner}
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="Több"
          className="relative flex flex-1 items-center justify-center"
        >
          <div className={cn('flex h-11 w-full items-center justify-center rounded-full transition-colors duration-300', hasSecondaryActive && 'bg-ui-dark')}>
            <MoreHorizontal className={cn('h-5 w-5', hasSecondaryActive ? 'text-white' : 'text-ui-muted')} strokeWidth={1.8} />
          </div>
        </button>
      </motion.nav>
      </div>

      <AnimatePresence>
      {moreOpen && (
        <>
          <motion.div
            key="mob-backdrop"
            className="lg:hidden fixed inset-0 z-50 bg-ui-dark/25 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
          <motion.div
            key="mob-panel"
            // `90vh` mobil Safari-n a nagy (címsor nélküli) viewportot vette alapul, ezért a
            // sheet a ténylegesen látható terület alá, a böngésző-sáv mögé is belógott — `dvh`
            // a TÉNYLEGES, aktuális viewportot nézi, és a kisebb érték eleve nem akarja majdnem
            // az egész képernyőt elfoglalni (a tartalom úgyis görgethető, ld. lent).
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex max-h-[70dvh] flex-col rounded-t-ui-card bg-white shadow-ui-popup"
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
              <span className="mx-auto block h-1 w-10 rounded-full bg-ui-grey" />
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
                className="flex w-full items-center gap-3 rounded-ui-control px-3 py-2.5 text-left transition-colors hover:bg-ui-cell disabled:opacity-60"
              >
                <span className="relative shrink-0">
                  <UserAvatar name={userName} src={userAvatarUrl} size={44} />
                  <IconCircle tone="dark" size="xs" className="absolute -bottom-0.5 -right-0.5 ring-2 ring-white">
                    {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" strokeWidth={3} />}
                  </IconCircle>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui-row text-ui-text">{userName ?? 'Fiók'}</span>
                  <span className="block truncate text-ui-meta text-ui-muted">{uploadingAvatar ? 'Feltöltés…' : (userEmail ?? '')}</span>
                </span>
              </button>

            </div>

            <div className="mx-4 border-t border-dashed border-ui-divider" />

            <div className="px-3 py-2">
              {secondaryNav.map(({ href, label, icon: Icon, exact }) => {
                const dim = isLocked && !isAllowedWhenLocked(href)
                if (dim) {
                  return (
                    <span
                      key={href}
                      aria-disabled
                      className="flex cursor-not-allowed items-center gap-3 rounded-ui-control px-3 py-3 text-ui-row text-ui-muted/50"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="flex-1">{label}</span>
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                    </span>
                  )
                }
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-ui-control px-3 py-3 text-ui-row transition-colors',
                      isActive(href, exact) ? 'bg-ui-dark text-white' : 'text-ui-text hover:bg-ui-cell'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex-1">{label}</span>
                  </Link>
                )
              })}
            </div>

            {variant !== 'backstage' && canBilling && (
              <div className="px-3 pb-1">
                <Link
                  href={subscriptionHref}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-ui-control px-3 py-3 text-ui-row transition-colors',
                    pathname.startsWith(subscriptionHref)
                      ? 'bg-ui-dark text-white'
                      : 'text-ui-text hover:bg-ui-cell'
                  )}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="flex-1">Előfizetés</span>
                </Link>
              </div>
            )}

            <div className="mx-4 border-t border-dashed border-ui-divider" />
            <div className="px-3 py-2 pb-8">
              <button
                onClick={() => { setMoreOpen(false); handleLogout() }}
                className="flex w-full items-center gap-3 rounded-ui-control px-3 py-3 text-ui-row text-ui-bad transition-colors hover:bg-ui-cell"
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
