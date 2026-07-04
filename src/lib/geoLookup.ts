/**
 * Kis ország-lookup a Vendég-térképhez (GuestMap.tsx).
 *
 * - ISO2 → ISO3: a futásidőben letöltött world-countries GeoJSON ISO_A3 mezőjéhez
 *   illesztéshez (a GeoJSON gyakran csak ISO_A3-at ad megbízhatóan).
 * - ISO2 → főváros: MEGJEGYZÉS — a foglalásokban jelenleg NINCS város-adat, ezért
 *   város-közelítésként az adott ország FŐVÁROSÁT jelenítjük meg magas zoomon.
 *   Amint valós város-adat lesz, ez a lookup lecserélhető.
 *
 * Csak a gyakori (európai + néhány globális) országokat tartalmazza; ismeretlen
 * ISO esetén a kifestés/város-marker egyszerűen elmarad — a pinek maradnak.
 */

export const ISO2_TO_ISO3: Record<string, string> = {
  HU: 'HUN', AT: 'AUT', DE: 'DEU', SK: 'SVK', RO: 'ROU', GB: 'GBR', FR: 'FRA',
  US: 'USA', IT: 'ITA', ES: 'ESP', PT: 'PRT', NL: 'NLD', BE: 'BEL', CH: 'CHE',
  PL: 'POL', CZ: 'CZE', HR: 'HRV', SI: 'SVN', RS: 'SRB', UA: 'UKR', GR: 'GRC',
  SE: 'SWE', NO: 'NOR', DK: 'DNK', FI: 'FIN', IE: 'IRL', IS: 'ISL', LU: 'LUX',
  BG: 'BGR', TR: 'TUR', RU: 'RUS', CA: 'CAN', MX: 'MEX', BR: 'BRA', AR: 'ARG',
  AU: 'AUS', NZ: 'NZL', JP: 'JPN', CN: 'CHN', IN: 'IND', ZA: 'ZAF', EG: 'EGY',
  AE: 'ARE', IL: 'ISR', LT: 'LTU', LV: 'LVA', EE: 'EST', BA: 'BIH', ME: 'MNE',
  MK: 'MKD', AL: 'ALB', MD: 'MDA', CY: 'CYP', MT: 'MLT',
}

export interface Capital {
  city: string
  latlng: [number, number]
}

/** ISO2 → főváros (város-közelítés, amíg nincs valós város-adat). */
export const ISO2_TO_CAPITAL: Record<string, Capital> = {
  HU: { city: 'Budapest', latlng: [47.4979, 19.0402] },
  AT: { city: 'Wien', latlng: [48.2082, 16.3738] },
  DE: { city: 'Berlin', latlng: [52.52, 13.405] },
  SK: { city: 'Bratislava', latlng: [48.1486, 17.1077] },
  RO: { city: 'București', latlng: [44.4268, 26.1025] },
  GB: { city: 'London', latlng: [51.5074, -0.1278] },
  FR: { city: 'Paris', latlng: [48.8566, 2.3522] },
  US: { city: 'Washington', latlng: [38.9072, -77.0369] },
  IT: { city: 'Roma', latlng: [41.9028, 12.4964] },
  ES: { city: 'Madrid', latlng: [40.4168, -3.7038] },
  PT: { city: 'Lisboa', latlng: [38.7223, -9.1393] },
  NL: { city: 'Amsterdam', latlng: [52.3676, 4.9041] },
  BE: { city: 'Brussel', latlng: [50.8503, 4.3517] },
  CH: { city: 'Bern', latlng: [46.948, 7.4474] },
  PL: { city: 'Warszawa', latlng: [52.2297, 21.0122] },
  CZ: { city: 'Praha', latlng: [50.0755, 14.4378] },
  HR: { city: 'Zagreb', latlng: [45.815, 15.9819] },
  SI: { city: 'Ljubljana', latlng: [46.0569, 14.5058] },
  RS: { city: 'Beograd', latlng: [44.7866, 20.4489] },
  UA: { city: 'Kyiv', latlng: [50.4501, 30.5234] },
  GR: { city: 'Athina', latlng: [37.9838, 23.7275] },
  SE: { city: 'Stockholm', latlng: [59.3293, 18.0686] },
  NO: { city: 'Oslo', latlng: [59.9139, 10.7522] },
  DK: { city: 'København', latlng: [55.6761, 12.5683] },
  FI: { city: 'Helsinki', latlng: [60.1699, 24.9384] },
  IE: { city: 'Dublin', latlng: [53.3498, -6.2603] },
  BG: { city: 'Sofia', latlng: [42.6977, 23.3219] },
  TR: { city: 'Ankara', latlng: [39.9334, 32.8597] },
  RU: { city: 'Moskva', latlng: [55.7558, 37.6173] },
  CA: { city: 'Ottawa', latlng: [45.4215, -75.6972] },
  MX: { city: 'Ciudad de México', latlng: [19.4326, -99.1332] },
  BR: { city: 'Brasília', latlng: [-15.7975, -47.8919] },
  AU: { city: 'Canberra', latlng: [-35.2809, 149.13] },
  JP: { city: 'Tokyo', latlng: [35.6762, 139.6503] },
  CN: { city: 'Beijing', latlng: [39.9042, 116.4074] },
  IN: { city: 'New Delhi', latlng: [28.6139, 77.209] },
  AE: { city: 'Abu Dhabi', latlng: [24.4539, 54.3773] },
  IL: { city: 'Jerusalem', latlng: [31.7683, 35.2137] },
  LT: { city: 'Vilnius', latlng: [54.6872, 25.2797] },
  LV: { city: 'Rīga', latlng: [56.9496, 24.1052] },
  EE: { city: 'Tallinn', latlng: [59.437, 24.7536] },
}
