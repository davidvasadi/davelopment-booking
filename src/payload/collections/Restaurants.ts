import type { Access, CollectionConfig } from 'payload'
import { uniqueSlugAcrossTenants } from '../lib/uniqueSlugAcrossTenants'
import { slugify } from '../lib/slugify'
import { settingsExtensionFields, businessTierField, emailTemplateFields } from '../settingsFields'
import { revalidatePlaceOnChange, revalidatePlaceOnDelete } from '../hooks/revalidatePublicPlace'
import { cleanupPlaceMedia } from '../hooks/cleanupPlaceMedia'
import { syncAccountSubscription } from '../../lib/accountSubscription'
import { auditAfterChange } from '../hooks/auditLog'

const isOwnerOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return { owner: { equals: req.user.id } }
}

export const Restaurants: CollectionConfig = {
  slug: 'restaurants',
  hooks: {
    afterChange: [
      revalidatePlaceOnChange('restaurant'),
      auditAfterChange('Étterem beállítás', 'self-restaurant'),
      async ({ req, doc, operation }) => {
        if (operation !== 'create') return
        // Fiók-szintű előfizetés: az új étterem a fiók (owner) előfizetésébe számít be — a díj
        // azonnal újraszámolódik, vagy ha ez az első üzlet, létrejön a trial fiók-sub.
        await syncAccountSubscription({ payload: req.payload, req }, doc.owner)
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
              body: `${doc.city ? doc.city + ' · ' : ''}hozzáadva egy fiókhoz`,
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
        // A kapcsolódó rekordok kaszkád-törlése. A fiók-előfizetést NEM töröljük (a userhez
        // tartozik); a díj újraszámolását az afterDelete intézi.
        await Promise.all([
          req.payload.delete({ collection: 'reservations', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'opening-hours', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'tables', where: { restaurant: { equals: id } }, overrideAccess: true }),
          req.payload.delete({ collection: 'rooms', where: { restaurant: { equals: id } }, overrideAccess: true }),
        ])
      },
    ],
    afterDelete: [
      revalidatePlaceOnDelete('restaurant'),
      cleanupPlaceMedia(),
      async ({ req, doc }) => {
        if (doc?.owner) await syncAccountSubscription({ payload: req.payload, req }, doc.owner).catch(() => null)
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
    { name: 'description', type: 'textarea', localized: true, label: 'Leírás' },
    { name: 'city', type: 'text', label: 'Város' },
    { name: 'address', type: 'text', label: 'Cím' },
    { name: 'phone', type: 'text', label: 'Telefon' },
    { name: 'email', type: 'email', label: 'Email' },
    { name: 'website', type: 'text', label: 'Weboldal' },
    {
      // Az étterem SAJÁT munkakörei (posztjai). A munkatárs-meghíváskor ezekből lehet
      // választani; új poszt megadásakor a lista automatikusan bővül (a meghívó-route teszi hozzá).
      name: 'positions',
      type: 'array',
      label: 'Kategóriák (szerepkörök)',
      admin: { description: 'A tulajdonos saját szerepkörei (Felszolgáló, Konyhavezető…). A szint adja a jogosultságot: Vezető = mindent kezel (bér nélkül), Dolgozó = csak a sajátját.' },
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Név' },
        {
          name: 'level',
          type: 'select',
          defaultValue: 'staff',
          options: [
            { label: 'Vezető', value: 'lead' },
            { label: 'Dolgozó', value: 'staff' },
          ],
          label: 'Hozzáférési szint',
        },
      ],
    },
    {
      // Napi KÖZPONTI borravaló-összeg (Ft) az adott napra. A Naptárban adja meg a tulaj; a profil
      // havi szinten összegzi, az aznap dolgozó JOGOSULT munkatársak (tip_eligible) közt elosztva.
      // A dátum date-only szöveg (ÉÉÉÉ-HH-NN), hogy ne csússzon el időzóna miatt.
      name: 'daily_tips',
      type: 'array',
      label: 'Napi borravaló',
      admin: { description: 'Napi központi borravaló-összeg; az aznap dolgozó jogosultak közt oszlik el.' },
      fields: [
        { name: 'date', type: 'text', required: true, label: 'Dátum (ÉÉÉÉ-HH-NN)' },
        { name: 'amount', type: 'number', required: true, label: 'Összeg (Ft)' },
      ],
    },
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
      label: 'Telefonszám kötelező a vendégnek',
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
      admin: { description: 'Opcionális, nyelvenként (admin nyelvváltó). Üresen → alap tárgy. Változók: {{name}}, {{date}}, {{time}}, {{pax}}.' },
    },
    {
      name: 'booking_email_intro',
      type: 'textarea',
      localized: true,
      label: 'Visszaigazoló email bevezető szövege',
      admin: { description: 'Sima szöveg, nyelvenként. A visszaigazoló email tetejére kerül. Változók: {{name}}, {{date}}, {{time}}, {{pax}}.' },
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
      name: 'event_types',
      type: 'array',
      label: 'Esemény-típusok (alkalmak)',
      admin: { description: 'Milyen alkalomból foglalhat a vendég (ikon + megnevezés). A vendég a foglalónál választhat ezekből; ki-be kapcsolhatók. Ha üresen hagyod, az alapkészlet jelenik meg.' },
      defaultValue: [
        { icon: 'cake', label: 'Születésnap', enabled: true },
        { icon: 'anniversary', label: 'Évforduló', enabled: true },
        { icon: 'business', label: 'Céges vacsora', enabled: true },
        { icon: 'date', label: 'Randi', enabled: true },
        { icon: 'family', label: 'Családi esemény', enabled: true },
        { icon: 'friends', label: 'Baráti összejövetel', enabled: true },
        { icon: 'party', label: 'Legénybúcsú / lánybúcsú', enabled: true },
        { icon: 'celebration', label: 'Ünnepség', enabled: true },
        { icon: 'engagement', label: 'Eljegyzés', enabled: true },
      ],
      fields: [
        { name: 'icon', type: 'text', label: 'Ikon kulcs', defaultValue: 'party' },
        { name: 'label', type: 'text', required: true, localized: true, label: 'Megnevezés' },
        { name: 'enabled', type: 'checkbox', defaultValue: true, label: 'Aktív' },
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
