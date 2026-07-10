import type { CollectionConfig, Access, Where } from 'payload'

/**
 * AUDIT-NAPLÓ (audit log). VALÓS „ki mit módosított" idővonal a Beállítások panelen.
 *
 * A bejegyzéseket kizárólag a szerver-oldali `auditLog` hook hozza létre (overrideAccess),
 * a lényeges collectionök afterChange/afterDelete eseményein. A CREATE ezért access-en
 * KÖTÖTT (false publikusan) — csak overrideAccess mehet át. A READ a tulaj/admin, a saját
 * üzleteire szűrve (a Reviews mintája szerint). Update/delete tiltott (append-only napló).
 */
const isOwnerOrAdmin: Access = async ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true

  const [salons, restaurants] = await Promise.all([
    req.payload.find({ collection: 'salons', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
    req.payload.find({ collection: 'restaurants', where: { owner: { equals: req.user.id } }, limit: 200, depth: 0, overrideAccess: true, req }),
  ])
  const salonIds = salons.docs.map((s) => s.id)
  const restaurantIds = restaurants.docs.map((r) => r.id)
  const or: Where[] = []
  if (salonIds.length) or.push({ salon: { in: salonIds } })
  if (restaurantIds.length) or.push({ restaurant: { in: restaurantIds } })
  if (or.length === 0) return false
  return { or }
}

export const AuditLog: CollectionConfig = {
  slug: 'audit-log',
  labels: { singular: 'Audit-bejegyzés', plural: 'Audit-napló' },
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['action', 'collection_name', 'actor_label', 'summary', 'createdAt'],
    group: 'Közös',
    hidden: true,
  },
  access: {
    // Létrehozás CSAK szerver-oldal (auditLog hook, overrideAccess). Nincs publikus create.
    create: () => false,
    read: isOwnerOrAdmin,
    update: () => false,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    { name: 'actor', type: 'relationship', relationTo: 'users', label: 'Végrehajtó (user)' },
    { name: 'actor_label', type: 'text', label: 'Végrehajtó (név)' },
    { name: 'actor_email', type: 'text', label: 'Végrehajtó (email)' },
    {
      name: 'action',
      type: 'select',
      required: true,
      options: [
        { label: 'Létrehozás', value: 'create' },
        { label: 'Módosítás', value: 'update' },
        { label: 'Törlés', value: 'delete' },
      ],
      label: 'Művelet',
    },
    { name: 'collection_name', type: 'text', label: 'Érintett collection' },
    { name: 'doc_id', type: 'text', label: 'Dokumentum azonosító' },
    { name: 'summary', type: 'text', label: 'Összegzés' },
    {
      name: 'changes',
      type: 'json',
      label: 'Változások (mező-diff)',
      admin: { description: 'Módosításnál a változott mezők: [{ field, from, to }].' },
    },
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
  ],
  timestamps: true,
}
