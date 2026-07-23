'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { ExternalLink, Lock, WifiOff, ChevronsLeft, Search, ChevronLeft, SlidersHorizontal } from 'lucide-react'
import { getNavConfig, navItemsForCapabilities, type DashboardVariant } from './navConfig'
import type { Capability } from '@/lib/permissions'
import { UserMenu } from './UserMenu'
import { CommandPalette } from './CommandPalette'
import { StoreSwitcher, type SwitcherBusiness } from './StoreSwitcher'
import { useOnline } from '@/lib/useOnline'
import { useRestaurantUI } from '@/components/restaurant/RestaurantUIContext'

/** Globális offline-jelző a navban — bárhol látszik a dashboardon, ha elment a net. */
function OfflineIndicator({ compact = false }: { compact?: boolean }) {
  const online = useOnline()
  if (online) return null
  if (compact) {
    return (
      <span
        title="Nincs internetkapcsolat"
        className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-amber-100 text-amber-700 shadow-[0_2px_8px_rgba(0,0,0,.06)] dark:bg-amber-500/15 dark:text-amber-300"
      >
        <WifiOff className="h-[18px] w-[18px]" />
      </span>
    )
  }
  return (
    <div className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      Nincs internet — vázlat módban dolgozol
    </div>
  )
}


type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

type SubStatus = NonNullable<SubInfo>['status']

// Egységes belépő-animáció a sidebar összes blokkjához (store-switcher, kereső,
// nav-elemek): a konténer lépcsőzi a gyermekeket, a gyermekek balról úsznak be.
const navStagger = { show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } } }
const navItemVariants = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }
const navItemSpring = { type: 'spring' as const, stiffness: 500, damping: 34 }

/** A csomag-státusz rövid címkéje a brand alatti pill-hez. */
function subStatusLabel(status: SubStatus): string {
  switch (status) {
    case 'trialing': return 'Próbaidőszak'
    case 'active': return 'Pro csomag'
    case 'past_due': return 'Lejárt'
    case 'paused': return 'Szüneteltetve'
    case 'canceled': return 'Megszűnt'
    default: return 'Csomag'
  }
}


