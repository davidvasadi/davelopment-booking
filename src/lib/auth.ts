import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayloadClient } from './payload'
import type { User } from '@/payload/payload-types'

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')
  if (!token) return null

  // A token-t magunknak dekódoljuk (jose, HS256, PAYLOAD_SECRET) és kiolvassuk a user id-t.
  // A Payload `payload.auth()` valamiért nem fogadja el a JWT-t (vélhetően a v3 belső auth
  // sorrendje vagy a session-elvárás miatt), ezért közvetlenül a DB-ből kérjük le a usert.
  // A token aláírás-ellenőrzése (jwtVerify) garantálja a hitelességet — ugyanaz a secret
  // mint amit a Payload natív login is használ.
  try {
    const { jwtVerify } = await import('jose')
    const crypto = await import('crypto')
    // FONTOS: a Payload 3 a JWT-t NEM a nyers PAYLOAD_SECRET-tel írja alá, hanem annak
    // SHA-256 hash-éből vett első 32 hex-karakterrel (lásd Payload sanitizeConfig).
    // Ezért a verify-hoz is ezt a derivált kulcsot kell használni, különben
    // "signature verification failed". (A natív Payload login így ír; a Google-úton
    // az issuePayloadToken is ezt használja — egységesen.)
    const rawSecret = process.env.PAYLOAD_SECRET ?? 'your-secret-key-here'
    const derived = crypto.createHash('sha256').update(rawSecret).digest('hex').slice(0, 32)
    const key = new TextEncoder().encode(derived)
    const { payload: decoded } = await jwtVerify(token.value, key)
    const userId = (decoded as { id?: number | string }).id
    if (!userId) {
      console.error('[getCurrentUser] nincs id a tokenben. decoded mezők:', Object.keys(decoded as object))
      return null
    }

    const payload = await getPayloadClient()
    const user = await payload.findByID({
      collection: 'users',
      id: userId,
      overrideAccess: true,
    })
    return user as User | null
  } catch (e) {
    console.error('[getCurrentUser] jwtVerify/findByID HIBA:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function requireAuth(role?: 'admin' | 'salon_owner' | 'restaurant_owner'): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (role && user.role !== role && user.role !== 'admin') redirect('/login')
  return user
}
