import { getPayloadClient } from '@/lib/payload'
import { guestKeyOf } from '@/lib/guests'
import type { Review, Booking, Reservation } from '@/payload/payload-types'

export interface ReviewSummary {
  average: number
  count: number
  /** 1–5 csillagos eloszlás — index 0 = 1 csillag … index 4 = 5 csillag. */
  distribution: [number, number, number, number, number]
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
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const r of docs) {
    const i = Math.min(5, Math.max(1, Math.round(r.rating || 0))) - 1
    distribution[i] += 1
  }
  const recent = docs.slice(0, recentLimit).map((r) => ({
    id: String(r.id),
    rating: r.rating,
    comment: r.comment ?? null,
    customer_name: r.customer_name ?? null,
    createdAt: r.createdAt,
  }))
  return { average, count, distribution, recent }
}

export interface GuestReviewInfo {
  average: number
  count: number
  latestComment: string | null
}

/**
 * Vendég-kulcsonkénti (`guestKeyOf`) értékelés-összesítő — a Vendégek oldalba kötéshez.
 * A `reviews` collectionön nincs (és nem is lesz) közvetlen vendég-reláció: a vendéget a
 * MEGLÉVŐ `booking`/`reservation` kapcsolaton át (depth:1) azonosítjuk, ugyanazzal a
 * `guestKeyOf()`-fal, mint amit a `guestsView.ts` a foglalás-történet levezetéséhez is használ.
 */
export async function getGuestReviewMap(
  kind: 'salon' | 'restaurant',
  id: string | number,
): Promise<Map<string, GuestReviewInfo>> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'reviews',
    where: { [kind]: { equals: id } },
    sort: '-createdAt',
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })
  const docs = res.docs as Review[]

  const map = new Map<string, GuestReviewInfo>()
  for (const r of docs) {
    const source = kind === 'salon' ? (r.booking as Booking | string | null | undefined) : (r.reservation as Reservation | string | null | undefined)
    if (!source || typeof source === 'string') continue
    const key = guestKeyOf({ email: source.customer_email, phone: source.customer_phone, name: source.customer_name })
    if (!key) continue

    const existing = map.get(key)
    if (existing) {
      const totalRating = existing.average * existing.count + (r.rating || 0)
      existing.count += 1
      existing.average = Math.round((totalRating / existing.count) * 10) / 10
      // A `docs` már -createdAt szerint rendezett — az ELSŐ találkozott komment a legfrissebb.
    } else {
      map.set(key, { average: r.rating || 0, count: 1, latestComment: r.comment?.trim() || null })
    }
  }
  return map
}
