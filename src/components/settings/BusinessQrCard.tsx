'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { BusinessQr, QrPrintSheet, type QrHoursRow } from '@/components/blocks/qr'
import { detectPlatform, socialHandle } from '@/lib/socialLinks'

/**
 * A foglalóoldal QR-kódja (design 16.11) élőben: a szerkesztő adataiból (név, logó, nyitvatartás, közösségi linkek).
 * Letöltés: 1024 px-es PNG, a logóval középen (H-szintű hibajavítás). Nyomtatás: ugyanaz az A5-ös lap, mint a
 * design mintája (`QrPrintSheet print`), a böngésző nyomtatásával — a lapon kívül semmi sem nyomtatódik.
 * Teljesen kliens-oldali, nem tárol semmit.
 */
export function BusinessQrCard({ url, businessName, subtitle, logoUrl = null, hours = [], socialLinks = [], preview = false }: {
  url: string; businessName: string; subtitle: string; logoUrl?: string | null; hours?: QrHoursRow[]; socialLinks?: string[]
  /** mellette a nyomtatott lap élő előnézete (a felugró ablakban) */
  preview?: boolean
}) {
  const [withHours, setWithHours] = useState(true)
  const [withSocials, setWithSocials] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(false)
  const socials = socialLinks.filter((u) => u.trim()).map((u) => ({ platform: detectPlatform(u), handle: socialHandle(u) }))
  // relatív URL-ből (az origin még nem töltődött be) ne készüljön beolvashatatlan QR
  const ready = /^https?:\/\//.test(url)

  const download = async () => {
    if (!ready) return
    setBusy(true)
    try {
      const size = 1024
      const canvas = document.createElement('canvas')
      await QRCode.toCanvas(canvas, url, { width: size, margin: 2, errorCorrectionLevel: logoUrl ? 'H' : 'M', color: { dark: '#1D1C19', light: '#FFFFFF' } })
      let out = canvas.toDataURL('image/png')
      if (logoUrl) {
        try {
          const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = logoUrl })
          const ctx = canvas.getContext('2d')!
          const box = size * 0.24, pad = box * 0.12, x = (size - box) / 2
          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath(); ctx.roundRect(x, x, box, box, box * 0.16); ctx.fill()
          const inner = box - pad * 2, r = Math.min(inner / img.width, inner / img.height)
          const w = img.width * r, h = img.height * r
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
          out = canvas.toDataURL('image/png')
        } catch { /* a logó nem tölthető be (pl. más domainről CORS nélkül) → a QR logó nélkül */ }
      }
      const a = document.createElement('a')
      a.href = out
      a.download = `${businessName || 'foglalas'}-qr.png`.replace(/[^\p{L}\p{N}._-]+/gu, '-')
      a.click()
    } catch { toast.error('A QR-kód nem készült el') } finally { setBusy(false) }
  }

  const print = () => {
    if (!ready) return
    setPrinting(true)
    const done = () => { setPrinting(false); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    // a lap kirajzolódik (és a logó betölt), utána nyomtatunk
    setTimeout(() => window.print(), 300)
  }

  return (
    <div className={preview ? 'grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_260px]' : ''}>
      <BusinessQr url={ready ? url : 'https://booking.davelopment.hu'} logo={logoUrl}
        hours={withHours} onHours={setWithHours} hasHours={hours.length > 0}
        socials={withSocials} onSocials={setWithSocials} hasSocials={socials.length > 0}
        onDownload={() => void download()} onPrint={print} busy={busy || !ready} withPreview={preview} />
      {/* mobilon az előnézet kerül felülre (ez az egy QR-kód), alatta a jelölők és a gombok */}
      {preview && <QrPrintSheet className="mx-auto max-md:order-first" name={businessName} subtitle={subtitle} url={ready ? url : 'https://booking.davelopment.hu'} logo={logoUrl} hours={withHours ? hours : []} socials={withSocials ? socials : []} />}
      {printing && createPortal(
        <div id="qr-print-sheet">
          <style>{`@page { size: A5; margin: 0 } @media screen { #qr-print-sheet { position: fixed; left: -10000px; top: 0 } } @media print { body > *:not(#qr-print-sheet) { display: none !important } #qr-print-sheet { position: static; -webkit-print-color-adjust: exact; print-color-adjust: exact } html, body { background: #fff !important } }`}</style>
          <QrPrintSheet print name={businessName} subtitle={subtitle} url={url} logo={logoUrl}
            hours={withHours ? hours : []} socials={withSocials ? socials : []} />
        </div>,
        document.body,
      )}
    </div>
  )
}
