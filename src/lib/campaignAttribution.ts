import type { Payload } from 'payload'

/**
 * Hírlevél → foglalás (2026-11): a kampány-levél foglalás-linkjei `?c=<kampány-id>` jelölést kapnak (lib/marketingSend),
 * a foglalóoldal ezt a foglalással együtt visszaküldi. Itt ellenőrizzük, hogy a kampány tényleg ehhez az üzlethez
 * tartozik, ki van küldve, és nem régebbi 60 napnál — csak akkor kerül a foglalásra (`marketing_campaign`).
 */
export const CAMPAIGN_PARAM = 'c'
const MAX_AGE_DAYS = 60

export async function attributedCampaign(payload: Payload, kind: 'salon' | 'restaurant', businessId: number | string, raw: unknown): Promise<number | null> {
  const id = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : null
  if (!id || id <= 0) return null
  const c = (await payload.findByID({ collection: 'marketing-campaigns', id, depth: 0, overrideAccess: true }).catch(() => null)) as
    | { status?: string | null; salon?: unknown; restaurant?: unknown; createdAt: string } | null
  if (!c || (c.status ?? 'sent') !== 'sent') return null
  const owner = c[kind]
  const ownerId = owner && typeof owner === 'object' ? (owner as { id: unknown }).id : owner
  if (ownerId == null || String(ownerId) !== String(businessId)) return null
  if (Date.now() - new Date(c.createdAt).getTime() > MAX_AGE_DAYS * 86_400_000) return null
  return id
}

/** A kész levélben az üzlet foglalóoldalára mutató linkek (`<base>`, `<base>/…`, `<base>?…`) kapják a kampány-jelölést. */
export function tagCampaignLinks(html: string, base: string, campaignId: number | string): string {
  const b = base.replace(/\/$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html.replace(new RegExp(`href="(${b}(?:[/?#][^"]*)?)"`, 'g'), (_m, url: string) => {
    if (new RegExp(`[?&]${CAMPAIGN_PARAM}=`).test(url)) return `href="${url}"`
    const [path, hash = ''] = url.split('#')
    const sep = path.includes('?') ? '&amp;' : '?'
    return `href="${path}${sep}${CAMPAIGN_PARAM}=${campaignId}${hash ? `#${hash}` : ''}"`
  })
}
