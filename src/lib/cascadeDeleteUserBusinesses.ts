import type { Payload, PayloadRequest } from 'payload'

/**
 * Egy user MINDEN üzletét (szalon+étterem) + a hozzá tartozó fiók-előfizetést (és számláit)
 * + a push-feliratkozásait törli — a user-sor tényleges törlése/megőrzése ELŐTT hívandó, akár
 * teljes hard-delete (backstage admin), akár self-delete anonymizálás előtt (lásd
 * `/api/delete-account`), mert ezek NOT NULL idegenkulcsai (salons/restaurants/subscriptions
 * .owner_id, push_subscriptions.user_id) elhasalnának, ha a user-sor előbb tűnne el/változna.
 *
 * Használja: `Users.beforeDelete` hook (admin hard-delete) ÉS a self-delete route-ok.
 */
export async function cascadeDeleteUserBusinesses(
  payload: Payload,
  userId: number | string,
  req?: PayloadRequest,
): Promise<void> {
  const salons = await payload.find({
    collection: 'salons',
    where: { owner: { equals: userId } },
    limit: 100,
    overrideAccess: true,
    req,
  })
  for (const salon of salons.docs) {
    await payload.delete({ collection: 'salons', id: salon.id, overrideAccess: true, req })
  }

  const restaurants = await payload.find({
    collection: 'restaurants',
    where: { owner: { equals: userId } },
    limit: 100,
    overrideAccess: true,
    req,
  })
  for (const restaurant of restaurants.docs) {
    await payload.delete({ collection: 'restaurants', id: restaurant.id, overrideAccess: true, req })
  }

  // FIÓK-szintű előfizetés: a `subscriptions` rekord a USERHEZ tartozik (owner=userId), NEM az
  // üzlethez — az üzlet-törlés NEM viszi el, kézzel kell.
  const subs = await payload.find({
    collection: 'subscriptions',
    where: { owner: { equals: userId } },
    limit: 100,
    overrideAccess: true,
    req,
  })
  for (const sub of subs.docs) {
    // invoices.subscription_id NOT NULL — előbb a számlák.
    await payload.delete({
      collection: 'invoices',
      where: { subscription: { equals: sub.id } },
      overrideAccess: true,
      req,
    })
    await payload.delete({ collection: 'subscriptions', id: sub.id, overrideAccess: true, req })
  }

  // push_subscriptions.user_id NOT NULL, de a DB-oldali szabály ON DELETE SET NULL — enélkül a
  // user-törlés "null value in column user_id violates not-null constraint"-tal hasalna el
  // (ez okozta, hogy a backstage-törlés push-értesítést használó fiókoknál nem ment le elsőre).
  await payload
    .delete({ collection: 'push-subscriptions', where: { user: { equals: userId } }, overrideAccess: true, req })
    .catch(() => null)
}
