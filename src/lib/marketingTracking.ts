/**
 * Anonim konverziós esemény a sikeres foglalás után (GA4 + Facebook Pixel) — SOSE tartalmaz
 * személyes adatot (név/telefon/email), csak a puszta "történt egy foglalás" jelzést, ha a
 * tulaj beállította az adott azonosítót (a `gtag`/`fbq` egyébként nincs is betöltve, a
 * globális-vagy-nincs optional chaining ezt biztonságosan kezeli).
 */
export function trackBookingConversion(): void {
  if (typeof window === 'undefined') return
  const w = window as unknown as { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void }
  w.gtag?.('event', 'generate_lead')
  w.fbq?.('track', 'Lead')
}
