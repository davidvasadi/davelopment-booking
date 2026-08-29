import type { CollectionConfig } from 'payload'
import { capabilityScoped } from '../access/capabilityAccess'
import { notifyOnBooking } from '../hooks/notifyOnBooking'
import { sseAfterChange, sseAfterDelete } from '../hooks/emitSseEvent'
import { revalidateOnReservationChange, revalidateOnReservationDelete } from '../hooks/revalidateRestaurant'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Reservations: CollectionConfig = {
  slug: 'reservations',
  labels: { singular: 'Asztalfoglalás', plural: 'Asztalfoglalások' },
  admin: {
    useAsTitle: 'customer_name',
    defaultColumns: ['date', 'start_time', 'customer_name', 'pax', 'status', 'restaurant'],
    group: 'Étterem',
    hidden: true,
  },
  access: {
    // A read csak a saját étterem foglalásait engedi (tenant-szűrő where-filter,
    // mint az update/delete). Korábban () => true volt → BÁRKI lekérhette az összes
    // étterem összes asztalfoglalását (vendégnév, telefon) bejelentkezés nélkül.
    // A vendég-foglalási flow nem ezen át olvas (overrideAccess), a create marad nyilvános.
    read: capabilityScoped('restaurant', 'restaurant', ['bookings.view', 'bookings.manage']),
    create: () => true,
    update: capabilityScoped('restaurant', 'restaurant', 'bookings.manage'),
    delete: capabilityScoped('restaurant', 'restaurant', 'bookings.manage'),
  },
  fields: [
    {
      name: 'restaurant',
      type: 'relationship',
      relationTo: 'restaurants',
      required: true,
      label: 'Étterem',
    },
    { name: 'date', type: 'text', required: true, label: 'Dátum (YYYY-MM-DD)' },
    { name: 'start_time', type: 'text', required: true, label: 'Kezdés (HH:MM)' },
    { name: 'end_time', type: 'text', required: true, label: 'Vég (HH:MM)' },
    { name: 'pax', type: 'number', required: true, defaultValue: 2, label: 'Fő' },
    {
      name: 'tables',
      type: 'relationship',
      relationTo: 'tables',
      hasMany: true,
      label: 'Asztal(ok)',
      admin: {
        description:
          'Csak tables módban — az étterem rendeli hozzá vagy a foglalás automatikusan. Nagyobb társaságnál több összevont asztal is lehet.',
      },
    },
    { name: 'customer_name', type: 'text', required: true, label: 'Vendég neve' },
    { name: 'customer_email', type: 'email', label: 'Email' },
    { name: 'customer_phone', type: 'text', label: 'Telefon' },
    { name: 'customer_city', type: 'text', label: 'Város', admin: { description: 'Opcionális — a vendég a foglalónál adja meg (vendég-analitika / térkép).' } },
    { name: 'customer_address', type: 'text', label: 'Cím (utca, házszám)', admin: { description: 'Csak előleg-fizetéskor kötelező a vendégnek (a Számlázz.hu/Billingo bizonylathoz kell).' } },
    { name: 'customer_tax_number', type: 'text', label: 'Vendég adószáma', admin: { description: 'Csak akkor töltött, ha a vendég cégként vásárolt (adószámos számlát kért) az előleg-fizetésnél.' } },
    { name: 'country', type: 'text', label: 'Ország (ISO kód, pl. HU)', admin: { description: 'A foglaló országa a telefon-előhívó választóból (statisztikához).' } },
    { name: 'notes', type: 'textarea', label: 'Megjegyzés (vendégtől)' },
    { name: 'internal_notes', type: 'textarea', label: 'Belső megjegyzés' },
    { name: 'occasion', type: 'text', label: 'Alkalom', admin: { description: 'Milyen alkalomból foglaltak (pl. Születésnap). A vendég a foglalónál választja, vagy az étterem állítja.' } },
    { name: 'occasion_icon', type: 'text', label: 'Alkalom ikon-kulcs', admin: { description: 'A választott alkalom Lucide ikon-kulcsa (a nézetekben jelenik meg).' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'confirmed',
      label: 'Státusz',
      options: [
        { label: 'Megerősítésre vár', value: 'pending' },
        { label: 'Megerősítve', value: 'confirmed' },
        { label: 'Leültetve', value: 'seated' },
        { label: 'Befejezett', value: 'completed' },
        { label: 'Nem jött meg', value: 'no_show' },
        { label: 'Lemondva', value: 'cancelled' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'online',
      label: 'Forrás',
      options: [
        { label: 'Online', value: 'online' },
        { label: 'Beeső (walk-in)', value: 'walk_in' },
        { label: 'Telefon', value: 'phone' },
      ],
    },
    {
      // Idempotencia: az értesítési cron állítja true-ra (emlékeztető / visszajelzés-kérő).
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
      // meg lett-e nyitva a foglalás előtti 24/12 órás ellenőrzési ponton.
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
      name: 'series_id',
      type: 'text',
      index: true,
      label: 'Sorozat azonosító',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'cancel_token',
      type: 'text',
      label: 'Lemondás token',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      // A vendég által választott nyelv a foglaláskor — ezen a nyelven megy a visszaigazoló
      // és a lemondó email. Default magyar.
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
    beforeChange: [
      // Korai befejezés: ha a foglalás MA „Befejezett"-re vált és az aktuális idő a
      // foglalás idején belül (start..end) van, az end_time a tényleges távozásra (most)
      // rövidül — így az asztal korábban felszabadul és újra foglalható. A tárolt valós
      // end_time-ból mérhető az átlagos foglalási idő (lásd restaurantStats avgDwell).
      ({ data, originalDoc, operation }) => {
        if (operation !== 'update') return data
        const becameCompleted = data.status === 'completed' && originalDoc?.status !== 'completed'
        if (!becameCompleted) return data
        const date = data.date ?? originalDoc?.date
        const start = data.start_time ?? originalDoc?.start_time
        const end = data.end_time ?? originalDoc?.end_time
        if (!date || !start || !end) return data
        const now = new Date()
        const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        if (ymd !== date) return data // csak a mai napra értelmezett a „most”
        const nowMin = now.getHours() * 60 + now.getMinutes()
        const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
        const startMin = toMin(start)
        const endMin = toMin(end)
        // Csak ha tényleg félúton vagyunk (a kezdés után, az eredeti vége előtt).
        if (nowMin > startMin && nowMin < endMin) {
          data.end_time = `${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`
        }
        return data
      },
    ],
    afterChange: [notifyOnBooking('restaurant'), sseAfterChange('restaurant'), revalidateOnReservationChange, auditAfterChange('Asztalfoglalás', 'restaurant')],
    afterDelete: [sseAfterDelete('restaurant'), revalidateOnReservationDelete, auditAfterDelete('Asztalfoglalás', 'restaurant')],
  },
  timestamps: true,
}
