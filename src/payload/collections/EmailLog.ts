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
    defaultColumns: ['type', 'to', 'subject', 'status', 'ok', 'createdAt'],
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
        { label: 'Ajándékutalvány vásárlás', value: 'voucher_purchase' },
        { label: 'Marketing hírlevél', value: 'marketing_broadcast' },
        { label: 'Foglalás módosítás', value: 'modification' },
        { label: 'Reggeli összefoglaló', value: 'digest_morning' },
        { label: 'Esti összefoglaló', value: 'digest_evening' },
        { label: 'Csapat-meghívó', value: 'team_invite' },
        { label: 'Jelszó-visszaállítás', value: 'password_reset' },
        { label: 'Beosztás értesítő', value: 'schedule_change' },
        { label: 'Egyéb', value: 'other' },
      ],
    },
    { name: 'to', type: 'text', label: 'Címzett' },
    { name: 'subject', type: 'text', label: 'Tárgy' },
    { name: 'ok', type: 'checkbox', defaultValue: true, index: true, label: 'Sikeres' },
    { name: 'error', type: 'text', label: 'Hiba (ha volt)' },
    // A Resend `emails.send()` válaszának id-je — ezzel párosítjuk a később beérkező webhook-
    // eseményeket (kézbesítve/megnyitva/kattintva/visszapattant) ehhez a rekordhoz.
    { name: 'resend_id', type: 'text', index: true, label: 'Resend ID' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'sent',
      index: true,
      label: 'Kézbesítési állapot',
      options: [
        { label: 'Elküldve', value: 'sent' },
        { label: 'Kézbesítve', value: 'delivered' },
        { label: 'Megnyitva', value: 'opened' },
        { label: 'Rákattintva', value: 'clicked' },
        { label: 'Visszapattant', value: 'bounced' },
        { label: 'Panasz (spam)', value: 'complained' },
        { label: 'Sikertelen küldés', value: 'failed' },
      ],
    },
    { name: 'delivered_at', type: 'date', label: 'Kézbesítve ekkor' },
    { name: 'opened_at', type: 'date', label: 'Megnyitva ekkor' },
    // Csak a foglaláshoz köthető vendég-emaileknél (visszaigazolás/módosítás/lemondás/
    // emlékeztető) van kitöltve — ez alapján jeleníti meg a szerkesztő ablak az állapotot.
    { name: 'booking', type: 'relationship', relationTo: 'bookings', label: 'Foglalás' },
    { name: 'reservation', type: 'relationship', relationTo: 'reservations', label: 'Asztalfoglalás' },
    // Csak a `marketing_broadcast` típusnál kitöltve — ez alapján számolja a küldés-route az
    // adott üzlet havi hírlevél-plafonjának felhasználását (naptári hónapra szűrve).
    { name: 'salon', type: 'relationship', relationTo: 'salons', label: 'Szalon' },
    { name: 'restaurant', type: 'relationship', relationTo: 'restaurants', label: 'Étterem' },
    // Csak `marketing_broadcast`-nál — melyik kampányhoz tartozik (nyitási-arány számításhoz).
    { name: 'campaign', type: 'relationship', relationTo: 'marketing-campaigns', label: 'Kampány' },
  ],
  timestamps: true,
}
