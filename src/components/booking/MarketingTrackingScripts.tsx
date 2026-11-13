'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '@/lib/motion'
import { Button } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { CookieBar, CookieChoices } from '@/components/blocks/consent'

const STORAGE_KEY = 'davelopment-cookie-consent'
/** A lábléc „Süti-beállítások” linkje ezzel nyitja a popupot (CookieFooterLink → `openCookieSettings`). */
export const COOKIE_SETTINGS_EVENT = 'davelopment:cookie-settings'
export const openCookieSettings = () => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))

/** A vállalkozók saját mérésére adott döntések, üzletenként (más adatkezelő → külön hozzájárulás): { 'salon:12': 'accepted' } */
const BIZ_KEY = 'davelopment-cookie-biz'
type Choice = 'accepted' | 'rejected' | 'unset'
const read = (): Choice => {
  try { const v = localStorage.getItem(STORAGE_KEY); return v === 'accepted' || v === 'rejected' ? v : 'unset' } catch { return 'unset' }
}
const readBiz = (key: string): Choice => {
  try { const v = (JSON.parse(localStorage.getItem(BIZ_KEY) ?? '{}') as Record<string, string>)[key]; return v === 'accepted' || v === 'rejected' ? v : 'unset' } catch { return 'unset' }
}
const writeBiz = (key: string, v: Choice) => {
  try { const m = JSON.parse(localStorage.getItem(BIZ_KEY) ?? '{}') as Record<string, string>; m[key] = v; localStorage.setItem(BIZ_KEY, JSON.stringify(m)) } catch { /* privát mód */ }
}

/**
 * Sütik a foglalóoldalon (design 21.14, élőben bővítve), két rétegben:
 *  1. a sáv: a landingével azonos általános szöveg, a süti-tájékoztató linkje, „Beállítások”, két egyforma gomb;
 *  2. a beállítások (popup, a lábléc „Süti-beállítások” linkje is ezt nyitja): kategóriánként, név szerint, külön
 *     kapcsolóval — a mi mérésünk (davelopment booking, Google Analytics — PlatformAnalytics, Consent Mode) és, ha
 *     beállította (Beállítások › Integrációk), a vállalkozóé (Google Analytics / Meta Pixel; adatkezelő a vállalkozó).
 * A sáv addig látszik, amíg bármelyikről nincs döntés (a landingen elfogadott mérés nem jelenti a vállalkozóét).
 * A vállalkozó szkriptjei csak az ő mérésének elfogadása után töltődnek be.
 * A `next.config.ts` CSP-je csak ezt a két konkrét domaint engedi, nem tetszőleges harmadik felet.
 */
export function MarketingTrackingScripts({ business, bizKey, ga4Id, facebookPixelId, privacyHref }: { business: string; bizKey: string; ga4Id?: string | null; facebookPixelId?: string | null; privacyHref?: string | null }) {
  const tools = [...(ga4Id ? ['ga4'] : []), ...(facebookPixelId ? ['pixel'] : [])]
  const hasBiz = tools.length > 0
  const [stats, setStats] = useState<Choice | 'checking'>('checking')
  const [biz, setBiz] = useState<Choice>('unset')
  const [open, setOpen] = useState(false)
  // a popup kapcsolói (mentésig csak itt)
  const [dStats, setDStats] = useState(false)
  const [dBiz, setDBiz] = useState(false)

  useEffect(() => {
    setStats(read()); setBiz(readBiz(bizKey))
  }, [bizKey])
  const openSettings = () => { setDStats(read() === 'accepted'); setDBiz(readBiz(bizKey) === 'accepted'); setOpen(true) }
  useEffect(() => {
    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings)
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  /** A döntés mentése: a mi mérésünk (közös kulcs — a PlatformAnalytics és a landing is ezt nézi) és a vállalkozóé (üzletenként). */
  function save(s: boolean, b: boolean) {
    const wasBiz = readBiz(bizKey)
    try { localStorage.setItem(STORAGE_KEY, s ? 'accepted' : 'rejected') } catch { /* privát mód — csak erre a látogatásra */ }
    setStats(s ? 'accepted' : 'rejected')
    if (hasBiz) { writeBiz(bizKey, b ? 'accepted' : 'rejected'); setBiz(b ? 'accepted' : 'rejected') }
    setOpen(false)
    // a vállalkozó már betöltött mérőkódjai visszavonáskor csak újratöltéssel tűnnek el (a miénket a Consent Mode kapcsolja)
    if (hasBiz && wasBiz === 'accepted' && !b) window.location.reload()
  }
  const pending = stats === 'unset' || (hasBiz && biz === 'unset')

  return (
    <>
      {hasBiz && biz === 'accepted' && (
        <>
          {ga4Id && (
            <>
              <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
              <Script id="ga4-init" strategy="afterInteractive">
                {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
              </Script>
            </>
          )}
          {facebookPixelId && (
            <Script id="fb-pixel-init" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${facebookPixelId}');
              fbq('track', 'PageView');`}
            </Script>
          )}
        </>
      )}

      {/* alul lebegő sötét sáv (design 21.14) — a két gomb egyforma */}
      <AnimatePresence>
        {stats !== 'checking' && pending && !open && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="fixed inset-x-0 bottom-0 z-[65] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <CookieBar className="mx-auto max-w-[760px]" business={business} tools={tools} platform
              onAccept={() => save(true, true)} onReject={() => save(false, false)} onDetails={openSettings} />
          </motion.div>
        )}
      </AnimatePresence>

      <PopupModal open={open} onClose={() => setOpen(false)} title="Süti-beállítások" subtitle={`${business} foglalóoldala`} maxWidth="sm:max-w-[440px]"
        // az elutasítás ugyanolyan könnyű és hangsúlyos, mint az elfogadás (GDPR / NMHH-ajánlás): két egyforma gomb + a mentés
        footer={<div className="w-full space-y-1.5">
          <div className="flex gap-1.5">
            <Button variant="dark" className="flex-1" onClick={() => save(false, false)}>Mindet elutasítom</Button>
            <Button variant="dark" className="flex-1" onClick={() => save(true, true)}>Mindet elfogadom</Button>
          </div>
          <Button variant="cell" className="w-full" onClick={() => save(dStats, dBiz)}>Kiválasztottak mentése</Button>
        </div>}>
        <CookieChoices business={business} tools={tools} stats={dStats} onStats={setDStats} biz={dBiz} onBiz={setDBiz} bizPrivacyHref={privacyHref ?? undefined} />
      </PopupModal>
    </>
  )
}
