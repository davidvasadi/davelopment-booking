import path from 'path'
import type { CollectionConfig } from 'payload'

/**
 * Táppénzes papír (orvosi igazolás) egy „Beteg” beosztáshoz — Naptár nap-szerkesztő (design 11.5). EGÉSZSÉGÜGYI adat,
 * ezért NEM a nyilvános médiatárban van: a fájl a projekt `uploads-private/sick-notes` mappájában, a Payload saját
 * végpontjain senki nem éri el (minden hozzáférés tiltva) — feltölteni, letölteni és törölni csak a
 * `/api/shifts/[id]/sick-note` végponton lehet, beosztás-kezelési joggal.
 */
export const SickNotes: CollectionConfig = {
  slug: 'sick-notes',
  labels: { singular: 'Táppénzes papír', plural: 'Táppénzes papírok' },
  admin: { group: 'Rendszer', hidden: true },
  access: {
    read: () => false,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  upload: {
    staticDir: path.join(process.cwd(), 'uploads-private/sick-notes'),
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  },
  fields: [
    { name: 'salon', type: 'relationship', relationTo: 'salons', hasMany: false, label: 'Szalon' },
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', hasMany: false, label: 'Étterem' },
  ],
  timestamps: true,
}
