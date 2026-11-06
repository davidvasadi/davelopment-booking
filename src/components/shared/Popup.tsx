'use client'

import { PopupModal } from '@/components/ui/popup-modal'

/** Egy kész ablak (a kit Modal-ja / Panel-je, pl. a vendég-szerkesztő blokk) megnyitása az egységes felugró ablakkal —
 *  ugyanaz a háttér, animáció és mobil-lap, mint az Új foglalásnál; Esc és a háttérre kattintás zárja. */
export function Popup({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return <PopupModal open onClose={onClose} panel={children} />
}
