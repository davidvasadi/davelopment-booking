import {
  LayoutDashboard, CalendarDays, CalendarRange, Briefcase, Users, Clock, Settings, BarChart2, Armchair, Lightbulb, HelpCircle, MapPin,
  Store, CreditCard, TrendingUp, AlertTriangle, Activity, Building2,
  type LucideIcon,
} from 'lucide-react'
import { can, type Capability } from '@/lib/permissions'

/** `capability`: a menüpont megtekintéséhez szükséges jog. Ha nincs megadva → mindenki látja. */
export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; capability?: Capability }

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
    { href: '/dashboard', label: 'Áttekintés', icon: LayoutDashboard, exact: true, capability: 'overview.view' },
    { href: '/dashboard/analytics', label: 'Statisztikák', icon: BarChart2, capability: 'analytics.view' },
    { href: '/dashboard/bookings', label: 'Foglalások', icon: CalendarDays, capability: 'bookings.view' },
    { href: '/dashboard/guests', label: 'Vendégek', icon: MapPin, capability: 'guests.view' },
    { href: '/dashboard/services', label: 'Szolgáltatások', icon: Briefcase, capability: 'catalog.view' },
    { href: '/dashboard/staff', label: 'Munkatársak', icon: Users, capability: 'staff.view' },
    { href: '/dashboard/schedule', label: 'Naptár', icon: CalendarRange, capability: 'schedule.manage' },
    { href: '/dashboard/availability', label: 'Nyitvatartás', icon: Clock, capability: 'settings.profile' },
    { href: '/dashboard/tips', label: 'Tippek', icon: Lightbulb, capability: 'analytics.view' },
    { href: '/dashboard/help', label: 'Súgó', icon: HelpCircle },
    { href: '/dashboard/settings', label: 'Beállítások', icon: Settings, capability: 'settings.profile' },
  ],
  publicUrlPrefix: '',
  settingsHref: '/dashboard/settings',
  subscriptionHref: '/dashboard/subscription',
}

const restaurantNav: NavConfig = {
  items: [
    { href: '/restaurant', label: 'Áttekintés', icon: LayoutDashboard, exact: true, capability: 'overview.view' },
    { href: '/restaurant/analytics', label: 'Statisztikák', icon: BarChart2, capability: 'analytics.view' },
    { href: '/restaurant/bookings', label: 'Foglalások', icon: CalendarDays, capability: 'bookings.view' },
    { href: '/restaurant/guests', label: 'Vendégek', icon: MapPin, capability: 'guests.view' },
    { href: '/restaurant/tables', label: 'Asztalok', icon: Armchair, capability: 'catalog.view' },
    { href: '/restaurant/staff', label: 'Munkatársak', icon: Users, capability: 'staff.view' },
    { href: '/restaurant/schedule', label: 'Naptár', icon: CalendarRange, capability: 'schedule.manage' },
    { href: '/restaurant/availability', label: 'Nyitvatartás', icon: Clock, capability: 'settings.profile' },
    { href: '/restaurant/tips', label: 'Tippek', icon: Lightbulb, capability: 'analytics.view' },
    { href: '/restaurant/help', label: 'Súgó', icon: HelpCircle },
    { href: '/restaurant/settings', label: 'Beállítások', icon: Settings, capability: 'settings.profile' },
  ],
  publicUrlPrefix: '',
  settingsHref: '/restaurant/settings',
  subscriptionHref: '/restaurant/subscription',
}

// Backstage (admin) menüpontjai — a backstage UGYANAZT a DashboardNav layoutot
// kapja mint a szalon/étterem (egységes kinézet), nincs külön sidebar-komponense.
const backstageNav: NavConfig = {
  items: [
    // Az első 4 a felső pill-navba kerül (AppNavbar PRIMARY_MAX), a többi a „Több"
    // legördülőbe — ezért a legfontosabb üzemeltetői nézetek állnak elöl.
    { href: '/backstage', label: 'Áttekintő', icon: LayoutDashboard, exact: true },
    { href: '/backstage/accounts', label: 'Előfizetők', icon: Users },
    { href: '/backstage/revenue', label: 'Bevétel', icon: TrendingUp },
    { href: '/backstage/churn', label: 'Kockázat', icon: AlertTriangle },
    { href: '/backstage/salons', label: 'Helyek', icon: Building2 },
    { href: '/backstage/subscriptions', label: 'Előfizetések', icon: CreditCard },
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

/**
 * A hatékony képesség-halmaz által LÁTHATÓ menüpontok. A backstage (admin) mindent lát.
 * A capability nélküli itemek mindenkinek látszanak; a többit a `can(caps, cap)` dönti el.
 */
export function navItemsForCapabilities(variant: DashboardVariant, caps: Capability[] | null | undefined): NavItem[] {
  const { items } = getNavConfig(variant)
  if (variant === 'backstage') return items
  return items.filter((it) => !it.capability || can(caps, it.capability))
}
