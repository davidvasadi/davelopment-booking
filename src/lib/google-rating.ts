// src/lib/google-rating.ts
// A scripts/google-reviews/fetch_rating.py cron script által naponta
// kiírt, cache-elt Google Cégem-pontszám beolvasása. Nincs élő API-hívás
// oldalbetöltéskor — ugyanaz a davelopment fő repóban is bevált minta
// (lásd ottani lib/shared/google-rating.ts), ugyanazt a Google Cégem-
// profilt (Place ID) használja, mivel ugyanaz a cég áll mindkét termék
// mögött.

import { readFile } from 'fs/promises'
import path from 'path'

export type GoogleRating = {
  rating: number
  userRatingCount: number
  name?: string
  googleMapsUrl?: string
  fetchedAt: string
}

export async function getCachedGoogleRating(): Promise<GoogleRating | null> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'google-rating.json')
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (typeof data?.rating !== 'number' || typeof data?.userRatingCount !== 'number') return null
    return data as GoogleRating
  } catch {
    return null
  }
}

export type GoogleReview = {
  authorName: string
  text: string
  rating: number | null
  /** Relatív útvonal a saját public/ mappánkban (a cron script tölti le, nem Google-hotlink). */
  photoUrl: string | null
  publishTime: string | null
}

/** Csak az 1 mondatnál hosszabb, tartalmas véleményeket tartalmazza (lásd fetch_rating.py szűrője). */
export async function getCachedGoogleReviews(): Promise<GoogleReview[]> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'google-reviews.json')
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data as GoogleReview[]
  } catch {
    return []
  }
}
