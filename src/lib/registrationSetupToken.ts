import { SignJWT, jwtVerify } from 'jose'
import crypto from 'crypto'

/**
 * Szűkre szabott, rövid életű "regisztráció-folytatás" token — KIZÁRÓLAG arra jó, hogy a
 * regisztrációs wizard 2. lépése (fiók+üzlet létrehozás) UTÁN, de MÉG az email-megerősítés
 * ELŐTT, a wizard hátralévő lépése (adatimport) authentikálni tudjon EGYETLEN, most létrehozott
 * üzlethez. SZÁNDÉKOSAN NEM a normál `payload-token` (bejelentkezés) — azt csak a valódi,
 * megerősítés utáni login állítja ki (`issuePayloadToken`, `src/auth.ts`), különben valaki egy
 * NEM SAJÁT email-domainnel is azonnal teljes dashboard-hozzáférést kapna, anélkül hogy valaha
 * rákattintana a megerősítő linkre — pont azt a védelmet törné el, amiért a `verify: true`
 * egyáltalán bekerült (lásd `/api/auth/register` route komment).
 */

const COOKIE = 'reg-setup-token'
const TTL_SECONDS = 60 * 30 // 30 perc — a wizard hátralévő lépéseihez bőven elég

function deriveKey(): Uint8Array {
  const secret = process.env.PAYLOAD_SECRET ?? 'your-secret-key-here'
  const derived = crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32)
  return new TextEncoder().encode(derived)
}

export async function issueRegistrationSetupToken(
  userId: number | string,
  kind: 'salon' | 'restaurant',
  businessId: number | string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ purpose: 'registration-setup', userId, kind, businessId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .sign(deriveKey())
}

export async function verifyRegistrationSetupToken(
  token: string,
): Promise<{ userId: number | string; kind: 'salon' | 'restaurant'; businessId: number | string } | null> {
  try {
    const { payload } = await jwtVerify(token, deriveKey())
    if (payload.purpose !== 'registration-setup') return null
    return {
      userId: payload.userId as number | string,
      kind: payload.kind as 'salon' | 'restaurant',
      businessId: payload.businessId as number | string,
    }
  } catch {
    return null
  }
}

export { COOKIE as REG_SETUP_COOKIE, TTL_SECONDS as REG_SETUP_TTL_SECONDS }
