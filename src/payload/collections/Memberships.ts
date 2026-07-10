import type { Access, CollectionConfig, Where } from 'payload'

/**
 * CSAPAT & JOGOK — tagságok (memberships). Egy üzlethez (szalon VAGY étterem) tartozó
 * meghívott/aktív felhasználó egy szereppel. ADDITÍV, DEFENZÍV: a meglévő tulaj-hozzáférés
 * (user.salon / user.restaurant / owner mező + getOwnedSalon/Restaurant) ezzel NEM változik.
 * A tulajdonos NEM ebből a collection-ból kap hozzáférést — ő továbbra is az `owner` mezőn át.
 *
 * Egy sor lehet:
 *  - meghívott (status: 'invited', user üres, email + invite_token kitöltve)
 *  - aktív (status: 'active', user-hez kötve — az elfogadás után)
 *
 * Access: a tulaj a SAJÁT üzletei tagságait látja/kezeli; az admin mindent. A create/update
 * gyakorlatilag a route-okon át overrideAccess-szel történik (token-validációval), de az
 * access-szabály így is tulaj/admin-only, hogy a collection-API se legyen nyitva.
 */

/** A bejelentkezett user által birtokolt szalon+étterem ID-k → where-szűrő a saját üzletekre. */
async function ownedBusinessWhere(req: Parameters<Access>[0]['req']): Promise<Where | boolean> {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  // A tag maga is láthatja a saját tagságát (pl. accept után), ezért a user-egyezést is engedjük.
  or.push({ user: { equals: req.user.id } })
  if (or.length === 0) return false
  return { or }
}

const ownerScoped: Access = ({ req }) => ownedBusinessWhere(req)

import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  hooks: {
    afterChange: [auditAfterChange('Csapattag', 'auto')],
    afterDelete: [auditAfterDelete('Csapattag', 'auto')],
  },
  labels: { singular: 'Tagság', plural: 'Csapat & jogok' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'status', 'salon', 'restaurant'],
    group: 'Közös',
    hidden: true,
  },
  access: {
    // Create/update/delete a tulaj/admin (a route-ok overrideAccess-szel dolgoznak token mellett).
    read: ownerScoped,
    create: ({ req }) => !!req.user,
    update: ownerScoped,
    delete: ownerScoped,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      label: 'Felhasználó',
      admin: { description: 'Üres, amíg a meghívó függőben van; elfogadáskor kötődik be.' },
    },
    {
      name: 'email',
      type: 'text',
      required: true,
      label: 'Email (meghíváskor)',
    },
    {
      name: 'name',
      type: 'text',
      label: 'Név',
      admin: { description: 'Az elfogadó felhasználó neve (megjelenítéshez).' },
    },
    { name: 'salon', type: 'relationship', relationTo: 'salons', hasMany: false, label: 'Szalon' },
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', hasMany: false, label: 'Étterem' },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'staff',
      options: [
        { label: 'Tulajdonos', value: 'owner' },
        { label: 'Üzletvezető', value: 'manager' },
        { label: 'Alkalmazott', value: 'staff' },
      ],
      label: 'Szerep (jogosultság)',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'invited',
      options: [
        { label: 'Aktív', value: 'active' },
        { label: 'Függő meghívó', value: 'invited' },
        { label: 'Felfüggesztett', value: 'suspended' },
      ],
      label: 'Státusz',
    },
    {
      name: 'invite_token',
      type: 'text',
      unique: true,
      index: true,
      label: 'Meghívó token',
      admin: { readOnly: true },
    },
    // ── Munkakör & HR (étterem-alkalmazott adatlap). A szalon ugyanezt a Staff-on tárolja. ──
    // A POZÍCIÓ (munkakör) FÜGGETLEN a szereptől (jogosultság): pl. Konyhavezető pozíció +
    // Üzletvezető jogosultság. Szabad szöveg, a Staff.role_title-lel konzisztensen.
    {
      name: 'position',
      type: 'text',
      label: 'Pozíció (munkakör)',
      admin: { placeholder: 'Konyhavezető · Szakács · Felszolgáló · Pultos · Mosogató' },
    },
    { name: 'avatar', type: 'relationship', relationTo: 'media', hasMany: false, label: 'Profilkép' },
    { name: 'phone', type: 'text', label: 'Telefon' },
    {
      name: 'birthday',
      type: 'date',
      label: 'Születésnap',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } },
    },
    { name: 'address', type: 'text', label: 'Cím' },
    { name: 'tax_id', type: 'text', label: 'TAJ / adóazonosító' },
    { name: 'emergency_contact', type: 'text', label: 'Vészhelyzeti kontakt' },
    {
      name: 'join_date',
      type: 'date',
      label: 'Belépés',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } },
    },
    { name: 'weekly_hours', type: 'number', label: 'Heti óraszám' },
    // BÉR: csak a Tulajdonos látja/szerkeszti. A fizetés a NAPTÁRBÓL számolódik:
    // napidíj → (ledolgozott + fizetett szabadság napok) × rate; órabér → (órák + szabadság×8) × rate.
    {
      name: 'pay_type',
      type: 'select',
      defaultValue: 'daily',
      options: [
        { label: 'Napidíj (Ft/nap)', value: 'daily' },
        { label: 'Órabér (Ft/óra)', value: 'hourly' },
      ],
      label: 'Bér típusa',
    },
    { name: 'pay_rate', type: 'number', label: 'Napidíj / órabér (Ft)' },
    // A borravaló NAPI KÖZÖS összeg (a Naptárban adod meg naponta), és elosztódik az aznap
    // dolgozó, JOGOSULT tagok közt. Itt csak a jogosultság kapcsolója van.
    { name: 'tip_eligible', type: 'checkbox', defaultValue: false, label: 'Borravalóra jogosult' },
    { name: 'salary', type: 'number', label: 'Bér (Ft) — régi, nem használt' },
    { name: 'bio', type: 'textarea', label: 'Megjegyzés / bemutatkozás' },
    { name: 'suspended_at', type: 'date', label: 'Felfüggesztés napja', admin: { readOnly: true } },
    {
      // Pozíció-előzmény (előléptetés): a pozíció-váltásokat naplózzuk dátummal → az adatlapon idővonal.
      name: 'position_history',
      type: 'array',
      label: 'Pozíció-előzmény',
      admin: { description: 'Pincér → Supervisor · dátum. A pozíció-váltáskor automatikusan bővül; elírás javítható.' },
      fields: [
        { name: 'position', type: 'text', label: 'Pozíció' },
        { name: 'changed_at', type: 'date', label: 'Dátum' },
      ],
    },
    {
      name: 'documents',
      type: 'array',
      label: 'Dokumentumok',
      fields: [
        { name: 'label', type: 'text', label: 'Megnevezés' },
        { name: 'file', type: 'relationship', relationTo: 'media', hasMany: false, label: 'Fájl' },
      ],
    },
  ],
  timestamps: true,
}
