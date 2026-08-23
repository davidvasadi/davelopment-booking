import { NextRequest, NextResponse } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { authOrUnauthorized } from '@/lib/salonRouteAuth'
import { assertAnyCapability } from '@/lib/apiCapability'
import type { Customer } from '@/payload/payload-types'

/**
 * Egy KIKÜLDÖTT kampány tényleges címzett-listája — az `email-log`-ból (`campaign` reláció),
 * NEM a `target_customer_ids`-ból (az csak a küldéskori KIJELÖLÉST tükrözi, "Mindenki"-nél
 * üres is lehet) — a cél, hogy a tulaj lássa, kik kapták meg ténylegesen, hogy ne küldje ki
 * véletlenül újra ugyanazoknak. Az e-mail-hez a `customers`-ből párosítunk nevet, ha van.
 */
export async function GET(request: NextRequest) {
  const user = await authOrUnauthorized()
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(request.url)
  const kind = searchParams.get('kind')
  const businessId = searchParams.get('businessId')
  const campaignId = searchParams.get('campaignId')
  if ((kind !== 'salon' && kind !== 'restaurant') || !businessId || !campaignId) {
    return NextResponse.json({ error: 'Érvénytelen adatok' }, { status: 400 })
  }

  const payload = await getPayloadClient()
  const denied = await assertAnyCapability(user.id, kind, businessId, ['marketing.view', 'marketing.manage'])
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

  const logs = await payload.find({
    collection: 'email-log',
    where: { and: [{ campaign: { equals: campaignId } }, { type: { equals: 'marketing_broadcast' } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const rows = logs.docs as Array<{ to?: string | null; status?: string | null }>
  const emails = Array.from(new Set(rows.map((r) => r.to).filter((e): e is string => !!e)))

  const nameByEmail = new Map<string, string>()
  if (emails.length > 0) {
    const customersRes = await payload.find({
      collection: 'customers',
      where: { and: [{ [kind]: { equals: businessId } }, { customer_email: { in: emails } }] },
      limit: emails.length,
      depth: 0,
      overrideAccess: true,
    })
    for (const c of customersRes.docs as Customer[]) {
      if (c.customer_email && c.customer_name) nameByEmail.set(c.customer_email, c.customer_name)
    }
  }

  const recipients = rows
    .filter((r) => !!r.to)
    .map((r) => ({ email: r.to as string, name: nameByEmail.get(r.to as string) ?? null, status: r.status ?? 'sent' }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, 'hu'))

  return NextResponse.json({ recipients })
}
