import { getPayloadClient } from './payload'
import type { Where } from 'payload'

/**
 * A vendég marketing-hírlevél hozzájárulásának tartós elmentése a `Customers` táblába — a
 * `/api/customers` route-ban már meglévő e-mail/telefon + `match_index` dedup-mintát követve
 * (ne jöjjön létre duplikátum, ha a vendégnek már van rekordja tiltás/javítás miatt). Csak
 * AKKOR hívandó, ha a vendég a foglaló-widgeten bepipálta a marketing-checkboxot — a GDPR
 * hozzájárulás sose retroaktív, és a jelölőnégyzet mindig üresen indul.
 */
export async function upsertMarketingConsent(params: {
  kind: 'salon' | 'restaurant'
  businessId: string | number
  name?: string | null
  email?: string | null
  phone?: string | null
  city?: string | null
  country?: string | null
}): Promise<void> {
  const { kind, businessId, name, email: rawEmail, phone: rawPhone, city, country } = params
  const email = rawEmail?.trim().toLowerCase() || null
  const phone = rawPhone?.trim() || null
  if (!email && !phone) return

  const payload = await getPayloadClient()
  const scope = kind
  const bizId: string | number = typeof businessId === 'string' && /^\d+$/.test(businessId) ? Number(businessId) : businessId

  const or: Where[] = []
  if (email) {
    or.push({ customer_email: { equals: email } })
    or.push({ match_index: { contains: email } })
  }
  if (phone) {
    or.push({ customer_phone: { equals: phone } })
    or.push({ match_index: { contains: phone } })
  }

  const existing = await payload.find({
    collection: 'customers',
    where: { and: [{ [scope]: { equals: bizId } }, { or }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const now = new Date().toISOString()

  if (existing.docs[0]) {
    const doc = existing.docs[0] as { marketing_consent?: boolean | null; customer_name?: string | null; customer_city?: string | null; customer_country?: string | null }
    // A NÉV csak akkor pótlódik, ha korábban hiányzott (nem írjuk felül egy esetleges kézi
    // javítást a Vendégek oldalon). A VÁROS/ORSZÁG viszont mindig a LEGUTÓBBI foglaláson
    // megadott értékre frissül — ha a vendég elköltözik és új várost ír be, a profilja is
    // azt mutassa, ne az első alkalommal megadott (azóta elavult) adatot.
    const backfill: Record<string, string> = {}
    if (!doc.customer_name && name?.trim()) backfill.customer_name = name.trim()
    if (city?.trim() && city.trim() !== doc.customer_city) backfill.customer_city = city.trim()
    if (country?.trim() && country.trim() !== doc.customer_country) backfill.customer_country = country.trim()
    if (doc.marketing_consent) {
      if (Object.keys(backfill).length > 0) {
        await payload.update({ collection: 'customers', id: existing.docs[0].id, data: backfill, overrideAccess: true })
      }
      return // már feliratkozott, a hozzájárulást nincs mit frissíteni
    }
    await payload.update({
      collection: 'customers',
      id: existing.docs[0].id,
      data: { marketing_consent: true, marketing_consent_at: now, ...backfill },
      overrideAccess: true,
    })
    return
  }

  const existingKeys: string[] = []
  const matchIndex = Array.from(new Set([...existingKeys, email, phone].filter(Boolean))).join('\n')

  await payload.create({
    collection: 'customers',
    data: {
      [scope]: bizId,
      customer_name: name?.trim() || null,
      customer_email: email,
      customer_phone: phone,
      customer_city: city?.trim() || null,
      customer_country: country?.trim() || null,
      match_index: matchIndex,
      marketing_consent: true,
      marketing_consent_at: now,
    },
    overrideAccess: true,
  })
}
