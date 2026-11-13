import { BackstageLoginForm } from '@/components/auth/BackstageLoginForm'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { Viewport } from 'next'

/** régebbi Safari / Chrome felső sávja (az iOS 26 Safari a fix réteg színét veszi — lásd BackstageLoginForm) */
export const viewport: Viewport = { themeColor: '#383838' }

export default async function BackstageLoginPage() {
  const user = await getCurrentUser()
  if (user?.role === 'admin') redirect('/backstage')

  return <BackstageLoginForm />
}
