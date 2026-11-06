// Import: oszlopnév-felismerés (aliasok) és választható célmezők — EGY közös forrás a felületnek
// (ImportPanel) és a szervernek (/api/import-csv). Korábban két külön lista volt, és elcsúsztak:
// amit a szerver felismert (pl. Salonic ID, Árbevétel, Első/Utolsó szolgáltatás), azt a felület
// „figyelmen kívül hagy”-nak mutatta, és ki sem lehetett választani.

export type ImportType =
  | 'bookings' | 'customers' | 'staff' | 'tables' | 'services'
  | 'opening_hours' | 'rooms' | 'service_categories' | 'billing_info'

export const ALIASES_BY_TYPE: Record<ImportType, Record<string, string>> = {
  bookings: {
    'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name', 'vendég': 'customer_name',
    'vendég neve': 'customer_name', 'név': 'customer_name', 'name': 'customer_name',
    'client': 'customer_name', 'client name': 'customer_name', 'customer': 'customer_name',
    'customer name': 'customer_name', 'guest': 'customer_name', 'guest name': 'customer_name',
    'email': 'customer_email', 'e-mail': 'customer_email', 'e-mail cím': 'customer_email',
    'email cím': 'customer_email', 'telefon': 'customer_phone', 'telefonszám': 'customer_phone',
    'phone': 'customer_phone', 'mobile': 'customer_phone', 'mobil': 'customer_phone',
    'phone number': 'customer_phone', 'dátum': 'date', 'date': 'date',
    'foglalás dátuma': 'date', 'appointment date': 'date', 'időpont': 'start_time',
    'kezdés': 'start_time', 'kezdési idő': 'start_time', 'kezdési idő (hh:mm)': 'start_time',
    'time': 'start_time', 'start time': 'start_time', 'appointment time': 'start_time',
    'vége': 'end_time', 'befejezési idő': 'end_time', 'befejezési idő (hh:mm)': 'end_time',
    'end time': 'end_time', 'end': 'end_time', 'fő': 'pax',
    'pax': 'pax', 'guests': 'pax', 'vendégek száma': 'pax',
    'covers': 'pax', 'party size': 'pax', 'szolgáltatás': 'service',
    'service': 'service', 'treatment': 'service', 'kezelés': 'service',
    'service name': 'service', 'munkatárs': 'staff', 'szakember': 'staff',
    'staff': 'staff', 'stylist': 'staff', 'employee': 'staff',
    'therapist': 'staff', 'provider': 'staff', 'időtartam (perc)': 'duration',
    'időtartam': 'duration', 'duration': 'duration', 'duration (min)': 'duration',
    'duration (minutes)': 'duration', 'ár (ft)': 'price', 'ár': 'price',
    'price': 'price', 'díj': 'price', 'cost': 'price',
    'státusz': 'status', 'status': 'status', 'booking status': 'status',
    'megjegyzés': 'notes', 'megjegyzések': 'notes', 'notes': 'notes',
    'note': 'notes', 'comment': 'notes', 'comments': 'notes',
  },
  customers: {
    'ügyfél': 'customer_name', 'ügyfél neve': 'customer_name', 'vendég': 'customer_name',
    'vendég neve': 'customer_name', 'név': 'customer_name', 'name': 'customer_name',
    'customer': 'customer_name', 'customer name': 'customer_name', 'guest': 'customer_name',
    'guest name': 'customer_name', 'email': 'customer_email', 'e-mail': 'customer_email',
    'e-mail cím': 'customer_email', 'telefon': 'customer_phone', 'phone': 'customer_phone',
    'mobile': 'customer_phone', 'mobil': 'customer_phone', 'mobiltelefonszám': 'customer_phone',
    'id': 'external_id', 'azonosító': 'external_id', 'azonosito': 'external_id',
    'megjegyzés': 'notes', 'notes': 'notes', 'note': 'notes',
    'comment': 'notes', 'jegyzet': 'notes', 'nem': 'gender',
    'gender': 'gender', 'csoport': 'group_tag', 'group': 'group_tag',
    'címke': 'group_tag', 'cimke': 'group_tag', 'tag': 'group_tag',
    'lakhely': 'customer_city', 'város': 'customer_city', 'varos': 'customer_city',
    'city': 'customer_city', 'születésnap': 'birthday', 'szuletesnap': 'birthday',
    'birthday': 'birthday', 'date of birth': 'birthday', 'dob': 'birthday',
    'hírlevél': 'marketing_consent', 'hirlevel': 'marketing_consent', 'newsletter': 'marketing_consent',
    'feketelistás': 'blocked', 'feketelistas': 'blocked', 'blocked': 'blocked',
    'blacklisted': 'blocked', 'feketelistára kerülés oka': 'block_reason', 'feketelistara kerules oka': 'block_reason',
    'block reason': 'block_reason', 'számlázási név': 'billing_name', 'szamlazasi nev': 'billing_name',
    'billing name': 'billing_name', 'számlázási adószám (cég esetén)': 'billing_tax_number', 'számlázási adószám': 'billing_tax_number',
    'adószám': 'billing_tax_number', 'tax number': 'billing_tax_number', 'számlaküldési e-mail cím': 'billing_email',
    'számlaküldési email': 'billing_email', 'billing email': 'billing_email', 'számlázási irányitószám': 'billing_postal_code',
    'számlázási irányítószám': 'billing_postal_code', 'billing postal code': 'billing_postal_code', 'számlázási település': 'billing_city',
    'billing city': 'billing_city', 'számlázási közterület neve': 'billing_street_name', 'számlázási közterület jellege': 'billing_street_type',
    'számlázási házszám, ajtó, stb.': 'billing_street_number', 'utca': 'billing_street', 'cím': 'billing_street',
    'street': 'billing_street', 'address': 'billing_street', 'árbevétel': 'total_revenue_huf',
    'időpontok összesen': 'visit_count', 'lemondások száma': 'cancellation_count', 'nem jött el alkalmak száma': 'no_show_count',
    'utolsó lemondás oka': 'last_cancellation_reason', 'első szolgáltatás': 'first_service_name', 'első szolgáltatás időpont': 'first_service_at',
    'utolsó szolgáltatás': 'last_service_name', 'utolsó szolgáltatás időpont': 'last_service_at', 'munkatársak': 'staff_name_hint',
    'munkatárs': 'staff_name_hint', 'település': 'customer_city', 'segment': 'group_tag',
    'invoice name': 'billing_name', 'billing zip': 'billing_postal_code', 'közterület neve': 'billing_street',
    'street address': 'billing_street', 'vat number': 'billing_tax_number', 'feliratkozott': 'marketing_consent',
    'blacklist': 'blocked', 'tiltólistás': 'blocked', 'blacklist reason': 'block_reason',
    'tiltás oka': 'block_reason', 'sex': 'gender',
  },
  staff: {
    'név': 'name', 'name': 'name', 'munkatárs': 'name',
    'munkatárs neve': 'name', 'employee': 'name', 'employee name': 'name',
    'staff name': 'name', 'full name': 'name', 'email': 'email',
    'e-mail': 'email', 'e-mail cím': 'email', 'telefon': 'phone',
    'phone': 'phone', 'mobile': 'phone', 'mobil': 'phone',
    'pozíció': 'role_title', 'beosztás': 'role_title', 'role': 'role_title',
    'title': 'role_title', 'job title': 'role_title', 'foglalkozás': 'role_title',
    'részleg': 'department', 'department': 'department', 'team': 'department',
    'csapat': 'department', 'születésnap': 'birthday', 'birthday': 'birthday',
    'date of birth': 'birthday', 'dob': 'birthday',
  },
  tables: {
    'asztal': 'name', 'asztal neve': 'name', 'table': 'name',
    'table name': 'name', 'name': 'name', 'név': 'name',
    'azonosító': 'name', 'férőhely': 'capacity', 'kapacitás': 'capacity',
    'capacity': 'capacity', 'seats': 'capacity', 'max guests': 'capacity',
    'max fő': 'capacity',
  },
  services: {
    'szolgáltatás': 'name', 'service': 'name', 'service name': 'name',
    'name': 'name', 'kezelés': 'name', 'treatment': 'name',
    'név': 'name', 'időtartam': 'duration', 'duration': 'duration',
    'időtartam (perc)': 'duration', 'duration (min)': 'duration', 'ár': 'price',
    'price': 'price', 'díj': 'price', 'cost': 'price',
    'ár (ft)': 'price', 'kategória': 'category', 'category': 'category',
    'group': 'category', 'csoport': 'category',
  },
  opening_hours: {
    'nap': 'day_of_week', 'day': 'day_of_week', 'day of week': 'day_of_week',
    'weekday': 'day_of_week', 'napja': 'day_of_week', 'hét napja': 'day_of_week',
    'nyitva': 'is_open', 'is_open': 'is_open', 'nyitva?': 'is_open',
    'open': 'is_open', 'open?': 'is_open', 'nyitva-e': 'is_open',
    'nyitás': 'open_time', 'nyitas': 'open_time', 'open time': 'open_time',
    'opens': 'open_time', 'nyitási idő': 'open_time', 'from': 'open_time',
    'tól': 'open_time', 'zárás': 'close_time', 'zaras': 'close_time',
    'close time': 'close_time', 'closes': 'close_time', 'záró idő': 'close_time',
    'to': 'close_time', 'ig': 'close_time', 'zárási idő': 'close_time',
  },
  rooms: {
    'terem': 'name', 'terem neve': 'name', 'room': 'name',
    'room name': 'name', 'name': 'name', 'név': 'name',
    'szoba': 'name', 'helyiség': 'name', 'zóna': 'name',
    'zona': 'name', 'section': 'name', 'szekció': 'name',
    'area': 'name', 'szabadtéri': 'is_outdoor', 'szabadteri': 'is_outdoor',
    'outdoor': 'is_outdoor', 'terasz': 'is_outdoor', 'kert': 'is_outdoor',
    'aktív': 'is_active', 'aktiv': 'is_active', 'active': 'is_active',
    'enabled': 'is_active',
  },
  service_categories: {
    'kategória': 'name', 'kategoria': 'name', 'category': 'name',
    'name': 'name', 'név': 'name', 'csoport': 'name',
    'group': 'name', 'type': 'name', 'típus': 'name',
    'sorrend': 'sort_order', 'sort': 'sort_order', 'order': 'sort_order',
    'pozíció': 'sort_order', 'sort order': 'sort_order',
  },
  billing_info: {
    'cégnév': 'legal_name', 'cegnev': 'legal_name', 'legal name': 'legal_name',
    'company name': 'legal_name', 'vállalkozás neve': 'legal_name', 'company': 'legal_name',
    'adószám': 'tax_number', 'adoszam': 'tax_number', 'tax number': 'tax_number',
    'vat number': 'tax_number', 'vat': 'tax_number', 'tax id': 'tax_number',
    'adó azonosító': 'tax_number', 'adó': 'tax_number', 'cégjegyzékszám': 'company_reg_number',
    'cegj.szam': 'company_reg_number', 'company registration': 'company_reg_number', 'reg number': 'company_reg_number',
    'cégj szám': 'company_reg_number', 'székhely': 'registered_seat', 'szekhelycim': 'registered_seat',
    'registered address': 'registered_seat', 'registered seat': 'registered_seat', 'számlázási email': 'billing_email',
    'billing email': 'billing_email', 'email': 'billing_email', 'számlázási e-mail': 'billing_email',
    'irányítószám': 'billing_postal_code', 'irsz': 'billing_postal_code', 'postal code': 'billing_postal_code',
    'zip': 'billing_postal_code', 'zip code': 'billing_postal_code', 'város': 'billing_city',
    'varos': 'billing_city', 'city': 'billing_city', 'town': 'billing_city',
    'utca': 'billing_street', 'cím': 'billing_street', 'street': 'billing_street',
    'address': 'billing_street', 'számlázási cím': 'billing_street', 'billing address': 'billing_street',
  },
}

