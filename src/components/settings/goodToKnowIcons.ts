import {
  Info, Clock, CalendarClock, Phone, Car, CreditCard, Dog, Baby, Cake,
  Wine, Cigarette, Accessibility, Wifi, MapPin, Users, AlertCircle,
  type LucideIcon,
} from 'lucide-react'

/** Választható „Jó tudni" ikonok (kulcs → lucide ikon + magyar címke). A séma a
 *  kulcsot tárolja (`good_to_know[].icon`), a szerkesztő és a landing innen oldja fel. */
export const GOOD_TO_KNOW_ICONS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'info', label: 'Infó', icon: Info },
  { key: 'clock', label: 'Idő', icon: Clock },
  { key: 'calendar', label: 'Naptár', icon: CalendarClock },
  { key: 'phone', label: 'Telefon', icon: Phone },
  { key: 'car', label: 'Parkolás', icon: Car },
  { key: 'card', label: 'Fizetés', icon: CreditCard },
  { key: 'dog', label: 'Kisállat', icon: Dog },
  { key: 'baby', label: 'Gyerek', icon: Baby },
  { key: 'cake', label: 'Szülinap', icon: Cake },
  { key: 'wine', label: 'Ital', icon: Wine },
  { key: 'smoking', label: 'Dohányzás', icon: Cigarette },
  { key: 'accessibility', label: 'Akadálymentes', icon: Accessibility },
  { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { key: 'location', label: 'Helyszín', icon: MapPin },
  { key: 'group', label: 'Társaság', icon: Users },
  { key: 'warning', label: 'Figyelem', icon: AlertCircle },
]

/** Ikon-kulcsból lucide komponens; ismeretlen/üres esetén az Info az alapértelmezett. */
export function iconByKey(key?: string | null): LucideIcon {
  return GOOD_TO_KNOW_ICONS.find((i) => i.key === key)?.icon ?? Info
}
