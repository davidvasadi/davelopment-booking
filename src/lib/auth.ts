import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient } from './payload'
import type { User } from '@/payload/payload-types'

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('payload-token')
    if (!token) return null

    const payload = await getPayloadClient()
    const { user } = await payload.auth({ headers: new Headers({ cookie: `payload-token=${token.value}` }) })
    return user as User | null
  } catch {
    return null
  }
}

export async function requireAuth(role?: 'admin' | 'salon_owner'): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/bookly/login')
  if (role && user.role !== role && user.role !== 'admin') redirect('/bookly/login')
  return user
}
