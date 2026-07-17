/**
 * Pending registration cookie — átmeneti, signed tárolás a Google-OAuth flow alatt.
 *
 * Miért kell:
 *   A regisztrációs wizardben a user megadja a cégadatokat (salon/restaurant név, város, telefon),
 *   majd a „Folytatás Google-lel" gombbal indít OAuth-flow-t. A flow közben a kliens elhagyja
 *   az oldalt, ezért az adatokat nem tarthatjuk a kliens state-ben. localStorage-be sem,
 *   mert egy másik tabban / másik device-on visszatérve nincs ott. Megoldás: signed cookie,
 *   HttpOnly + Secure (prod) + SameSite=Lax, rövid TTL (15 perc).
 *
 * Hogyan használjuk:
 *   - `setPendingRegistration(payload)` — beállítja a cookie-t (15 perc TTL).
 *   - `readPendingRegistration()` — kiolvassa és visszaadja a payloadot, ha érvényes.
 *   - `clearPendingRegistration()` — törli a cookie-t (sikeres complete után).
 *
 * Biztonság:
 *   - jose HS256, a PAYLOAD_SECRET kulccsal (ugyanaz mint a payload-tokennél).
 *   - HttpOnly: JS-ből nem olvasható.
 *   - 15 perces lejárat (rövid, hogy egy elfelejtett flow ne maradjon nyitva órákig).
 */

import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'davelopment-pending-reg'
const TTL_SECONDS = 60 * 15 // 15 perc

export type PendingRegistration = {
  role: 'salon_owner' | 'restaurant_owner'
  ownerName: string
  placeName: string // salon name vagy restaurant name
  city?: string
  phone?: string
}

function getKey(): Uint8Array {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET hiányzik')
  return new TextEncoder().encode(secret)
}

export async function setPendingRegistration(payload: PendingRegistration): Promise<void> {
  const now = Math.floor(Date.now() / 1000)
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(getKey())
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export async function readPendingRegistration(): Promise<PendingRegistration | null> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getKey())
    // Whitelistezzük a mezőket; bármi más kerülne bele, azt eldobjuk.
    return {
      role: payload.role as PendingRegistration['role'],
      ownerName: String(payload.ownerName ?? ''),
      placeName: String(payload.placeName ?? ''),
      city: payload.city ? String(payload.city) : undefined,
      phone: payload.phone ? String(payload.phone) : undefined,
    }
  } catch {
    return null
  }
}

export async function clearPendingRegistration(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}
