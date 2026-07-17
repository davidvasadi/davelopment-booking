'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/BrandLogo'
import { getNavConfig, navItemsForCapabilities, type DashboardVariant } from './navConfig'
import type { Capability } from '@/lib/permissions'
import { UserMenu } from './UserMenu'

// A „staggered spring" belépő (etalon: a UserMenu popover) — a „Több" legördülő is ezt kapja:
// a panel a triggerből kinőve rugósan pattan ki, az elemek egymás után úsznak be.
const POP_PANEL = {
  hidden: { opacity: 0, scale: 0.85, y: -8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 520, damping: 26, mass: 0.9, staggerChildren: 0.035, delayChildren: 0.04 },
  },
  exit: { opacity: 0, scale: 0.92, y: -6, transition: { duration: 0.12, ease: 'easeIn' as const } },
}
const POP_ITEM = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 500, damping: 30 } },
}

type SubInfo = {
  plan: 'trial' | 'paid'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

/**
 * Egységes felső pill-nav (davelopment-design) — a 34px konténer tetején, mindkét
 * modulhoz (szalon/étterem/backstage) UGYANEZ, csak a `variant` adja a tartalmat.
 * Bal: davelopment booking brand. Közép: pill-nav (aktív elem sötét pillben). Jobb: Beállítás
 * (fogaskerék) + avatar/értesítés-menü (UserMenu). A kereső később aloldalakba kerül;
 * a nyilvános oldal + CSV az avatar-menüben.
 */
export function AppNavbar({
  variant,
  capabilities = [],
  businessSlug,
  subscription,
  userName = null,
  userEmail = null,
  userAvatarUrl = null,
}: {
  variant: DashboardVariant
  capabilities?: Capability[]
  businessSlug: string
  subscription?: SubInfo
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
}) {
  const { publicUrlPrefix, settingsHref, subscriptionHref } = getNavConfig(variant)
  const items = navItemsForCapabilities(variant, capabilities)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))
  const isLocked = subscription?.status === 'past_due' || subscription?.status === 'canceled' || subscription?.status === 'paused'

  // A „Beállítások" a jobb oldali fogaskerékre kerül; a pill-navban a többi elem.
  // A pill-nav ~6 elemre van tervezve — a többi egy „Több" legördülőbe kerül, hogy ne lógjon ki.
  const allPill = items.filter((it) => it.href !== settingsHref)
  const PRIMARY_MAX = 4
  const pillItems = allPill.slice(0, PRIMARY_MAX)
  const overflowItems = allPill.slice(PRIMARY_MAX)
  const [moreOpen, setMoreOpen] = useState(false)
  const overflowActive = overflowItems.some((it) => isActive(it.href, it.exact))

  const csvDays = searchParams.get('period') ?? '30'
  const csvHref = `/api/export-csv?days=${csvDays}&module=${variant}`
  const publicUrl = variant === 'backstage' ? undefined : `/${publicUrlPrefix}${businessSlug}`
  const settingsActive = isActive(settingsHref)

  return (
    // relative z-50: a nav (és a legördülői/popoverei) a tartalom fölé kerüljön. Kell, mert a
    // nav és a foglalás-kártyák is backdrop-filteres stacking contextek → a később jövő kártya
    // különben rárajzolódna a „Több" legördülőre / UserMenu popoverre.
    <div className="relative z-50 hidden lg:flex items-center justify-between gap-4">
      {/* Bal: brand */}
      <Link
        href={items[0]?.href ?? '/'}
        aria-label="davelopment booking"
        className="flex items-center shrink-0 px-1"
      >
        <BrandLogo className="h-10" />
      </Link>

      {/* Közép: pill-nav — üveges háttér (a konténer-gradient átdereng), 40px sugár, soft shadow */}
      <nav className="flex items-center gap-1.5 rounded-[40px] bg-[var(--dav-glass-strong)] p-[6px] shadow-[0_2px_10px_rgba(0,0,0,.05)] backdrop-blur-lg">
        {pillItems.map(({ href, label, exact }) => {
          const active = isActive(href, exact)
          const dim = isLocked
          return (
            <Link
              key={href}
              href={href}
              data-tour={href}
              className={cn(
                'relative rounded-[30px] py-[11px] text-sm transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ink/10',
                active ? 'px-[22px] text-white font-semibold' : dim ? 'px-[18px] text-[#55524a]/50' : 'px-[18px] font-medium text-[#55524a] hover:text-ink',
              )}
            >
              {active && (
                <motion.span
                  layoutId="dav-nav-pill"
                  className="absolute inset-0 -z-0 rounded-[30px] bg-ink-dark"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </Link>
          )
        })}

        {/* „Több" legördülő a másodlagos elemekre — így a nav nem lóg ki */}
        {overflowItems.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMoreOpen((o) => !o)}
              onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
              className={cn(
                'relative flex items-center gap-1 rounded-[30px] py-[11px] text-sm transition-colors whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ink/10',
                overflowActive ? 'px-[22px] text-white font-semibold' : 'px-[18px] font-medium text-[#55524a] hover:text-ink',
              )}
            >
              {overflowActive && <span className="absolute inset-0 -z-0 rounded-[30px] bg-ink-dark" />}
              <span className="relative z-10">Több</span>
              <ChevronDown className={cn('relative z-10 h-4 w-4 transition-transform', moreOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  variants={POP_PANEL}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[190px] overflow-hidden rounded-[18px] border border-[#ececec] bg-white p-1.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,.35)]"
                >
                  {overflowItems.map(({ href, label, exact, icon: Icon }) => {
                    const active = isActive(href, exact)
                    return (
                      <motion.div key={href} variants={POP_ITEM}>
                        <Link
                          href={href}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-[13px] px-3 py-2.5 text-sm transition-colors',
                            active ? 'bg-ink-dark font-semibold text-white' : 'font-medium text-[#3a352a] hover:bg-[#f4f4f5] hover:text-ink',
                          )}
                        >
                          <Icon className={cn('h-[17px] w-[17px]', !active && 'text-[#8a8779]')} />
                          {label}
                        </Link>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>

      {/* Jobb: Beállítás (Crextio: fehér pill ikon+felirat) + csengő + avatar */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Link
          href={settingsHref}
          data-tour={settingsHref}
          aria-label="Beállítások"
          title="Beállítások"
          className={cn(
            'flex h-[52px] shrink-0 items-center gap-2 rounded-[30px] px-[22px] text-sm font-semibold shadow-[0_2px_8px_rgba(0,0,0,.05)] outline-none transition-colors backdrop-blur-lg',
            settingsActive ? 'bg-ink-dark text-white' : 'bg-[var(--dav-glass-strong)] text-ink hover:bg-white/70',
          )}
        >
          <Settings className="h-[16px] w-[16px]" strokeWidth={2} />
          Beállítások
        </Link>

        <UserMenu
          name={userName}
          email={userEmail}
          avatarUrl={userAvatarUrl}
          collapsed
          subscriptionHref={subscriptionHref}
          settingsHref={settingsHref}
          publicUrl={publicUrl}
          csvHref={variant === 'backstage' ? undefined : csvHref}
        />
      </div>
    </div>
  )
}
