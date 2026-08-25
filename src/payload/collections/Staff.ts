import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { capabilityScoped, capabilityCreate } from '../access/capabilityAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'
import { syncAccountSubscription } from '../../lib/accountSubscription'

/** A staff.salon relációból feloldja a szalon owner-jét (a szalon-díj az AKTÍV munkatárs-számtól
 *  függ, lásd computeAccountFee — a staffet magát sose kötöttük be a díj-újraszámolásba eddig). */
async function syncOwnerFeeForStaff(req: import('payload').PayloadRequest, salon: unknown): Promise<void> {
  const salonId = typeof salon === 'object' && salon ? (salon as { id: unknown }).id : salon
  if (salonId == null) return
  const salonDoc = await req.payload.findByID({ collection: 'salons', id: salonId as string | number, depth: 0, overrideAccess: true, req }).catch(() => null)
  const ownerId = salonDoc?.owner && typeof salonDoc.owner === 'object' ? (salonDoc.owner as { id: unknown }).id : salonDoc?.owner
  if (ownerId == null) return
  await syncAccountSubscription({ payload: req.payload, req }, ownerId as string | number).catch(() => null)
}

export const Staff: CollectionConfig = {
  slug: 'staff',
  hooks: {
    afterChange: [
      revalidateChildOnChange('salon', 'salon'),
      auditAfterChange('Munkatárs', 'salon'),
      // Új munkatárs vagy aktív/inaktív váltás → a szalon díja (alap + aktív fő × extra) azonnal
      // frissül, ne csak egy KÉSŐBBI, független eseménynél (pl. másik üzlet hozzáadása) számolódjon újra.
      async ({ req, doc }) => { await syncOwnerFeeForStaff(req, doc.salon) },
    ],
    afterDelete: [
      revalidateChildOnDelete('salon', 'salon'),
      auditAfterDelete('Munkatárs', 'salon'),
      async ({ req, doc }) => { await syncOwnerFeeForStaff(req, doc?.salon) },
    ],
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
    create: capabilityCreate('salon', 'salon', 'staff.manage'),
    update: capabilityScoped('salon', 'salon', 'staff.manage'),
    delete: capabilityScoped('salon', 'salon', 'staff.manage'),
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
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      label: 'Bejelentkezési fiók',
      admin: {
        description: 'Ha ez a szakember EGYBEN egy bejelentkezett fiók is (pl. a tulajdonos, aki maga is dolgozik, vagy egy elfogadott meghívású munkatárs) — enélkül a „Saját munka" statisztika és a munkavállalói foglalás-szűrés nem találja meg ezt a rekordot.',
      },
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
    { name: 'tax_number', type: 'text', label: 'Adószám' },
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
