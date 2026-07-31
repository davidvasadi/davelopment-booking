/**
 * Beosztás-értesítő helperek — a "Nap véglegesítése" gomb hívja, SOHA nem az automatikus CRUD.
 *
 * notifyShiftMember: étterem → membership id alapján (member mező)
 * notifyShiftStaff: szalon → staff id alapján (staff mező)
 *
 * Mindkettő küld push + in-app értesítést HA personal_notif_prefs.schedule !== false.
 */
import type { BasePayload } from 'payload'
import { sendPushToUsers } from './webPush'
import { sendShiftChangeEmail } from './email'

type Event = 'created' | 'modified' | 'deleted'
type BizType = 'salon' | 'restaurant'

export async function notifyShiftMember(
  payload: BasePayload,
  memberId: string | number | null | undefined,
  bizType: BizType,
  bizId: string | number | null | undefined,
  event: Event,
  shiftDate: string,
  startTime?: string | null,
): Promise<void> {
  if (!memberId || !bizId) return

  try {
    // Membership + custom_role betöltése
    const membership = await payload.findByID({
      collection: 'memberships',
      id: memberId,
      depth: 1,
      overrideAccess: true,
    })
    if (!membership) return

    const userId = typeof membership.user === 'object' && membership.user !== null
      ? (membership.user as { id: string | number }).id
      : membership.user
    if (!userId) return

    // Személyes preferencia: értesítés megy mindenki KIVÉVE aki explicit kikapcsolta
    const fullUser = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    const personalPrefs = fullUser?.personal_notif_prefs as Record<string, boolean | null> | null | undefined
    if (personalPrefs?.schedule === false) return

    // Üzenet szövege
    const when = [shiftDate, startTime].filter(Boolean).join(' ')
    const title = event === 'created' ? 'Új műszak' : event === 'modified' ? 'Beosztás módosítva' : 'Beosztás törölve'
    const body = event === 'created'
      ? `Beosztást kaptál${when ? ` – ${when}` : ''}`
      : event === 'modified'
        ? `Műszakod módosult${when ? ` – ${when}` : ''}`
        : `Műszakod törölve lett${when ? ` – ${when}` : ''}`

    // In-app értesítés — user-re célozva, dátum + event metadata-val (ikon-szín + naptár navigáció).
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        [bizType]: Number(bizId),
        user: Number(userId),
        audience: 'member',
        type: 'schedule_change',
        title,
        body,
        read: false,
        metadata: { date: shiftDate, event },
      } as never,
    })

    // Push értesítés — URL-ben a dátum, hogy a push kattintás pontosan oda vigyen.
    const scheduleBase = bizType === 'restaurant' ? '/restaurant/schedule' : '/dashboard/schedule'
    const url = `${scheduleBase}?date=${shiftDate}`
    await sendPushToUsers(payload, [userId], { title, body, url, tag: `shift-${event}-${userId}` })

    // Email értesítés — az üzlet neve + logója a fejlécbe.
    const userEmail = fullUser?.email as string | null | undefined
    if (userEmail) {
      const biz = await payload.findByID({ collection: bizType === 'restaurant' ? 'restaurants' : 'salons', id: bizId, depth: 1, overrideAccess: true }).catch(() => null)
      const bizName = (biz as { name?: string } | null)?.name ?? 'davelopment booking'
      const logoField = (biz as { logo?: unknown } | null)?.logo
      const bizLogoUrl = logoField && typeof logoField === 'object' && 'url' in logoField ? (logoField as { url: string }).url : null
      const memberName = (membership.name as string | null | undefined) || (fullUser?.name as string | null | undefined) || userEmail
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
      await sendShiftChangeEmail({
        to: userEmail,
        staffName: memberName,
        businessName: bizName,
        businessLogoUrl: bizLogoUrl,
        event,
        shiftDate,
        startTime,
        scheduleUrl: `${APP_URL}${scheduleBase}?date=${shiftDate}`,
      })
    }
  } catch (err) {
    console.error('[notifyShiftMember]', err)
  }
}

/** Szalon shift értesítés — staff-id (staff collection) alapján, email-egyezéssel keres userId-t. */
export async function notifyShiftStaff(
  payload: BasePayload,
  staffId: string | number,
  salonId: string | number,
  event: Event,
  shiftDate: string,
  startTime?: string | null,
): Promise<void> {
  if (!staffId || !salonId) return
  try {
    const staffMember = await payload.findByID({ collection: 'staff', id: staffId, depth: 0, overrideAccess: true }) as { email?: string | null } | null
    const email = staffMember?.email
    if (!email) return

    const userRes = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    const userId = userRes.docs[0]?.id
    if (!userId) return

    const fullUser = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    const personalPrefs = fullUser?.personal_notif_prefs as Record<string, boolean | null> | null | undefined
    if (personalPrefs?.schedule === false) return

    const when = [shiftDate, startTime].filter(Boolean).join(' ')
    const title = event === 'created' ? 'Új műszak' : event === 'modified' ? 'Beosztás módosítva' : 'Beosztás törölve'
    const body = event === 'created'
      ? `Beosztást kaptál${when ? ` – ${when}` : ''}`
      : event === 'modified'
        ? `Műszakod módosult${when ? ` – ${when}` : ''}`
        : `Műszakod törölve lett${when ? ` – ${when}` : ''}`

    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        salon: Number(salonId),
        user: Number(userId),
        audience: 'member',
        type: 'schedule_change',
        title, body, read: false,
        metadata: { date: shiftDate, event },
      } as never,
    })

    await sendPushToUsers(payload, [userId], { title, body, url: `/dashboard/schedule?date=${shiftDate}`, tag: `shift-${event}-${userId}` })

    // Email értesítés
    if (email) {
      const salon = await payload.findByID({ collection: 'salons', id: salonId, depth: 1, overrideAccess: true }).catch(() => null)
      const bizName = (salon as { name?: string } | null)?.name ?? 'davelopment booking'
      const logoField = (salon as { logo?: unknown } | null)?.logo
      const bizLogoUrl = logoField && typeof logoField === 'object' && 'url' in logoField ? (logoField as { url: string }).url : null
      const staffName = (staffMember as { name?: string | null } | null)?.name ?? email
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'
      await sendShiftChangeEmail({
        to: email,
        staffName,
        businessName: bizName,
        businessLogoUrl: bizLogoUrl,
        event,
        shiftDate,
        startTime,
        scheduleUrl: `${APP_URL}/dashboard/schedule?date=${shiftDate}`,
      })
    }
  } catch (err) {
    console.error('[notifyShiftStaff]', err)
  }
}
