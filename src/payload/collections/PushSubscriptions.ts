import type { Access, CollectionConfig } from 'payload'

/**
 * WEB PUSH FELIRATKOZÁSOK — eszközönként (böngésző) egy rekord: az `endpoint` a push-szolgáltató
 * címe (ez azonosítja az eszközt, EGYEDI), a `p256dh`+`auth` a titkosításhoz kell. Egy felhasználónak
 * több eszköze (több rekordja) lehet. Küldéskor a szerver a user-hez tartozó feliratkozásokra küld;
 * hogy melyik üzlet eseményét kapja meg, a user tulaj/tag viszonya dönti (nem a feliratkozás).
 *
 * Access: mindenki CSAK a SAJÁT feliratkozásait látja/törli (a route-ok overrideAccess-szel dolgoznak).
 */
const ownScoped: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return { user: { equals: req.user.id } }
}

export const PushSubscriptions: CollectionConfig = {
  slug: 'push-subscriptions',
  labels: { singular: 'Push feliratkozás', plural: 'Push feliratkozások' },
  admin: {
    useAsTitle: 'endpoint',
    defaultColumns: ['user', 'user_agent', 'createdAt'],
    group: 'Közös',
    hidden: true,
  },
  access: {
    read: ownScoped,
    create: ({ req }) => !!req.user,
    update: ownScoped,
    delete: ownScoped,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', hasMany: false, required: true, index: true },
    { name: 'endpoint', type: 'text', required: true, unique: true, index: true },
    { name: 'p256dh', type: 'text', required: true },
    { name: 'auth', type: 'text', required: true },
    { name: 'user_agent', type: 'text', label: 'Eszköz / böngésző' },
  ],
  timestamps: true,
}