export function DashboardNav({
  salonName,
  salonSlug,
  subscription,
  variant = 'salon',
  capabilities = [],
  brandLogoUrl = null,
  userName = null,
  userEmail = null,
  userAvatarUrl = null,
  businesses = [],
  activeBusinessKey = null,
  mobileOnly = false,
}: {
  salonName: string
  salonSlug: string
  subscription?: SubInfo
  variant?: DashboardVariant
  capabilities?: Capability[]
  /** davelopment-design: csak a mobil fejléc + ⌘K (a desktop sidebart az új TopNav váltja). */
  mobileOnly?: boolean
  /** Az üzlet logója a fejléc store-switcher blokkjához. */
  brandLogoUrl?: string | null
  /** A bejelentkezett felhasználó adatai a sidebar alján lévő fiók-blokkhoz. */
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
  /** Több-üzlet: a felhasználó összes üzlete a store-switcherhez. */
  businesses?: SwitcherBusiness[]
  /** Az aktív üzlet "<type>:<id>" kulcsa. */
  activeBusinessKey?: string | null
}) {
  const { publicUrlPrefix, settingsHref, subscriptionHref } = getNavConfig(variant)
  const navItems = navItemsForCapabilities(variant, capabilities)
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Mobilon a body háttere is krém legyen, hogy a notch + bottom safe area ne fehér legyen.
  useEffect(() => {
    document.body.style.backgroundColor = '#ECECE8'
    return () => { document.body.style.backgroundColor = '' }
  }, [])

  // CSV export a header „…" menüjébe — a szűrésnek (URL period) megfelelő exporttal.
  const csvDays = searchParams.get('period') ?? '30'
  const csvHref = `/api/export-csv?days=${csvDays}&module=${variant}`

  // A vissza-gomb az ELŐZŐ oldalra visz (böngésző-history).
  const goBack = () => router.back()

  // Backstage (admin): nincs üzlet/előfizetés/nyilvános oldal/store-switcher — ezeket
  // elrejtjük, a fejlécben admin-email + „Backstage" badge van. A nav-elemek, a kereső,
  // a fiók-blokk és a teljes layout viszont UGYANAZ mint a szalon/étterem dashboardon.
  const isBackstage = variant === 'backstage'

  // Összecsukás az étterem ÉS a backstage navban él (a salon nav változatlan).
  const collapsible = variant === 'restaurant' || variant === 'backstage'
  const { navCollapsed, toggleNav } = useRestaurantUI()
  const collapsed = collapsible && navCollapsed

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const isLocked = subscription?.status === 'past_due' || subscription?.status === 'canceled' || subscription?.status === 'paused'
  const isAllowedWhenLocked = (href: string) => href === settingsHref

  return (
    <>
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────── */}
      {!mobileOnly && (
      <aside
        className={cn(
          'hidden lg:flex relative h-screen sticky top-0 z-40 bg-white border-r border-zinc-100 dark:bg-black dark:border-white/[0.06] flex-col shrink-0 transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        {/* Összecsukás-fül a sidebar jobb szélén, a határvonalon lebegve. */}
        {collapsible && (
          <motion.button
            onClick={toggleNav}
            title={collapsed ? 'Menü kinyitása' : 'Menü összecsukása'}
            aria-label={collapsed ? 'Menü kinyitása' : 'Menü összecsukása'}
            initial={false}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="absolute top-3 -right-3 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400 shadow-sm hover:text-zinc-900 dark:border-white/[0.1] dark:bg-zinc-900 dark:text-white/40 dark:hover:text-white"
          >
            <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }}>
              <ChevronsLeft className="h-3.5 w-3.5" />
            </motion.span>
          </motion.button>
        )}
        {/* Egységes stagger-konténer: a fejléc, a kereső és a nav-elemek mind ugyanazzal
            a belépő-animációval (balról beúszva, lépcsőzve) jelennek meg. */}
        <motion.div
          className="flex flex-1 flex-col min-h-0"
          initial="hidden"
          animate="show"
          variants={navStagger}
        >
          {/* Fejléc: store-switcher (logó + név + csomag + ⇅). Felül üres sáv (pt-12)
              a jobb szélen lebegő összecsukás-fülnek. */}
          <motion.div variants={navItemVariants} transition={navItemSpring} className={cn('pt-12 pb-4', collapsed ? 'px-2' : 'px-3')}>
            {collapsed ? (
              <div className="flex flex-col items-center gap-2">
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brandLogoUrl} alt={salonName} className="h-9 w-9 rounded-full object-cover bg-zinc-100 dark:bg-white/[0.06]" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white text-sm font-bold">
                    {salonName?.trim()?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
              </div>
            ) : isBackstage ? (
              // Backstage fejléc: márka-logó + „Backstage" badge + admin email.
              <div className="flex flex-col gap-2">
                <Link href="/backstage" aria-label="davelopment booking Backstage" className="block w-fit hover:opacity-80 transition-opacity">
                  <BrandLogo variant="dark" className="h-6" />
                </Link>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-white dark:text-black">
                    Backstage
                  </span>
                </div>
                {userEmail && (
                  <p className="text-xs text-zinc-400 dark:text-white/30 truncate" title={userEmail}>{userEmail}</p>
                )}
              </div>
            ) : (
              <StoreSwitcher
                name={salonName}
                logoUrl={brandLogoUrl}
                planLabel={subscription ? subStatusLabel(subscription.status) : null}
                businesses={businesses}
                activeKey={activeBusinessKey}
              />
            )}
          </motion.div>

          {/* Kereső a menü fölött (⌘K command-palette). */}
          <motion.div variants={navItemVariants} transition={navItemSpring} className={cn('pb-1', collapsed ? 'px-2' : 'px-3')}>
            {collapsed ? (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('davelopment:open-command'))}
                aria-label="Keresés"
                title="Keresés"
                className="group flex w-full items-center justify-center rounded-lg px-2 py-2.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors"
              >
                <Search className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('davelopment:open-command'))}
                aria-label="Keresés"
                className="group flex h-9 w-full items-center gap-2.5 rounded-xl border border-zinc-200 dark:border-white/[0.08] px-3 text-sm text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300 dark:text-white/30 dark:hover:text-white dark:hover:bg-white/[0.06] dark:hover:border-white/[0.16] transition-colors"
              >
                <Search className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                <span className="flex-1 text-left">Keresés…</span>
                <kbd className="inline-flex items-center rounded-md border border-zinc-200 dark:border-white/[0.1] px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">⌘K</kbd>
              </button>
            )}
          </motion.div>

          <motion.div variants={navItemVariants} transition={navItemSpring} className="mt-3 mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

          <nav className={cn('flex-1 py-4 space-y-0.5 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const dim = isLocked && !isAllowedWhenLocked(href)
              const active = isActive(href, exact)
              return (
                <motion.div
                  key={href}
                  variants={navItemVariants}
                  transition={navItemSpring}
                >
                <Link
                  href={href}
                  data-tour={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg text-sm transition-colors',
                    collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                    active
                      ? 'text-white dark:text-black font-semibold'
                      : dim
                        ? 'text-zinc-300 dark:text-white/15 hover:text-zinc-400 dark:hover:text-white/25'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06]'
                  )}
                >
                  {/* Mozgó aktív-pill: layoutId-vel átcsúszik az új aktív elemre. */}
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      className="absolute inset-0 -z-0 rounded-lg bg-zinc-900 dark:bg-white"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <Icon className="relative z-10 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key="label"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.18 }}
                        className="relative z-10 flex-1 overflow-hidden whitespace-nowrap"
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!collapsed && dim && <Lock className="relative z-10 h-3 w-3 shrink-0" />}
                </Link>
              </motion.div>
            )
          })}

            {/* Nyilvános oldal — a menüpontokkal egy oszlopban. Backstage-en NINCS publikus
                oldal (admin-eszköz), ezért ott elrejtjük. */}
            {!isBackstage && (
            <motion.div variants={navItemVariants} transition={navItemSpring}>
              <a
                href={`/${publicUrlPrefix}${salonSlug}`}
                target="_blank"
                title={collapsed ? 'Nyilvános oldal' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg text-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06] transition-colors',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                )}
              >
                <ExternalLink className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {!collapsed && <span className="flex-1">Nyilvános oldal</span>}
              </a>
            </motion.div>
            )}
          </nav>
        </motion.div>

        <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

        {!collapsed && (
          <div className="pt-3">
            <OfflineIndicator />
          </div>
        )}

        {/* Fiók-blokk: avatar + név + harang + „⋯". Az avatarra/„⋯"-ra kattintva nyílik
            a fiók-popover (profil, profilkép, téma, kijelentkezés). */}
        <div className={cn('pt-3', collapsed ? 'px-2' : 'px-3')}>
          <UserMenu
            name={userName}
            email={userEmail}
            avatarUrl={userAvatarUrl}
            collapsed={collapsed}
            subscriptionHref={subscriptionHref}
            settingsHref={settingsHref}
          />
        </div>

        <div className={cn('py-4', collapsed ? 'px-2' : 'px-3')}>
          {/* Étterem navban: „powered by" felirat, ALATTA a márka + davelopment logók. */}
          {variant === 'restaurant' && !collapsed && (
            <div className="mt-3 px-3">
              <p className="text-[10px] text-zinc-300 dark:text-white/20">powered by</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                  <BrandLogo variant="dark" className="h-5" />
                </a>
                <span className="text-zinc-200 dark:text-white/10">·</span>
                <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
                  {/* FIGYELEM: a fájlnevek félrevezetők — a *_dark.svg* sötét tintás (világos
                      témára), a *_light.svg* világos (sötét témára). Ezért fordítva kötjük. */}
                  <img src="/logo_davelopment_dark.svg" alt="davelopment" className="h-[18px] w-auto block dark:hidden" />
                  <img src="/logo_davelopment_light.svg" alt="davelopment" className="h-[18px] w-auto hidden dark:block" />
                </a>
              </div>
            </div>
          )}
        </div>
      </aside>
      )}

      {/* ── MOBILE TOP BAR — vissza + cím + „…" menü ───────────── */}
      {/* Crextio-stílus: NINCS tömör sáv/határvonal — a fejléc a krém gradiensen ül, a
          gombok lebegő fehér KÖRÖK (üveg + lágy árnyék + blur), mint a referencia „←" ikon.
          A cím középen marad (kompakt sáv-elrendezés). */}
      <header className="lg:hidden relative z-40 px-3 h-16 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={goBack}
          aria-label="Vissza"
          className="flex items-center justify-center h-11 w-11 shrink-0 rounded-full bg-[var(--dav-glass-strong)] text-ink shadow-[0_2px_8px_rgba(0,0,0,.06)] backdrop-blur-lg outline-none transition-colors hover:bg-white/80 active:scale-95 dark:bg-white/[0.08] dark:text-white/80 dark:hover:bg-white/[0.14]"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2.5 shrink-0">
          <OfflineIndicator compact />
          {/* Beállítások nav ikon — csak a settings oldalakon jelenik meg. */}
          {pathname.startsWith(settingsHref) && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('davelopment:open-settings-nav'))}
              aria-label="Beállítások menü"
              className="flex items-center justify-center h-[52px] w-[52px] shrink-0 rounded-full bg-[var(--dav-glass-strong)] text-ink shadow-[0_2px_8px_rgba(0,0,0,.05)] backdrop-blur-lg outline-none transition-colors hover:bg-white/70 active:scale-95"
            >
              <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={2} />
            </button>
          )}
          {/* Tippek szűrő ikon — csak a tips oldalon jelenik meg. */}
          {pathname.endsWith('/tips') && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('davelopment:open-tips-filter'))}
              aria-label="Kategória szűrő"
              className="flex items-center justify-center h-[52px] w-[52px] shrink-0 rounded-full bg-[var(--dav-glass-strong)] text-ink shadow-[0_2px_8px_rgba(0,0,0,.05)] backdrop-blur-lg outline-none transition-colors hover:bg-white/70 active:scale-95"
            >
              <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={2} />
            </button>
          )}
          {/* Értesítés + fiók — a mobil fejléc JOBB felső sarkában, desktop-szerű popoverrel
              (csengő = értesítések, avatar = fiók-menü → Saját profil). */}
          {!isBackstage && (
            <UserMenu
              name={userName}
              email={userEmail}
              avatarUrl={userAvatarUrl}
              collapsed
              subscriptionHref={subscriptionHref}
              settingsHref={settingsHref}
              publicUrl={`/${salonSlug}`}
            />
          )}
        </div>
      </header>

      {/* A ⌘K kereső-palette — desktopon a sidebar keresője, mobilon a header ikonja nyitja. */}
      <CommandPalette variant={variant} />
    </>
  )
}
