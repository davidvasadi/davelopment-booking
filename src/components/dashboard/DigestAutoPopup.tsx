'use client'

import { useEffect, useState } from 'react'
import { useNotifications, type Notification } from '@/lib/useNotifications'
import { DigestSheet } from './DigestSheet'

/** A digest-kártyák (UserMenu dropdown / NotificationsPage) ezt az eseményt dobják kattintáskor
 *  — a `detail` a `Notification` objektum. A `DigestAutoPopup` egyetlen, központi DigestSheet-
 *  mountja nyitja meg, NEM a kártya saját, beágyazott portálja (az volt a megbízhatatlanul
 *  megnyíló sheet oka — beágyazott `createPortal` egy MÁR portált popover-fán belül). */
export const OPEN_DIGEST_EVENT = 'davelopment:open-digest'

/**
 * Egyetlen, app-keret-szintű (`AppShell`) `DigestSheet`-mount — ez nyitja meg mind az „ÉPP MOST
 * érkezett" auto-popupot, MIND a kártyáról kézzel kattintott digestet. Függetlenül attól, hogy
 * a UserMenu dropdown nyitva van-e, vagy melyik oldalon állsz.
 *
 * SZÁNDÉKOSAN nem a `UserMenu`-ben él: a `UserMenu` egy adott oldalon EGYSZERRE TÖBBSZÖR is
 * mountolva van (mobil-fejléces `DashboardNav` + desktop `AppNavbar`, csak CSS-sel elrejtve
 * viewport szerint — mindkettő a DOM-ban van). Ott próbálva a logikát két független
 * `useNotifications()`-pollozás versenyzett egymással, ezért volt kiszámíthatatlan (néha
 * lemaradt a popup, csak oldalfrissítés után látszott). Itt, az `AppShell`-ben EGYSZER
 * mountolva nincs ilyen verseny.
 */
export function DigestAutoPopup() {
  const { markRead, newDigest, clearNewDigest } = useNotifications()

  useEffect(() => {
    if (newDigest && !newDigest.read) markRead(newDigest.id)
  }, [newDigest, markRead])

  const [manualDigest, setManualDigest] = useState<Notification | null>(null)
  useEffect(() => {
    const handler = (e: Event) => setManualDigest((e as CustomEvent<Notification>).detail)
    window.addEventListener(OPEN_DIGEST_EVENT, handler)
    return () => window.removeEventListener(OPEN_DIGEST_EVENT, handler)
  }, [])

  const active = manualDigest ?? newDigest
  if (!active) return null
  return (
    <DigestSheet
      n={active}
      open
      onClose={() => { setManualDigest(null); clearNewDigest() }}
    />
  )
}
