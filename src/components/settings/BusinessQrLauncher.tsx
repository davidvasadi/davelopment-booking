'use client'

import { useState } from 'react'
import { PopupModal } from '@/components/ui/popup-modal'
import { QrLaunchCard, QrLaunchRow } from '@/components/blocks/settings'
import { BusinessQrCard } from './BusinessQrCard'
import type { QrHoursRow } from '@/components/blocks/qr'

/** A foglalóoldal QR-kódja egy sorként (Foglalóoldal-szerkesztő › Link & QR, Beállítások › Integrációk) — kattintásra
 *  felugró ablakban a teljes kezelő: előnézet, mi kerüljön a lapra, letöltés, nyomtatás, a nyomtatott lap előnézete. */
export function BusinessQrLauncher({ url, businessName, restaurant = false, logoUrl = null, hours = [], socialLinks = [], className, variant = 'row' }: {
  url: string; businessName: string; restaurant?: boolean; logoUrl?: string | null; hours?: QrHoursRow[]; socialLinks?: string[]; className?: string
  /** `row`: sor a szerkesztő paneljében; `card`: kártya a jobb oszlopban (Integrációk) */
  variant?: 'row' | 'card'
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'card' ? <QrLaunchCard onOpen={() => setOpen(true)} className={className} /> : <QrLaunchRow onOpen={() => setOpen(true)} className={className} />}
      <PopupModal open={open} onClose={() => setOpen(false)} title="QR-kód a foglalóoldalhoz" subtitle="Pult, kirakat, névjegy, szórólap — beolvasva a foglalóoldal nyílik meg." maxWidth="sm:max-w-[860px]">
        <BusinessQrCard preview url={url} businessName={businessName} subtitle={restaurant ? 'Foglalj asztalt online' : 'Foglalj időpontot online'} logoUrl={logoUrl} hours={hours} socialLinks={socialLinks} />
      </PopupModal>
    </>
  )
}
