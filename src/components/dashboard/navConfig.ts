import {
  LayoutDashboard, CalendarDays, CalendarRange, Briefcase, Users, Clock, Settings, BarChart2, Armchair, SlidersHorizontal, MapPin,
  Store, CreditCard, TrendingUp, AlertTriangle, Activity,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean }

export type DashboardVariant = 'salon' | 'restaurant' | 'backstage'

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
    { href: '/dashboard/guests', label: 'Vendégek', icon: MapPin },
    { href: '/dashboard/services', label: 'Szolgáltatások', icon: Briefcase },
    { href: '/dashboard/staff', label: 'Munkatársak', icon: Users },
    { href: '/dashboard/schedule', label: 'Naptár', icon: CalendarRange },
    { href: '/dashboard/availability', label: 'Nyitvatartás', icon: Clock },
    { href: '/dashboard/tips', label: 'Funkciók', icon: SlidersHorizontal },
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
    { href: '/restaurant/guests', label: 'Vendégek', icon: MapPin },
    { href: '/restaurant/tables', label: 'Asztalok', icon: Armchair },
    { href: '/restaurant/staff', label: 'Munkatársak', icon: Users },
    { href: '/restaurant/schedule', label: 'Naptár', icon: CalendarRange },
    { href: '/restaurant/availability', label: 'Nyitvatartás', icon: Clock },
    { href: '/restaurant/tips', label: 'Funkciók', icon: SlidersHorizontal },
    { href: '/restaurant/settings', label: 'Beállítások', icon: Settings },
  ],
  publicUrlPrefix: '',
  settingsHref: '/restaurant/settings',
  subscriptionHref: '/restaurant/subscription',
}

// Backstage (admin) menüpontjai — a backstage UGYANAZT a DashboardNav layoutot
// kapja mint a szalon/étterem (egységes kinézet), nincs külön sidebar-komponense.
const backstageNav: NavConfig = {
  items: [
    { href: '/backstage', label: 'Áttekintő', icon: LayoutDashboard, exact: true },
    { href: '/backstage/salons', label: 'Helyek', icon: Store },
    { href: '/backstage/subscriptions', label: 'Előfizetések', icon: CreditCard },
    { href: '/backstage/revenue', label: 'Bevétel', icon: TrendingUp },
    { href: '/backstage/churn', label: 'Kockázat', icon: AlertTriangle },
    { href: '/backstage/activity', label: 'Aktivitás', icon: Activity },
    { href: '/backstage/settings', label: 'Beállítások', icon: Settings },
  ],
  publicUrlPrefix: '',
  settingsHref: '/backstage/settings',
  subscriptionHref: '/backstage/subscriptions',
}

export function getNavConfig(variant: DashboardVariant): NavConfig {
  if (variant === 'restaurant') return restaurantNav
  if (variant === 'backstage') return backstageNav
  return salonNav
}
