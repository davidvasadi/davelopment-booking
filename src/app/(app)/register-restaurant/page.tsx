import type { Viewport } from 'next'
import { RegisterRestaurantWizard } from '@/components/auth/RegisterRestaurantWizard'

export const metadata = { title: 'Étterem regisztráció — davelopment booking' }
export const viewport: Viewport = { themeColor: '#1D1C19' }

export default function RegisterRestaurantPage() {
  return <RegisterRestaurantWizard />
}
