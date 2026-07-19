import type { Viewport } from 'next'
import { RegisterWizard } from '@/components/auth/RegisterWizard'

export const metadata = { title: 'Regisztráció — davelopment booking' }
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function RegisterPage() {
  return <RegisterWizard />
}
