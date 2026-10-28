import {
  Cake, Heart, Briefcase, Wine, Users, PartyPopper, Sparkles, Gem, GlassWater, CalendarHeart,
  type LucideIcon,
} from 'lucide-react'

/**
 * Esemény-típus (alkalom) ikonok — kulcs → lucide ikon + magyar címke. A séma az `icon`
 * kulcsot tárolja (Restaurants.event_types[].icon és Reservation.occasion_icon), a
 * szerkesztő, a foglaló és a nézetek innen oldják fel. A `good_to_know` mintáját követi.
 */
export const EVENT_TYPE_ICONS: { key: string; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'cake', label: 'Születésnap', icon: Cake, color: '#DB4F94' },
  { key: 'anniversary', label: 'Évforduló', icon: CalendarHeart, color: '#D2433A' },
  { key: 'business', label: 'Céges vacsora', icon: Briefcase, color: '#3A6BD4' },
  { key: 'date', label: 'Randi', icon: Heart, color: '#A44FC4' },
  { key: 'family', label: 'Családi esemény', icon: Users, color: '#2C8F63' },
  { key: 'friends', label: 'Baráti összejövetel', icon: GlassWater, color: '#1C97A8' },
  { key: 'party', label: 'Legénybúcsú / lánybúcsú', icon: PartyPopper, color: '#E07B1F' },
  { key: 'celebration', label: 'Ünnepség', icon: Sparkles, color: '#B8900F' },
  { key: 'engagement', label: 'Eljegyzés', icon: Gem, color: '#5E54CF' },
  { key: 'drinks', label: 'Italozás', icon: Wine, color: '#8A5A3A' },
]

/** Ikon-kulcsból lucide komponens; ismeretlen/üres esetén a PartyPopper az alapértelmezett. */
export function eventIconByKey(key?: string | null): LucideIcon {
  return EVENT_TYPE_ICONS.find((i) => i.key === key)?.icon ?? PartyPopper
}

/** Alkalom saját színe (tömör jelvény-háttér fehér ikonnal, ill. halvány chiphez `${c}1f`).
 *  Ismeretlen kulcsnál az arany marad. */
export function eventColorByKey(key?: string | null): string {
  return EVENT_TYPE_ICONS.find((i) => i.key === key)?.color ?? '#B8900F'
}

/** Az étterem alap esemény-készlete (ha a tulaj nem állított be sajátot). */
export const DEFAULT_EVENT_TYPES: { icon: string; label: string; enabled: boolean }[] =
  EVENT_TYPE_ICONS.filter((i) => i.key !== 'drinks').map((i) => ({ icon: i.key, label: i.label, enabled: true }))
