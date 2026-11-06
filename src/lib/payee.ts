import type { Salon, StaffMember } from '@/payload/payload-types'

/**
 * Kié a pénz és a számla egy szalon-foglalásnál (design 16.7 „Ki számláz?”):
 *  - „Az üzlet” (alap): az üzlet Stripe-fiókja, számlázója és adószáma;
 *  - „Szakemberenként” (a csapat vállalkozó): a foglalás szakemberéé — a saját Stripe-ja (az előleg és a fizetési link
 *    pénze oda megy), a saját számlázója és adószáma (a számla az ő nevére). Akinek nincs kész Stripe-ja, annál nincs
 *    online fizetés (előleg, link) — csak helyszíni.
 * Az ajándékutalvány nem köthető szakemberhez: mindig az üzleté.
 */
export type InvoiceSettingsLike = { invoice_provider?: string | null; szamlazz_agent_key_enc?: string | null; billingo_api_key_enc?: string | null } | null | undefined
export type Payee = {
  kind: 'business' | 'staff'
  /** a Stripe Connect fiók, ahová az online pénz megy (null: nincs) */
  accountId: string | null
  /** a fiók kész-e fogadni (onboarding lefutott) */
  canTakePayments: boolean
  invoiceSettings: InvoiceSettingsLike
  taxNumber: string | null
  name: string
}

export const issuerOf = (salon: Pick<Salon, 'invoice_settings'>): 'business' | 'staff' => (salon.invoice_settings?.issuer === 'staff' ? 'staff' : 'business')

export function salonPayee(salon: Salon, staff: StaffMember | null | undefined): Payee {
  if (issuerOf(salon) === 'staff' && staff) {
    return {
      kind: 'staff',
      accountId: staff.stripe_connect_account_id ?? null,
      canTakePayments: !!staff.stripe_connect_onboarded && !!staff.stripe_connect_account_id,
      invoiceSettings: { invoice_provider: staff.invoice_provider, szamlazz_agent_key_enc: staff.szamlazz_agent_key_enc, billingo_api_key_enc: staff.billingo_api_key_enc },
      taxNumber: staff.tax_number ?? null,
      name: staff.name,
    }
  }
  return {
    kind: 'business',
    accountId: salon.stripe_connect_account_id ?? null,
    canTakePayments: !!salon.stripe_connect_onboarded && !!salon.stripe_connect_account_id,
    invoiceSettings: salon.invoice_settings,
    taxNumber: salon.tax_number ?? null,
    name: salon.legal_name || salon.name,
  }
}

/**
 * Egy már kiállított számla melyik számlázó-fiókból ment (a sztornóhoz és a PDF-hez): szalon-foglalásnál, ha
 * szakemberenként számláznak, a foglalás szakemberéé; különben (és az utalványnál mindig) az üzleté.
 */
export async function invoiceSettingsForRecord(
  payload: import('payload').Payload,
  biz: { invoice_settings?: unknown } & Partial<Pick<Salon, 'invoice_settings'>>,
  collection: 'bookings' | 'reservations' | 'gift-vouchers',
  rec: { staff?: unknown },
): Promise<InvoiceSettingsLike> {
  if (collection === 'bookings' && (biz.invoice_settings as { issuer?: string } | undefined)?.issuer === 'staff' && rec.staff != null) {
    const sid = typeof rec.staff === 'object' ? (rec.staff as { id: unknown }).id : rec.staff
    const st = (await payload.findByID({ collection: 'staff', id: String(sid), depth: 0, overrideAccess: true }).catch(() => null)) as StaffMember | null
    if (st) return { invoice_provider: st.invoice_provider, szamlazz_agent_key_enc: st.szamlazz_agent_key_enc, billingo_api_key_enc: st.billingo_api_key_enc }
  }
  return biz.invoice_settings as InvoiceSettingsLike
}
