'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CalendarDays, Briefcase, Users, Clock, Settings,
  LogOut, Monitor, Sun, Moon, MoreHorizontal, BarChart2,
} from 'lucide-react'

const navItems = [
  { href: '/bookly/dashboard', label: 'Áttekintés', icon: LayoutDashboard, exact: true },
  { href: '/bookly/dashboard/analytics', label: 'Statisztikák', icon: BarChart2 },
  { href: '/bookly/dashboard/bookings', label: 'Foglalások', icon: CalendarDays },
  { href: '/bookly/dashboard/services', label: 'Szolgáltatások', icon: Briefcase },
  { href: '/bookly/dashboard/staff', label: 'Munkatársak', icon: Users },
  { href: '/bookly/dashboard/availability', label: 'Nyitvatartás', icon: Clock },
  { href: '/bookly/dashboard/settings', label: 'Beállítások', icon: Settings },
]

const primaryNav = navItems.slice(0, 4)
const secondaryNav = navItems.slice(4)

export default function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [moreOpen, setMoreOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/bookly/login')
    toast.success('Kijelentkezve')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const hasSecondaryActive = secondaryNav.some(({ href, exact }) => isActive(href, exact))

  return (
    <>
      <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-black/[0.12] dark:shadow-black/50 border border-zinc-100 dark:border-white/[0.08] flex items-center px-4 py-3 gap-1.5">
        {primaryNav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
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
                    : 'h-[22px] w-[22px] text-zinc-400 dark:text-white/30'
                )} />
              </div>
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
            <div className="px-3 py-2">
              {secondaryNav.map(({ href, label, icon: Icon, exact }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors',
                    isActive(href, exact)
                      ? 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-white'
                      : 'text-zinc-600 dark:text-white/60 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </Link>
              ))}
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
