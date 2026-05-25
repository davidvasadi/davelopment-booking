import type { Access, CollectionConfig } from 'payload'
import { uniqueSlugAcrossTenants } from '../lib/uniqueSlugAcrossTenants'
import { slugify } from '../lib/slugify'

const isOwnerOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return { owner: { equals: req.user.id } }
}

export const Restaurants: CollectionConfig = {
  slug: 'restaurants',
  hooks: {
    afterChange: [
      async ({ req, doc, operation }) => {
        if (operation !== 'create') return
        const existing = await req.payload.find({
          collection: 'subscriptions',
          where: { restaurant: { equals: doc.id } },
          limit: 1,
          overrideAccess: true,
          req,
        })
        if (existing.docs.length > 0) return
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + 14)
        await req.payload.create({
          collection: 'subscriptions',
          data: {
            restaurant: doc.id,
            plan: 'trial',
            status: 'trialing',
            trial_ends_at: trialEnd.toISOString(),
            amount_huf: 9900,
          },
          overrideAccess: true,
          req,
        })
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        await Promise.all([
          req.payload.delete({ collection: 'reservations', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'opening-hours', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'tables', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'rooms', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'subscriptions', where: { restaurant: { equals: id } }, overrideAccess: true }),
        ])
      },
    ],
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'owner', 'city', 'capacity_mode', 'is_active'],
    group: 'Étterem',
  },
  labels: { singular: 'Étterem', plural: 'Éttermek' },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: isOwnerOrAdmin,
    delete: isOwnerOrAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Étterem neve' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      label: 'URL slug',
      admin: { description: 'A nyilvános URL: /[slug]. A névből generálódik, de később nem írja át magát — a kiadott linkek így nem törnek el.' },
      validate: uniqueSlugAcrossTenants('restaurants', 'salons'),
      hooks: {
        // Auto-fill from the name only when the slug is empty (i.e. on create,
        // or if the owner deliberately clears it). Editing the name later does
        // NOT overwrite an existing slug, so public links stay stable.
        beforeValidate: [
          ({ value, data }) => {
            if (value) return value
            return data?.name ? slugify(data.name as string) : value
          },
        ],
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      label: 'Tulajdonos',
    },
    { name: 'description', type: 'textarea', label: 'Leírás' },
    { name: 'city', type: 'text', label: 'Város' },
    { name: 'address', type: 'text', label: 'Cím' },
    { name: 'phone', type: 'text', label: 'Telefon' },
    { name: 'email', type: 'email', label: 'Email' },
    { name: 'website', type: 'text', label: 'Weboldal' },
    {
      name: 'cover_image',
      type: 'upload',
      relationTo: 'media',
      label: 'Borítókép',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logó',
    },
    {
      name: 'capacity_mode',
      type: 'select',
      required: true,
      defaultValue: 'tables',
      label: 'Kapacitás-mód',
      options: [
        { label: 'Asztaltérkép (asztalok szerinti foglalás)', value: 'tables' },
        { label: 'Egyszerű kapacitás (csak főszám-limit)', value: 'flat' },
      ],
    },
    {
      name: 'max_pax',
      type: 'number',
      defaultValue: 40,
      label: 'Max fő (flat módban)',
      admin: {
        description: 'Csak flat módban használjuk: turnusonként hány fő foglalható összesen',
      },
    },
    {
      name: 'turn_duration_minutes',
      type: 'number',
      defaultValue: 120,
      label: 'Foglalás hossza (perc)',
      admin: { description: 'Egy foglalás mennyi ideig tartja az asztalt (pl. 120 perc)' },
    },
    {
      name: 'slot_step_minutes',
      type: 'number',
      defaultValue: 30,
      label: 'Időpont-lépték (perc)',
      admin: { description: 'Milyen sűrűn ajánljon időpontokat a nyitvatartáson belül (pl. 30 perc)' },
    },
    {
      name: 'last_seating_buffer_minutes',
      type: 'number',
      defaultValue: 0,
      label: 'Utolsó foglalható időpont zárás előtt (perc)',
      admin: {
        description:
          'Mennyivel a zárás előtt legyen az utolsó kezdő időpont. 0 = zárásig lehet foglalni (a foglalás belelóghat a zárásba). Ha a foglalás hosszára állítod, csak az fér bele, ami zárásig véget ér.',
      },
    },
    {
      name: 'lead_time_hours',
      type: 'number',
      defaultValue: 2,
      label: 'Min. előfoglalási idő (óra)',
      admin: {
        description: 'Hány órával előtte lehet legkorábban foglalni',
      },
    },
    {
      name: 'require_phone',
      type: 'checkbox',
      defaultValue: true,
      label: 'Telefonszám kötelező a vendégnek',
    },
    {
      name: 'notify_new_bookings',
      type: 'checkbox',
      defaultValue: true,
      label: 'Értesítés új foglalásokról',
      admin: { description: 'Ha be van kapcsolva, a tulajdonos értesítést kap új foglalásról és lemondásról az alkalmazáson belül.' },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Aktív',
      admin: { position: 'sidebar' },
    },
    {
      name: 'rooms',
      type: 'join',
      collection: 'rooms',
      on: 'restaurant',
    },
    {
      name: 'tables',
      type: 'join',
      collection: 'tables',
      on: 'restaurant',
    },
    {
      name: 'opening_hours',
      type: 'join',
      collection: 'opening-hours',
      on: 'restaurant',
    },
    {
      name: 'reservations',
      type: 'join',
      collection: 'reservations',
      on: 'restaurant',
    },
  ],
  timestamps: true,
}
