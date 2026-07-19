import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import { NextResponse } from 'next/server'
import type { User } from '@/payload/payload-types'

/**
 * Manuális salon-tulajdonos ellenőrzés a custom API route-okhoz.
 * A Payload natív REST API JWT-parsere inkompatibilis az alkalmazás auth-megoldásával,
 * ezért a mutáló route-ok (POST/PATCH/DELETE) getCurrentUser() + overrideAccess mintát
 * használnak — ennek közös segédfüggvénye.
 */
export async function ownsThisSalon(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  user: { id: string | number; role?: string },
  salonId: unknown,
): Promise<boolean> {
  if (user.role === 'admin') return true
  const sid = salonId && typeof salonId === 'object' ? (salonId as { id: unknown }).id : salonId
  if (sid == null) return false
  try {
    const salon = await payload.findByID({ collection: 'salons', id: sid as string | number, depth: 0, overrideAccess: true })
    const ownerId = salon?.owner && typeof salon.owner === 'object'
      ? (salon.owner as { id: unknown }).id
      : salon?.owner
    return String(ownerId) === String(user.id)
  } catch {
    return false
  }
}

/** Auth check helper: visszaadja a usert vagy 401-es NextResponse-t. */
export async function authOrUnauthorized(): Promise<User | NextResponse> {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Bejelentkezés szükséges' }, { status: 401 })
  return user
}
