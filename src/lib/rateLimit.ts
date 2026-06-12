/**
 * Egyszerű in-memory sliding-window rate limiter.
 *
 * Azért in-memory (nem Redis), mert egyetlen tartós `next start` process fut
 * (nincs PM2 cluster mód). Ha valaha cluster lesz → minden process külön
 * számolna; akkor megosztott store-ra kell váltani.
 *
 * A számláló a middleware-ben (src/proxy.ts) hívódik útvonal-specifikus
 * limitekkel. A kulcs a valós kliens-IP (nginx-proxy mögött a req.ip a proxy
 * IP-je lenne, ezért az x-forwarded-for első elemét használjuk).
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

// Időnként kitakarítjuk a lejárt bucketeket, hogy a Map ne hízzon korlátlanul.
let lastSweep = Date.now()
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  /** Másodperc a window újranyílásáig — a Retry-After headerhez. */
  retryAfter: number
}

/**
 * @param key   azonosító (pl. "bookings:1.2.3.4")
 * @param limit megengedett kérések száma a windowban
 * @param windowMs a window hossza ms-ban
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (bucket.count < limit) {
    bucket.count += 1
    return { allowed: true, retryAfter: 0 }
  }

  return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
}

/**
 * Valós kliens-IP kinyerése az nginx-proxy mögött.
 * Az x-forwarded-for első eleme a tényleges kliens; fallback az x-real-ip.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return headers.get('x-real-ip') ?? 'unknown'
}
