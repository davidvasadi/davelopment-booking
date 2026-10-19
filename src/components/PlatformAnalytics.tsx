'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

const STORAGE_KEY = 'davelopment-cookie-consent'
const GA4_ID = 'G-HGW3Y9FV95'
// EGT (EU + Izland, Liechtenstein, Norvégia) + UK/Svájc — csak ezekben a régiókban kell a
// szigorú "denied" alapértelmezés induláskor; máshol (pl. USA) nem vonatkozik rájuk a GDPR,
// ott a mérés alapból mehet, különben feleslegesen nullázódik a konverziókövetés.
const EEA_REGION_CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
]
// A Google Ads saját címkéje — amíg nincs kész a dedikált, új Ads-fiók/konverziós azonosító
// (a régi, hello.davelopment@gmail.com alatti Google-fiók letiltása miatt), ideiglenesen a
// GA4-mérőkóddal egyezik meg.
const ADS_ID = GA4_ID

/**
 * A davelopment booking platform saját (nem üzletenkénti) Google Analytics + Google Ads
 * mérőkódja — Google hivatalos "Consent Mode" mintáját követi.
 *
 * A címke MINDIG betöltődik minden oldalon (különben Google saját ellenőrző eszközei nem
 * találják meg — a süti-elfogadás előtti feltételes betöltés miatt korábban ezt írta ki a
 * Google Ads: "A rendszer nem észlelte a Google-címkét"). GDPR-konform marad, mert a
 * betöltéskor AZONNAL, a `gtag('js', ...)`/`config` hívások ELŐTT `gtag('consent','default',
 * {...denied, region: EEA_REGION_CODES})`-et küldünk — de ez a szigorú letiltás CSAK az
 * EGT-re (+UK/Svájc) vonatkozik, mert e nélkül a `region` megkötés nélkül korábban MINDEN
 * látogatóra (EGT-n kívülire is) alapból letiltva indult a mérés, és mivel a legtöbb
 * látogató soha nem kattint a banner egyik gombjára sem, ez a "denied" állapot örökre
 * megmaradt — ez okozta a GA4 "0%-os beleegyezési arány" figyelmeztetését. Az EGT-n kívüli
 * látogatóknál a mérés alapból mehet (granted). A user tényleges elfogadásakor/elutasításakor
 * kapcsol a tényleges döntésre (`gtag('consent','update',...)`). A `CookieBanner`/
 * `MarketingTrackingScripts` által már használt ugyanazon localStorage-kulcsot nézi.
 */
export function PlatformAnalytics() {
  const [consent, setConsent] = useState<'accepted' | 'rejected' | 'unset'>('unset')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setConsent(stored === 'accepted' || stored === 'rejected' ? stored : 'unset')
    // Ha a user a jelen betöltés UTÁN dönt a bannerben, egy oldal-újratöltés nélkül is
    // frissüljön a Consent Mode állapota — a banner-gombok ugyanezt a kulcsot írják.
    const onStorage = () => {
      const v = localStorage.getItem(STORAGE_KEY)
      if (v === 'accepted' || v === 'rejected') setConsent(v)
    }
    window.addEventListener('storage', onStorage)
    const interval = setInterval(onStorage, 1000)
    return () => { window.removeEventListener('storage', onStorage); clearInterval(interval) }
  }, [])

  // A user döntésének (vagy változásának) valós idejű átadása a már betöltött gtag-nek.
  useEffect(() => {
    if (consent === 'unset') return
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof gtag !== 'function') return
    gtag('consent', 'update', {
      ad_storage: consent === 'accepted' ? 'granted' : 'denied',
      analytics_storage: consent === 'accepted' ? 'granted' : 'denied',
      ad_user_data: consent === 'accepted' ? 'granted' : 'denied',
      ad_personalization: consent === 'accepted' ? 'granted' : 'denied',
    })
  }, [consent])

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`} strategy="afterInteractive" />
      <Script id="platform-ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}` +
          `gtag('consent','default',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});` +
          `gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',region:${JSON.stringify(EEA_REGION_CODES)}});` +
          `gtag('js',new Date());gtag('config','${GA4_ID}');gtag('config','${ADS_ID}');`}
      </Script>
    </>
  )
}
