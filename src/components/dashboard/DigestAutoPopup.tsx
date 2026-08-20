'use client'

import { useEffect } from 'react'
import { useNotifications } from '@/lib/useNotifications'
import { DigestSheet } from './DigestSheet'

/**
 * Egyetlen, app-keret-szintű (`AppShell`) előfizetés az „ÉPP MOST érkezett" reggeli/esti
 * digestre — automatikusan felugrik a `DigestSheet`, függetlenül attól, hogy a UserMenu
 * dropdown nyitva van-e, vagy melyik oldalon állsz.
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

  if (!newDigest) return null
  return <DigestSheet n={newDigest} open onClose={clearNewDigest} />
}
