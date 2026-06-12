import type { CollectionConfig } from 'payload'
import { isRestaurantOwnerOrAdmin } from '../access/restaurantAccess'
import { notifyOnBooking } from '../hooks/notifyOnBooking'
import { revalidateOnReservationChange, revalidateOnReservationDelete } from '../hooks/revalidateRestaurant'

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
    read: isRestaurantOwnerOrAdmin,
    create: () => true,
    update: isRestaurantOwnerOrAdmin,
    delete: isRestaurantOwnerOrAdmin,
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
    { name: 'country', type: 'text', label: 'Ország (ISO kód, pl. HU)', admin: { description: 'A foglaló országa a telefon-előhívó választóból (statisztikához).' } },
    { name: 'notes', type: 'textarea', label: 'Megjegyzés (vendégtől)' },
    { name: 'internal_notes', type: 'textarea', label: 'Belső megjegyzés' },
    { name: 'is_birthday', type: 'checkbox', defaultValue: false, label: 'Szülinapos foglalás' },
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
      name: 'cancel_token',
      type: 'text',
      label: 'Lemondás token',
      admin: { position: 'sidebar', readOnly: true },
    },
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
    afterChange: [notifyOnBooking('restaurant'), revalidateOnReservationChange],
    afterDelete: [revalidateOnReservationDelete],
  },
  timestamps: true,
}
