/**
 * Telefonszám → ország (ISO2) feloldás a Vendég-térképhez.
 *
 * A foglalásoknál az ország nem mindig van külön eltárolva (szalon `bookings`-ban
 * egyáltalán nincs `country` mező, és a kézzel/rendszeren belül felvitt étterem-
 * foglalásnál is hiányozhat). A telefonszám nemzetközi előhívójából viszont
 * megbízhatóan levezethető — így a vendég a térképen a helyére kerül.
 *
 * Logika:
 *  - `+`/`00` előtag → leghosszabb illeszkedő hívókód nyer (pl. +421 SK a +42 elé).
 *  - `06…` vagy egyszerű helyi formátum → belföldi = HU (magyar alap).
 *  - egyébként null (nem tippelünk).
 */

/** Hívókód → ISO2. Több országnál ütköző kódnál a fő piac nyer (+1→US, +7→RU). */
const DIAL_TO_ISO: Record<string, string> = {
  '+36': 'HU', '+43': 'AT', '+49': 'DE', '+421': 'SK', '+40': 'RO', '+385': 'HR',
  '+381': 'RS', '+386': 'SI', '+39': 'IT', '+33': 'FR', '+44': 'GB', '+353': 'IE',
  '+1': 'US', '+48': 'PL', '+420': 'CZ', '+31': 'NL', '+32': 'BE', '+34': 'ES',
  '+351': 'PT', '+41': 'CH', '+46': 'SE', '+47': 'NO', '+45': 'DK', '+358': 'FI',
  '+30': 'GR', '+380': 'UA', '+359': 'BG', '+90': 'TR', '+7': 'RU', '+352': 'LU',
  '+370': 'LT', '+371': 'LV', '+372': 'EE', '+387': 'BA', '+382': 'ME', '+389': 'MK',
  '+355': 'AL', '+373': 'MD', '+357': 'CY', '+356': 'MT', '+354': 'IS', '+52': 'MX',
  '+55': 'BR', '+54': 'AR', '+61': 'AU', '+64': 'NZ', '+81': 'JP', '+86': 'CN',
  '+91': 'IN', '+27': 'ZA', '+20': 'EG', '+971': 'AE', '+972': 'IL',
}

// Hívókódok hosszúság szerint csökkenőben — a leghosszabb prefix nyer.
const DIALS_BY_LEN = Object.keys(DIAL_TO_ISO).sort((a, b) => b.length - a.length)

/** Telefonszámból ISO2 ország, vagy null ha nem megállapítható. */
export function isoFromPhone(phone?: string | null): string | null {
  if (!phone) return null
  let s = phone.replace(/[\s\-()./]/g, '')
  if (!s) return null
  if (s.startsWith('00')) s = '+' + s.slice(2)
  if (s.startsWith('+')) {
    for (const dial of DIALS_BY_LEN) {
      if (s.startsWith(dial)) return DIAL_TO_ISO[dial]
    }
    return null
  }
  // Belföldi formátum (06 20…, 20…, 0620…) → magyar.
  if (/^0?6?\d{6,}$/.test(s)) return 'HU'
  return null
}
