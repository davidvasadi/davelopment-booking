import type { Viewport } from 'next'
import { RegisterRestaurantWizard } from '@/components/auth/RegisterRestaurantWizard'

export const metadata = {
  title: 'Étterem regisztráció — davelopment booking',
  description: 'Hozd létre az éttermed davelopment booking fiókját, és kezdj el asztalfoglalásokat kezelni.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Étterem regisztráció — davelopment booking',
    description: 'Modern foglaláskezelő éttermeknek.',
    images: [{ url: '/og/og-auth.jpg', width: 1200, height: 630, alt: 'davelopment booking — Regisztráció' }],
    siteName: 'davelopment booking',
  },
}
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function RegisterRestaurantPage() {
  return <RegisterRestaurantWizard />
}
