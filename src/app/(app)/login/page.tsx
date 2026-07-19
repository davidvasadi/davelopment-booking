import type { Viewport } from 'next'
import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Bejelentkezés — davelopment booking' }
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
