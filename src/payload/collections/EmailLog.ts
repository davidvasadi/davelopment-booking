import type { CollectionConfig } from 'payload'

/**
 * KIMENŐ EMAIL-NAPLÓ. Minden platformon kiküldött email (Resend) egy rekord — így a backstage
 * pontosan látja, havonta hány email megy ki (a Resend-csomag megválasztásához). A rekordokat
 * a `sendEmail` wrapper (src/lib/emailSend.ts) hozza létre, overrideAccess-szel. Append-only,
 * csak admin olvashatja.
 */
export const EmailLog: CollectionConfig = {
  slug: 'email-log',
  labels: { singular: 'Email-napló', plural: 'Email-napló' },
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['type', 'to', 'subject', 'ok', 'createdAt'],
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
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      label: 'Típus',
      options: [
        { label: 'Foglalás visszaigazolás', value: 'booking_confirmation' },
        { label: 'Új foglalás értesítő', value: 'new_booking' },
        { label: 'Lemondás', value: 'cancellation' },
        { label: 'Emlékeztető', value: 'reminder' },
        { label: 'Értékelés-kérés', value: 'feedback' },
        { label: 'Várólista feliratkozás', value: 'waitlist_signup' },
        { label: 'Várólista felszabadult', value: 'waitlist_opening' },
        { label: 'Csapat-meghívó', value: 'team_invite' },
        { label: 'Jelszó-visszaállítás', value: 'password_reset' },
        { label: 'Egyéb', value: 'other' },
      ],
    },
    { name: 'to', type: 'text', label: 'Címzett' },
    { name: 'subject', type: 'text', label: 'Tárgy' },
    { name: 'ok', type: 'checkbox', defaultValue: true, index: true, label: 'Sikeres' },
    { name: 'error', type: 'text', label: 'Hiba (ha volt)' },
  ],
  timestamps: true,
}
