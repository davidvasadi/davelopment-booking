import type { CollectionConfig } from 'payload'

/**
 * Google Places API (New) hívás-napló — ÁLLAPOT NÉLKÜLI biztonsági számláló, nem funkcionális
 * adat. Minden ténylegesen kimenő Text Search / Place Details hívás egy sor; ebből számolja a
 * `src/lib/googleReviews.ts` havonta (naptári hónapra szűrve), hogy közeledünk-e a Google-fiók
 * ingyenes keretéhez (Text Search Pro: 5000/hó, Place Details Enterprise+Atmosphere: 1000/hó) —
 * lásd a két konstanst ott (`CAPS`). A plafon elérése előtt (biztonsági sávval, 4950/950-nél)
 * a funkció önmagát "karbantartás alatt áll"-ra kapcsolja, hogy a platform SOSE lépje túl a
 * Google-nél ténylegesen fizetőssé váló küszöböt.
 */
export const GoogleApiLog: CollectionConfig = {
  slug: 'google-api-log',
  labels: { singular: 'Google API-napló', plural: 'Google API-napló' },
  admin: {
    useAsTitle: 'kind',
    defaultColumns: ['kind', 'createdAt'],
    group: 'Rendszer',
    hidden: true,
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => false, // csak szerver-oldal (overrideAccess)
    update: () => false,
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      required: true,
      index: true,
      label: 'Hívás típusa',
      options: [
        { label: 'Élő találatok (Autocomplete New)', value: 'autocomplete' },
        { label: 'Hely-részletek (Place Details Enterprise+Atmosphere)', value: 'place_details' },
        { label: 'Cím-részletek (Place Details Essentials)', value: 'address_details' },
      ],
    },
  ],
  timestamps: true,
}
