import { NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'
import type { Subscription, User } from '@/payload/payload-types'

/** Könnyű fiók-lista (id/név/email/üzlet-leírás) a körüzenet egyedi-kiválasztójához. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()
  const subs = await payload.find({
    collection: 'subscriptions',
    limit: 2000,
    depth: 1,
    overrideAccess: true,
  })

  const accounts = (subs.docs as Subscription[])
    .map(s => {
      const owner = typeof s.owner === 'object' ? (s.owner as User) : null
      if (!owner) return null
      return { ownerId: String(owner.id), name: owner.name || owner.email, email: owner.email, breakdown: s.breakdown || null }
    })
    .filter((a): a is { ownerId: string; name: string; email: string; breakdown: string | null } => a != null)

  return NextResponse.json({ accounts })
}
