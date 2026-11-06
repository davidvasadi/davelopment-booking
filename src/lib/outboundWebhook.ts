import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Kimenő webhook (Beállítások › API & integrációk › Zapier / Make, design 16.15.2): az üzlet eseményeinél (foglalás,
 * vendég, számla, utalvány, értékelés — lásd `payload/hooks/webhookOnBooking.ts`) egy JSON POST a megadott URL-re.
 *
 * Védelem (SSRF): csak https, és a cím nem mutathat belső / privát hálózatra (localhost, 10.x, 192.168.x, 169.254.x
 * stb. — a DNS-feloldás után is ellenőrizve). 5 mp időkorlát, átirányítást nem követünk. Best-effort: a hiba nem
 * akasztja meg a foglalást, csak naplózzuk.
 */

export type WebhookEvent =
  | 'booking.created' | 'booking.updated' | 'booking.cancelled'
  | 'customer.created' | 'invoice.issued' | 'voucher.purchased' | 'voucher.redeemed' | 'review.received'

function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const v = ip.toLowerCase()
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.')
}

/** A megadott cím használható-e webhookként: https, nem belső hálózat. Hiba esetén az ok szövegesen. */
export async function checkWebhookUrl(raw: string): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let url: URL
  try { url = new URL(raw.trim()) } catch { return { ok: false, error: 'Ez nem érvényes link.' } }
  if (url.protocol !== 'https:') return { ok: false, error: 'Csak https:// kezdetű cím lehet.' }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return { ok: false, error: 'Belső hálózati cím nem lehet.' }
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return { ok: false, error: 'Belső hálózati cím nem lehet.' }
  } catch { return { ok: false, error: 'A cím nem található.' } }
  return { ok: true, url }
}

/** Egy esemény elküldése. Visszaadja a válasz HTTP-kódját (vagy a hibát) — a próba-küldés kiírja. */
export async function postWebhook(rawUrl: string, event: WebhookEvent, data: Record<string, unknown>, test = false): Promise<{ ok: boolean; status?: number; error?: string }> {
  const chk = await checkWebhookUrl(rawUrl)
  if (!chk.ok) return { ok: false, error: chk.error }
  try {
    const res = await fetch(chk.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'davelopment-booking-webhook/1' },
      body: JSON.stringify({ event, test, sent_at: new Date().toISOString(), ...data }),
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    })
    return { ok: res.ok, status: res.status }
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'TimeoutError' ? 'Nem válaszolt 5 másodpercen belül.' : 'Nem sikerült elérni a címet.' }
  }
}
