import crypto from 'crypto'

/**
 * Platform-szintű titkosítás üzletenkénti (BYO) API-kulcsokhoz (Számlázz.hu Agent-kulcs,
 * Billingo API-kulcs) — ELLENTÉTBEN a Stripe Connect account-id-vel, ezek VALÓDI titkok, nem
 * tárolhatók sima szövegként (lásd docs/audit/FUTURE-FEATURES.md guest-payment terv +
 * SettingsHub biztonsági megjegyzés).
 *
 * AES-256-GCM: a `ENCRYPTION_KEY` env (32 bájt, base64) a platform EGYETLEN saját titka, amivel
 * MINDEN üzlet kulcsát titkosítjuk — nem üzletenkénti kulcs (az önmagában nem oldana meg semmit,
 * hiszen valahol akkor is tárolni kellene). A `decrypt` csak szerver-oldali kódból hívható; a
 * titkosított mezők Payload `access.read: () => false`-szal amúgy is ki vannak zárva minden
 * API-válaszból, ez a lib csak a DB-ben nyugvó adatot védi.
 *
 * Tárolt formátum: `iv:authTag:ciphertext`, mindhárom hex-kódolva.
 */

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('ENCRYPTION_KEY hiányzik a környezetből')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY-nek 32 bájtosnak kell lennie (base64-kódolva)')
  return key
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const [ivHex, authTagHex, dataHex] = stored.split(':')
  if (!ivHex || !authTagHex || !dataHex) throw new Error('Érvénytelen titkosított érték formátum')
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8')
}

export const isEncryptionEnabled = (): boolean => !!process.env.ENCRYPTION_KEY

/**
 * A `salon|restaurant/settings` PATCH route ezt hívja meg a mentés ELŐTT — a kliens (Settings
 * UI) NYERS kulcsot küld (a titkosítás Node `crypto`-t igényel, böngészőben nem futtatható),
 * ezt itt, szerver-oldalon titkosítjuk, mielőtt a DB-be kerülne. `body`-t helyben módosítja.
 */
export function encryptInvoiceKeysInBody(body: Record<string, unknown>): void {
  const inv = body.invoice_settings
  if (!inv || typeof inv !== 'object') return
  const rec = inv as Record<string, unknown>
  if (typeof rec.szamlazz_agent_key_enc === 'string' && rec.szamlazz_agent_key_enc.trim()) {
    rec.szamlazz_agent_key_enc = encrypt(rec.szamlazz_agent_key_enc.trim())
  }
  if (typeof rec.billingo_api_key_enc === 'string' && rec.billingo_api_key_enc.trim()) {
    rec.billingo_api_key_enc = encrypt(rec.billingo_api_key_enc.trim())
  }
}
