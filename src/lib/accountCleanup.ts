import type { Payload, PayloadRequest } from 'payload'

const MS_PER_DAY = 86_400_000
/** Türelmi idő, mielőtt egy sosem befejezett regisztráció "elhagyottnak" számít — nem a mai
 *  napon kezdett wizardot törli, csak a tartósan, hetekig üresen maradt fiókot. */
const ABANDONED_ACCOUNT_GRACE_DAYS = 30

/**
 * "Üres" owner-fiók: 0 szalon, 0 étterem, 0 előfizetés, 0 staff-tagság — tehát félbehagyott/
 * sosem befejezett regisztráció — ÉS legalább `ABANDONED_ACCOUNT_GRACE_DAYS` napja létrejött.
 * Az admin, és minden élő (üzlettel/tagsággal rendelkező) user SOHA nem érintett.
 *
 * GDPR-adatminimalizálás (ld. privacy/page.tsx 6. "Adatmegőrzés" pontja: "a cél eléréséhez
 * szükséges ideig kezeljük"): egy ilyen fióknak nincs jogos célja a további megőrzésre.
 * Best-effort — egy sikertelen egyedi törlés nem szakítja meg a többit.
 */
export async function purgeAbandonedAccounts(payload: Payload, req?: PayloadRequest): Promise<number> {
  const cutoff = new Date(Date.now() - ABANDONED_ACCOUNT_GRACE_DAYS * MS_PER_DAY).toISOString()
  const users = await payload.find({
    collection: 'users',
    where: {
      and: [
        { role: { in: ['salon_owner', 'restaurant_owner'] } },
        { createdAt: { less_than: cutoff } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  let deleted = 0
  for (const u of users.docs as { id: number | string; email: string }[]) {
    try {
      const [salons, restaurants, subs, staff] = await Promise.all([
        payload.find({ collection: 'salons', where: { owner: { equals: u.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection: 'restaurants', where: { owner: { equals: u.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection: 'subscriptions', where: { owner: { equals: u.id } }, limit: 0, overrideAccess: true }),
        payload.find({ collection: 'staff', where: { email: { equals: u.email } }, limit: 0, overrideAccess: true }),
      ])
      if (salons.totalDocs > 0 || restaurants.totalDocs > 0 || subs.totalDocs > 0 || staff.totalDocs > 0) continue
      await payload.delete({ collection: 'users', id: u.id, overrideAccess: true, req })
      deleted++
    } catch (err) {
      console.error('[accountCleanup] Elhagyott fiók törlése sikertelen', u.id, err)
    }
  }
  return deleted
}
