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
    // a saját üzlet naplója — más üzlet kampány-azonosítójával nem lehet címzett-listát kérni
    where: { and: [{ campaign: { equals: campaignId } }, { type: { equals: 'marketing_broadcast' } }, { [kind]: { equals: businessId } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const rows = logs.docs as Array<{ to?: string | null; status?: string | null; opened_at?: string | null }>
  const emails = Array.from(new Set(rows.map((r) => r.to).filter((e): e is string => !!e)))

  // „Küldd el újra” (design 13.1): a feliratkozott vendégek azonosítói, akik nem nyitották meg / azóta iratkoztak fel
  const resend = searchParams.get('resend')
  if (resend === 'notOpened' || resend === 'newSince') {
    const lower = new Set(emails.map((e) => e.toLowerCase()))
    const opened = new Set(rows.filter((r) => r.opened_at || r.status === 'opened' || r.status === 'clicked').map((r) => (r.to ?? '').toLowerCase()))
    const campaign = await payload.findByID({ collection: 'marketing-campaigns', id: campaignId, depth: 0, overrideAccess: true }).catch(() => null)
    if (!campaign) return NextResponse.json({ error: 'A kampány nem található' }, { status: 404 })
    const subs = (await payload.find({ collection: 'customers', where: { and: [{ [kind]: { equals: businessId } }, { marketing_consent: { equals: true } }] }, limit: 5000, depth: 0, overrideAccess: true, select: { customer_email: true, marketing_consent_at: true, createdAt: true } as never })).docs as Customer[]
    const sentAt = new Date(campaign.createdAt).getTime()
    const ids = subs.filter((c) => {
      const e = (c.customer_email ?? '').toLowerCase()
      if (!e) return false
      return resend === 'notOpened' ? lower.has(e) && !opened.has(e) : !lower.has(e) && new Date(c.marketing_consent_at ?? c.createdAt).getTime() > sentAt
    }).map((c) => String(c.id))
    return NextResponse.json({ ids })
  }

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
    .map((r) => ({ email: r.to as string, name: nameByEmail.get(r.to as string) ?? null, status: r.status ?? 'sent', openedAt: r.opened_at ?? null }))
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email, 'hu'))

  return NextResponse.json({ recipients })
}
