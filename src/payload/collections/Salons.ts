import type { Access, CollectionConfig } from 'payload'
import { uniqueSlugAcrossTenants } from '../lib/uniqueSlugAcrossTenants'
import { settingsExtensionFields, businessTierField, emailTemplateFields } from '../settingsFields'
import { revalidatePlaceOnChange, revalidatePlaceOnDelete } from '../hooks/revalidatePublicPlace'
import { cleanupPlaceMedia } from '../hooks/cleanupPlaceMedia'
import { syncAccountSubscription } from '../../lib/accountSubscription'
import { auditAfterChange } from '../hooks/auditLog'

// Több-üzlet (multi-tenant): egy user TÖBB szalont birtokolhat, ezért a hozzáférést az
// `owner` alapján kell ellenőrizni (a régi `user.salon` fix mező csak az „első"-t nézte →
// másik szalon szerkesztésekor 403). A where-filter biztosítja, hogy a user csak a SAJÁT
// szalonjait érje el. (Az étterem-collection már így működik — egységesítve.)
const isOwnerOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return { owner: { equals: req.user.id } }
}

export const Salons: CollectionConfig = {
  slug: 'salons',
  hooks: {
    afterChange: [
      revalidatePlaceOnChange('salon'),
      auditAfterChange('Szalon beállítás', 'self-salon'),
      async ({ req, doc, operation }) => {
        if (operation !== 'create') return
        // Fiók-szintű előfizetés: az új szalon a fiók (owner) előfizetésébe számít be — a díj
        // azonnal újraszámolódik, vagy ha ez az első üzlet, létrejön a trial fiók-sub.
        await syncAccountSubscription({ payload: req.payload, req }, doc.owner)
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
              body: `${doc.city ? doc.city + ' · ' : ''}hozzáadva egy fiókhoz`,
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
        // A kapcsolódó rekordok kaszkád-törlése. A fiók-előfizetést NEM töröljük (az a userhez
        // tartozik, nem a szalonhoz); a díj újraszámolását az afterDelete intézi.
        await Promise.all([
          req.payload.delete({ collection: 'bookings', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'availability', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'services', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'service-categories', where: { salon: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'staff', where: { salon: { equals: id } }, overrideAccess: true }),
        ])
      },
    ],
    afterDelete: [
      revalidatePlaceOnDelete('salon'),
      cleanupPlaceMedia(),
      async ({ req, doc }) => {
        // A szalon kikerült → a fiók előfizetési díja újraszámol (kevesebb üzlet).
        if (doc?.owner) await syncAccountSubscription({ payload: req.payload, req }, doc.owner).catch(() => null)
      },
    ],
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
    update: isOwnerOrAdmin,
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
              localized: true,
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
            businessTierField,
            ...settingsExtensionFields,
            {
              name: 'booking_email_subject',
              type: 'text',
              localized: true,
              label: 'Visszaigazoló email tárgya',
              admin: { description: 'Opcionális, nyelvenként (admin nyelvváltó). Üresen → alap tárgy. Változók: {{name}}, {{date}}, {{time}}, {{service}}.' },
            },
            {
              name: 'booking_email_intro',
              type: 'textarea',
              localized: true,
              label: 'Visszaigazoló email bevezető szövege',
              admin: { description: 'Sima szöveg, nyelvenként. A visszaigazoló email tetejére kerül. Változók: {{name}}, {{date}}, {{time}}, {{service}}.' },
            },
            // Lemondó / emlékeztető / visszajelzés-kérő emailek szerkeszthető tárgya + bevezetője (localized).
            ...emailTemplateFields,
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
                { name: 'title', type: 'text', localized: true, label: 'Szakasz címe' },
                { name: 'body', type: 'textarea', localized: true, label: 'Szakasz szövege' },
              ],
            },
            {
              name: 'good_to_know',
              type: 'array',
              label: 'Jó tudni pontok',
              admin: { description: 'Saját „Jó tudni" pontok (ikon + cím + szöveg) a foglaló oldalon.' },
              fields: [
                { name: 'icon', type: 'text', label: 'Ikon kulcs', defaultValue: 'info' },
                { name: 'title', type: 'text', localized: true, label: 'Pont címe' },
                { name: 'body', type: 'textarea', localized: true, label: 'Pont szövege' },
              ],
            },
            {
              name: 'supported_locales',
              type: 'select',
              hasMany: true,
              label: 'Foglaló nyelvei',
              defaultValue: ['hu'],
              admin: {
                description: 'Mely nyelveken kínálja a foglaló oldal a nyelvválasztót. A magyar mindig elérhető. Több is kiválasztható; a hozzáadott nyelvek tartalmát az admin nyelvváltóval kell kitölteni.',
              },
              options: [
                { label: 'Magyar', value: 'hu' },
                { label: 'English', value: 'en' },
                { label: 'Deutsch', value: 'de' },
                { label: 'Español', value: 'es' },
                { label: 'Italiano', value: 'it' },
                { label: 'Français', value: 'fr' },
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
