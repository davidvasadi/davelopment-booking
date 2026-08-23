import type { Payload } from 'payload'

/**
 * A belső (nem-vendég) emailek — "Új foglalás"/"Beosztás változás" — SAJÁT, EXPLICIT
 * `_email` preferencia-mezőt kapnak (`Users.personal_notif_prefs.bookings_email`/
 * `schedule_email`), a push/in-app-tól FÜGGETLENÜL: alapból KIKAPCSOLVA mindenkinél
 * (owner is), mert az app a fő csatorna — a push/in-app-ot ez NEM érinti, azok külön,
 * a meglévő `bookings`/`schedule` mezőn mennek, változatlanul.
 */
export type EmailNotifCategory = 'bookings_email' | 'schedule_email'

/** Eldönti, hogy egy email-cím tulajdonosa (ha van hozzá bejelentkezhető User) explicit
 *  bekapcsolta-e ezt a belső email-kategóriát. Ha a címhez nem tartozik User (pl. sima
 *  kapcsolati cím), a régi, gate nélküli viselkedést tartjuk meg (engedjük) — nincs mit
 *  letiltani rajta. */
export async function isInternalEmailAllowed(
  payload: Payload,
  email: string | null | undefined,
  category: EmailNotifCategory,
): Promise<boolean> {
  if (!email) return false
  try {
    const res = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const user = res.docs[0] as { personal_notif_prefs?: Record<string, boolean | null> } | undefined
    if (!user) return true
    return user.personal_notif_prefs?.[category] === true
  } catch {
    return true
  }
}

/**
 * A "Új foglalás" email a KIOSZTOTT szakembernek megy (sose az összes stábnak) — ha a
 * szerepének `booking_notify_level`-je explicit `'off'`, a tulaj TUDATOSAN kikapcsolta neki
 * ezt a foglalás-értesítés-vonalat, akkor is, ha ő maga személyesen bekapcsolta a
 * `bookings_email`-t — a szerep-szintű tiltás felülír. Ha nincs egyedi szerepe (vagy a
 * mezőn valamiért nincs érték), NEM tiltunk emiatt (a személyes preferencia dönt egyedül).
 */
export async function isBookingNotifyLevelOff(
  payload: Payload,
  salonId: string | number,
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false
  try {
    const users = await payload.find({ collection: 'users', where: { email: { equals: email } }, limit: 1, depth: 0, overrideAccess: true })
    const userId = users.docs[0]?.id
    if (!userId) return false
    const memberships = await payload.find({
      collection: 'memberships',
      where: { and: [{ salon: { equals: salonId } }, { user: { equals: userId } }, { status: { equals: 'active' } }] },
      limit: 1, depth: 1, overrideAccess: true,
    })
    const level = (memberships.docs[0]?.custom_role as { booking_notify_level?: string | null } | null | undefined)?.booking_notify_level
    return level === 'off'
  } catch {
    return false
  }
}

/** Egy email-cím-lista `category` szerint szűrve (csak akik engedélyezték). */
export async function filterAllowedEmails(
  payload: Payload,
  emails: (string | null | undefined)[],
  category: EmailNotifCategory,
): Promise<string[]> {
  const candidates = [...new Set(emails.filter((e): e is string => !!e && /^\S+@\S+\.\S+$/.test(e)))]
  const results = await Promise.all(candidates.map(async (e) => ((await isInternalEmailAllowed(payload, e, category)) ? e : null)))
  return results.filter((e): e is string => !!e)
}
