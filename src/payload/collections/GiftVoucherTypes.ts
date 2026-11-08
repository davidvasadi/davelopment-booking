import type { CollectionConfig, Access, CollectionAfterChangeHook, CollectionAfterDeleteHook, PayloadRequest } from 'payload'
import { revalidateTag } from 'next/cache'
import { auditAfterChange, auditAfterDelete } from '../hooks/auditLog'
import { cleanupMediaOnChange } from '../hooks/cleanupMediaOnChange'
import { salonTag, restaurantTag } from '@/lib/publicPlace'

/**
 * Ajándékutalvány-típus — a tulaj által előre létrehozott "termék" (név + fix Ft-összeg + saját
 * kép), amiből a vendég a publikus vásárlás-oldalon választ. Polimorf, mint a `GiftVouchers`:
 * egy rekord vagy egy szalonhoz, vagy egy étteremhez tartozik. A `read` publikus (a publikus
 * vásárlás-oldal listázza az aktív típusokat), a create/update/delete tulaj/admin-scope-olt,
 * a `Services.ts` mintáját követve.
 */

async function ownerIdOf(
  req: Parameters<Access>[0]['req'],
  business: 'salon' | 'restaurant',
  businessId: number | string | { id: number | string } | null | undefined,
): Promise<string | null> {
  const id = businessId && typeof businessId === 'object' ? businessId.id : businessId
  if (id == null) return null
  try {
    const doc = await req.payload.findByID({
      collection: business === 'salon' ? 'salons' : 'restaurants',
      id,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const owner = doc?.owner
    return owner && typeof owner === 'object' ? String((owner as { id: number | string }).id) : owner != null ? String(owner) : null
  } catch {
    return null
  }
}

async function userOwnsBusiness(
  req: Parameters<Access>[0]['req'],
  salonId: number | string | { id: number | string } | null | undefined,
  restaurantId: number | string | { id: number | string } | null | undefined,
): Promise<boolean> {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  const ownerId = salonId ? await ownerIdOf(req, 'salon', salonId) : await ownerIdOf(req, 'restaurant', restaurantId)
  return !!ownerId && ownerId === String(req.user.id)
}

const canCreateForOwnBusiness: Access = async ({ req, data }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return userOwnsBusiness(req, data?.salon as number | string | undefined, data?.restaurant as number | string | undefined)
}

/** A publikus vásárlás-oldal a `getPublicSalon`/`getPublicRestaurant` cache-en át listázza a
 *  típusokat — típus-változáskor a megfelelő place-tag-et kell invalidálni, mint a Services-nél. */
async function revalidateOwnerPlace(req: PayloadRequest, salon: unknown, restaurant: unknown) {
  const kind: 'salons' | 'restaurants' = salon ? 'salons' : 'restaurants'
  const id = salon ?? restaurant
  const rid = id && typeof id === 'object' ? (id as { id: unknown }).id : id
  if (rid == null) return
  try {
    const doc = await req.payload.findByID({ collection: kind, id: rid as string | number, depth: 0, overrideAccess: true, req })
    const slug = (doc as { slug?: unknown })?.slug
    if (typeof slug !== 'string') return
    revalidateTag(kind === 'salons' ? salonTag(slug) : restaurantTag(slug), 'max')
  } catch { /* legfeljebb a következő tag-alapú módosítás frissíti */ }
}

const revalidateOnChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  await revalidateOwnerPlace(req, doc?.salon, doc?.restaurant)
  return doc
}
const revalidateOnDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await revalidateOwnerPlace(req, doc?.salon, doc?.restaurant)
  return doc
}

export const GiftVoucherTypes: CollectionConfig = {
  slug: 'gift-voucher-types',
  hooks: {
    afterChange: [revalidateOnChange, cleanupMediaOnChange(['image']), auditAfterChange('Ajándékutalvány-típus', 'auto')],
    afterDelete: [revalidateOnDelete, auditAfterDelete('Ajándékutalvány-típus', 'auto')],
  },
  labels: { singular: 'Ajándékutalvány-típus', plural: 'Ajándékutalvány-típusok' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'amount_huf', 'active', 'salon', 'restaurant'],
    hidden: true,
  },
  access: {
    read: () => true,
    create: canCreateForOwnBusiness,
    update: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'gift-voucher-types', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      if (!doc) return false
      return userOwnsBusiness(req, doc.salon as number | string | undefined, doc.restaurant as number | string | undefined)
    },
    delete: async ({ req, id }) => {
      if (req.user?.role === 'admin') return true
      if (!id) return false
      const doc = await req.payload.findByID({ collection: 'gift-voucher-types', id, depth: 0, overrideAccess: true, req }).catch(() => null)
      if (!doc) return false
      return userOwnsBusiness(req, doc.salon as number | string | undefined, doc.restaurant as number | string | undefined)
    },
  },
  fields: [
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'name', type: 'text', required: true, localized: true, label: 'Név' },
    { name: 'amount_huf', type: 'number', required: true, min: 0, label: 'Összeg (Ft)' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Kép' },
    // a sablon (design 12.x): a jegy formája és színe — lib/voucherDesign; ha van kép, az a háttér
    { name: 'card_layout', type: 'text', label: 'Sablon (forma)' },
    { name: 'card_color', type: 'text', label: 'Sablon (szín)' },
    { name: 'card_text', type: 'text', label: 'Sablon (szövegszín)' },
    // az üzlet képe a jegy fejlécében (design 24.2): 'logo' | 'icon' | 'none' — üres = ikon (lib/brandImage)
    { name: 'card_brand', type: 'text', label: 'Sablon (az üzlet képe)' },
    { name: 'description', type: 'textarea', localized: true, label: 'Leírás' },
    { name: 'active', type: 'checkbox', defaultValue: true, label: 'Aktív' },
  ],
  timestamps: true,
}
