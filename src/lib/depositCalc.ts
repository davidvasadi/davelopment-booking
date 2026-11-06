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
  apply_when?: string | null
  min_price_huf?: number | null
  min_pax?: number | null
  special_days?: { weekdays?: number[] | null; dates?: string[] | null } | null
} | null | undefined

/**
 * Kell-e előleg EZEN a foglaláson (design 16.1 „Mely foglalásoknál”): mindig / X Ft feletti szolgáltatásnál (szalon) /
 * X fő felett (étterem) / kiemelt napokon (a hét kiválasztott napjai vagy konkrét dátumok). A foglalóoldal (a fizetés
 * lépés megjelenése) és a szerver (deposit-intent, foglalás mentése) is ezt hívja — a kettő sose csúszhat szét.
 * Dátum nélkül (pl. még nincs kiválasztva) a kiemelt-napos szabály nem teljesül.
 */
export function depositApplies(settings: DepositSettings, ctx: { date?: string | null; priceHuf?: number | null; pax?: number | null }): boolean {
  if (!settings?.enabled) return false
  switch (settings.apply_when) {
    case 'min_price': return (ctx.priceHuf ?? 0) > (settings.min_price_huf ?? 0)
    case 'min_pax': return (ctx.pax ?? 0) > (settings.min_pax ?? 0)
    case 'special_days': {
      if (!ctx.date) return false
      const day = ctx.date.slice(0, 10)
      const sd = settings.special_days
      if (sd?.dates?.includes(day)) return true
      return !!sd?.weekdays?.includes(new Date(`${day}T12:00:00`).getDay())
    }
    default: return true
  }
}

export function computeSalonDepositHuf(settings: DepositSettings, servicePriceHuf: number, date?: string | null): number | null {
  if (!settings?.enabled) return null
  if (date !== undefined && !depositApplies(settings, { date, priceHuf: servicePriceHuf })) return null
  if (settings.type === 'percent' && settings.percent_value) {
    return Math.round((servicePriceHuf * settings.percent_value) / 100)
  }
  return settings.fixed_amount_huf ? Math.round(settings.fixed_amount_huf) : null
}

export function computeRestaurantDepositHuf(settings: DepositSettings, pax: number, date?: string | null): number | null {
  if (!settings?.enabled) return null
  if (date !== undefined && !depositApplies(settings, { date, pax })) return null
  if (settings.type === 'per_pax' && settings.per_pax_amount_huf) {
    return Math.round(settings.per_pax_amount_huf * pax)
  }
  return settings.fixed_amount_huf ? Math.round(settings.fixed_amount_huf) : null
}
