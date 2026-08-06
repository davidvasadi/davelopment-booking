import type { Metadata } from 'next'
import { getPricing } from '@/lib/pricing'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  title: '[davelopment]® Booking — Online Időpontfoglaló Rendszer',
  description:
    'Egyszerű, modern online időpontfoglaló rendszer éttermeknek, fodrászatoknak és szépségszalonoknak. Hagyd, hogy ügyfeleid maguk foglaljanak — te csak a munkádra figyelj. Próbáld ki ingyen.',
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
    title: '[davelopment]® Booking — Online Időpontfoglaló Rendszer',
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
    title: '[davelopment]® Booking — Online Időpontfoglaló Rendszer',
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
  return <HomeClient pricing={pricing} />
}