export const FIELD_OPTIONS_BY_TYPE: Record<ImportType, { value: string; label: string }[]> = {
  bookings: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'customer_name', label: 'Ügyfél / vendég neve' },
    { value: 'customer_email', label: 'Email' },
    { value: 'customer_phone', label: 'Telefon' },
    { value: 'date', label: 'Dátum (ÉÉÉÉ-HH-NN)' },
    { value: 'start_time', label: 'Kezdési idő' },
    { value: 'end_time', label: 'Befejezési idő' },
    { value: 'pax', label: 'Fő (étterem)' },
    { value: 'service', label: 'Szolgáltatás neve' },
    { value: 'staff', label: 'Munkatárs neve' },
    { value: 'duration', label: 'Időtartam (perc)' },
    { value: 'price', label: 'Ár' },
    { value: 'status', label: 'Státusz' },
    { value: 'notes', label: 'Megjegyzés' },
  ],
  customers: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'external_id', label: 'Külső azonosító (ID)' },
    { value: 'customer_name', label: 'Név' },
    { value: 'customer_email', label: 'Email' },
    { value: 'customer_phone', label: 'Telefon' },
    { value: 'customer_city', label: 'Város' },
    { value: 'birthday', label: 'Születésnap' },
    { value: 'group_tag', label: 'Csoport / címke' },
    { value: 'notes', label: 'Megjegyzés' },
    { value: 'billing_name', label: 'Számlázási név' },
    { value: 'billing_tax_number', label: 'Adószám' },
    { value: 'billing_email', label: 'Számlaküldési email' },
    { value: 'billing_postal_code', label: 'Számlázási irányítószám' },
    { value: 'billing_city', label: 'Számlázási település' },
    { value: 'billing_street', label: 'Számlázási utca, házszám' },
    { value: 'marketing_consent', label: 'Hírlevél-feliratkozás (igen/nem)' },
    { value: 'blocked', label: 'Tiltólistás (igen/nem)' },
    { value: 'block_reason', label: 'Tiltás indoka' },
    { value: 'gender', label: 'Nem' },
    { value: 'billing_street_name', label: 'Számlázási közterület neve' },
    { value: 'billing_street_type', label: 'Számlázási közterület jellege' },
    { value: 'billing_street_number', label: 'Számlázási házszám, ajtó' },
    { value: 'visit_count', label: 'Látogatások száma (összesítő)' },
    { value: 'cancellation_count', label: 'Lemondások száma (összesítő)' },
    { value: 'no_show_count', label: 'Nem jött el alkalmak (összesítő)' },
    { value: 'last_cancellation_reason', label: 'Utolsó lemondás oka' },
    { value: 'total_revenue_huf', label: 'Összes árbevétel, Ft (összesítő)' },
    { value: 'first_service_name', label: 'Első szolgáltatás' },
    { value: 'first_service_at', label: 'Első szolgáltatás időpontja' },
    { value: 'last_service_name', label: 'Utolsó szolgáltatás' },
    { value: 'last_service_at', label: 'Utolsó szolgáltatás időpontja' },
    { value: 'staff_name_hint', label: 'Munkatárs (az első/utolsó látogatáshoz)' },
  ],
  staff: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Neve' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Telefon' },
    { value: 'role_title', label: 'Pozíció / beosztás' },
    { value: 'department', label: 'Részleg / csapat' },
    { value: 'birthday', label: 'Születésnap' },
  ],
  tables: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Asztal neve' },
    { value: 'capacity', label: 'Férőhely (fő)' },
  ],
  services: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Szolgáltatás neve' },
    { value: 'duration', label: 'Időtartam (perc)' },
    { value: 'price', label: 'Ár' },
    { value: 'category', label: 'Kategória neve' },
  ],
  opening_hours: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'day_of_week', label: 'Nap (pl. Hétfő / Monday)' },
    { value: 'is_open', label: 'Nyitva? (igen/nem)' },
    { value: 'open_time', label: 'Nyitási idő (ÓÓ:PP)' },
    { value: 'close_time', label: 'Zárási idő (ÓÓ:PP)' },
  ],
  rooms: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Terem / zóna neve' },
    { value: 'is_outdoor', label: 'Szabadtéri? (igen/nem)' },
    { value: 'is_active', label: 'Aktív? (igen/nem)' },
  ],
  service_categories: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'name', label: 'Kategória neve' },
    { value: 'sort_order', label: 'Sorrend (szám)' },
  ],
  billing_info: [
    { value: '', label: '— figyelmen kívül hagy —' },
    { value: 'legal_name', label: 'Cégnév (jogi név)' },
    { value: 'tax_number', label: 'Adószám' },
    { value: 'company_reg_number', label: 'Cégjegyzékszám' },
    { value: 'registered_seat', label: 'Székhely (teljes cím)' },
    { value: 'billing_email', label: 'Számlázási email' },
    { value: 'billing_postal_code', label: 'Irányítószám' },
    { value: 'billing_city', label: 'Város' },
    { value: 'billing_street', label: 'Utca / számlázási cím' },
  ],
}

