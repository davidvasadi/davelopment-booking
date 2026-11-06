import type { Viewport } from 'next'
import { Suspense } from 'react'
import { RegisterFlow } from '@/components/auth/RegisterFlow'

export const metadata = {
  title: 'Regisztráció — davelopment booking',
  description: 'Hozd létre a davelopment booking fiókodat, és kezdj el időpontokat fogadni percek alatt.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Regisztráció — davelopment booking',
    description: 'Foglalás, csapat, vendégek, fizetés és marketing — egy helyen.',
    images: [{ url: '/og/og-auth.jpg', width: 1200, height: 630, alt: 'davelopment booking — Regisztráció' }],
    siteName: 'davelopment booking',
  },
}
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterFlow />
    </Suspense>
  )
}
