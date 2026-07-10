import {
  Cake, Heart, Briefcase, Wine, Users, PartyPopper, Sparkles, Gem, GlassWater, CalendarHeart,
  type LucideIcon,
} from 'lucide-react'

/**
 * Esemény-típus (alkalom) ikonok — kulcs → lucide ikon + magyar címke. A séma az `icon`
 * kulcsot tárolja (Restaurants.event_types[].icon és Reservation.occasion_icon), a
 * szerkesztő, a foglaló és a nézetek innen oldják fel. A `good_to_know` mintáját követi.
 */
export const EVENT_TYPE_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'cake', label: 'Születésnap', icon: Cake },
  { key: 'anniversary', label: 'Évforduló', icon: CalendarHeart },
  { key: 'business', label: 'Céges vacsora', icon: Briefcase },
  { key: 'date', label: 'Randi', icon: Heart },
  { key: 'family', label: 'Családi esemény', icon: Users },
  { key: 'friends', label: 'Baráti összejövetel', icon: GlassWater },
  { key: 'party', label: 'Legénybúcsú / lánybúcsú', icon: PartyPopper },
  { key: 'celebration', label: 'Ünnepség', icon: Sparkles },
  { key: 'engagement', label: 'Eljegyzés', icon: Gem },
  { key: 'drinks', label: 'Italozás', icon: Wine },
]

/** Ikon-kulcsból lucide komponens; ismeretlen/üres esetén a PartyPopper az alapértelmezett. */
export function eventIconByKey(key?: string | null): LucideIcon {
  return EVENT_TYPE_ICONS.find((i) => i.key === key)?.icon ?? PartyPopper
}

/** Az étterem alap esemény-készlete (ha a tulaj nem állított be sajátot). */
export const DEFAULT_EVENT_TYPES: { icon: string; label: string; enabled: boolean }[] =
  EVENT_TYPE_ICONS.filter((i) => i.key !== 'drinks').map((i) => ({ icon: i.key, label: i.label, enabled: true }))
