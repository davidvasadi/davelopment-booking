import type { Payload } from 'payload'
import type { Media } from '@/payload/payload-types'
import { brandChoice, type BrandPlace, type BrandWhere } from './brandImage'
import { fixMediaUrl } from './utils'

/**
 * Szerveren: az adott helyen megjelenő kép URL-je akkor is, ha az üzletet mélység nélkül olvastuk (a logó / ikon csak
 * azonosító) — ilyenkor a választott médiát külön lekérjük. Ugyanaz a döntés, mint a `brandImage`-nél (lib/brandImage).
 */
export async function brandImageUrl(payload: Payload, place: BrandPlace | null | undefined, where: BrandWhere, override?: string | null): Promise<string | null> {
  const choice = brandChoice(place, where, override)
  if (!place || choice === 'none') return null
  const order = choice === 'icon' ? [place.icon, place.logo] : [place.logo, place.icon]
  for (const rel of order) {
    if (rel == null) continue
    const doc = typeof rel === 'object'
      ? (rel as Media)
      : ((await payload.findByID({ collection: 'media', id: rel as string | number, depth: 0, overrideAccess: true }).catch(() => null)) as Media | null)
    if (doc?.url) return fixMediaUrl(doc.url) ?? null
  }
  return null
}
