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
        // Próbaidő hossza + ár a GLOBÁLIS árazásból (backstage-ben szerkeszthető).
        const pricing = (await req.payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, req })) as { trial_days?: number; restaurant_pro_huf?: number }
        const trialDays = pricing?.trial_days ?? 14
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + trialDays)
        await req.payload.create({
          collection: 'subscriptions',
          data: {
            restaurant: doc.id,
            plan: 'trial',
            status: 'trialing',
            trial_ends_at: trialEnd.toISOString(),
            amount_huf: pricing?.restaurant_pro_huf ?? 9900,
          },
          overrideAccess: true,
          req,
        })
        // Admin-értesítés a backstage harangba (best-effort, ne bukjon el a regisztráció).
        try {
          await req.payload.create({
            collection: 'notifications',
            overrideAccess: true,
            req,
            data: {
              audience: 'admin',
              type: 'new_signup',
              title: `Új étterem: ${doc.name}`,
              body: `${doc.city ? doc.city + ' · ' : ''}próbaidőszak elindult`,
              restaurant: doc.id,
              read: false,
            },
          })
        } catch (err) {
          req.payload.logger.error(`admin új-étterem értesítés hiba: ${String(err)}`)
        }
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
    defaultColumns: ['name', 'slug', 'owner', 'city', 'is_active'],
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
      name: 'booking_email_subject',
      type: 'text',
      label: 'Visszaigazoló email tárgya',
      admin: { description: 'Opcionális. Üresen hagyva az alapértelmezett tárgy. Változók: {{name}}, {{date}}, {{time}}, {{pax}}.' },
    },
    {
      name: 'booking_email_intro',
      type: 'textarea',
      label: 'Visszaigazoló email bevezető szövege',
      admin: { description: 'Sima szöveg (nem HTML). A visszaigazoló email tetejére kerül. Változók: {{name}}, {{date}}, {{time}}, {{pax}}.' },
    },
    {
      name: 'email_show_phone',
      type: 'checkbox',
      defaultValue: true,
      label: 'Telefonszám megjelenítése a visszaigazoló emailben',
      admin: { description: 'Módosításhoz a vendég látja a telefonszámot.' },
    },
    {
      name: 'email_contact_phone',
      type: 'text',
      label: 'Módosítási telefonszám (opcionális)',
      admin: { description: 'Ha üres, a nyilvános telefonszámot használja. Csak akkor jelenik meg, ha a fenti kapcsoló be van kapcsolva.' },
    },
    {
      name: 'email_show_email',
      type: 'checkbox',
      defaultValue: false,
      label: 'Email cím megjelenítése a visszaigazoló emailben',
    },
    {
      name: 'email_show_address',
      type: 'checkbox',
      defaultValue: false,
      label: 'Cím megjelenítése a visszaigazoló emailben',
    },
    {
      name: 'email_show_directions',
      type: 'checkbox',
      defaultValue: false,
      label: 'Útvonaltervezés gomb a visszaigazoló emailben',
      admin: { description: 'Egy „Útvonaltervezés" gomb, ami Google Mapsben nyitja meg a helyet.' },
    },
    {
      name: 'email_directions_address',
      type: 'text',
      label: 'Útvonaltervezéshez használt cím (opcionális)',
      admin: { description: 'Ha üres, a fenti címet használja. Megadhatsz pontosabb címet vagy Google Maps-linket is.' },
    },
    { name: 'legal_name', type: 'text', label: 'Hivatalos cégnév' },
    { name: 'tax_number', type: 'text', label: 'Adószám' },
    { name: 'company_reg_number', type: 'text', label: 'Cégjegyzékszám' },
    { name: 'registered_seat', type: 'text', label: 'Székhely' },
    {
      name: 'terms_sections',
      type: 'array',
      label: 'Foglalási feltételek',
      admin: { description: 'Szakaszonként (cím + szöveg). Megjelenik a foglaló oldalon és a visszaigazoló emailben.' },
      fields: [
        { name: 'title', type: 'text', label: 'Szakasz címe' },
        { name: 'body', type: 'textarea', label: 'Szakasz szövege' },
      ],
    },
    {
      name: 'good_to_know',
      type: 'array',
      label: 'Jó tudni pontok',
      admin: { description: 'Saját „Jó tudni" pontok (ikon + cím + szöveg) a foglaló oldalon.' },
      fields: [
        { name: 'icon', type: 'text', label: 'Ikon kulcs', defaultValue: 'info' },
        { name: 'title', type: 'text', label: 'Pont címe' },
        { name: 'body', type: 'textarea', label: 'Pont szövege' },
      ],
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Aktív',
      admin: { position: 'sidebar' },
    },
    {
      // A backstage PlaceDetailSheet-hez (a Salon admin_notes mintájára) — csak az operátor látja.
      name: 'admin_notes',
      type: 'textarea',
      label: 'Admin megjegyzés (belső)',
      admin: { position: 'sidebar', description: 'Csak az operátor látja' },
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
