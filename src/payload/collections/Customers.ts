import type { CollectionConfig, Access, Where } from 'payload'
import { webhookOnCustomer } from '../hooks/webhookOnBooking'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'

/**
 * Vendég-rekord (CRM) — a foglalásokból LEVEZETETT vendég mellé egy TARTÓS rekord, amit
 * a tulaj kézzel kezel. Két dolgot szolgál:
 *  1) TILTÓLISTA: `blocked` → a publikus foglaló elutasítja az adott e-mailt/telefont
 *     (üzletenként — egy rekord vagy egy szalonhoz, vagy egy étteremhez tartozik).
 *  2) KÉZI FELÜLÍRÁS: utólag pótolt/javított `customer_phone`/`customer_email`/`customer_name`
 *     + belső `notes`. A Vendégek oldal a levezetett adatot ezzel fésüli össze.
 *
 * Kulcs (dedup): `customer_email` VAGY `customer_phone` az adott üzletnél. Nyilvános create
 * NINCS — csak a tulaj hozza létre/szerkeszti (a /api/customers route overrideAccess-szel).
 */

const isCustomerOwnerOrAdmin: Access = async ({ req }) => {
  if (req.user?.role === 'admin') return true
  if (!req.user) return false

  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  if (salonIds.length === 0 && restaurantIds.length === 0) return false

  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  return { or }
}

export const Customers: CollectionConfig = {
  slug: 'customers',
  hooks: {
    afterChange: [webhookOnCustomer, auditAfterChange('Vendég-rekord', 'auto')],
    afterDelete: [auditAfterDelete('Vendég-rekord', 'auto')],
  },
  labels: { singular: 'Vendég-rekord', plural: 'Vendég-rekordok' },
  admin: {
    useAsTitle: 'customer_name',
    defaultColumns: ['customer_name', 'customer_email', 'customer_phone', 'blocked', 'restaurant', 'salon'],
    hidden: true,
  },
  access: {
    create: isCustomerOwnerOrAdmin,
    read: isCustomerOwnerOrAdmin,
    update: isCustomerOwnerOrAdmin,
    delete: isCustomerOwnerOrAdmin,
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'customer_name', type: 'text', label: 'Vendég neve' },
    { name: 'customer_email', type: 'text', label: 'Email' },
    { name: 'customer_phone', type: 'text', label: 'Telefon' },
    // A foglaláskor megadott város/ország — ha a vendég megadta, a marketing-lista is mutatja
    // (ország csak zászlóként, a `country` a Reservations 2-betűs ISO-kódját tükrözi).
    { name: 'customer_city', type: 'text', label: 'Város' },
    { name: 'customer_country', type: 'text', label: 'Ország (ISO-2)' },
    { name: 'birthday', type: 'date', label: 'Születésnap', admin: { date: { pickerAppearance: 'dayOnly' } } },
    {
      name: 'gender',
      type: 'select',
      label: 'Nem',
      options: [
        { label: 'Nő', value: 'female' },
        { label: 'Férfi', value: 'male' },
        { label: 'Egyéb', value: 'other' },
      ],
    },
    // Szabad szöveges szegmens-címke (pl. "VIP", "céges ügyfél") — nem egy zárt lista, a tulaj
    // saját szóhasználata szerint tölti/importálja.
    { name: 'group_tag', type: 'text', label: 'Csoport / címke' },
    { name: 'notes', type: 'textarea', label: 'Belső jegyzet' },
    // Állandó számlázási profil — hogy ne kelljen minden alkalommal újra begépelni. Ugyanaz a
    // mező-elnevezés, mint a Salon/Restaurant saját számlázási adatain (billing_*), csak itt a
    // VENDÉG céges adatai (cégként vásárló törzsvendégeknek).
    {
      type: 'collapsible',
      label: 'Számlázási profil',
      admin: { initCollapsed: true },
      fields: [
        { name: 'billing_name', type: 'text', label: 'Számlázási név' },
        { name: 'billing_tax_number', type: 'text', label: 'Adószám' },
        { name: 'billing_email', type: 'email', label: 'Számlaküldési email' },
        { name: 'billing_postal_code', type: 'text', label: 'Irányítószám' },
        { name: 'billing_city', type: 'text', label: 'Település' },
        { name: 'billing_street', type: 'text', label: 'Utca, házszám' },
      ],
    },
    // Import-összesítő — olyan külső rendszerből (pl. Salonic) jövő vendég-exportokhoz, amik
    // GUEST-SZINTŰ ÉLETTARTAM-összesítőt adnak (nem egyenkénti látogatás-naplót), ezért a
    // ténylegesen rögzíthető foglalás-sorokon (jellemzően csak az első+utolsó látogatás,
    // amihez van dátum) FELÜL ez tárolja a köztes, csak összesítve ismert számokat. A Vendégek
    // oldal ELSŐBBSÉGGEL ezt mutatja, ha ki van töltve (nem a foglalás-történetből számolt
    // értéket) — lásd dashboard/guests/page.tsx és restaurant/guests/page.tsx.
    {
      type: 'collapsible',
      label: 'Import-összesítő (külső rendszerből)',
      admin: { initCollapsed: true },
      fields: [
        { name: 'visit_count', type: 'number', label: 'Látogatások száma (import)' },
        { name: 'cancellation_count', type: 'number', label: 'Lemondások száma (import)' },
        { name: 'no_show_count', type: 'number', label: 'Nem jött el alkalmak száma (import)' },
        { name: 'last_cancellation_reason', type: 'text', label: 'Utolsó lemondás oka (import)' },
        { name: 'total_revenue_huf', type: 'number', label: 'Összes árbevétel Ft (import)' },
      ],
    },
    // Külső rendszer saját azonosítója (pl. Salonic "ID" oszlopa) — ismételt importnál
    // megbízhatóbb dedup-kulcs, mint az email (ami hiányozhat/ismétlődhet egy exportban).
    { name: 'external_id', type: 'text', label: 'Külső azonosító (import)', admin: { position: 'sidebar' } },
    // A vendéghez tartozó ÖSSZES azonosító (régi+új e-mail/telefon), `\n`-nel elválasztva.
    // Így a telefon-csere után is átlinkelhető a régi foglalás → a levezetett adat frissül.
    { name: 'match_index', type: 'text', label: 'Match-index (belső)', admin: { hidden: true } },
    { name: 'blocked', type: 'checkbox', defaultValue: false, label: 'Tiltólistán', admin: { position: 'sidebar' } },
    { name: 'block_reason', type: 'text', label: 'Tiltás indoka', admin: { position: 'sidebar' } },
    { name: 'blocked_at', type: 'date', label: 'Tiltás időpontja', admin: { position: 'sidebar', readOnly: true } },
    // Marketing-hírlevél hozzájárulás — a foglaló-widget külön, alapból üres jelölőnégyzetével
    // gyűlik (GDPR opt-in, sose retroaktív). A leiratkozó link false-ra állítja vissza.
    { name: 'marketing_consent', type: 'checkbox', defaultValue: false, label: 'Feliratkozott hírlevélre', admin: { position: 'sidebar' } },
    { name: 'marketing_consent_at', type: 'date', label: 'Hozzájárulás időpontja', admin: { position: 'sidebar', readOnly: true } },
    // a leiratkozás időpontja — a kampány „Leiratkozott” száma ebből (design 13.1)
    { name: 'marketing_unsubscribed_at', type: 'date', label: 'Leiratkozás időpontja', admin: { position: 'sidebar', readOnly: true } },
  ],
  timestamps: true,
}
