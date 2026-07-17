import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import type { EmailLogEntry } from '@/payload/payload-types'

export type EmailType = EmailLogEntry['type']

/**
 * Egy kimenő email naplózása az `email-log` collectionbe (best-effort). A backstage ebből
 * számolja, havonta hány email megy ki (Resend-csomag megválasztásához). A hibákat lenyeli —
 * a naplózás sosem törheti meg a küldést.
 */
export async function logEmail(type: EmailType, to: string | undefined, subject: string | undefined, ok: boolean, error?: string): Promise<void> {
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'email-log',
      overrideAccess: true,
      data: { type, to: to ?? null, subject: subject ?? null, ok, error: error ?? null },
    })
  } catch {
    /* a naplózás nem blokkoló */
  }
}
