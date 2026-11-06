import crypto from 'crypto'
import type { Payload } from 'payload'
import { seedSalonTemplates, seedRestaurantTemplate } from './seedTemplates'
import { slugify } from './slug'

/**
 * Új fiók: user + szalon / étterem + összekötés + kezdő-sablon (kategóriák, minta szolgáltatások / termek). A kódos
 * regisztráció (lib/authCodes) a helyes kód után hívja — a kód egyben az e-mail megerősítése (`verified`), jelszó
 * nincs (véletlen, senki nem ismeri; belépni kóddal vagy Google-lel lehet). A hely / sablon hibája nem buktatja a
 * fiókot: a dashboardon pótolható.
 */
export type AccountInput = {
  kind: 'salon' | 'restaurant'
  ownerName: string
  placeName: string
  email: string
  password?: string
  city?: string
  phone?: string
  businessTypes?: string[]
  templateId?: string
  tier?: 'starter' | 'pro'
  /** ajánló kód (a regisztrációs űrlapról vagy az `/r/<kód>` link sütijéből) */
  referralCode?: string
}


export async function createAccount(payload: Payload, input: AccountInput, opts: { verified?: boolean } = {}): Promise<{ user: { id: number | string; email: string; role: string }; placeId: number | string | null; kind: 'salon' | 'restaurant' }> {
  const { kind, ownerName, placeName, city, phone, tier } = input
  const email = input.email.toLowerCase().trim()
  const role = kind === 'restaurant' ? 'restaurant_owner' : 'salon_owner'
  const user = await payload.create({
    collection: 'users',
    data: { name: ownerName, email, password: input.password ?? crypto.randomBytes(24).toString('base64url'), role, ...(opts.verified ? { _verified: true } : {}) } as never,
    overrideAccess: true,
    disableVerificationEmail: true,
  }) as { id: number | string }
  if (opts.verified) await payload.update({ collection: 'users', id: user.id, data: { _verified: true } as never, overrideAccess: true }).catch(() => null)

  const collection = kind === 'restaurant' ? 'restaurants' : 'salons'
  const base = slugify(placeName)
  let place: { id: number | string } | null = null
  for (const slug of [base, `${base}-${Date.now().toString(36)}`]) {
    try {
      place = await payload.create({ collection, data: { name: placeName, slug, owner: user.id, phone, city, is_active: true, ...(tier ? { tier } : {}) } as never, overrideAccess: true, user: user as never }) as { id: number | string }
      break
    } catch (e) { if (slug !== base) console.error(`[createAccount] ${collection} create error:`, e) }
  }
  if (place) {
    try {
      await payload.update({ collection: 'users', id: user.id, data: { [kind]: place.id, last_active_business: `${kind}:${place.id}` } as never, overrideAccess: true })
    } catch (e) { console.error('[createAccount] user place-link error:', e) }
    try {
      if (kind === 'salon' && input.businessTypes?.length) await seedSalonTemplates(payload, place.id, input.businessTypes, user as never)
      else if (kind === 'restaurant' && input.templateId) await seedRestaurantTemplate(payload, place.id, input.templateId, user as never)
    } catch (e) { console.error('[createAccount] seed error:', e) }
  }
  return { user: { id: user.id, email, role }, placeId: place?.id ?? null, kind }
}