// ── Típus-felismerés (közös: Beállítások › Import és a regisztráció / új üzlet import-lépése) ──

// ── Típus-felismerés (közös: Beállítások › Import és a regisztráció / új üzlet import-lépése) ──

// Sheet name → import type auto-suggestion
export const SHEET_NAME_MAP: Record<string, ImportType> = {
  'munkatársak': 'staff', 'munkatarsak': 'staff', 'staff': 'staff', 'employees': 'staff', 'team': 'staff',
  'szolgáltatások': 'services', 'szolgaltatasok': 'services', 'services': 'services', 'treatments': 'services',
  'asztalok': 'tables', 'tables': 'tables',
  'vendégek': 'customers', 'vendegek': 'customers', 'customers': 'customers', 'guests': 'customers', 'ügyfelek': 'customers', 'ugyfelek': 'customers',
  'foglalások': 'bookings', 'foglalasok': 'bookings', 'bookings': 'bookings', 'reservations': 'bookings', 'appointments': 'bookings',
  'nyitvatartás': 'opening_hours', 'nyitvatartas': 'opening_hours', 'opening hours': 'opening_hours', 'hours': 'opening_hours', 'órarend': 'opening_hours',
  'termek': 'rooms', 'szobák': 'rooms', 'szobak': 'rooms', 'rooms': 'rooms', 'sections': 'rooms', 'zónák': 'rooms', 'zones': 'rooms',
  'kategóriák': 'service_categories', 'kategoriak': 'service_categories', 'categories': 'service_categories', 'kategoriák': 'service_categories',
  'számlázás': 'billing_info', 'szamlazas': 'billing_info', 'billing': 'billing_info', 'cégadatok': 'billing_info', 'cegadatok': 'billing_info', 'company': 'billing_info',
}

