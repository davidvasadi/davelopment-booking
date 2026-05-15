'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, CreditCard, TrendingUp, LogOut,
  Monitor, Sun, Moon, MoreHorizontal, AlertTriangle, Activity,
} from 'lucide-react'

const navItems = [
  { href: '/bookly/backstage', label: 'Áttekintő', icon: LayoutDashboard, exact: true },
  { href: '/bookly/backstage/salons', label: 'Szalonok', icon: Building2 },
  { href: '/bookly/backstage/subscriptions', label: 'Előfizetések', icon: CreditCard },
  { href: '/bookly/backstage/revenue', label: 'Bevétel', icon: TrendingUp },
  { href: '/bookly/backstage/churn', label: 'Kockázat', icon: AlertTriangle },
  { href: '/bookly/backstage/activity', label: 'Aktivitás', icon: Activity },
]

const primaryNav = navItems.slice(0, 4)
const secondaryNav = navItems.slice(4)

function ThemeToggle({ dark }: { dark?: boolean }) {
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
    <div className="flex gap-0.5 px-0.5">
      {options.map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={value}
          className={cn(
            'flex-1 flex items-center justify-center h-7 rounded-md transition-colors',
            dark
              ? theme === value
                ? 'bg-white/[0.12] text-white'
                : 'text-zinc-600 hover:text-zinc-400'
              : theme === value
                ? 'bg-zinc-100 text-zinc-900 dark:bg-white/[0.12] dark:text-white'
                : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400'
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}

interface Props {
  email: string
}

export function BackstageSidebar({ email }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  const handleLogout = async () => {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/bookly/backstage/login')
    toast.success('Kijelentkezve')
  }

  return (
    <>
      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-white/[0.06] px-4 py-8 h-screen sticky top-0">
        <div className="mb-8 px-2">
          <p className="text-zinc-900 dark:text-white font-black text-lg tracking-tight">Bookly</p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-widest mt-0.5">Backstage</p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                isActive(href, exact)
                  ? 'bg-zinc-900 text-white dark:bg-white/[0.10] dark:text-white'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-white/[0.06]'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-200 dark:border-white/[0.06] pt-4 mt-4 space-y-1">
          <ThemeToggle />
          <p className="px-3 text-xs text-zinc-400 dark:text-zinc-600 truncate py-1">{email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-600 dark:hover:text-zinc-300 dark:hover:bg-white/[0.04] transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Kilépés
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ──────────────────────────────────────── */}
      <header className="lg:hidden bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-white/[0.06] px-5 h-14 flex items-center justify-between shrink-0 fixed top-0 left-0 right-0 z-30">
        <div>
          <span className="font-black text-base tracking-tight text-zinc-900 dark:text-white">Bookly</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-widest ml-2">Backstage</span>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-black/[0.12] dark:shadow-black/50 border border-zinc-100 dark:border-white/[0.08] flex items-center px-4 py-3 gap-1.5">
        {primaryNav.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact)
          return (
            <Link key={href} href={href} aria-label={label} className="flex items-center justify-center">
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-300 ease-out',
                active ? 'bg-zinc-900 dark:bg-white shadow-md shadow-black/20' : 'hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
              )}>
                <Icon className={cn(
                  'transition-all duration-300 ease-out',
                  active ? 'h-6 w-6 text-white dark:text-black' : 'h-[22px] w-[22px] text-zinc-400 dark:text-white/30'
                )} />
              </div>
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(true)} aria-label="Több" className="flex items-center justify-center">
          <div className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center transition-all',
            secondaryNav.some(({ href, exact }) => isActive(href, exact))
              ? 'bg-zinc-900 dark:bg-white shadow-md shadow-black/20'
              : 'hover:bg-zinc-100 dark:hover:bg-white/[0.08]'
          )}>
            <MoreHorizontal className={cn(
              'h-5 w-5 transition-all',
              secondaryNav.some(({ href, exact }) => isActive(href, exact))
                ? 'text-white dark:text-black'
                : 'text-zinc-400 dark:text-white/30'
            )} />
          </div>
        </button>
      </nav>

      {/* ── MOBILE MORE SHEET ───────────────────────────────────── */}
      {moreOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-50 bg-black/40 dark:bg-black/60" onClick={() => setMoreOpen(false)} />
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
              <ThemeToggle />
            </div>
            <div className="mx-4 h-px bg-zinc-100 dark:bg-white/[0.06]" />
            <div className="px-3 py-2 pb-10">
              <p className="px-3 py-2 text-xs text-zinc-400 dark:text-zinc-600 truncate">{email}</p>
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
