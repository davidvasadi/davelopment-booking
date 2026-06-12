import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { v4 as uuid } from 'uuid'
import { getPayloadClient } from '@/lib/payload'
import { getCurrentUser } from '@/lib/auth'

const TOKEN_EXPIRATION = 60 * 60 * 2 // 2 hours in seconds

export async function POST(req: NextRequest) {
  // A redirect-bázis a PUBLIKUS URL — az nginx-proxy mögött a req.url http://localhost:3001
  // lenne, így a böngésző localhostra navigálna (ugyanaz a bug, mint a Google-loginnál volt).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.url

  const admin = await getCurrentUser()
  if (!admin || admin.role !== 'admin') {
    return NextResponse.redirect(new URL('/backstage/login', baseUrl), { status: 303 })
  }

  const formData = await req.formData()
  const userId = formData.get('userId') as string | null
  if (!userId) return NextResponse.redirect(new URL('/backstage', baseUrl), { status: 303 })

  const payload = await getPayloadClient()
  const user = await payload.findByID({
    collection: 'users',
    id: userId,
    overrideAccess: true,
    depth: 0,
  }).catch(() => null)

  if (!user) return NextResponse.redirect(new URL('/backstage', baseUrl), { status: 303 })

  // Create a real Payload session so the JWT is valid with useSessions: true/false
  const sid = uuid()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRATION * 1000)
  const newSession = { id: sid, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }
  const existingSessions = Array.isArray((user as any).sessions) ? (user as any).sessions : []

  await (payload.db as any).updateOne({
    id: user.id,
    collection: 'users',
    data: { ...(user as any), sessions: [...existingSessions, newSession] },
    returning: false,
  })

  // Use payload.secret directly — guarantees same key as Payload's jwtVerify
  const secretKey = new TextEncoder().encode(payload.secret)
  const issuedAt = Math.floor(Date.now() / 1000)

  const token = await new SignJWT({ id: user.id, collection: 'users', email: user.email, sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TOKEN_EXPIRATION)
    .sign(secretKey)

  // A cél a belépett user szerepe szerint: étterem-owner → /restaurant, szalon-owner → /dashboard,
  // admin → /backstage. Korábban MINDIG /dashboard volt → étterem-owner-ként nem lehetett belépni
  // (a /dashboard visszadobta, mert nincs szalonja).
  const role = (user as { role?: string }).role
  const dest = role === 'restaurant_owner' ? '/restaurant' : role === 'admin' ? '/backstage' : '/dashboard'

  const res = NextResponse.redirect(new URL(dest, baseUrl), { status: 303 })
  res.cookies.set('payload-token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRATION,
  })
  return res
}
