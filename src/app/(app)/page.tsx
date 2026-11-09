import type { Metadata } from 'next'
import { getPricing } from '@/lib/pricing'
import { siteJsonLd } from '@/lib/publicSeo'
import HomeClient from './HomeClient'

// A homepage addig statikusan prerendelt volt build-időben — a cron-cache-elt
// Google-értékelés (lásd src/lib/google-rating.ts) így csak egy új deployig
// változott volna, nem a napi cron-frissítéskor. Óránkénti ISR-revalidáció
// elég a naponta egyszer frissülő adathoz, full force-dynamic nélkül.
export const revalidate = 3600

export const metadata: Metadata = {
  title: '[davelopment]© Booking — Online Időpontfoglaló Rendszer',
  description:
    'Online időpontfoglaló rendszer szakembereknek és szolgáltató vállalkozásoknak — szépségszalonoktól az étteremig. Próbáld ki ingyen, kártya nélkül.',
  keywords: [
    'online időpontfoglaló',
    'időpontfoglaló rendszer',
    'foglalási rendszer',
    'étterem foglaló',
    'fodrász foglalás',
    'szépségszalon időpontfoglaló',
    'köröm szalon foglaló',
    'masszázs foglalás',
    'kis vállalkozás foglaló',
    'davelopment booking',
  ],
  openGraph: {
    title: '[davelopment]© Booking — Online Időpontfoglaló Rendszer',
    description:
      'Egyszerű, modern online időpontfoglaló rendszer kis vállalkozásoknak. Próbáld ki ingyen — bankkártya sem kell.',
    url: '/',
    siteName: 'davelopment booking',
    locale: 'hu_HU',
    type: 'website',
    images: [
      {
        url: '/api/og/landing',
        width: 1200,
        height: 630,
        alt: 'davelopment booking',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '[davelopment]© Booking — Online Időpontfoglaló Rendszer',
    description:
      'Egyszerű, modern online időpontfoglaló rendszer kis vállalkozásoknak. Próbáld ki ingyen.',
    images: ['/api/og/landing'],
  },
  alternates: {
    canonical: '/',
  },
}

export default async function Home() {
  const pricing = await getPricing()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd(pricing)) }}
      />
      <HomeClient pricing={pricing} />
    </>
  )
}
