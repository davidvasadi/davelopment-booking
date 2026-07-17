import type { MetadataRoute } from 'next'
import { getPayloadClient } from '@/lib/payload'
import { SITE_URL } from '@/lib/publicSeo'

/**
 * Dinamikus sitemap: minden aktív üzlet publikus profil-oldala (/[slug]).
 * A /book wizard szándékosan kimarad (noindex). Hiba esetén üres listát adunk,
 * hogy a build/kérés ne dőljön el egy DB-hiba miatt.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const payload = await getPayloadClient()
    const [salons, restaurants] = await Promise.all([
      payload.find({
        collection: 'salons',
        where: { is_active: { equals: true } },
        limit: 1000,
        depth: 0,
        pagination: false,
      }),
      payload.find({
        collection: 'restaurants',
        where: { is_active: { not_equals: false } },
        limit: 1000,
        depth: 0,
        pagination: false,
      }),
    ])

    const entries: MetadataRoute.Sitemap = [
      { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    ]
    for (const s of salons.docs) {
      if (s.slug) entries.push({ url: `${SITE_URL}/${s.slug}`, changeFrequency: 'weekly', priority: 0.8 })
    }
    for (const r of restaurants.docs) {
      if (r.slug) entries.push({ url: `${SITE_URL}/${r.slug}`, changeFrequency: 'weekly', priority: 0.8 })
    }
    return entries
  } catch {
    return [{ url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 }]
  }
}
