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

/** Átirányít, ha a listán szereplő képességek EGYIKE SEM megvan. (OR logika) */
export function requireAnyCapability(
  caps: Capability[] | null | undefined,
  anyOf: Capability[],
  fallback: string,
): void {
  if (!anyOf.some((c) => can(caps, c))) redirect(fallback)
}
