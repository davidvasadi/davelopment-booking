import { SignJWT, jwtVerify } from 'jose'

/**
 * Aláírt leiratkozó-token minden kiküldött hírlevélbe — a `PAYLOAD_SECRET`-tel (ugyanaz a
 * kulcs, mint a `pendingRegistration.ts`-nél), HOGY ne kelljen külön env-változó a
 * deploy-hoz. Szándékosan NINCS lejárat — egy hírlevelet a vendég hetekkel/hónapokkal
 * később is megnyithat, a leiratkozásnak akkor is működnie kell.
 */
function getKey(): Uint8Array {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET hiányzik')
  return new TextEncoder().encode(secret)
}

export async function signUnsubscribeToken(customerId: string | number): Promise<string> {
  return new SignJWT({ customerId: String(customerId) })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .sign(getKey())
}

export async function verifyUnsubscribeToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getKey())
    return payload.customerId ? String(payload.customerId) : null
  } catch {
    return null
  }
}
