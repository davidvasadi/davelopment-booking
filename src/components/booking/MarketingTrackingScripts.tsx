'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from '@/lib/motion'

const STORAGE_KEY = 'davelopment-cookie-consent'

/**
 * Google Analytics 4 + Facebook (Meta) Pixel betöltése a publikus foglaló oldalon — csak akkor,
 * ha az adott azonosító be van állítva (Beállítások → Integrációk → Marketing-követés) ÉS a
 * vendég elfogadta a sütiket. Amíg nincs döntés, egy diszkrét sáv kéri a hozzájárulást — a
 * szkriptek addig NEM töltődnek be. Ugyanazt a localStorage-kulcsot használja, mint a landing
 * oldal `CookieBanner`-je, mivel ugyanarról a domainről, ugyanarról a döntésről van szó.
 * Szándékosan NEM teljes Google Tag Manager (ld. FUTURE-FEATURES.md 6. pont) — a
 * `next.config.ts` CSP-je ezt a két konkrét domaint engedi, nem tetszőleges harmadik felet.
 */
export function MarketingTrackingScripts({
  ga4Id,
  facebookPixelId,
}: {
  ga4Id?: string | null
  facebookPixelId?: string | null
}) {
  const hasTracking = !!(ga4Id || facebookPixelId)
  const [consent, setConsent] = useState<'accepted' | 'rejected' | 'unset' | 'checking'>('checking')

  useEffect(() => {
    if (!hasTracking) return
    const stored = localStorage.getItem(STORAGE_KEY)
    setConsent(stored === 'accepted' || stored === 'rejected' ? stored : 'unset')
  }, [hasTracking])

  function decide(value: 'accepted' | 'rejected') {
    localStorage.setItem(STORAGE_KEY, value)
    setConsent(value)
  }

  if (!hasTracking) return null

  return (
    <>
      {consent === 'accepted' && (
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

      <AnimatePresence>
        {consent === 'unset' && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="fixed inset-x-0 top-0 z-[65]"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div
              className="flex flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-center"
              style={{ background: 'rgba(22,22,26,0.94)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}
            >
              <p className="text-center text-[12.5px] leading-relaxed text-white/70 sm:text-left">
                Sütiket használunk a látogatottság méréséhez.{' '}
                <Link href="/cookies" className="font-semibold text-white underline underline-offset-2 hover:text-gold transition-colors">
                  Süti-tájékoztató
                </Link>
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => decide('rejected')}
                  className="h-9 px-3.5 rounded-full text-[12.5px] font-semibold text-white/55 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  Elutasítom
                </button>
                <button
                  type="button"
                  onClick={() => decide('accepted')}
                  className="h-9 px-4 rounded-full text-[12.5px] font-semibold text-ink-dark transition hover:brightness-105"
                  style={{ background: '#FFD85F' }}
                >
                  Elfogadom
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
