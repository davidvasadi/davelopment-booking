import type { Payload } from 'payload'

function startOfMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

/**
 * A Marketing dashboard-oldal fejléc-statisztikái: havi felhasznált email-mennyiség +
 * ebből hány lett MEGNYITVA (a Resend webhook — `src/app/api/webhooks/resend/route.ts` —
 * már frissíti az `email-log` `status`-t kézbesítéskor/megnyitáskor, ez csak összegzi).
 */
export async function newsletterMonthStats(payload: Payload, kind: 'salon' | 'restaurant', businessId: string | number): Promise<{ usedThisMonth: number; openedThisMonth: number }> {
  const res = await payload.find({
    collection: 'email-log',
    where: { and: [{ type: { equals: 'marketing_broadcast' } }, { [kind]: { equals: businessId } }, { createdAt: { greater_than_equal: startOfMonthIso() } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  const docs = res.docs as Array<{ status?: string | null }>
  const openedThisMonth = docs.filter((d) => d.status === 'opened' || d.status === 'clicked').length
  return { usedThisMonth: res.totalDocs, openedThisMonth }
}

/** Kampányonkénti nyitás-szám a megadott kampány-id-khez (a lista-nézet "Megnyitva" oszlopához). */
export async function campaignOpenCounts(payload: Payload, campaignIds: Array<string | number>): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (campaignIds.length === 0) return map
  const res = await payload.find({
    collection: 'email-log',
    where: { and: [{ campaign: { in: campaignIds } }, { status: { in: ['opened', 'clicked'] } }] },
    limit: 5000,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of res.docs as Array<{ campaign?: unknown }>) {
    const cid = doc.campaign && typeof doc.campaign === 'object' ? (doc.campaign as { id: unknown }).id : doc.campaign
    if (cid == null) continue
    const key = String(cid)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}
