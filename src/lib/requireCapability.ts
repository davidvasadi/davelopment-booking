import { redirect } from 'next/navigation'
import { can, type Capability } from './permissions'

/**
 * Szerver-oldali jogosultság-kapu az oldalakhoz (C2). Ha a hatékony képesség-halmaz NEM
 * tartalmazza a képességet, átirányít (alapból az adott modul áttekintőjére).
 * A nav-elrejtés (C1) csak UX; ez állítja meg az URL-re gépelést is.
 *
 * Használat a page.tsx elején, a getOwnedSalon/Restaurant után:
 *   requireCapability(capabilities, 'analytics.view', '/restaurant')
 */
export function requireCapability(
  caps: Capability[] | null | undefined,
  capability: Capability,
  fallback: string,
): void {
  if (!can(caps, capability)) redirect(fallback)
}
