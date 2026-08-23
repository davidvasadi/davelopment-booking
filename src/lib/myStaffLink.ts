import { getPayloadClient } from './payload'

/**
 * A bejelentkezett fiókhoz tartozó SAJÁT `staff` rekord azonosítója egy adott szalonban.
 *
 * Elsődleges: a `Staff.user` reláció (megbízható — ezt állítja be a meghívás-elfogadás
 * AUTOMATIKUSAN a taglaknál, és a Munkatársak oldalon a tulaj EXPLICITEN a "Ez a saját
 * fiókom" kapcsolóval saját magánál). Fallback: email-egyeztetés (régi, még nem linkelt
 * rekordoknál) — ez a régi, törékeny mechanizmus, amit a `user` reláció vált ki.
 *
 * `null`-t ad vissza, ha a fiókhoz NINCS staff-rekord ebben a szalonban (pl. a tulaj sosem
 * vette fel magát szakembernek) — ilyenkor a "saját munka" nézeteknek helyesen ÜRES adatot
 * kell mutatniuk, nem a teljes üzletet (lásd a hívó oldalak `?? 0` sentinel-ét).
 */
export async function findMyStaffId(
  salonId: string | number,
  userId: string | number,
  userEmail?: string | null,
): Promise<string | number | null> {
  const payload = await getPayloadClient()

  const byUser = await payload.find({
    collection: 'staff',
    where: { and: [{ salon: { equals: salonId } }, { user: { equals: userId } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  if (byUser.docs[0]) return byUser.docs[0].id

  if (userEmail) {
    const byEmail = await payload.find({
      collection: 'staff',
      where: { and: [{ salon: { equals: salonId } }, { email: { equals: userEmail } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    if (byEmail.docs[0]) return byEmail.docs[0].id
  }

  return null
}
