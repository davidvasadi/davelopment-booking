import { computeSalonDepositHuf, computeRestaurantDepositHuf } from './depositCalc'

/**
 * A vendégnek mutatott előleg-tájékoztató (foglaló „Adatok” lépése). A tényleges összeget a
 * kliensen UGYANAZZAL a függvénnyel számoljuk, amivel a szerver a fizetést kéri (`depositCalc`):
 * szalonnál a választott szolgáltatás árából (fix vagy %), étteremnél a létszámból (fix vagy
 * fejenkénti) — így a kiírt összeg mindig egyezik a fizetendővel. Csak élő előlegnél (bekapcsolva +
 * Stripe-onboarding kész), különben null.
 */
export type DepositInfo = {
  settings: { enabled: true; type: string | null; fixed_amount_huf: number | null; percent_value: number | null; per_pax_amount_huf: number | null; apply_when: string | null; min_price_huf: number | null; min_pax: number | null; special_days: { weekdays?: number[] | null; dates?: string[] | null } | null }
  refundHours: number
}

type DepositDoc = {
  stripe_connect_onboarded?: boolean | null
  deposit_settings?: {
    enabled?: boolean | null
    type?: string | null
    fixed_amount_huf?: number | null
    percent_value?: number | null
    per_pax_amount_huf?: number | null
    apply_when?: string | null
    min_price_huf?: number | null
    min_pax?: number | null
    special_days?: { weekdays?: number[] | null; dates?: string[] | null } | null
    refund_hours_before?: number | null
  } | null
}

export function depositSummary(doc: DepositDoc): DepositInfo | null {
  const d = doc.deposit_settings
  if (!d?.enabled || !doc.stripe_connect_onboarded) return null
  return {
    settings: {
      enabled: true,
      type: d.type ?? null,
      fixed_amount_huf: d.fixed_amount_huf ?? null,
      percent_value: d.percent_value ?? null,
      per_pax_amount_huf: d.per_pax_amount_huf ?? null,
      apply_when: d.apply_when ?? null,
      min_price_huf: d.min_price_huf ?? null,
      min_pax: d.min_pax ?? null,
      special_days: d.special_days ?? null,
    },
    refundHours: d.refund_hours_before ?? 24,
  }
}

const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

/** Szalon tájékoztató-szöveg (fordítási kulcs + paraméterek): százalékos beállításnál a
 *  százalékot ÉS a választott szolgáltatás árából számolt összeget is kiírjuk; fixnél az összeget. */
export function salonDepositNotice(info: DepositInfo, servicePriceHuf: number | null): { key: string; params: Record<string, string | number> } {
  const s = info.settings
  if (s.type === 'percent' && s.percent_value) {
    const amount = servicePriceHuf != null ? computeSalonDepositHuf(s, servicePriceHuf) : null
    return amount != null
      ? { key: 'public.deposit.noticePercent', params: { percent: s.percent_value, amount: ft(amount) } }
      : { key: 'public.deposit.noticePercentNoPrice', params: { percent: s.percent_value } }
  }
  return { key: 'public.deposit.notice', params: { amount: ft(s.fixed_amount_huf ?? 0) } }
}

/** Étterem: a létszámból (fejenkénti) vagy fix összeg. */
export function restaurantDepositLabel(info: DepositInfo, pax: number): string {
  const amount = computeRestaurantDepositHuf(info.settings, pax)
  return ft(amount ?? 0)
}
