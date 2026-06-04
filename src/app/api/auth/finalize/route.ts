/**
 * GET /api/auth/finalize
 *
 * Az Auth.js Google-callback UTÁN ide irányítunk (lásd src/auth.ts redirect callback).
 * Ennek a route-nak az a dolga, hogy:
 *   1. Olvassa az Auth.js sessionjéből a Payload user id-t és emailt (a signIn callback
 *      a JWT-be tette).
 *   2. Kiállítson egy payload-token cookie-t (HttpOnly, Secure-prod, SameSite=Lax, 7 nap),
 *      hogy a meglévő Payload auth és RBAC változtatás nélkül működjön.
 *   3. Eldöntse hova menjen:
 *      - `?next=...` query-param (pl. /api/auth/complete-registration regisztrációból)
 *      - vagy a Payload user role-ja szerinti dashboard (étterem / szalon / backstage).
 *
 * Miért kell ez az átkötés:
 *   Auth.js v5-ben a `signIn` callbackből a `cookies().set()` NEM kerül a 302 response-ba,
 *   ezért a payload-token nem érne el a böngészőig. Egy route handlerből viszont a `Set-Cookie`
 *   header garantáltan megy a response-ba.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { issuePayloadToken, PAYLOAD_COOKIE, TOKEN_TTL_SECONDS } from '@/auth'
import { getPayloadClient } from '@/lib/payload'

export async function GET(req: NextRequest) {
  const session = await auth()
  console.log('[finalize] session:', JSON.stringify(session))
  const sessionToken = session as unknown as { payloadId?: string | number; payloadEmail?: string; user?: { email?: string; name?: string } } | null

  // Ha valami okból nincs session, vissza /login-ra
  if (!sessionToken?.payloadId || !sessionToken.payloadEmail) {
    console.warn('[finalize] hiányzó payloadId/Email — session:', JSON.stringify(sessionToken))
    // Fallback: ha az Auth.js session-ben van email, próbáljuk azzal megtalálni a Payload usert.
    const fallbackEmail = sessionToken?.user?.email
    if (!fallbackEmail) {
      return NextResponse.redirect(new URL('/login?error=session', req.url))
    }
    const payload = await getPayloadClient()
    const found = await payload.find({
      collection: 'users',
      where: { email: { equals: fallbackEmail.toLowerCase() } },
      limit: 1,
      overrideAccess: true,
    })
    if (found.docs.length === 0) {
      return NextResponse.redirect(new URL('/login?error=no-user', req.url))
    }
    sessionToken!.payloadId = found.docs[0].id
    sessionToken!.payloadEmail = fallbackEmail.toLowerCase()
  }

  // 1. Lekérjük a user role-ját — a token-kiállításhoz ÉS a redirect-hez kell.
  let role: string | undefined
  try {
    const payload = await getPayloadClient()
    const user = await payload.findByID({
      collection: 'users',
      id: sessionToken.payloadId!,
      overrideAccess: true,
    })
    role = (user as { role?: string } | null)?.role
  } catch {
    // ha nem kérdezhető le, marad undefined → default 'salon_owner'
  }

  // 2. Payload-token kiállítás (role-lal együtt, mert a séma saveToJWT: true).
  const token = await issuePayloadToken(sessionToken.payloadId!, sessionToken.payloadEmail!, role)

  // 3. Cél meghatározása: next query-param vagy role szerinti dashboard
  let dest = req.nextUrl.searchParams.get('next')
  if (!dest) {
    if (role === 'restaurant_owner') dest = '/restaurant'
    else if (role === 'admin') dest = '/backstage'
    else dest = '/dashboard' // salon_owner és default
  }

  // Biztonság: csak relatív, ugyanazon origin-en belüli redirectet engedünk.
  if (!dest.startsWith('/')) dest = '/dashboard'

  // 3. Redirect + cookie beállítás (a NextResponse.cookies.set garantáltan a Set-Cookie headerre megy)
  const res = NextResponse.redirect(new URL(dest, req.url))
  res.cookies.set(PAYLOAD_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_TTL_SECONDS,
  })
  return res
}
