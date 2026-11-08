/**
 * A számlázási ország (ISO 3166-1 alpha-2) — a vendég foglalásánál / utalvány-vásárlásánál. A számlázó felé megy
 * (Billingo: `country_code`, Számlázz.hu: `orszag` névvel). Külföldi (nem HU) vevő csak magánszemélyként vásárolhat:
 * a céges vásárlás (adószám) nála nem jelenik meg — így minden számla magyar áfás, magánszemélynek szóló.
 */
export const HOME_COUNTRY = 'HU'

/** a választó listája: Magyarország elöl, utána a környező és gyakori országok (EU + a leggyakoribb külföldiek) */
const CODES = [
  'HU', 'AT', 'SK', 'RO', 'HR', 'SI', 'RS', 'UA', 'DE', 'CZ', 'PL', 'IT', 'FR', 'ES', 'PT', 'NL', 'BE', 'LU', 'IE', 'DK',
  'SE', 'FI', 'EE', 'LV', 'LT', 'BG', 'GR', 'CY', 'MT', 'CH', 'NO', 'IS', 'GB', 'US', 'CA', 'AU', 'IL', 'TR', 'CN', 'JP', 'KR', 'IN', 'BR', 'AE',
] as const

export function countryName(code: string, locale = 'hu'): string {
  try { return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code } catch { return code }
}

/** a választó opciói a vendég nyelvén: Magyarország elöl, a többi ábécérendben */
export function countryOptions(locale: string): { code: string; name: string }[] {
  const [home, ...rest] = CODES
  return [{ code: home, name: countryName(home, locale) }, ...rest.map((c) => ({ code: c, name: countryName(c, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale))]
}

/** érvényes kód (nagybetűs), különben null */
export function normalizeCountry(code?: string | null): string | null {
  const c = (code ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(c) ? c : null
}

export const isForeignCountry = (code?: string | null) => !!normalizeCountry(code) && normalizeCountry(code) !== HOME_COUNTRY

/** a nyelvből kitalált alap: magyar oldalon Magyarország, máshol üres (a vendég választ) */
export const defaultCountryFor = (locale: string) => (locale === 'hu' ? HOME_COUNTRY : '')
