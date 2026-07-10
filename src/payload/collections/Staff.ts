import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { userOwnsSalon, canCreateForOwnSalon } from '../lib/salonOwnerAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

export const Staff: CollectionConfig = {
  slug: 'staff',
  hooks: {
    afterChange: [revalidateChildOnChange('salon', 'salon'), auditAfterChange('Munkatárs', 'salon')],
    afterDelete: [revalidateChildOnDelete('salon', 'salon'), auditAfterDelete('Munkatárs', 'salon')],
  },
  labels: { singular: 'Munkatárs', plural: 'Munkatársak' },
  admin: {
    group: 'Szalon',
    useAsTitle: 'name',
    defaultColumns: ['name', 'salon', 'is_active'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: canCreateForOwnSalon,
    update: async ({ req, id, data }) => {
      if (req.user?.role === 'admin') return true
      if (id) {
        const doc = await req.payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true, req }).catch(() => null)
        return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
      }
      return userOwnsSalon(req, data?.salon as number | string | undefined)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'staff', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      return userOwnsSalon(req, (doc as { salon?: number | string })?.salon)
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Név',
    },
    {
      name: 'bio',
      type: 'textarea',
      localized: true,
      label: 'Bemutatkozás',
    },
    {
      name: 'salon',
      type: 'relationship',
      relationTo: 'salons',
      hasMany: false,
      required: true,
    },
    {
      name: 'avatar',
      type: 'relationship',
      relationTo: 'media',
      hasMany: false,
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Aktív',
    },
    // ── HR-mezők (Beosztás modul) ──
    {
      name: 'role_title',
      type: 'text',
      label: 'Pozíció',
      admin: { placeholder: 'Műszakvezető · Pincér' },
    },
    {
      name: 'department',
      type: 'text',
      label: 'Részleg',
      admin: { placeholder: 'Fodrász · Kozmetika' },
    },
    {
      name: 'salary',
      type: 'number',
      label: 'Bér (Ft)',
    },
    {
      name: 'birthday',
      type: 'date',
      label: 'Születésnap',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } },
    },
    {
      name: 'join_date',
      type: 'date',
      label: 'Belépés',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'yyyy. MM. dd.' } },
    },
    {
      name: 'weekly_hours',
      type: 'number',
      label: 'Heti óraszám',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
    },
    { name: 'email', type: 'text', label: 'Email' },
    { name: 'address', type: 'text', label: 'Cím' },
    { name: 'tax_id', type: 'text', label: 'TAJ / adóazonosító' },
    { name: 'emergency_contact', type: 'text', label: 'Vészhelyzeti kontakt' },
    {
      name: 'documents',
      type: 'array',
      label: 'Dokumentumok',
      fields: [
        { name: 'label', type: 'text', label: 'Megnevezés' },
        { name: 'file', type: 'relationship', relationTo: 'media', hasMany: false, label: 'Fájl' },
      ],
    },
  ],
  timestamps: true,
}
