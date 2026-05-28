/** A settings „Email" fül előnézet-gombjához tartozó URL-építő. A jelenlegi
 *  (akár mentetlen) mező-állapotot átadja a /api/email-preview route-nak. */
export function emailPreviewUrl(
  type: 'restaurant' | 'salon',
  v: {
    booking_email_intro?: string | null
    email_show_phone?: boolean | null
    email_show_email?: boolean | null
    email_show_address?: boolean | null
    email_show_directions?: boolean | null
    email_contact_phone?: string | null
    email_directions_address?: string | null
  },
): string {
  const q = new URLSearchParams({
    type,
    intro: v.booking_email_intro ?? '',
    phone: v.email_show_phone ? '1' : '0',
    cmail: v.email_show_email ? '1' : '0',
    addr: v.email_show_address ? '1' : '0',
    dir: v.email_show_directions ? '1' : '0',
    contactPhone: v.email_contact_phone ?? '',
    dirAddr: v.email_directions_address ?? '',
  })
  return `/api/email-preview?${q.toString()}`
}
