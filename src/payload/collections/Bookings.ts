import { CollectionConfig } from 'payload'
import { notifyOnBooking } from '../hooks/notifyOnBooking'
import { sseAfterChange, sseAfterDelete } from '../hooks/emitSseEvent'
import { capabilityScoped } from '../access/capabilityAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  labels: { singular: 'Foglalás', plural: 'Foglalások' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'customer_name',
    defaultColumns: ['customer_name', 'salon', 'service', 'date', 'start_time', 'status'],
    hidden: true,
  },
  access: {
    // A read access where-filtert ad vissza (NEM data-összehasonlítást: a `data`
    // listázásnál undefined, ami kiszivárogtatná más szalon foglalásait). Több-üzlet:
    // a tulaj az ÖSSZES SAJÁT szalonja foglalásait látja (nem csak az „első"-ét); egy
    // TAG csak akkor, ha ténylegesen megvan nála a `bookings.view`/`bookings.manage`
    // capability. (A dashboard úgyis az aktív szalon id-jára szűr tovább.)
    read: capabilityScoped('salon', 'salon', ['bookings.view', 'bookings.manage']),
    create: () => true, // Publikus: ügyfél hozza létre
    update: capabilityScoped('salon', 'salon', 'bookings.manage'),
    delete: capabilityScoped('salon', 'salon', 'bookings.manage'),
  },
  fields: [
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services',
      hasMany: false,
      required: true,
    },
    {
      name: 'staff',
      type: 'relationship',
      relationTo: 'staff',
      hasMany: false,
      // SZÁNDÉKOSAN nem kötelező: ha egy munkatársat törölnek, a Payload NULL-ra állítja ezt a
      // mezőt minden rá hivatkozó foglaláson (lezárt/lemondott foglalásoknál ez rendben van —
      // a foglalás megmarad, csak a munkatárs-hivatkozás nem). Az API (`/api/staff/[id]`) csak
      // AKTÍV (pending/confirmed) foglalás esetén tiltja a törlést, lezárt/lemondott nem számít.
    },
    {
      name: 'customer_name',
      type: 'text',
      required: true,
      label: 'Ügyfél neve',
    },
    {
      name: 'customer_email',
      type: 'email',
      required: true,
      label: 'Ügyfél email',
    },
    {
      name: 'customer_phone',
      type: 'text',
      label: 'Ügyfél telefon',
      admin: { description: 'Kötelezőségét a szalon „Telefonszám kötelező" beállítása vezérli a foglaló oldalon.' },
    },
    {
      name: 'customer_city',
      type: 'text',
      label: 'Ügyfél városa',
      admin: { description: 'Opcionális — a vendég a foglalónál adja meg (vendég-analitika / térkép).' },
    },
    {
      name: 'customer_address',
      type: 'text',
      label: 'Ügyfél címe (utca, házszám)',
      admin: { description: 'Csak előleg-fizetéskor kötelező a vendégnek (a Számlázz.hu/Billingo bizonylathoz kell).' },
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      label: 'Foglalás dátuma',
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Formátum: ÉÉÉÉ-HH-NN'
        return true
      },
    },
    {
      name: 'start_time',
      type: 'text',
      required: true,
      label: 'Kezdési idő (HH:MM)',
      validate: (value: string | string[] | null | undefined) => {
        if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
          return 'Formátum: HH:MM'
        }
        return true
      },
    },
    {
      name: 'end_time',
      type: 'text',
      required: true,
      label: 'Befejezési idő (HH:MM)',
      validate: (value: string | string[] | null | undefined) => {
        if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) {
          return 'Formátum: HH:MM'
        }
        return true
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Függőben', value: 'pending' },
        { label: 'Megerősített', value: 'confirmed' },
        { label: 'Lemondott', value: 'cancelled' },
        { label: 'Befejezett', value: 'completed' },
      ],
      defaultValue: 'pending',
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Megjegyzések',
    },
    {
      // Idempotencia: az értesítési cron állítja true-ra, ha kiment az emlékeztető /
      // visszajelzés-kérő email — így a cron nem küld duplán.
      name: 'reminder_sent',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'feedback_sent',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // Idempotencia: a cron állítja true-ra, miután megnézte, hogy a visszaigazoló email
      // meg lett-e nyitva a foglalás előtti 24/12 órás ellenőrzési ponton (nem a riasztás
      // tényét jelzi, hanem hogy az ellenőrzés MEGTÖRTÉNT — így nem kérdez rá kétszer).
      name: 'email_open_check_24h',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'email_open_check_12h',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // Ismétlődő foglalás-sorozat közös azonosítója (opcionális). Egyszeri foglalásnál üres.
      // Ugyanaz az érték köti össze a sorozat tagjait; indexelt a sorozat-lekérdezéshez.
      name: 'series_id',
      type: 'text',
      index: true,
      label: 'Sorozat azonosító',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'cancellation_token',
      type: 'text',
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
      access: { update: () => false },
    },
    {
      // A vendég által választott nyelv a foglaláskor — ezen a nyelven megy a visszaigazoló
      // és a lemondó email. Default magyar (a régi foglalások és a kapcsoló nélküli esetek).
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
    {
      // Pontos lemondás-időbélyeg — a `status` átállás önmagában nem elég a visszatérítési
      // időablak (deposit_settings.refund_hours_before) kiszámításához, mert az implicit
      // `updatedAt`-et más mentés is módosíthatja.
      name: 'cancelled_at',
      type: 'date',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'payment_gateway',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Stripe', value: 'stripe' },
        { label: 'SimplePay', value: 'simplepay' },
        { label: 'Nincs', value: 'none' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'payment_status',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Nincs előleg', value: 'none' },
        { label: 'Függőben', value: 'pending' },
        { label: 'Befizetve', value: 'paid' },
        { label: 'Visszatérítve', value: 'refunded' },
        { label: 'Sikertelen', value: 'failed' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'deposit_amount_huf', type: 'number', label: 'Előleg összege (Ft)', admin: { position: 'sidebar', readOnly: true } },
    { name: 'deposit_paid', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', readOnly: true } },
    { name: 'deposit_refunded', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', readOnly: true } },
    {
      // Idempotencia-kulcs a Connect-webhookhoz és a dupla-terhelés-védelemhez.
      name: 'payment_intent_id',
      type: 'text',
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'invoice_number', type: 'text', label: 'Számlaszám', admin: { position: 'sidebar', readOnly: true } },
    { name: 'invoice_pdf_url', type: 'text', label: 'Számla PDF', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'invoice_status',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Nincs', value: 'none' },
        { label: 'Kiállítva', value: 'issued' },
        { label: 'Sikertelen', value: 'failed' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'voucher_code', type: 'text', label: 'Beváltott utalvány-kód', admin: { position: 'sidebar', readOnly: true } },
    { name: 'voucher_discount_huf', type: 'number', label: 'Utalvánnyal fedezett összeg (Ft)', admin: { position: 'sidebar', readOnly: true } },
    // Digitális beleegyező nyilatkozat elfogadása — per-foglalás (nem a Customers-en, mert
    // ez per-látogatás dolog, nem tartós preferencia). A szöveg-snapshot és az IP a szervertől
    // jön (a kliens sose adja meg közvetlenül), hogy ne legyen manipulálható bizonyíték.
    { name: 'consent_accepted', type: 'checkbox', defaultValue: false, label: 'Nyilatkozat elfogadva', admin: { position: 'sidebar', readOnly: true } },
    { name: 'consent_accepted_at', type: 'date', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'consent_accepted_via',
      type: 'select',
      options: [
        { label: 'Online (foglaláskor)', value: 'online' },
        { label: 'Helyszínen', value: 'onsite' },
      ],
      admin: { position: 'sidebar', readOnly: true },
    },
    { name: 'consent_text_snapshot', type: 'textarea', label: 'Elfogadott szöveg-verzió', admin: { position: 'sidebar', readOnly: true } },
    { name: 'consent_accepted_ip', type: 'text', admin: { position: 'sidebar', readOnly: true } },
    { name: 'custom_answers', type: 'json', label: 'Egyedi kérdések válaszai', admin: { position: 'sidebar', readOnly: true } },
  ],
  hooks: {
    afterChange: [notifyOnBooking('salon'), sseAfterChange('salon'), auditAfterChange('Foglalás', 'salon')],
    afterDelete: [sseAfterDelete('salon'), auditAfterDelete('Foglalás', 'salon')],
  },
  timestamps: true,
}
