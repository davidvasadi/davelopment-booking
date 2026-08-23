import type { CollectionConfig, Access, Where } from 'payload'

/**
 * Kiküldött hírlevél-kampányok NAPLÓJA — ez adja a Marketing dashboard-oldal böngészhető
 * előzmény-listáját (tárgy, kiküldés ideje, címzett-szám). Külön az `email-log`-tól: az
 * `email-log` CÍMZETTENKÉNT egy sor (kézbesítés-követéshez), ez itt KAMPÁNYONKÉNT egy sor
 * (a lista-nézethez) — a `/api/marketing/send` route mindkettőt írja egy sikeres küldéskor.
 * Csak szerver-oldal hozhat létre rekordot (`overrideAccess`), a tulaj csak OLVASSA.
 */

const isCampaignOwnerOrAdmin: Access = async ({ req }) => {
  if (req.user?.role === 'admin') return true
  if (!req.user) return false

  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  if (salonIds.length === 0 && restaurantIds.length === 0) return false

  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  return { or }
}

export const MarketingCampaigns: CollectionConfig = {
  slug: 'marketing-campaigns',
  labels: { singular: 'Hírlevél-kampány', plural: 'Hírlevél-kampányok' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'recipient_count', 'salon', 'restaurant', 'createdAt'],
    hidden: true,
  },
  access: {
    read: isCampaignOwnerOrAdmin,
    // A `create`/`update` szándékosan zárt (csak szerver, `overrideAccess`-szel) — a
    // piszkozat-mentés/frissítés/törlés is a `/api/marketing/drafts` route-on megy, tulaj-
    // hitelesítéssel, NEM közvetlen Payload-hozzáféréssel.
    create: () => false,
    update: () => false,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'subject', type: 'text', required: true, label: 'Tárgy' },
    { name: 'body_text', type: 'textarea', label: 'Szöveg' },
    { name: 'recipient_count', type: 'number', min: 0, defaultValue: 0, label: 'Címzettek száma' },
    { name: 'package', type: 'text', label: 'Csomag küldéskor' },
    {
      name: 'status',
      type: 'select',
      options: [{ label: 'Kiküldve', value: 'sent' }, { label: 'Piszkozat', value: 'draft' }],
      defaultValue: 'sent',
      required: true,
      label: 'Állapot',
    },
    // A szerkesztő blokk-tömbje NYERSEN (JSON) — csak piszkozatnál van rá szükség, hogy
    // visszatöltéskor a szerkesztő pontosan onnan folytatódjon, ahol abbamaradt (a `body_text`
    // csak egy egyirányú, kilapított szöveg-változat, abból nem lehet visszaépíteni a blokkokat).
    { name: 'blocks_json', type: 'json', label: 'Blokkok (piszkozathoz)' },
    // Ha a piszkozat mentésekor konkrét feliratkozók voltak kiválasztva (nem "mindenki"),
    // visszatöltéskor ez adja vissza a kijelölést.
    { name: 'target_customer_ids', type: 'json', label: 'Kiválasztott címzettek (piszkozathoz)' },
  ],
  timestamps: true,
}
