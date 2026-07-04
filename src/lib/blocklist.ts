import type { Where } from 'payload'
import { getPayloadClient } from '@/lib/payload'

/**
 * Tiltólista-ellenőrzés (üzletenként). Igaz, ha az adott üzletnél van olyan
 * `blocked` Customers-rekord, amelynek e-mailje VAGY telefonja egyezik a foglalóéval.
 * A hívó (foglalás-route) ez alapján ÁLTALÁNOS hibát ad — nem árulja el a tiltást.
 */
export async function isGuestBlocked(args: {
  business: 'salon' | 'restaurant'
  businessId: string | number
  email?: string | null
  phone?: string | null
}): Promise<boolean> {
  const email = args.email?.trim().toLowerCase() || null
  const phone = args.phone?.trim() || null
  if (!email && !phone) return false

  const payload = await getPayloadClient()
  const or: Where[] = []
  if (email) or.push({ customer_email: { equals: email } })
  if (phone) or.push({ customer_phone: { equals: phone } })

  const res = await payload.find({
    collection: 'customers',
    where: {
      and: [{ [args.business]: { equals: args.businessId } }, { blocked: { equals: true } }, { or }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.totalDocs > 0
}
