import { getPayloadClient } from './payload'
import type { AuditLogEntry } from '@/payload/payload-types'
import type { AuditEntry } from '@/components/settings/SettingsHub'

/** Az AUDIT-NAPLÓ panel VALÓS adata egy üzlethez: a legutóbbi ~30 bejegyzés, üzletre szűrve. */
export async function getAuditLogForBusiness(opts: {
  type: 'salon' | 'restaurant'
  businessId: string | number
  limit?: number
}): Promise<AuditEntry[]> {
  const payload = await getPayloadClient()
  try {
    const res = await payload.find({
      collection: 'audit-log',
      where:
        opts.type === 'salon'
          ? { salon: { equals: opts.businessId } }
          : { restaurant: { equals: opts.businessId } },
      limit: opts.limit ?? 30,
      depth: 0,
      overrideAccess: true,
      sort: '-createdAt',
    })
    return (res.docs as AuditLogEntry[]).map((e) => ({
      id: String(e.id),
      actor: e.actor_label || 'Rendszer',
      action: e.action,
      summary: e.summary || '',
      collection: e.collection_name || '',
      createdAt: e.createdAt,
    }))
  } catch {
    return []
  }
}
