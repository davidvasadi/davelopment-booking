import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'

/** POST /api/users/verify-email — a `/verify-email?token=...` oldal hívja, a Payload
 *  `verify: true` (Users.ts) által kiküldött linkből. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null
  const token = body?.token
  if (!token) return NextResponse.json({ error: 'missing_token' }, { status: 400 })

  const payload = await getPayloadClient()
  try {
    const verified = await payload.verifyEmail({ collection: 'users', token })
    if (!verified) return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[verify-email] error:', e)
    return NextResponse.json({ error: 'invalid_token' }, { status: 400 })
  }
}
