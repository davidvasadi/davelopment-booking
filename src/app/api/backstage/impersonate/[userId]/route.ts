import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = await params
  const payload = await getPayloadClient()

  const userResult = await payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
  })
  if (!userResult) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const secret = process.env.PAYLOAD_SECRET ?? 'your-secret-key-here'
  const secretKey = new TextEncoder().encode(secret)
  const issuedAt = Math.floor(Date.now() / 1000)
  const exp = issuedAt + 60 * 60 * 2 // 2 hours

  const token = await new SignJWT({ id: userResult.id, email: userResult.email, collection: 'users' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(exp)
    .sign(secretKey)

  // Return token in body — the client opens a new tab to the redirect route
  // which sets the cookie only for that navigation, not overwriting the admin's session
  return NextResponse.json({ token })
}
