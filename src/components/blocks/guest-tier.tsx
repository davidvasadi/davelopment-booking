import { Star } from 'lucide-react'
import { Pill } from '@/components/ui-kit'

/** A vendég szintje egy pillben — mindenhol ugyanígy (Vendégek lista, vendég-kártya, a foglalás lapja):
 *  Új sárga · Visszatérő sötét (fehér betű) · Törzsvendég sötét + kitöltött sárga csillag (az „extra”).
 *  `children`: saját felirat (pl. „Törzsvendég · 9. alkalom”), különben a szint neve. Kis, önálló fájl — nehéz blokkokat nem húz be. */
export type GuestTierLevel = 1 | 2 | 3
export const GUEST_TIER_LABEL: Record<GuestTierLevel, string> = { 1: 'Új', 2: 'Visszatérő', 3: 'Törzsvendég' }
export const guestTierOf = (visits: number): GuestTierLevel => (visits >= 4 ? 3 : visits >= 2 ? 2 : 1)

export function GuestTierPill({ tier, children, className }: { tier: GuestTierLevel; children?: React.ReactNode; className?: string }) {
  return (
    <Pill size="sm" tone={tier === 1 ? 'yellow' : 'dark'} className={className}>
      {tier === 3 && <Star className="h-3.5 w-3.5 shrink-0 fill-ui-yellow text-ui-yellow" strokeWidth={1.8} />}
      {children ?? GUEST_TIER_LABEL[tier]}
    </Pill>
  )
}
