import { getPayloadClient } from '@/lib/payload'
import type { Review } from '@/payload/payload-types'

export interface ReviewSummary {
  average: number
  count: number
  recent: {
    id: string
    rating: number
    comment: string | null
    customer_name: string | null
    createdAt: string
  }[]
}

/**
 * Egy üzlet (szalon vagy étterem) értékeléseinek összefoglalója a tulaj-nézethez.
 * average = átlag csillag (1 tizedes), count = összes, recent = legutóbbi néhány.
 */
export async function getReviewSummary(
  kind: 'salon' | 'restaurant',
  id: string | number,
  recentLimit = 5,
): Promise<ReviewSummary> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reviews',
    where: { [kind]: { equals: id } },
    sort: '-createdAt',
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const docs = res.docs as Review[]
  const count = docs.length
  const average = count > 0 ? Math.round((docs.reduce((s, r) => s + (r.rating || 0), 0) / count) * 10) / 10 : 0
  const recent = docs.slice(0, recentLimit).map((r) => ({
    id: String(r.id),
    rating: r.rating,
    comment: r.comment ?? null,
    customer_name: r.customer_name ?? null,
    createdAt: r.createdAt,
  }))
  return { average, count, recent }
}
