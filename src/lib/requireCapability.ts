import { redirect } from 'next/navigation'
import { can, type Capability } from './permissions'

/**
 * Szerver-oldali jogosultság-kapu az oldalakhoz (C2). Ha a hatékony képesség-halmaz NEM
 * tartalmazza EGYIKET SEM a listából, átirányít (alapból az adott modul áttekintőjére).
 * A nav-elrejtés (C1) csak UX; ez állítja meg az URL-re gépelést is.
 *
 * MINDIG az `X.view`/`X.manage` PÁRT add át (OR logika), még akkor is, ha az oldal csak
 * `.view`-t vár — a `.manage` NEM implikálja automatikusan a `.view`-t a `can()`-ban, egy
 * kizárólag `.manage`-es szerep egyetlen `.view`-ra szűkített kapun elakadt volna.
 *
 * Használat a page.tsx elején, a getOwnedSalon/Restaurant után:
 *   requireAnyCapability(capabilities, ['analytics.view', 'analytics.view.own'], '/restaurant')
 */
export function requireAnyCapability(
  caps: Capability[] | null | undefined,
  anyOf: Capability[],
  fallback: string,
): void {
  if (!anyOf.some((c) => can(caps, c))) redirect(fallback)
}
