import { BackstageLoginForm } from '@/components/auth/BackstageLoginForm'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function BackstageLoginPage() {
  const user = await getCurrentUser()
  if (user?.role === 'admin') redirect('/bookly/backstage')

  return <BackstageLoginForm />
}
