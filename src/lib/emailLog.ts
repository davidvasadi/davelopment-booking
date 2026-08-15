import 'server-only'
import { getPayloadClient } from '@/lib/payload'
import type { EmailLogEntry } from '@/payload/payload-types'

export type EmailType = EmailLogEntry['type']

export interface LogEmailOpts {
  /** A Resend `emails.send()` válaszának id-je — enélkül a kézbesítve/megnyitva webhook-
   *  eseményeket nem lehet visszapárosítani ehhez a rekordhoz. */
  resendId?: string
  bookingId?: string | number
  reservationId?: string | number
  /** Csak `marketing_broadcast`-nál — az üzlet, aminek a havi hírlevél-plafonjába számít. */
  salonId?: string | number
  restaurantId?: string | number
  /** Csak `marketing_broadcast`-nál — a kampány, amihez a nyitási-arány számításkor tartozik. */
  campaignId?: string | number
}

/**
 * Egy kimenő email naplózása az `email-log` collectionbe (best-effort). A backstage ebből
 * számolja, havonta hány email megy ki (Resend-csomag megválasztásához); a `resendId` mentésével
 * a Resend webhook (src/app/api/webhooks/resend/route.ts) utólag frissíti a kézbesítési
 * állapotot (kézbesítve/megnyitva). A hibákat lenyeli — a naplózás sosem törheti meg a küldést.
 */
export async function logEmail(
  type: EmailType,
  to: string | undefined,
  subject: string | undefined,
  ok: boolean,
  error?: string,
  opts?: LogEmailOpts,
): Promise<void> {
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'email-log',
      overrideAccess: true,
      data: {
        type,
        to: to ?? null,
        subject: subject ?? null,
        ok,
        error: error ?? null,
        resend_id: opts?.resendId ?? null,
        status: ok ? 'sent' : 'failed',
        booking: opts?.bookingId ?? null,
        reservation: opts?.reservationId ?? null,
        salon: opts?.salonId ?? null,
        restaurant: opts?.restaurantId ?? null,
        campaign: opts?.campaignId ?? null,
      },
    })
  } catch {
    /* a naplózás nem blokkoló */
  }
}
