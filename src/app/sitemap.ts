import type { MetadataRoute } from 'next'
import { execSync } from 'child_process'
import { getPayloadClient } from '@/lib/payload'
import { SITE_URL } from '@/lib/publicSeo'
import { TIPS } from '@/lib/tips-content'
import { INDUSTRY_LANDINGS } from '@/lib/industryLandings'
import { FEATURE_GROUPS, featurePagesOn } from '@/lib/landingFeatures'

/**
 * A statikus (kódban tárolt) tartalom `lastModified`-je AUTOMATIKUSAN a git commit-történetből
 * jön — nem kézzel karban tartott dátum-mező (azt könnyű elfelejteni frissíteni, és egy hamis
 * "ma módosult" jel aláásná a sitemap megbízhatóságát a Google szemében). A VPS deployon a
 * `.git` mappa megvan (a deploy.sh maga is git-alapú), ezért ez éles környezetben is működik.
 * Egyszer számoljuk ki (modul-szinten, process-élettartamra memoizálva), nem minden kérésnél.
 */
const gitLastModifiedCache = new Map<string, Date | undefined>()
function gitLastModified(relativePath: string): Date | undefined {
  if (gitLastModifiedCache.has(relativePath)) return gitLastModifiedCache.get(relativePath)
  let result: Date | undefined
  try {
    const iso = execSync(`git log -1 --format=%cI -- "${relativePath}"`, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
    result = iso ? new Date(iso) : undefined
  } catch {
    result = undefined
  }
  gitLastModifiedCache.set(relativePath, result)
  return result
}

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
    const tipsLastModified = gitLastModified('src/lib/tips-content.ts')
    for (const tip of TIPS) {
      entries.push({ url: `${SITE_URL}/tips/${tip.slug}`, lastModified: tipsLastModified, changeFrequency: 'monthly', priority: 0.6 })
    }
    const industryLandingsLastModified = gitLastModified('src/lib/industryLandings.ts')
    for (const landing of Object.values(INDUSTRY_LANDINGS)) {
      entries.push({ url: `${SITE_URL}/${landing.slug}`, lastModified: industryLandingsLastModified, changeFrequency: 'monthly', priority: 0.7 })
    }
    entries.push({ url: `${SITE_URL}/kapcsolat`, lastModified: gitLastModified('src/components/landing/sections/ContactSection.tsx'), changeFrequency: 'yearly', priority: 0.5 })
    entries.push({ url: `${SITE_URL}/arak`, lastModified: gitLastModified('src/lib/pricingContent.ts'), changeFrequency: 'monthly', priority: 0.9 })
    const featuresLastModified = gitLastModified('src/lib/landingFeatures.ts')
    // a /funkciok oldalak csak akkor kerülnek a sitemapbe, ha élesek (landingFeatures FEATURE_PAGES_PUBLIC)
    if (featurePagesOn) entries.push({ url: `${SITE_URL}/funkciok`, lastModified: featuresLastModified, changeFrequency: 'monthly', priority: 0.8 })
    for (const g of FEATURE_GROUPS.filter((fg) => fg.ready && featurePagesOn)) {
      entries.push({ url: `${SITE_URL}/funkciok/${g.slug}`, lastModified: featuresLastModified, changeFrequency: 'monthly', priority: 0.8 })
    }
    for (const s of salons.docs) {
      if (s.slug) entries.push({ url: `${SITE_URL}/${s.slug}`, lastModified: s.updatedAt ? new Date(s.updatedAt) : undefined, changeFrequency: 'weekly', priority: 0.8 })
    }
    for (const r of restaurants.docs) {
      if (r.slug) entries.push({ url: `${SITE_URL}/${r.slug}`, lastModified: r.updatedAt ? new Date(r.updatedAt) : undefined, changeFrequency: 'weekly', priority: 0.8 })
    }
    return entries
  } catch {
    return [{ url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 }]
  }
}
