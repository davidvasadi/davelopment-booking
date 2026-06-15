import type { CollectionConfig } from 'payload'
import { uniqueSlugAcrossTenants } from '../lib/uniqueSlugAcrossTenants'
import { revalidatePlaceOnChange, revalidatePlaceOnDelete } from '../hooks/revalidatePublicPlace'

export const Salons: CollectionConfig = {
  slug: 'salons',
  hooks: {
    afterChange: [
      revalidatePlaceOnChange('salon'),
      async ({ req, doc, operation }) => {
        if (operation !== 'create') return
        const existing = await req.payload.find({
          collection: 'subscriptions',
          where: { salon: { equals: doc.id } },
          limit: 1,
          overrideAccess: true,
          req,
        })
        if (existing.docs.length > 0) return
        // Próbaidő hossza + ár a GLOBÁLIS árazásból (backstage-ben szerkeszthető).
        const pricing = (await req.payload.findGlobal({ slug: 'pricing-settings', overrideAccess: true, req })) as { trial_days?: number; salon_pro_huf?: number }
        const trialDays = pricing?.trial_days ?? 14
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + trialDays)
        await req.payload.create({
          collection: 'subscriptions',
          data: {
            salon: doc.id,
            plan: 'trial',
            status: 'trialing',
            trial_ends_at: trialEnd.toISOString(),
            amount_huf: pricing?.salon_pro_huf ?? 2900,
          },
          overrideAccess: true,
          req,
        })
        // Admin-értesítés a backstage harangba (best-effort).
        try {
          await req.payload.create({
            collection: 'notifications',
            overrideAccess: true,
            req,
            data: {
              audience: 'admin',
              type: 'new_signup',
              title: `Új szalon: ${doc.name}`,
              body: `${doc.city ? doc.city + ' · ' : ''}próbaidőszak elindult`,
              salon: doc.id,
              read: false,
            },
          })
        } catch (err) {
          req.payload.logger.error(`admin új-szalon értesítés hiba: ${String(err)}`)
        }
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        await Promise.all([
          req.payload.delete({ collection: 'bookings', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'availability', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'services', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'service-categories', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'staff', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'subscriptions', where: { salon: { equals: id } }, overrideAccess: true }),
        ])
      },
    ],
    afterDelete: [revalidatePlaceOnDelete('salon')],
  },
  labels: { singular: 'Szalon', plural: 'Szalonok' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'owner', 'city', 'is_active'],
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
    update: ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      const userSalonId = req.user?.salon && typeof req.user.salon === 'object'
        ? (req.user.salon as { id: number | string }).id
        : req.user?.salon
      return String(userSalonId) === String(id)
    },
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Alap adatok',
          fields: [
            {
              name: 'name',
              type: 'text',
              required: true,
              label: 'Szalon neve',
            },
            {
              name: 'slug',
              type: 'text',
              required: true,
              unique: true,
              label: 'URL slug',
              admin: {
                position: 'sidebar',
                description: 'davelopment.hu/[slug]',
              },
              validate: uniqueSlugAcrossTenants('salons', 'restaurants'),
            },
            {
              name: 'owner',
              type: 'relationship',
              relationTo: 'users',
              hasMany: false,
              required: true,
            },
            {
              name: 'description',
              type: 'richText',
              label: 'Szalon leírása',
            },
            {
              name: 'logo',
              type: 'relationship',
              relationTo: 'media',
              hasMany: false,
            },
            {
              name: 'cover_image',
              type: 'relationship',
              relationTo: 'media',
              hasMany: false,
            },
            {
              name: 'address',
              type: 'text',
              label: 'Cím',
            },
            {
              name: 'city',
              type: 'text',
              label: 'Város',
            },
            {
              name: 'postal_code',
              type: 'text',
              label: 'Irányítószám',
            },
            {
              name: 'phone',
              type: 'text',
              label: 'Telefon',
            },
            {
              name: 'email',
              type: 'email',
              label: 'Email',
            },
            {
              name: 'website',
              type: 'text',
              label: 'Weboldal',
            },
            {
              name: 'booking_buffer_minutes',
              type: 'number',
              defaultValue: 15,
              label: 'Foglalások közti szünet (perc)',
            },
            {
              name: 'booking_window_days',
              type: 'number',
              defaultValue: 60,
              label: 'Foglalható napok előre',
              admin: {
                description: 'Hány napra előre foglalhatnak a vendégek (pl. 30, 60, 90).',
              },
            },
            {
              name: 'require_phone',
              type: 'checkbox',
              defaultValue: true,
              label: 'Telefonszám kötelező az ügyfélnek',
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
              admin: { description: 'Opcionális. Üresen hagyva az alapértelmezett tárgy. Változók: {{name}}, {{date}}, {{time}}, {{service}}.' },
            },
            {
              name: 'booking_email_intro',
              type: 'textarea',
              label: 'Visszaigazoló email bevezető szövege',
              admin: { description: 'Sima szöveg (nem HTML). A visszaigazoló email tetejére kerül. Változók: {{name}}, {{date}}, {{time}}, {{service}}.' },
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
            },
            {
              name: 'admin_notes',
              type: 'textarea',
              label: 'Admin megjegyzés (belső)',
              admin: { description: 'Csak az operátor látja' },
            },
          ],
        },
        {
          label: 'Munkatársak',
          fields: [
            {
              name: 'staffMembers',
              type: 'join',
              collection: 'staff',
              on: 'salon',
            },
          ],
        },
        {
          label: 'Szolgáltatások',
          fields: [
            {
              name: 'servicesList',
              type: 'join',
              collection: 'services',
              on: 'salon',
            },
          ],
        },
        {
          label: 'Foglalások',
          fields: [
            {
              name: 'bookingsList',
              type: 'join',
              collection: 'bookings',
              on: 'salon',
              admin: {
                defaultColumns: ['customer_name', 'date', 'start_time', 'status'],
              },
            },
          ],
        },
        {
          label: 'Elérhetőség',
          fields: [
            {
              name: 'availabilityList',
              type: 'join',
              collection: 'availability',
              on: 'salon',
              admin: {
                defaultColumns: ['staff', 'day_of_week', 'start_time', 'end_time', 'is_available'],
              },
            },
          ],
        },
      ],
    },
  ],
  timestamps: true,
}