export function guessTypeFromSheet(name: string): ImportType | null {
  return SHEET_NAME_MAP[name.toLowerCase().trim()] ?? null
}

/** A fejlécből a legvalószínűbb adattípus (pontozás: a több típusnál is előforduló oszlopnév kevesebbet ér). */
export function detectTypeFromHeaders(headers: string[]): ImportType | null {
  const norm = headers.map((h) => h.toLowerCase().trim())
  const types = Object.keys(ALIASES_BY_TYPE) as ImportType[]
  let best: ImportType | null = null
  let bestScore = 0
  for (const type of types) {
    const aliases = ALIASES_BY_TYPE[type]
    let score = 0
    for (const h of norm) {
      if (!(h in aliases)) continue
      // Egy oszlopnév, ami TÖBB típus szótárában is szerepel (pl. "név"/"email"/"telefon",
      // ami csapatnál ÉS vendégnél is ott van), kevésbé megkülönböztető — csak az egyedi
      // (csak ennél a típusnál szereplő) nevek adjanak teljes pontot. Enélkül egy bővebb
      // szótár (több célmező = több alias) szisztematikusan "elnyerte" a felismerést egy
      // olyan fájltól is, ami valójában egy másik típushoz tartozott (pl. egy vendéglista
      // "munkatársak"-ként detektálódott, mert a staff-szótárban volt "születésnap" alias).
      const sharedWithOthers = types.filter((t) => t !== type && h in ALIASES_BY_TYPE[t]).length
      score += 1 / (1 + sharedWithOthers)
    }
    if (score > bestScore) { bestScore = score; best = type }
  }
  return bestScore >= 1.5 ? best : null
}
