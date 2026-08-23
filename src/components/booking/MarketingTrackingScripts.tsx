import Script from 'next/script'

/**
 * Google Analytics 4 + Facebook (Meta) Pixel betöltése a publikus foglaló oldalon — csak akkor,
 * ha az adott azonosító be van állítva (Beállítások → Integrációk → Marketing-követés).
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
  return (
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
  )
}
