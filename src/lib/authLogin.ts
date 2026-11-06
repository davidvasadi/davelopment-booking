import type { NextRequest, NextResponse } from 'next/server'
import { issuePayloadToken, PAYLOAD_COOKIE, TOKEN_TTL_SECONDS } from '@/auth'
import { createSession } from './authSessions'
import { clientIp } from './rateLimit'

/** Bejelentkezés: új munkamenet (eszköz) + a `payload-token` süti a válaszra. Kódos és Google-belépés is ezt használja. */
export async function startSession(req: NextRequest, res: NextResponse, user: { id: number | string; email: string; role?: string | null }): Promise<void> {
  const sid = await createSession(user.id, req.headers.get('user-agent'), clientIp(req.headers))
  const token = await issuePayloadToken(user.id, user.email, user.role ?? undefined, sid)
  res.cookies.set(PAYLOAD_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: TOKEN_TTL_SECONDS,
  })
}

/** A belépett user kezdőoldala a szerepe szerint. */
export function homeFor(role?: string | null): string {
  return role === 'admin' ? '/backstage' : role === 'restaurant_owner' ? '/restaurant' : '/dashboard'
}
