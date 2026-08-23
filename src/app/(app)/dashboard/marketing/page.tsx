import { getOwnedSalon } from '@/lib/salonContext'
import { requireAnyCapability } from '@/lib/requireCapability'
import { can } from '@/lib/permissions'
import { getPayloadClient } from '@/lib/payload'
import { getPricing } from '@/lib/pricing'
import { monthlyEmailCapForTier } from '@/lib/tier'
import { newsletterMonthStats, campaignOpenCounts } from '@/lib/marketingStats'
import { NewsletterManager, type CampaignRow, type SubscriberRow } from '@/components/dashboard/NewsletterManager'
import type { MarketingCampaign, Customer } from '@/payload/payload-types'

export const dynamic = 'force-dynamic'

export default async function MarketingPage() {
  const { salon, capabilities } = await getOwnedSalon()
  requireAnyCapability(capabilities, ['marketing.view', 'marketing.manage'], '/dashboard')
  const payload = await getPayloadClient()
  const pricing = await getPricing()

  // A feliratkozó-lista SZERVER-oldalon lapozott (lásd `/api/marketing/subscribers`) — itt csak
  // az első oldalt (20 sor) töltjük be SSR-ben, hogy nagy vendégkörnél se lassuljon az oldal.
  // A `countryDocsRes` csak az ország-mezőt kéri (könnyű lekérdezés) — ebből áll össze a
  // szűrő-dropdown lehetséges ország-listája.
  const [subscribersRes, monthStats, campaignsRes, countryDocsRes] = await Promise.all([
    payload.find({ collection: 'customers', where: { and: [{ salon: { equals: salon.id } }, { marketing_consent: { equals: true } }] }, sort: '-marketing_consent_at', limit: 20, depth: 0, overrideAccess: true }),
    newsletterMonthStats(payload, 'salon', salon.id),
    payload.find({ collection: 'marketing-campaigns', where: { salon: { equals: salon.id } }, sort: '-createdAt', limit: 200, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'customers', where: { and: [{ salon: { equals: salon.id } }, { marketing_consent: { equals: true } }] }, select: { customer_country: true } as never, limit: 2000, depth: 0, overrideAccess: true }),
  ])
  const countryOptions = Array.from(new Set((countryDocsRes.docs as Customer[]).map((c) => c.customer_country).filter((c): c is string => !!c))).sort()

  const subscriberDocs = subscribersRes.docs as Customer[]
  const subscribers: SubscriberRow[] = subscriberDocs.map((c) => ({
    id: String(c.id),
    name: c.customer_name ?? '',
    email: c.customer_email ?? '',
    city: c.customer_city ?? '',
    country: c.customer_country ?? null,
    consentAt: c.marketing_consent_at ?? c.createdAt,
  }))
  const subscriberCount = subscribersRes.totalDocs
  const subscribersHasMore = subscribersRes.hasNextPage

  const campaignDocs = campaignsRes.docs as MarketingCampaign[]
  const opens = await campaignOpenCounts(payload, campaignDocs.slice(0, 20).map((c) => c.id))

  const campaigns: CampaignRow[] = campaignDocs.map((c, idx) => ({
    id: String(c.id),
    subject: c.subject,
    recipient_count: c.recipient_count ?? 0,
    // A megnyitás-számot csak az első 20 kampányhoz kérdezzük le (teljesítmény) — ott 0-t
    // adunk vissza nyitás nélkül is (nem `null`-t), hogy a kördiagram MINDEN kiküldött sorban
    // megjelenjen (akár 0%-kal), ne csak akkor, ha már volt megnyitás. A 20-on túli soroknál
    // marad a `null` ("nincs adat"), mert azoknál ténylegesen nem kérdeztük le.
    opened_count: idx >= 20 ? null : c.status === 'sent' ? (opens.get(String(c.id)) ?? 0) : null,
    createdAt: c.createdAt,
    status: c.status ?? 'sent',
    blocksJson: (c.blocks_json as CampaignRow['blocksJson']) ?? null,
    targetCustomerIds: (c.target_customer_ids as string[] | null) ?? null,
  }))

  const logoUrl = salon.logo && typeof salon.logo === 'object' ? salon.logo.url : null

  return (
    <div className="p-5 lg:p-0">
      <NewsletterManager
        variant="salon"
        businessId={String(salon.id)}
        businessName={salon.name}
        logoUrl={logoUrl}
        emailCap={monthlyEmailCapForTier(pricing, salon.tier)}
        subscriberCount={subscriberCount}
        initialSubscribers={subscribers}
        initialSubscribersHasMore={subscribersHasMore}
        countryOptions={countryOptions}
        usedThisMonth={monthStats.usedThisMonth}
        openedThisMonth={monthStats.openedThisMonth}
        initialCampaigns={campaigns}
        canManage={can(capabilities, 'marketing.manage')}
      />
    </div>
  )
}
