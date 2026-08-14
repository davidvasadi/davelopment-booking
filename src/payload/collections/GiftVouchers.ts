import type { CollectionConfig, Access, Where } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'
import { notifyOnVoucher } from '../hooks/notifyOnVoucher'

/**
 * Ajándékutalvány — additív, defenzív, a `Waitlist.ts` polimorf mintáját követve. Egy bejegyzés
 * vagy egy szalonhoz, vagy egy étteremhez tartozik (opcionális relációk). A `create` nyilvános
 * (a vendég vásárol — a `/api/vouchers` route `overrideAccess`-szel hozza létre, csak a
 * szerver-oldali Stripe-ellenőrzés után), a read/update/delete csak a tulaj/admin, a saját
 * üzletére szűrve.
 */

const isGiftVoucherOwnerOrAdmin: Access = async ({ req }) => {
  if (req.user?.role === 'admin') return true
  if (!req.user) return false

  const [salons, restaurants] = await Promise.all([
    req.payload.find({
      collection: 'salons',
      where: { owner: { equals: req.user.id } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'restaurants',
      where: { owner: { equals: req.user.id } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  if (salonIds.length === 0 && restaurantIds.length === 0) return false

  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  return { or }
}

export const GiftVouchers: CollectionConfig = {
  slug: 'gift-vouchers',
  hooks: {
    afterChange: [notifyOnVoucher, auditAfterChange('Ajándékutalvány', 'auto')],
    afterDelete: [auditAfterDelete('Ajándékutalvány', 'auto')],
  },
  labels: { singular: 'Ajándékutalvány', plural: 'Ajándékutalványok' },
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'amount_huf', 'status', 'purchaser_name', 'salon', 'restaurant'],
    hidden: true,
  },
  access: {
    create: () => true,
    read: isGiftVoucherOwnerOrAdmin,
    update: isGiftVoucherOwnerOrAdmin,
    delete: isGiftVoucherOwnerOrAdmin,
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'voucher_type', type: 'relationship', relationTo: 'gift-voucher-types', label: 'Utalvány-típus', admin: { readOnly: true } },
    { name: 'type_name', type: 'text', label: 'Típus neve (pillanatkép)', admin: { readOnly: true } },
    { name: 'code', type: 'text', required: true, unique: true, label: 'Kód', admin: { readOnly: true } },
    { name: 'amount_huf', type: 'number', required: true, label: 'Összeg (Ft)' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Egyedi kép' },
    { name: 'qr_code_url', type: 'text', label: 'QR-kód URL', admin: { readOnly: true } },
    { name: 'purchaser_name', type: 'text', required: true, label: 'Vásárló neve' },
    { name: 'purchaser_email', type: 'email', required: true, label: 'Vásárló email' },
    { name: 'recipient_name', type: 'text', label: 'Megajándékozott neve' },
    { name: 'recipient_email', type: 'email', label: 'Megajándékozott email' },
    { name: 'message', type: 'textarea', label: 'Személyes üzenet' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      label: 'Státusz',
      options: [
        { label: 'Aktív', value: 'active' },
        { label: 'Beváltva', value: 'redeemed' },
        { label: 'Lejárt', value: 'expired' },
        { label: 'Visszatérítve', value: 'refunded' },
      ],
    },
    { name: 'payment_intent_id', type: 'text', required: true, unique: true, index: true, admin: { position: 'sidebar', readOnly: true } },
    { name: 'expires_at', type: 'date', required: true, label: 'Lejárat', admin: { position: 'sidebar' } },
    { name: 'redeemed_at', type: 'date', label: 'Beváltás dátuma', admin: { position: 'sidebar' } },
    { name: 'redeemed_booking', type: 'relationship', relationTo: 'bookings', label: 'Beváltó foglalás (szalon)', admin: { position: 'sidebar' } },
    { name: 'redeemed_reservation', type: 'relationship', relationTo: 'reservations', label: 'Beváltó foglalás (étterem)', admin: { position: 'sidebar' } },
    { name: 'invoice_number', type: 'text', label: 'Számlaszám', admin: { position: 'sidebar', readOnly: true } },
    { name: 'invoice_pdf_url', type: 'text', label: 'Számla PDF', admin: { position: 'sidebar', readOnly: true } },
    {
      name: 'invoice_status',
      type: 'select',
      defaultValue: 'none',
      label: 'Számla-státusz',
      options: [
        { label: 'Nincs', value: 'none' },
        { label: 'Kiállítva', value: 'issued' },
        { label: 'Sikertelen', value: 'failed' },
      ],
      admin: { position: 'sidebar' },
    },
    {
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
  timestamps: true,
}
