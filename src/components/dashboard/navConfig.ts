import {
  LayoutDashboard, CalendarDays, Briefcase, Users, Clock, Settings, BarChart2, Armchair,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean }

export type DashboardVariant = 'salon' | 'restaurant'

export type NavConfig = {
  items: NavItem[]
  /** A nyilvános oldal URL-prefixe (szalon: '', étterem: 'r/'). */
  publicUrlPrefix: string
  settingsHref: string
  subscriptionHref: string
}

const salonNav: NavConfig = {
  items: [
    { href: '/dashboard', label: 'Áttekintés', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/analytics', label: 'Statisztikák', icon: BarChart2 },
    { href: '/dashboard/bookings', label: 'Foglalások', icon: CalendarDays },
    { href: '/dashboard/services', label: 'Szolgáltatások', icon: Briefcase },
    { href: '/dashboard/staff', label: 'Munkatársak', icon: Users },
    { href: '/dashboard/availability', label: 'Nyitvatartás', icon: Clock },
    { href: '/dashboard/settings', label: 'Beállítások', icon: Settings },
  ],
  publicUrlPrefix: '',
  settingsHref: '/dashboard/settings',
  subscriptionHref: '/dashboard/subscription',
}

const restaurantNav: NavConfig = {
  items: [
    { href: '/restaurant', label: 'Áttekintés', icon: LayoutDashboard, exact: true },
    { href: '/restaurant/analytics', label: 'Statisztikák', icon: BarChart2 },
    { href: '/restaurant/bookings', label: 'Foglalások', icon: CalendarDays },
    { href: '/restaurant/tables', label: 'Asztalok', icon: Armchair },
    { href: '/restaurant/availability', label: 'Nyitvatartás', icon: Clock },
    { href: '/restaurant/settings', label: 'Beállítások', icon: Settings },
  ],
  publicUrlPrefix: 'r/',
  settingsHref: '/restaurant/settings',
  subscriptionHref: '/restaurant/subscription',
}

export function getNavConfig(variant: DashboardVariant): NavConfig {
  return variant === 'restaurant' ? restaurantNav : salonNav
}
