'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, CalendarDays, Scissors, Users, Clock, Settings, LogOut, ExternalLink,
} from 'lucide-react'

const navItems = [
  { href: '/bookly/dashboard', label: 'Áttekintés', icon: LayoutDashboard, exact: true },
  { href: '/bookly/dashboard/bookings', label: 'Foglalások', icon: CalendarDays },
  { href: '/bookly/dashboard/services', label: 'Szolgáltatások', icon: Scissors },
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
      <aside className="hidden lg:flex w-56 min-h-screen bg-zinc-950 flex-col shrink-0">
        <div className="px-6 pt-7 pb-6">
          <span className="text-white font-black text-lg tracking-tight">Bookly</span>
          <div className="mt-3">
            <p className="text-zinc-300 font-semibold text-sm truncate">{salonName}</p>
            <a
              href={`/bookly/${salonSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 mt-0.5 transition-colors"
            >
              Nyilvános oldal <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        <div className="mx-4 h-px bg-zinc-800" />

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive(href, exact)
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mx-4 h-px bg-zinc-800" />

        <div className="px-3 py-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-600 hover:text-white hover:bg-zinc-800 w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Kijelentkezés
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ─────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-950 px-5 h-14 flex items-center justify-between">
        <span className="text-white font-black text-base tracking-tight">Bookly</span>
        <div className="flex items-center gap-3">
          <a
            href={`/bookly/${salonSlug}`}
            target="_blank"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button onClick={handleLogout} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 flex">
        {navItems.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors',
              isActive(href, exact)
                ? 'text-white'
                : 'text-zinc-600 hover:text-zinc-400'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[9px] font-medium leading-none">{label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
