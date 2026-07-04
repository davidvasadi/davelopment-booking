import type { CollectionConfig, Access, Where } from 'payload'
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
    afterChange: [auditAfterChange('Vendég-rekord', 'auto')],
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
    { name: 'notes', type: 'textarea', label: 'Belső jegyzet' },
    // A vendéghez tartozó ÖSSZES azonosító (régi+új e-mail/telefon), `\n`-nel elválasztva.
    // Így a telefon-csere után is átlinkelhető a régi foglalás → a levezetett adat frissül.
    { name: 'match_index', type: 'text', label: 'Match-index (belső)', admin: { hidden: true } },
    { name: 'blocked', type: 'checkbox', defaultValue: false, label: 'Tiltólistán', admin: { position: 'sidebar' } },
    { name: 'block_reason', type: 'text', label: 'Tiltás indoka', admin: { position: 'sidebar' } },
    { name: 'blocked_at', type: 'date', label: 'Tiltás időpontja', admin: { position: 'sidebar', readOnly: true } },
  ],
  timestamps: true,
}
