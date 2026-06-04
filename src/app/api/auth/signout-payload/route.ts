/**
 * POST /api/auth/signout-payload
 *
 * Saját kijelentkezés-endpoint, ami megbízhatóan törli a payload-token cookie-t.
 * A Payload natív /api/users/logout endpointja `payload.auth()`-szal próbálja kiszedni a
 * usert a token-ből, de a mi saját kiállítású token-jeinket nem ismeri be (lásd
 * src/lib/auth.ts kommentek), ezért 400 „No User" hibát dob. Ez az endpoint egyszerűen
 * cookie-t töröl és sikert ad — a kliens utána /login-ra navigál.
 */

import { NextResponse } from 'next/server'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // payload-token: a mi saját, jose-aláírt JWT-nk
  res.cookies.set('payload-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  // Auth.js v5 session cookie (dev: authjs.session-token, prod: __Secure-authjs.session-token)
  res.cookies.set('authjs.session-token', '', { path: '/', maxAge: 0 })
  res.cookies.set('__Secure-authjs.session-token', '', { path: '/', maxAge: 0, secure: true })
  return res
}
