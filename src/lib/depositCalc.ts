/**
 * Előleg-összeg számítása — KIZÁRÓLAG szerver-oldalon hívjuk (sose fogadjunk el kliens által
 * küldött összeget). Megosztott a `deposit-intent` route (első számítás) és a
 * `bookings`/`reservations` route (a PaymentIntent visszaellenőrzésekor újraszámolt "elvárt
 * összeg") között, hogy a két hely SOSE csúszhasson szét.
 *
 * Szalon: fix VAGY a `service.price` százaléka (van ár-alap).
 * Étterem: fix VAGY fejenkénti (nincs ár-mező a foglaláson — a végszámla foglaláskor nem
 * létezik, ezért "százalék a végszámlából" nem értelmezhető, lásd a terv 3. pontját).
 */

type DepositSettings = {
  enabled?: boolean | null
  type?: string | null
  fixed_amount_huf?: number | null
  percent_value?: number | null
  per_pax_amount_huf?: number | null
} | null | undefined

export function computeSalonDepositHuf(settings: DepositSettings, servicePriceHuf: number): number | null {
  if (!settings?.enabled) return null
  if (settings.type === 'percent' && settings.percent_value) {
    return Math.round((servicePriceHuf * settings.percent_value) / 100)
  }
  return settings.fixed_amount_huf ? Math.round(settings.fixed_amount_huf) : null
}

export function computeRestaurantDepositHuf(settings: DepositSettings, pax: number): number | null {
  if (!settings?.enabled) return null
  if (settings.type === 'per_pax' && settings.per_pax_amount_huf) {
    return Math.round(settings.per_pax_amount_huf * pax)
  }
  return settings.fixed_amount_huf ? Math.round(settings.fixed_amount_huf) : null
}
