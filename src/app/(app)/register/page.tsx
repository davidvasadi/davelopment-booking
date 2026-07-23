import type { Viewport } from 'next'
import { RegisterWizard } from '@/components/auth/RegisterWizard'

export const metadata = {
  title: 'Regisztráció — davelopment booking',
  description: 'Hozd létre a davelopment booking fiókodat, és kezdj el időpontokat fogadni percek alatt.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Regisztráció — davelopment booking',
    description: 'Modern időpontfoglaló kis vállalkozásoknak.',
    images: [{ url: '/og/og-auth.jpg', width: 1200, height: 630, alt: 'davelopment booking — Regisztráció' }],
    siteName: 'davelopment booking',
  },
}
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function RegisterPage() {
  return <RegisterWizard />
}
