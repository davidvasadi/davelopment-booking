'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, ChevronDown, Lock, Building2, FileText, Mail, PanelsTopLeft, CreditCard, type LucideIcon } from 'lucide-react'
import { can } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui-kit'
import { BrandLogo } from '@/components/BrandLogo'
import { getNavConfig, navItemsForCapabilities, type DashboardVariant } from './navConfig'
import type { Capability } from '@/lib/permissions'
import { UserMenu } from './UserMenu'
import type { SwitcherBusiness } from './switcherTypes'
import { buttonHover } from '@/lib/motion'
import { useExclusivePopover } from '@/lib/exclusivePopover'

const MotionLink = motion.create(Link)

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
  businesses = [],
  activeBusinessKey = null,
  hiddenHrefs = [],
}: {
  variant: DashboardVariant
  capabilities?: Capability[]
  businessSlug: string
  subscription?: SubInfo
  userName?: string | null
  userEmail?: string | null
  userAvatarUrl?: string | null
  businesses?: SwitcherBusiness[]
  activeBusinessKey?: string | null
  /** Nav-hrefek, amiket egy kikapcsolt funkció miatt el kell rejteni (pl. utalványok). */
  hiddenHrefs?: string[]
}) {
  const { publicUrlPrefix, settingsHref, subscriptionHref, notificationsHref } = getNavConfig(variant)
  const items = navItemsForCapabilities(variant, capabilities, hiddenHrefs)
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href))
  const isLocked = subscription?.status === 'past_due' || subscription?.status === 'canceled' || subscription?.status === 'paused'

  const trialDaysLeft = subscription?.status === 'trialing' && subscription.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86_400_000))
    : undefined

  // A „Beállítások" a jobb oldali pillre kerül; a pill-navban a design szerinti 5 fő elem (/design 2.1):
  // Áttekintés · Foglalások · Naptár (étteremnél Asztalok) · Vendégek · Statisztikák — a többi a „Több" alá, csoportosítva.
  const showSettings = variant === 'backstage' || items.some((it) => it.href === settingsHref)
  const allPill = items.filter((it) => it.href !== settingsHref)
  const PRIMARY = variant === 'backstage' ? null : ['', '/bookings', '/schedule', '/guests', '/analytics']
  const base = variant === 'restaurant' ? '/restaurant' : '/dashboard'
  const pillItems = PRIMARY ? PRIMARY.map((sfx) => allPill.find((it) => it.href === base + sfx)).filter((x): x is (typeof allPill)[number] => !!x) : allPill.slice(0, 4)
  const overflowItems = allPill.filter((it) => !pillItems.includes(it))
  const [moreOpen, setMoreOpen] = useState(false)
  useExclusivePopover(moreOpen, () => setMoreOpen(false))
  const overflowActiveItem = overflowItems.find((it) => isActive(it.href, it.exact))
  const overflowActive = !!overflowActiveItem
  // a „Több" panel csoportjai (a design szerint); ami nincs benne, az „Egyéb"
  const GROUPS: [string, string[]][] = [['Üzlet', ['/services', '/staff', '/schedule', '/availability']], ['Bevétel és marketing', ['/vouchers', '/marketing']], ['Segítség', ['/tips', '/help']]]
  const groupOf = (href: string) => GROUPS.find(([, sfx]) => sfx.some((x) => href === base + x))?.[0] ?? 'Egyéb'
  // a „Több” panel kiegészítő linkjei (Beállítások-témák és a kapcsolat), hogy minden csoport kitöltse a helyét —
  // csak annak, akinek joga van hozzá; nem jelölődnek aktívnak (a Beállítások pill az)
  const allowed = (cap?: Capability) => !cap || !capabilities || can(capabilities, cap)
  const EXTRA: Record<string, { href: string; label: string; icon: LucideIcon; cap?: Capability }[]> = variant === 'backstage' ? {} : {
    'Üzlet': variant === 'restaurant' ? [{ href: `${settingsHref}?tab=tables`, label: 'Asztalok & termek', icon: Building2, cap: 'settings.profile' }] : [],
    'Bevétel és marketing': [{ href: `${settingsHref}?tab=invoices`, label: 'Számlák', icon: FileText, cap: 'payments.manage' }],
    'Segítség': [{ href: '/kapcsolat', label: 'Kapcsolat', icon: Mail }],
    'Egyéb': [{ href: `${settingsHref}?tab=site`, label: 'Foglalóoldal', icon: PanelsTopLeft, cap: 'settings.profile' }, { href: `${settingsHref}?tab=billing`, label: 'Előfizetés', icon: CreditCard, cap: 'billing.manage' }],
  }
  const overflowGroups = [...GROUPS.map(([g]) => g), 'Egyéb']
    .map((g) => [g, [...overflowItems.filter((it) => groupOf(it.href) === g), ...(EXTRA[g] ?? []).filter((x) => allowed(x.cap)).map((x) => ({ ...x, exact: false, extra: true }))]] as const)
    .filter(([, list]) => list.length > 0)

  const publicUrl = variant === 'backstage' ? undefined : `/${publicUrlPrefix}${businessSlug}`
  const settingsActive = isActive(settingsHref)

  return (
    <>
    {/* Backdrop — kattintásra bezárja a „Több" lenyílót; z-[49] a nav z-50 alatt van. */}
    {moreOpen && (
      <div className="fixed inset-0 z-[49]" aria-hidden onClick={() => setMoreOpen(false)} />
    )}
    <div className="relative z-50 hidden lg:flex print:!hidden items-center justify-between gap-4">
      {/* Bal: brand */}
      <Link
        href={items[0]?.href ?? '/'}
        aria-label="davelopment booking"
        className="flex items-center shrink-0 px-1"
      >
        <BrandLogo variant="light" className="h-8" />
      </Link>

      {/* Jobb: a menü-pill, a Beállítások, a csengő és az avatar — egymáshoz simulva (a design szerint) */}
      <div className="flex items-center gap-1.5">

      {/* a menü-pill: fehér 60%, benne a kit gombjai (ghost; az aktív sötét, animált háttérrel) */}
      <nav className="flex items-center gap-1 rounded-full bg-white/60 p-1">
        {pillItems.map(({ href, label, exact }) => {
          const active = isActive(href, exact)
          // Lejárt/megszűnt/szüneteltetett előfizetésnél a nav-elemek NEM navigálhatók —
          // csak lakat-ikonnal jelzett, inaktív pill marad belőlük (a "Beállítások" gomb és
          // az azon belüli Előfizetés/Fiók-törlés fülek maradnak elérhetők).
          if (isLocked) {
            return <Button key={href} variant="ghost" icon={Lock} disabled title="Az előfizetésed lejárt — aktiváld a folytatáshoz">{label}</Button>
          }
          return (
            <Button key={href} href={href} data-tour={href} variant="ghost" className={cn('relative', active ? 'text-white' : 'hover:bg-white/70')}>
              {/* az aktív háttér rugósan átúszik a kiválasztott menüpontra */}
              {active && <motion.span layoutId="ui-nav-pill" className="absolute inset-0 -z-0 rounded-full bg-ui-dark" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span className="relative z-10">{label}</span>
            </Button>
          )
        })}

        {/* „Több" legördülő a másodlagos elemekre — így a nav nem lóg ki */}
        {overflowItems.length > 0 && (
          <div className="relative">
            <Button variant={overflowActive ? 'dark' : 'ghost'} onClick={() => setMoreOpen((o) => !o)} onBlur={() => setTimeout(() => setMoreOpen(false), 150)} className={overflowActive ? undefined : 'hover:bg-white/70'}>
              {/* ha a Több alatti oldalon vagy, a helyén az oldal neve áll (sötéten) */}
              {overflowActiveItem?.label ?? 'Több'}
              <ChevronDown className={cn('h-3.5 w-3.5 opacity-60 transition-transform', moreOpen && 'rotate-180')} />
            </Button>
            <AnimatePresence>
              {moreOpen && (
                <motion.div
                  variants={POP_PANEL}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 top-[calc(100%+8px)] z-50 grid w-[440px] grid-cols-2 gap-1 overflow-hidden rounded-ui-card bg-white p-3 shadow-ui-popup"
                >
                  {overflowGroups.map(([group, list]) => (
                  <motion.div key={group} variants={POP_ITEM} className="p-1">
                  <div className="px-2.5 pb-1 pt-1.5 text-ui-label text-ui-muted">{group}</div>
                  {list.map((item) => {
                    const { href, label, exact, icon: Icon } = item
                    const active = 'extra' in item ? false : isActive(href, exact)
                    if (isLocked) {
                      return (
                        <motion.div key={href} variants={POP_ITEM}>
                          <span
                            aria-disabled
                            title="Az előfizetésed lejárt — aktiváld a folytatáshoz"
                            className="flex cursor-not-allowed items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body text-ui-muted/60"
                          >
                            <Lock className="h-4 w-4" strokeWidth={1.8} />
                            {label}
                          </span>
                        </motion.div>
                      )
                    }
                    return (
                      <motion.div key={href} variants={POP_ITEM}>
                        <MotionLink
                          href={href}
                          onClick={() => setMoreOpen(false)}
                          variants={buttonHover}
                          initial="rest"
                          whileHover="hover"
                          whileTap="hover"
                          className={cn(
                            'flex items-center gap-2.5 rounded-ui-control px-3 py-2.5 text-ui-body transition-colors',
                            // a Partnerprogram sárga sor, mint a fiók-menüben (design 20.3) — kiemelve, nem szürke hover
                            active ? 'bg-ui-dark text-white' : href.endsWith('/partnerprogram') ? 'bg-ui-yellow text-ui-text hover:opacity-90' : 'text-ui-text hover:bg-ui-cell',
                          )}
                        >
                          <Icon className={cn('h-4 w-4', !active && !href.endsWith('/partnerprogram') && 'text-ui-muted')} strokeWidth={1.8} />
                          {label}
                        </MotionLink>
                      </motion.div>
                    )
                  })}
                  </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-1.5 shrink-0">
        {showSettings && (
          <Button href={settingsHref} data-tour={settingsHref} variant={settingsActive ? 'dark' : 'glass'} size="lg" icon={Settings} className={settingsActive ? undefined : 'hover:bg-white'}>Beállítások</Button>
        )}

        <UserMenu
          showPartner={variant !== 'backstage' && !hiddenHrefs.some((h) => h.endsWith('/partnerprogram'))}
          approvals={variant !== 'backstage'}
          name={userName}
          email={userEmail}
          avatarUrl={userAvatarUrl}
          subscriptionHref={subscriptionHref}
          settingsHref={settingsHref}
          publicUrl={publicUrl}
          businesses={businesses}
          activeBusinessKey={activeBusinessKey}
          capabilities={variant === 'backstage' ? undefined : capabilities}
          notificationsHref={variant === 'backstage' ? undefined : notificationsHref}
          trialDaysLeft={trialDaysLeft}
        />
      </div>
      </div>
    </div>
    </>
  )
}
