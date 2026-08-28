'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

const STORAGE_KEY = 'davelopment-cookie-consent'
const GA4_ID = 'G-NE18MQT41F'
// A Google Ads saját címkéje — külön ID a GA4-es mérőkódtól, de ugyanabból a betöltött
// gtag.js-ből mehet egy második `gtag('config', ...)` hívással. Enélkül a Google Ads
// konverziós céljai (ads_conversion_*) nem tudnak elsülni, mert nem találja a saját címkéjét.
const ADS_ID = 'G-MXYSTX2XXK'

/**
 * A davelopment booking platform saját (nem üzletenkénti) Google Analytics + Google Ads
 * mérőkódja — az egész oldalon fut (landing, auth, dashboard, publikus foglaló oldalak), a
 * `CookieBanner`/`MarketingTrackingScripts` által már használt ugyanazon süti-hozzájárulási
 * localStorage-kulcsot nézi, hogy a betöltés GDPR-konform maradjon (elutasítás/döntés-hiány
 * esetén nem tölt).
 */
export function PlatformAnalytics() {
  const [consent, setConsent] = useState<'accepted' | 'rejected' | 'unset'>('unset')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setConsent(stored === 'accepted' || stored === 'rejected' ? stored : 'unset')
    // Ha a user a jelen betöltés UTÁN dönt a bannerben, egy oldal-újratöltés nélkül is
    // elinduljon a mérés — a banner-gombok ugyanezt a kulcsot írják localStorage-be.
    const onStorage = () => {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'accepted' || v === 'rejected') setConsent(v)
    }
    window.addEventListener('storage', onStorage)
    const interval = setInterval(onStorage, 1000)
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval) }
  }, [])

  if (consent !== 'accepted') return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} strategy="afterInteractive" />
      <Script id="platform-ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');gtag('config','${ADS_ID}');`}
      </Script>
    </>
  )
}
