import type { Viewport } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = {
  title: 'Bejelentkezés — davelopment booking',
  description: 'Jelentkezz be a davelopment booking fiókodba, és kezeld egyszerűen az üzleted: foglalás, csapat, vendégek, fizetés és marketing egy helyen.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Bejelentkezés — davelopment booking',
    description: 'Foglalás, csapat, vendégek, fizetés és marketing — egy helyen.',
    images: [{ url: '/og/og-default.jpg', width: 1200, height: 630, alt: 'davelopment booking' }],
    siteName: 'davelopment booking',
  },
}
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
