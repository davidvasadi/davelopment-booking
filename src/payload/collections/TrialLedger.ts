import type { CollectionConfig } from 'payload'

/**
 * PRÓBAIDŐ-NYILVÁNTARTÁS — a fiók törlésétől FÜGGETLEN, örökre megmaradó email-lista arról,
 * hogy egy adott email már kapott valaha ingyenes próbaidőt. A `Users`/`Subscriptions` rekordok
 * a fiók törlésekor teljesen törlődnek (lásd `Users.beforeDelete`), enélkül tehát bárki
 * végtelenítve tudná a próbaidőt: lejár → törli a fiókját → újraregisztrál ugyanazzal az
 * emaillel → friss próbaidőt kap. Ez a collection ezt zárja be: `getOrCreateAccountSubscription`
 * ELLENŐRZI (és felveszi) az emailt ide ÚJ trial indításakor — ha már szerepel, a fiók trial
 * nélkül, azonnal `past_due` státusszal jön létre.
 *
 * SOSE töröljük innen a sorokat (a `Users.beforeDelete` hook szándékosan NEM nyúl hozzá).
 */
export const TrialLedger: CollectionConfig = {
  slug: 'trial-ledger',
  labels: { singular: 'Próbaidő-nyilvántartás', plural: 'Próbaidő-nyilvántartás' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'first_seen_at'],
    group: 'Rendszer',
    description: 'Kizárólag rendszer-célra: mely emailek használtak már ingyenes próbaidőt. Fiók-törlés NEM üríti.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    { name: 'first_seen_at', type: 'date', required: true, defaultValue: () => new Date().toISOString() },
  ],
  timestamps: true,
}
