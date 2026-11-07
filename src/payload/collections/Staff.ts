import { CollectionConfig } from 'payload'
import { revalidateChildOnChange, revalidateChildOnDelete } from '../hooks/revalidatePublicPlace'
import { cleanupMediaOnChange } from '../hooks/cleanupMediaOnChange'
import { capabilityScoped, capabilityCreate } from '../access/capabilityAccess'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'
import { isSilentImport } from '../../lib/silentImport'
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
    beforeChange: [
      // Az import által létrehozott munkatárs „átnézendő” — a tulaj első szerkesztése (akár csak
      // az aktív-kapcsoló) lezárja. Az import saját frissítései nem törlik a jelölést.
      ({ req, operation, data }) => {
        if (operation === 'update' && !isSilentImport(req)) data.import_review = false
        return data
      },
    ],
    afterChange: [
      revalidateChildOnChange('salon', 'salon'),
      cleanupMediaOnChange(['avatar']),
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
      name: 'social_links',
      type: 'array',
      label: 'Közösségi linkek',
      admin: { description: 'Pl. a szakember saját Instagram-portfóliója — bármilyen platform linkje beilleszthető, a platformot a linkből ismerjük fel automatikusan.' },
      fields: [{ name: 'url', type: 'text', required: true, label: 'Link' }],
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
    {
      name: 'import_review',
      type: 'checkbox',
      defaultValue: false,
      label: 'Importált — átnézendő',
      admin: { readOnly: true, description: 'Az import hozta létre; az első szerkesztés törli.' },
    },
    // ── HR-mezők (Beosztás modul) ──
    {
      name: 'role_title',
      type: 'text',
      label: 'Pozíció',
      admin: { placeholder: 'Műszakvezető · Pincér' },
    },
    {
      name: 'show_role_title',
      type: 'checkbox',
      defaultValue: true,
      label: 'Pozíció a foglalásnál',
      admin: { description: 'A foglalóoldalon a munkatárs neve alatt (Foglalóoldal-szerkesztő › Szakember).' },
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
      // Éves szabadság-keret (nap) — a Naptár nap-szerkesztője mutatja, mennyi marad (design 11.5).
      name: 'annual_leave_days',
      type: 'number',
      label: 'Éves szabadság (nap)',
    },
    {
      // Személyenkénti szünet két foglalás között (perc). Üres → a szalon „Foglalási időköz"
      // beállítása (`booking_buffer_minutes`) érvényes.
      name: 'booking_buffer_minutes',
      type: 'number',
      min: 0,
      max: 240,
      label: 'Szünet a foglalások között (perc)',
    },
    {
      // Legalább ennyivel a kezdés előtt lehet online foglalni ehhez a munkatárshoz (óra, pl. 3
      // vagy 0.5). Üres/0 → nincs korlát. A tulaj kézi (dashboard) foglalását nem korlátozza.
      name: 'min_lead_hours',
      type: 'number',
      min: 0,
      max: 720,
      label: 'Minimum foglalási idő előre (óra)',
    },
    {
      // Több alap-szünet is megadható (pl. ebéd + délutáni pihenő) — a beosztás-automatizáló
      // minden napra ráírja mindet, egyedi napokon (vagy tartományon/"minden napra" felülíráson
      // keresztül) módosítható. A korábbi egyszeres `default_break_start`/`_end` oszlopok az
      // adatbázisban megmaradtak (expand-contract minta), a meglévő adat 1-elemű tömbbé migrálva.
      name: 'default_breaks',
      type: 'json',
      label: 'Napi szünetek (alap)',
      admin: { description: 'Alap szünetidők — a beosztás-automatizáló minden napra ezeket írja rá, egyedi napokon felülírhatók.' },
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
    // Saját számlázás (vállalkozó szakember, ha az üzletben „Szakemberenként” számláznak — design 16.7 / 10.4): a saját
    // számlázója (titkosított kulcs, sosem megy ki a kliensre) és a saját Stripe Connect fiókja (a webhook állítja)
    { name: 'invoice_provider', type: 'select', defaultValue: 'none', label: 'Saját számlázó', options: [{ label: 'Számlázz.hu', value: 'szamlazz' }, { label: 'Billingo', value: 'billingo' }, { label: 'Nincs', value: 'none' }] },
    { name: 'szamlazz_agent_key_enc', type: 'text', label: 'Számlázz.hu Agent kulcs', access: { read: () => false } },
    { name: 'billingo_api_key_enc', type: 'text', label: 'Billingo API kulcs', access: { read: () => false } },
    { name: 'stripe_connect_account_id', type: 'text', label: 'Stripe Connect fiók', access: { update: ({ req }) => req.user?.role === 'admin' } },
    { name: 'stripe_connect_onboarded', type: 'checkbox', defaultValue: false, label: 'Stripe onboarding kész', access: { update: ({ req }) => req.user?.role === 'admin' } },
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
