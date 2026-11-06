import type { Where } from 'payload'
import { getPayloadClient } from './payload'
import { fixMediaUrl } from './utils'
import type { AuditLogEntry, AuditChangeEntry } from '@/payload/payload-types'
import type { AuditEntry } from '@/components/settings/SettingsHub'

/**
 * VISSZATEKINTÉSI ABLAK (retention). A sorokat NEM töröljük — csak a nézet szűr erre az
 * ablakra. Így egy későbbi csomag-emelés visszamenőleg is kinyithatja a történetet.
 * 90 nap a bevált SMB-alap; a magasabb csomag később ezt tolhatja feljebb (fiók-sub).
 */
export const AUDIT_WINDOW_DAYS = 90

/** A JSON `changes` mező biztonságos AuditChangeEntry[]-vé alakítása (védett a szemét ellen). */
function normalizeChanges(raw: unknown): AuditChangeEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({
      field: String(c.field ?? ''),
      from: (c.from ?? null) as AuditChangeEntry['from'],
      to: (c.to ?? null) as AuditChangeEntry['to'],
    }))
    .filter((c) => c.field)
  return out.length ? out : undefined
}

/**
 * Az AUDIT-NAPLÓ panel VALÓS adata egy üzlethez: a visszatekintési ablakon belüli bejegyzések,
 * üzletre szűrve, legfrissebb elöl. A UI innen szűr tovább (akció-típus + finomabb dátum).
 */
export async function getAuditLogForBusiness(opts: {
  type: 'salon' | 'restaurant'
  businessId: string | number
  days?: number
  limit?: number
}): Promise<AuditEntry[]> {
  const payload = await getPayloadClient()
  const days = opts.days ?? AUDIT_WINDOW_DAYS
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  try {
    const businessFilter: Where =
      opts.type === 'salon'
        ? { salon: { equals: opts.businessId } }
        : { restaurant: { equals: opts.businessId } }
    const where: Where = { and: [businessFilter, { createdAt: { greater_than_equal: since } }] }
    const res = await payload.find({
      collection: 'audit-log',
      where,
      limit: opts.limit ?? 300,
      depth: 0,
      overrideAccess: true,
      sort: '-createdAt',
    })
    const docs = res.docs as AuditLogEntry[]
    // a végrehajtók profilképe (Users.avatar_url) — egy lekérdezéssel
    const ids = [...new Set(docs.map((e) => (typeof e.actor === 'object' ? e.actor?.id : e.actor)).filter((x) => x != null).map(Number))]
    const imgs = new Map<number, string | null>()
    if (ids.length) {
      const us = await payload.find({ collection: 'users', where: { id: { in: ids } }, depth: 0, limit: ids.length, overrideAccess: true, select: { avatar_url: true } as never })
      for (const u of us.docs as unknown as { id: number; avatar_url?: string | null }[]) imgs.set(u.id, fixMediaUrl(u.avatar_url) ?? null)
    }
    return docs.map((e) => ({
      id: String(e.id),
      actorImg: imgs.get(Number(typeof e.actor === 'object' ? e.actor?.id : e.actor)) ?? null,
      actor: e.actor_label || 'Rendszer',
      actorEmail: e.actor_email || undefined,
      action: e.action,
      summary: e.summary || '',
      collection: e.collection_name || '',
      changes: normalizeChanges(e.changes),
      createdAt: e.createdAt,
    }))
  } catch {
    return []
  }
}
