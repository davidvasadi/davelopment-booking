'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import { LogOut, ExternalLink, Monitor, Sun, Moon, Lock, WifiOff } from 'lucide-react'
import { getNavConfig, type DashboardVariant } from './navConfig'
import { NotificationBell } from './NotificationBell'
import { useOnline } from '@/lib/useOnline'

/** Globális offline-jelző a navban — bárhol látszik a dashboardon, ha elment a net. */
function OfflineIndicator({ compact = false }: { compact?: boolean }) {
  const online = useOnline()
  if (online) return null
  if (compact) {
    return (
      <span
        title="Nincs internetkapcsolat"
        className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
      >
        <WifiOff className="h-4 w-4" />
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

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-7" />
  const options = [
    { value: 'system', icon: Monitor },
    { value: 'light', icon: Sun },
    { value: 'dark', icon: Moon },
  ] as const
  return (
    <div className="flex gap-0.5 mb-1 px-0.5">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={cn(
            'flex-1 flex items-center justify-center h-7 rounded-md transition-colors',
            theme === value
              ? 'bg-zinc-100 text-zinc-900 dark:bg-white/[0.1] dark:text-white'
              : 'text-zinc-400 hover:text-zinc-600 dark:text-white/25 dark:hover:text-white/50'
          )}
          title={value}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}


type SubInfo = {
  plan: 'trial' | 'pro' | 'restaurant_pro'
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused'
  trial_ends_at?: string | null
  current_period_end?: string | null
} | null

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function SubscriptionWidget({ sub, subscriptionHref }: { sub: SubInfo; subscriptionHref: string }) {
  if (!sub) return null

  const days = sub.status === 'trialing' ? daysLeft(sub.trial_ends_at) : null
  const isUrgent = days !== null && days <= 3

  return (
    <div className={cn(
      'mx-3 mb-2 p-3 rounded-xl border text-xs',
      isUrgent
        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40'
        : 'bg-zinc-50 border-zinc-100 dark:bg-white/[0.03] dark:border-white/[0.06]'
    )}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-zinc-900 dark:text-white">
          {sub.plan === 'trial' ? 'Próbaidőszak' : 'Pro csomag'}
        </span>
        {sub.status === 'active' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">aktív</span>
        )}
        {sub.status === 'past_due' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">lejárt</span>
        )}
        {sub.status === 'paused' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-white/50">szünet</span>
        )}
        {sub.status === 'canceled' && (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">megszűnt</span>
        )}
      </div>
      {days !== null && (
        <p className={cn('mb-2', isUrgent ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-zinc-500 dark:text-white/40')}>
          {days === 0 ? 'Ma lejár' : `${days} nap maradt`}
        </p>
      )}
      {(sub.status === 'trialing' || sub.status === 'past_due' || sub.status === 'canceled') && (
        <Link
          href={subscriptionHref}
          className="flex items-center justify-center gap-1 w-full py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-black font-medium hover:opacity-80 transition-opacity"
        >
          Upgrade
        </Link>
      )}
    </div>
  )
}

export function DashboardNav({
  salonName,
  salonSlug,
  subscription,
  variant = 'salon',
}: {
  salonName: string
  salonSlug: string
  subscription?: SubInfo
  variant?: DashboardVariant
}) {
  const { items: navItems, publicUrlPrefix, settingsHref, subscriptionHref } = getNavConfig(variant)
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/login')
    toast.success('Kijelentkezve')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const isLocked = subscription?.status === 'past_due' || subscription?.status === 'canceled' || subscription?.status === 'paused'
  const isAllowedWhenLocked = (href: string) => href === settingsHref

  return (
    <>
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 h-screen sticky top-0 z-40 bg-white border-r border-zinc-100 dark:bg-black dark:border-white/[0.06] flex-col shrink-0">
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Schedulio" className="block w-fit hover:opacity-80 transition-opacity">
              <SchedulioLogo className="h-7" />
            </Link>
            <NotificationBell align="left" />
          </div>
          <div className="mt-3">
            <p className="text-zinc-700 dark:text-white/70 font-semibold text-sm truncate">{salonName}</p>
            <a
              href={`/${publicUrlPrefix}${salonSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 mt-0.5 transition-colors"
            >
              Nyilvános oldal <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => {
            const dim = isLocked && !isAllowedWhenLocked(href)
            return (
              <Link
                key={href}
                href={href}
                data-tour={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive(href, exact)
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-semibold'
                    : dim
                      ? 'text-zinc-300 dark:text-white/15 hover:text-zinc-400 dark:hover:text-white/25'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {dim && <Lock className="h-3 w-3 shrink-0" />}
              </Link>
            )
          })}
        </nav>

        <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

        <div className="pt-3">
          <OfflineIndicator />
          <SubscriptionWidget sub={subscription ?? null} subscriptionHref={subscriptionHref} />
        </div>

        <div className="px-3 py-4">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/30 dark:hover:text-white dark:hover:bg-white/[0.06] w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Kijelentkezés
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ─────────────────────────────────────── */}
      <header className="lg:hidden relative z-40 bg-white border-b border-zinc-100 dark:bg-black dark:border-white/[0.06] px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" aria-label="Schedulio" className="block w-fit hover:opacity-80 transition-opacity">
            <SchedulioLogo className="h-6" />
          </Link>
          <span className="text-xs text-zinc-400 dark:text-white/30 font-medium truncate max-w-[120px]">{salonName}</span>
        </div>
        <div className="flex items-center gap-1">
          <OfflineIndicator compact />
          <NotificationBell />
          <a
            href={`/${salonSlug}`}
            target="_blank"
            className="text-zinc-400 hover:text-zinc-700 dark:text-white/30 dark:hover:text-white/70 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>
    </>
  )
}
