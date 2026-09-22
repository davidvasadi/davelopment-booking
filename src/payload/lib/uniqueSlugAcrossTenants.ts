import type { TextFieldSingleValidation } from 'payload'
import { RESERVED_INDUSTRY_SLUGS } from '@/lib/industryLandings'

/**
 * Salons and restaurants share a single public URL namespace (domain.com/[slug]),
 * so a slug must be unique across BOTH collections — not just within one.
 * This validator rejects a slug already taken by the other collection.
 *
 * `ownCollection` is the collection the field lives on (skipped in the lookup);
 * `otherCollection` is the one we check against.
 */
export function uniqueSlugAcrossTenants(
  ownCollection: 'salons' | 'restaurants',
  otherCollection: 'salons' | 'restaurants',
): TextFieldSingleValidation {
  return async (value, { req }) => {
    if (!value || typeof value !== 'string') return true

    // A `/[slug]` route ezekre a nevekre egy fix SEO landinget renderel (ld. industryLandings.ts)
    // egy üzlet-lookup HELYETT — ha egy üzlet ezt választaná slugnak, örökre elfedné a saját
    // oldalát a landing mögött.
    if (RESERVED_INDUSTRY_SLUGS.includes(value)) {
      return 'Ez a slug foglalt (rendszer által fenntartott). Válassz másikat.'
    }

    const existing = await req.payload.find({
      collection: otherCollection,
      where: { slug: { equals: value } },
      limit: 1,
      depth: 0,
    })

    if (existing.docs.length > 0) {
      const label = otherCollection === 'salons' ? 'szalon' : 'étterem'
      return `Ez a slug már foglalt egy másik ${label} oldalához. Válassz másikat.`
    }
    return true
  }
}
