import { CollectionConfig } from 'payload'
import { notifyOnBooking } from '../hooks/notifyOnBooking'
import { userOwnsSalon } from '../lib/salonOwnerAccess'
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
    // a tulaj az ÖSSZES SAJÁT szalonja foglalásait látja (nem csak az „első"-ét);
    // kívülálló semmit. (A dashboard úgyis az aktív szalon id-jára szűr tovább.)
    read: async ({ req }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user) return false
      const salons = await req.payload.find({
        collection: 'salons',
        where: { owner: { equals: req.user.id } },
        limit: 100,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const ids = salons.docs.map((s) => s.id)
      if (ids.length === 0) return false
      return { salon: { in: ids } }
    },
    create: () => true, // Publikus: ügyfél hozza létre
    update: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!req.user || !id) return false
      const booking = await req.payload.findByID({ collection: 'bookings', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      return userOwnsSalon(req, (booking as { salon?: number | string })?.salon)
    },
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
      required: true,
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
  ],
  hooks: {
    afterChange: [notifyOnBooking('salon'), auditAfterChange('Foglalás', 'salon')],
    afterDelete: [auditAfterDelete('Foglalás', 'salon')],
  },
  timestamps: true,
}
