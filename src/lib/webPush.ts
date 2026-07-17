import webpush from 'web-push'
import type { Payload } from 'payload'
import type { PushSubscription as PushSub } from '@/payload/payload-types'

/**
 * WEB PUSH küldés (self-hosted, VAPID) — a saját szerverünkről közvetlenül a böngésző
 * push-szolgáltatásaira. Nincs 3rd-party, nincs díj. A payloadot a `sw.js` push-handlere
 * jeleníti meg. A halott feliratkozásokat (404/410) küldéskor kitakarítjuk.
 */
let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:your-email@example.com'
  if (!pub || !priv) return false // VAPID nélkül némán kikapcsolt (mint az SMTP)
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  /** Kattintáskor megnyitandó relatív útvonal (pl. /restaurant/bookings?reservation=12). */
  url?: string
  /** Azonos tag → az új értesítés felülírja a régit (nem halmozódik). */
  tag?: string
}

/**
 * Push küldése a megadott felhasználók MINDEN eszközére. `overrideAccess`, mert szerver-kontextusból
 * (hook/route) hívjuk. Best-effort: egy hibás küldés nem dobja el a többit.
 */
export async function sendPushToUsers(
  payload: Payload,
  userIds: (string | number | null | undefined)[],
  data: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return
  const ids = Array.from(new Set(userIds.filter(Boolean).map((i) => String(i))))
  if (ids.length === 0) return

  const subs = await payload.find({
    collection: 'push-subscriptions',
    where: { user: { in: ids } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  if (subs.docs.length === 0) return

  const json = JSON.stringify({ title: data.title, body: data.body, url: data.url ?? '/', tag: data.tag })

  await Promise.all(
    (subs.docs as PushSub[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        )
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        // 404/410 → a feliratkozás halott (leiratkozott / lejárt): töröljük, hogy ne próbálkozzunk vele újra.
        if (status === 404 || status === 410) {
          await payload.delete({ collection: 'push-subscriptions', id: s.id, overrideAccess: true }).catch(() => {})
        }
      }
    }),
  )
}
