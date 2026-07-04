import type { CollectionConfig, Access, Where } from 'payload'

/**
 * Várólista (waitlist) — additív, defenzív. A publikus foglaló-flow akkor iratkoztat fel,
 * ha a kért időpont telt ÉS az üzletnél be van kapcsolva a várólista
 * (feature_modules.waitlist_on && booking_rules.waitlist_enabled). Egy bejegyzés vagy egy
 * szalonhoz vagy egy étteremhez tartozik (opcionális relációk). A create nyilvános (a vendég
 * iratkozik fel), a read/update csak a tulaj/admin (a saját üzletére szűrve).
 */

// Read/update where-filter: a tulaj csak a SAJÁT üzletei várólista-bejegyzéseit látja.
const isWaitlistOwnerOrAdmin: Access = async ({ req }) => {
  if (req.user?.role === 'admin') return true
  if (!req.user) return false

  const [salons, restaurants] = await Promise.all([
    req.payload.find({
      collection: 'salons',
      where: { owner: { equals: req.user.id } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'restaurants',
      where: { owner: { equals: req.user.id } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  if (salonIds.length === 0 && restaurantIds.length === 0) return false

  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  return { or }
}

import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Waitlist: CollectionConfig = {
  slug: 'waitlist',
  hooks: {
    afterChange: [auditAfterChange('Várólista-bejegyzés', 'auto')],
    afterDelete: [auditAfterDelete('Várólista-bejegyzés', 'auto')],
  },
  labels: { singular: 'Várólista-bejegyzés', plural: 'Várólista' },
  admin: {
    useAsTitle: 'customer_name',
    defaultColumns: ['date', 'time', 'pax', 'customer_name', 'status', 'restaurant', 'salon'],
    hidden: true,
  },
  access: {
    // A vendég iratkozik fel a publikus foglalón át (a POST /api/waitlist route
    // overrideAccess-szel hozza létre; a nyílt create a defenzív jövőbiztos alap).
    create: () => true,
    read: isWaitlistOwnerOrAdmin,
    update: isWaitlistOwnerOrAdmin,
    delete: isWaitlistOwnerOrAdmin,
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'date', type: 'text', required: true, label: 'Dátum (YYYY-MM-DD)' },
    { name: 'time', type: 'text', required: true, label: 'Időpont (HH:MM)' },
    { name: 'pax', type: 'number', label: 'Fő' },
    { name: 'customer_name', type: 'text', required: true, label: 'Vendég neve' },
    { name: 'customer_email', type: 'email', required: true, label: 'Email' },
    { name: 'customer_phone', type: 'text', label: 'Telefon' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'waiting',
      label: 'Státusz',
      options: [
        { label: 'Várakozik', value: 'waiting' },
        { label: 'Értesítve', value: 'notified' },
        { label: 'Foglalássá vált', value: 'promoted' },
        { label: 'Lejárt', value: 'expired' },
      ],
    },
    {
      name: 'token',
      type: 'text',
      required: true,
      unique: true,
      label: 'Token',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'locale',
      type: 'select',
      defaultValue: 'hu',
      options: [
        { label: 'Magyar', value: 'hu' },
        { label: 'English', value: 'en' },
        { label: 'Deutsch', value: 'de' },
        { label: 'Español', value: 'es' },
        { label: 'Italiano', value: 'it' },
        { label: 'Français', value: 'fr' },
      ],
      admin: { position: 'sidebar' },
    },
  ],
  timestamps: true,
}
