import type { CollectionConfig } from 'payload'

/**
 * Mentett beosztás-sablon (Naptár „+ Beosztás”, design 11.6): kiknek, mely napokon, milyen időben, milyen szünettel —
 * egy kattintással újra kitölti az űrlapot. Csak a saját végponton (`/api/shift-templates`) érhető el.
 */
export const ShiftTemplates: CollectionConfig = {
  slug: 'shift-templates',
  labels: { singular: 'Beosztás-sablon', plural: 'Beosztás-sablonok' },
  admin: { group: 'Rendszer', hidden: true, useAsTitle: 'name' },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Név' },
    { name: 'salon', type: 'relationship', relationTo: 'salons', hasMany: false, label: 'Szalon' },
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', hasMany: false, label: 'Étterem' },
    { name: 'start_time', type: 'text', label: 'Kezdés (ÓÓ:PP)' },
    { name: 'end_time', type: 'text', label: 'Vége (ÓÓ:PP)' },
    { name: 'breaks', type: 'json', label: 'Szünetek' },
    // a hét napjai: 0 = vasárnap … 6 = szombat
    { name: 'days', type: 'json', label: 'Napok' },
    // kiknek: munkatárs- (szalon) vagy tag- (étterem) azonosítók
    { name: 'people', type: 'json', label: 'Kiknek' },
  ],
  timestamps: true,
}
