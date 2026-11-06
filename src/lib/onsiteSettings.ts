import type { Salon } from '@/payload/payload-types'
import type { OnsiteSettings } from '@/components/dashboard/BookingCheckout'

/** A szalon „Fizetés a helyszínen” beállítása a dashboard nézeteknek (a foglalás „Fizetés” gombja — design 6.7.1). */
export function onsiteSettingsOf(salon: Pick<Salon, 'onsite_payment'>): OnsiteSettings {
  const o = salon.onsite_payment
  return {
    enabled: !!o?.enabled,
    mode: o?.mode === 'invoice' ? 'invoice' : 'register',
    methods: (o?.methods ?? 'cash,card,transfer').split(',').map((x) => x.trim()).filter(Boolean),
    invoiceDefault: o?.invoice_default === 'always' ? 'always' : 'ask',
  }
}
