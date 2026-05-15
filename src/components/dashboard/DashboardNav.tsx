'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CalendarDays, Briefcase, Users, Clock, Settings, LogOut, ExternalLink, Monitor, Sun, Moon, BarChart2,
} from 'lucide-react'

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

const navItems = [
  { href: '/bookly/dashboard', label: 'Áttekintés', icon: LayoutDashboard, exact: true },
  { href: '/bookly/dashboard/analytics', label: 'Statisztikák', icon: BarChart2 },
  { href: '/bookly/dashboard/bookings', label: 'Foglalások', icon: CalendarDays },
  { href: '/bookly/dashboard/services', label: 'Szolgáltatások', icon: Briefcase },
  { href: '/bookly/dashboard/staff', label: 'Munkatársak', icon: Users },
  { href: '/bookly/dashboard/availability', label: 'Nyitvatartás', icon: Clock },
  { href: '/bookly/dashboard/settings', label: 'Beállítások', icon: Settings },
]

export function DashboardNav({ salonName, salonSlug }: { salonName: string; salonSlug: string }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/bookly/login')
    toast.success('Kijelentkezve')
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <>
      {/* ── DESKTOP SIDEBAR ────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 h-screen sticky top-0 bg-white border-r border-zinc-100 dark:bg-black dark:border-white/[0.06] flex-col shrink-0">
        <div className="px-6 pt-7 pb-6">
          <span className="relative inline-block w-fit leading-none">
            <Link href="/" className="font-black text-lg tracking-tight text-zinc-900 dark:text-white hover:opacity-70 transition-opacity">Bookly</Link>
            <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="absolute -bottom-3 right-0 translate-x-1/2 text-[10px] text-zinc-400 dark:text-zinc-600 font-normal leading-none whitespace-nowrap hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">by [davelopment]®</a>
          </span>
          <div className="mt-3">
            <p className="text-zinc-700 dark:text-white/70 font-semibold text-sm truncate">{salonName}</p>
            <a
              href={`/bookly/${salonSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-zinc-400 dark:text-white/30 hover:text-zinc-700 dark:hover:text-white/60 mt-0.5 transition-colors"
            >
              Nyilvános oldal <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive(href, exact)
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-black font-semibold'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/[0.06]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />

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
      <header className="lg:hidden bg-white border-b border-zinc-100 dark:bg-black dark:border-white/[0.06] px-5 h-14 flex items-center justify-between shrink-0">
        <div className="flex items-baseline gap-2">
          <span className="relative inline-block w-fit leading-none">
            <Link href="/" className="font-black text-base tracking-tight text-zinc-900 dark:text-white hover:opacity-70 transition-opacity">Bookly</Link>
            <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="absolute -bottom-3 right-0 translate-x-1/2 text-[9px] text-zinc-400 dark:text-zinc-600 font-normal leading-none whitespace-nowrap hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">by [davelopment]®</a>
          </span>
          <span className="text-xs text-zinc-400 dark:text-white/30 font-medium truncate max-w-[120px]">{salonName}</span>
        </div>
        <a
          href={`/bookly/${salonSlug}`}
          target="_blank"
          className="text-zinc-400 hover:text-zinc-700 dark:text-white/30 dark:hover:text-white/70 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </header>
    </>
  )
}
