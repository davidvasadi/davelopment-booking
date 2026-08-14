import { randomBytes } from 'crypto'
import { getPayloadClient } from '@/lib/payload'

/**
 * Rövid, ember által is könnyen beírható ajándékutalvány-kód — a kódbázisban eddig csak hosszú
 * hex/base64url tokenek voltak (URL-be szánva, nem kézi bevitelre). Formátum: `XXXX-XXXX`, a
 * félreolvasható karakterek (0/O, 1/I/L) kihagyva a ábécéből.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function randomSegment(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Egyedi kód generálása — DB-ütközés esetén újrapróbál (gyakorlatilag sosem fordul elő, a
 *  keresőtér ~32^8, de a `unique` mezőn ettől függetlenül biztonságosan kezeljük). */
export async function generateUniqueVoucherCode(): Promise<string> {
  const payload = await getPayloadClient()
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${randomSegment(4)}-${randomSegment(4)}`
    const existing = await payload.find({
      collection: 'gift-vouchers',
      where: { code: { equals: code } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs === 0) return code
  }
  throw new Error('Nem sikerült egyedi utalvány-kódot generálni')
}
