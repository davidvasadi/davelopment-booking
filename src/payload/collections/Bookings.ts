import { CollectionConfig } from 'payload'
import { notifyOnBooking } from '../hooks/notifyOnBooking'
import { webhookOnBooking } from '../hooks/webhookOnBooking'
import { sseAfterChange, sseAfterDelete } from '../hooks/emitSseEvent'
import { capabilityScoped } from '../access/capabilityAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'
import { confirmOnApproval } from '../hooks/confirmOnApproval'

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
    // A szolgáltatás ÁRÁNAK pillanatfelvétele a foglalás létrehozásakor (service-áthelyezéskor
    // is frissül) — enélkül minden bevétel-statisztika a szolgáltatás MINDENKORI aktuális árát
    // olvasná élőben, ezért egy utólagos ár-változtatás visszamenőleg átírná a korábbi
    // foglalások bevételét is. Régi (a mező bevezetése előtti) foglalásoknál a migráció
    // egyszeri, akkor-aktuális árral tölti fel — onnantól befagy.
    { name: 'price_snapshot', type: 'number', label: 'Ár a foglaláskor', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'price_snapshot_currency',
      type: 'select',
      options: [
        { label: 'HUF', value: 'HUF' },
        { label: 'EUR', value: 'EUR' },
      ],
      label: 'Pénznem a foglaláskor',
      admin: { position: 'sidebar', readOnly: true },
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
      // Nem kötelező: a dashboardon kézzel rögzített (pl. telefonos) foglalásnál a vendég
      // e-mail címe gyakran nem ismert. Ilyenkor nem megy ki vendég-email. A publikus foglaló
      // továbbra is megköveteli (api/bookings).
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
    { name: 'customer_postal_code', type: 'text', label: 'Ügyfél irányítószáma' },
    {
      name: 'customer_address',
      type: 'text',
      label: 'Ügyfél címe (utca, házszám)',
      admin: { description: 'Csak előleg-fizetéskor kötelező a vendégnek (a Számlázz.hu/Billingo bizonylathoz kell).' },
    },
    { name: 'deposit_kind', type: 'text', label: 'Előleg jellege', admin: { readOnly: true, description: "'foglalo': áfa nélküli foglaló (a végszámla tartalmazza az áfát); üres: régi áfás előleg-számla." } },
    { name: 'customer_country', type: 'text', label: 'Számlázási ország', admin: { description: 'ISO kód (pl. AT) — üres = Magyarország. Külföldi vendég csak magánszemélyként vásárolhat.' } },
    {
      name: 'customer_tax_number',
      type: 'text',
      label: 'Ügyfél adószáma',
      admin: { description: 'Csak akkor töltött, ha a vendég cégként vásárolt (adószámos számlát kért) az előleg-fizetésnél.' },
    },
    {
      name: 'date',
      index: true, // gyakori szűrő (sebesség — docs/audit/2026-11-05_1921)
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
      index: true, // gyakori szűrő (sebesség — docs/audit/2026-11-05_1921)
      type: 'select',
      options: [
        { label: 'Függőben', value: 'pending' },
        { label: 'Megerősített', value: 'confirmed' },
        { label: 'Lemondott', value: 'cancelled' },
        { label: 'Befejezett', value: 'completed' },
        { label: 'Nem jött meg', value: 'no_show' },
      ],
      defaultValue: 'pending',
      required: true,
    },
    {
      // Honnan jött a foglalás — ugyanaz, mint az éttermi foglalásnál (Reservations.source).
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
      // Több emlékeztető (pl. 48 és 3 órával előtte): a legutóbb kiküldött időzítés (óra).
      // A cron csak az ennél KÖZELEBBI időzítést küldi — így egyik sem megy ki kétszer.
      name: 'reminder_last_offset',
      type: 'number',
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
    { name: 'invoice_storno_number', type: 'text', label: 'Sztornó számla száma', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'invoice_status',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'Nincs', value: 'none' },
        { label: 'Kiállítva', value: 'issued' },
        { label: 'Sikertelen', value: 'failed' },
        { label: 'Sztornózva', value: 'storno' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'voucher_code', type: 'text', label: 'Beváltott utalvány-kód', admin: { position: 'sidebar', readOnly: true } },
    { name: 'voucher_discount_huf', type: 'number', label: 'Utalvánnyal fedezett összeg (Ft)', admin: { position: 'sidebar', readOnly: true } },
    // helyszíni fizetés (design 6.7.1) — a lezáráskor rögzítve (/api/salon/booking-checkout)
    { name: 'paid_amount_huf', type: 'number', label: 'Helyben fizetett (Ft)', admin: { position: 'sidebar', readOnly: true } },
    { name: 'pay_method', type: 'select', label: 'Fizetési mód', options: [{ label: 'Készpénz', value: 'cash' }, { label: 'Bankkártya', value: 'card' }, { label: 'Átutalás', value: 'transfer' }, { label: 'Fizetési link', value: 'link' }], admin: { position: 'sidebar', readOnly: true } },
    { name: 'pay_receipt', type: 'select', label: 'Bizonylat', options: [{ label: 'Számla (a rendszer)', value: 'invoice' }, { label: 'Pénztárgép', value: 'register' }, { label: 'Nem kért', value: 'none' }, { label: 'Kézzel kell kiállítani', value: 'manual' }], admin: { position: 'sidebar', readOnly: true } },
    { name: 'paid_lines', type: 'json', label: 'Tételek', admin: { readOnly: true } },
    { name: 'paid_at', type: 'date', label: 'Fizetve', admin: { position: 'sidebar', readOnly: true } },
    // fizetési link (Stripe Checkout a fizetés fogadójánál — lib/payee): a kifizetés után a webhook zárja le
    { name: 'pay_link_url', type: 'text', label: 'Fizetési link', admin: { readOnly: true } },
    { name: 'pay_link_session', type: 'text', label: 'Fizetési link munkamenet', admin: { readOnly: true } },
    { name: 'pay_pending', type: 'json', label: 'Fizetési link — lezárás adatai', admin: { readOnly: true } },
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
    afterChange: [notifyOnBooking('salon'), webhookOnBooking('salon'), sseAfterChange('salon'), auditAfterChange('Foglalás', 'salon'), confirmOnApproval('salon')],
    afterDelete: [sseAfterDelete('salon'), auditAfterDelete('Foglalás', 'salon')],
  },
  timestamps: true,
}
