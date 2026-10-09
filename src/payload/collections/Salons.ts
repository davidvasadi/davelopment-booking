import type { Access, CollectionConfig } from 'payload'
import { uniqueSlugAcrossTenants } from '../lib/uniqueSlugAcrossTenants'
import { settingsExtensionFields, businessTierField, customMonthlyFeeField, emailTemplateFields, depositSettingsFields, stripeConnectFields, invoiceSettingsFields, voucherSettingsFields, newsletterSettingsFields, consentSettingsFields, marketingTrackingFields, googlePlaceFields } from '../settingsFields'
import { revalidatePlaceOnChange, revalidatePlaceOnDelete } from '../hooks/revalidatePublicPlace'
import { cleanupPlaceMedia } from '../hooks/cleanupPlaceMedia'
import { cleanupMediaOnChange } from '../hooks/cleanupMediaOnChange'
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
      cleanupMediaOnChange(['logo', 'cover_image']),
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
        // A tulaj automatikus staff-rekordja: mivel aki regisztrál, az a szalon tulajdonosa,
        // és egy kis vállalkozásnál a tulaj szinte mindig maga is dolgozik szakemberként —
        // ettől fogva EGYBŐL kap egy valódi (foglalható) staff-rekordot, `Staff.user`-rel a
        // fiókjához kötve. Így sosem kell külön linkelni/felvennie saját magát a Munkatársakon
        // ahhoz, hogy a szolgáltatásoknál kiválasztható, a Naptáron ütemezhető, a "Saját munka"
        // statisztikában megtalálható legyen.
        try {
          if (doc.owner) {
            const owner = await req.payload.findByID({ collection: 'users', id: doc.owner, depth: 0, overrideAccess: true }).catch(() => null)
            if (owner) {
              await req.payload.create({
                collection: 'staff',
                overrideAccess: true,
                req,
                data: {
                  salon: doc.id,
                  user: doc.owner,
                  name: owner.name || 'Tulajdonos',
                  email: owner.email || undefined,
                  role_title: 'Tulajdonos',
                  is_active: true,
                },
              })
            }
          }
        } catch (err) {
          req.payload.logger.error(`tulaj automatikus staff-rekord hiba: ${String(err)}`)
        }
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        // EGYMÁS UTÁN, nem Promise.all-lal: a Payload bulk delete({where}) egyidejű,
        // párhuzamos hívásai ugyanazon a megosztott `req`-en versenyeznek a belső
        // tranzakció-állapotért, ami néma, részleges törlést eredményezett (a hiba
        // per-dokumentumonként nyelődött el, sose jutott fel a hívóig) — ez okozta,
        // hogy a fiók-törlés csak a MÁSODIK gombnyomásra sikerült (első körben a
        // service-categories törlése elveszett a versenyben, a szalon törlése ezért
        // FK-hibával hasalt el; második körben már nem volt mivel versenyeznie).
        const results = []
        results.push(await req.payload.delete({ collection: 'shifts', where: { salon: { equals: id } }, overrideAccess: true }))
        results.push(await req.payload.delete({ collection: 'bookings', where: { salon: { equals: id } }, overrideAccess: true }))
        results.push(await req.payload.delete({ collection: 'availability', where: { salon: { equals: id } }, overrideAccess: true }))
        results.push(await req.payload.delete({ collection: 'staff', where: { salon: { equals: id } }, overrideAccess: true }))
        results.push(await req.payload.delete({ collection: 'services', where: { salon: { equals: id } }, overrideAccess: true }))
        results.push(await req.payload.delete({ collection: 'service-categories', where: { salon: { equals: id } }, overrideAccess: true }))
        for (const r of results) {
          if (r && 'errors' in r && Array.isArray(r.errors) && r.errors.length > 0) {
            req.payload.logger.error(`[Salons.beforeDelete] gyerek-törlés hiba (salon ${id}): ${JSON.stringify(r.errors)}`)
          }
        }
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
              type: 'textarea',
              label: 'Szalon leírása',
              localized: true,
              admin: { description: 'Rövid bemutatkozás — ez jelenik meg a Google-találatban ÉS a foglaló oldaladon is.' },
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
            // Fókuszpont (0-100%) + nagyítás — az Instagram-féle "húzd és nagyítsd" crop-minta
            // menti ide, hogy a kép lényegi része a nagyon eltérő mobil/desktop képarányokon is
            // látszódjon. Alapértelmezett 50/50 fókusz + 1x nagyítás = a mai, eddigi center-cover
            // viselkedés, tehát a meglévő szalonok változatlanul jelennek meg.
            {
              name: 'cover_focal_x',
              type: 'number',
              defaultValue: 50,
              admin: { hidden: true },
            },
            {
              name: 'cover_focal_y',
              type: 'number',
              defaultValue: 50,
              admin: { hidden: true },
            },
            {
              name: 'cover_zoom',
              type: 'number',
              defaultValue: 1,
              admin: { hidden: true },
            },
            {
              // Mobil (álló) képkivágás külön fókuszpontja — üres = a desktop fókuszpont.
              name: 'cover_focal_mobile_x',
              type: 'number',
              min: 0,
              max: 100,
              admin: { hidden: true },
            },
            {
              name: 'cover_focal_mobile_y',
              type: 'number',
              min: 0,
              max: 100,
              admin: { hidden: true },
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
              name: 'social_links',
              type: 'array',
              label: 'Közösségi linkek',
              admin: { description: 'Bármilyen platform linkje beilleszthető (Instagram, Facebook, TikTok…) — a platformot és az ikont a linkből ismerjük fel automatikusan.' },
              fields: [{ name: 'url', type: 'text', required: true, label: 'Link' }],
            },
            {
              name: 'booking_buffer_minutes',
              type: 'number',
              defaultValue: 15,
              label: 'Foglalások közti szünet (perc)',
            },
            {
              name: 'services_uncategorized_sort_order',
              type: 'number',
              admin: { hidden: true },
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
              name: 'booking_window_periodic',
              type: 'checkbox',
              defaultValue: false,
              label: 'Időszakos megnyitás',
              admin: { description: 'Be: egyszerre N nap nyílik meg (időszak), a végén automatikusan megújul. Ki: mindig a következő N nap foglalható (gördülő).' },
            },
            {
              name: 'booking_window_end',
              type: 'text',
              label: 'Jelenlegi foglalási időszak vége (ÉÉÉÉ-HH-NN)',
              admin: { condition: (data) => !!data?.booking_window_periodic },
            },
            {
              name: 'booking_window_auto_renew',
              type: 'checkbox',
              defaultValue: true,
              label: 'Időszak automatikus megújítása',
              admin: { condition: (data) => !!data?.booking_window_periodic },
            },
            {
              name: 'booking_window_notice_for',
              type: 'text',
              admin: { hidden: true },
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
            customMonthlyFeeField,
            ...settingsExtensionFields,
            ...depositSettingsFields,
            ...voucherSettingsFields,
            ...newsletterSettingsFields,
            ...consentSettingsFields,
            ...marketingTrackingFields,
            ...googlePlaceFields,
            ...stripeConnectFields,
            ...invoiceSettingsFields,
            {
              name: 'booking_email_subject',
              type: 'text',
              localized: true,
              label: 'Visszaigazoló email tárgya',
              admin: { description: 'Opcionális, nyelvenként (admin nyelvváltó). Üresen → alap tárgy. Változók: {{name}}, {{date}}, {{time}}, {{service}}.' },
            },
            {
              name: 'booking_email_intro',
              type: 'json',
              localized: true,
              label: 'Visszaigazoló email bevezető tartalma',
              admin: { description: 'Blokk-szerkesztős tartalom, nyelvenként. A visszaigazoló email tetejére kerül. Változók: {{name}}, {{date}}, {{time}}, {{service}}.' },
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
            {
              name: 'email_show_terms',
              type: 'checkbox',
              defaultValue: true,
              label: 'Foglalási feltételek linkje a visszaigazoló emailben',
              admin: { description: 'Csak akkor jelenik meg, ha van megadva foglalási feltétel. Kikapcsolva a visszaigazoló email nem hivatkozik a feltételekre.' },
            },
            { name: 'legal_name', type: 'text', label: 'Hivatalos cégnév' },
            { name: 'tax_number', type: 'text', label: 'Adószám' },
            { name: 'company_reg_number', type: 'text', label: 'Cégjegyzékszám' },
            { name: 'registered_seat', type: 'text', label: 'Székhely (jogilag bejegyzett)' },
            { name: 'billing_email', type: 'email', label: 'Számlázási email' },
            { name: 'billing_postal_code', type: 'text', label: 'Számlázási cím — irányítószám' },
            { name: 'billing_city', type: 'text', label: 'Számlázási cím — város' },
            { name: 'billing_street', type: 'text', label: 'Számlázási cím — utca, házszám' },
            { name: 'webhook_url', type: 'text', label: 'Zapier / Make webhook URL', admin: { description: 'Erre a végpontra küldünk POST-ot minden új foglalásnál.' } },
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
              name: 'custom_questions',
              type: 'array',
              label: 'Egyedi kérdések a foglaláskor',
              admin: { description: 'Saját kérdések, amiket a vendégnek fel kell tenni foglaláskor (pl. „Allergiás vagy valamire?").' },
              fields: [
                { name: 'label', type: 'text', localized: true, label: 'Kérdés szövege' },
                {
                  name: 'type',
                  type: 'select',
                  defaultValue: 'text',
                  label: 'Típus',
                  options: [
                    { label: 'Szöveges válasz', value: 'text' },
                    { label: 'Igen / Nem', value: 'yesno' },
                    { label: 'Választható lista', value: 'select' },
                  ],
                },
                {
                  name: 'options',
                  type: 'array',
                  label: 'Választható opciók',
                  admin: { description: 'Csak „Választható lista" típusnál használt.' },
                  fields: [{ name: 'value', type: 'text', localized: true, label: 'Opció szövege' }],
                },
                { name: 'required', type: 'checkbox', defaultValue: false, label: 'Kötelező' },
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
