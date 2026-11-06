export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export const DAY_LABELS_HU: Record<DayOfWeek, string> = {
  monday: 'Hétfő',
  tuesday: 'Kedd',
  wednesday: 'Szerda',
  thursday: 'Csütörtök',
  friday: 'Péntek',
  saturday: 'Szombat',
  sunday: 'Vasárnap',
}

export const DAY_LABELS_EN: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const DAY_LABELS_DE: Record<DayOfWeek, string> = {
  monday: 'Montag', tuesday: 'Dienstag', wednesday: 'Mittwoch', thursday: 'Donnerstag',
  friday: 'Freitag', saturday: 'Samstag', sunday: 'Sonntag',
}

export const DAY_LABELS_ES: Record<DayOfWeek, string> = {
  monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
  friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
}

export const DAY_LABELS_IT: Record<DayOfWeek, string> = {
  monday: 'Lunedì', tuesday: 'Martedì', wednesday: 'Mercoledì', thursday: 'Giovedì',
  friday: 'Venerdì', saturday: 'Sabato', sunday: 'Domenica',
}

export const DAY_LABELS_FR: Record<DayOfWeek, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi', thursday: 'Jeudi',
  friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

/** Napnév-címkék a megadott nyelven (a 6 támogatott locale). */
export function dayLabels(locale: 'hu' | 'en' | 'de' | 'es' | 'it' | 'fr'): Record<DayOfWeek, string> {
  switch (locale) {
    case 'en': return DAY_LABELS_EN
    case 'de': return DAY_LABELS_DE
    case 'es': return DAY_LABELS_ES
    case 'it': return DAY_LABELS_IT
    case 'fr': return DAY_LABELS_FR
    default: return DAY_LABELS_HU
  }
}

export interface RoomSeed {
  name: string
  sort_order?: number
  tables: TableSeed[]
}

export interface TableSeed {
  name: string
  capacity: number
  sort_order?: number
}

export interface OpeningHourSeed {
  day_of_week: DayOfWeek
  is_open: boolean
  open_time?: string
  close_time?: string
}

export interface RestaurantTemplate {
  id: string
  label: string
  description: string
  turn_duration_minutes: number
  slot_step_minutes: number
  lead_time_hours: number
  rooms: RoomSeed[]
  opening_hours: OpeningHourSeed[]
}

/** Minden nap ugyanazzal a nyitvatartással. */
function everyDay(open: string, close: string): OpeningHourSeed[] {
  return DAYS_OF_WEEK.map((d) => ({ day_of_week: d, is_open: true, open_time: open, close_time: close }))
}

/**
 * Hétköznap / hétvége (péntek-szombat) eltérő nyitvatartás, opcionális zárva-napokkal.
 * weekend = péntek + szombat.
 */
function weekHours(
  weekday: [string, string],
  weekend: [string, string],
  closedDays: DayOfWeek[] = [],
): OpeningHourSeed[] {
  const weekendDays: DayOfWeek[] = ['friday', 'saturday']
  return DAYS_OF_WEEK.map((d) => {
    if (closedDays.includes(d)) return { day_of_week: d, is_open: false }
    const [open, close] = weekendDays.includes(d) ? weekend : weekday
    return { day_of_week: d, is_open: true, open_time: open, close_time: close }
  })
}

/** Per-napos egyedi nyitvatartás (a felsoroltak nyitva, a többi zárva). */
function customDays(
  spec: Partial<Record<DayOfWeek, [string, string]>>,
): OpeningHourSeed[] {
  return DAYS_OF_WEEK.map((d) => {
    const hours = spec[d]
    if (!hours) return { day_of_week: d, is_open: false }
    return { day_of_week: d, is_open: true, open_time: hours[0], close_time: hours[1] }
  })
}

/** Gyors asztal-generátor: count db asztal adott kapacitással, prefixszel. */
function tablesOf(prefix: string, specs: Array<[capacity: number, count: number]>): TableSeed[] {
  const out: TableSeed[] = []
  let n = 1
  for (const [capacity, count] of specs) {
    for (let i = 0; i < count; i++) {
      out.push({ name: `${prefix}${n}`, capacity, sort_order: n })
      n++
    }
  }
  return out
}

export const RESTAURANT_TEMPLATES: RestaurantTemplate[] = [
  {
    id: 'classic',
    label: 'Klasszikus étterem',
    description:
      'Belső terem + terasz, à la carte. Kétfős, négyfős és nagyobb asztalok, ebéd–vacsora nyitvatartás, hétfőn zárva.',
    turn_duration_minutes: 120,
    slot_step_minutes: 30,
    lead_time_hours: 2,
    rooms: [
      {
        name: 'Belső terem',
        sort_order: 1,
        // 4× kétfős, 5× négyfős, 2× hatfős
        tables: tablesOf('', [
          [2, 4],
          [4, 5],
          [6, 2],
        ]),
      },
      {
        name: 'Terasz',
        sort_order: 2,
        // 3× négyfős, 2× hatfős, 1× nyolcfős (társasági)
        tables: tablesOf('T', [
          [4, 3],
          [6, 2],
          [8, 1],
        ]),
      },
    ],
    // hétfő zárva; kedd–csüt 11:30–22:00; péntek-szombat 11:30–23:30; vasárnap 11:30–21:00
    opening_hours: customDays({
      tuesday: ['11:30', '22:00'],
      wednesday: ['11:30', '22:00'],
      thursday: ['11:30', '22:00'],
      friday: ['11:30', '23:30'],
      saturday: ['11:30', '23:30'],
      sunday: ['11:30', '21:00'],
    }),
  },
  {
    id: 'multi_room',
    label: 'Nagy étterem (több terem)',
    description:
      'Földszint, emelet, terasz és külön rendezvényterem. Sok asztal, nagy társaságoknak is. Egész napos nyitvatartás.',
    turn_duration_minutes: 120,
    slot_step_minutes: 30,
    lead_time_hours: 3,
    rooms: [
      {
        name: 'Földszinti terem',
        sort_order: 1,
        tables: tablesOf('F', [
          [2, 4],
          [4, 6],
          [6, 2],
        ]),
      },
      {
        name: 'Emeleti terem',
        sort_order: 2,
        tables: tablesOf('E', [
          [4, 4],
          [6, 3],
          [8, 2],
        ]),
      },
      {
        name: 'Terasz',
        sort_order: 3,
        tables: tablesOf('T', [
          [2, 3],
          [4, 4],
          [6, 2],
        ]),
      },
      {
        name: 'Rendezvényterem',
        sort_order: 4,
        // nagy társasági asztalok
        tables: tablesOf('R', [
          [8, 3],
          [10, 2],
          [12, 1],
        ]),
      },
    ],
    opening_hours: everyDay('10:00', '23:30'),
  },
  {
    id: 'cafe',
    label: 'Kávézó / Bisztró',
    description:
      'Egy nyitott tér ablak melletti és bárpult-helyekkel. Reggeltől estig, sűrű (15 perces) időpont-léptékkel, rövid foglalási idővel.',
    turn_duration_minutes: 90,
    slot_step_minutes: 15,
    lead_time_hours: 1,
    rooms: [
      {
        name: 'Belső tér',
        sort_order: 1,
        tables: tablesOf('', [
          [2, 6],
          [4, 4],
          [6, 1],
        ]),
      },
      {
        name: 'Bárpult',
        sort_order: 2,
        // egyfős bárpult-helyek
        tables: tablesOf('B', [[1, 6]]),
      },
    ],
    opening_hours: everyDay('08:00', '20:00'),
  },
  {
    id: 'flat_simple',
    label: 'Egyszerű (csak főszám)',
    description:
      'Nincs asztaltérkép — időpontonként összesített főszám-limit. Pubok, kisebb helyek, gyors beültetés. Hétvégén tovább nyitva.',
    turn_duration_minutes: 120,
    slot_step_minutes: 30,
    lead_time_hours: 1,
    rooms: [],
    opening_hours: weekHours(['12:00', '22:00'], ['12:00', '23:59'], ['monday']),
  },
]


/* A regisztráció típusai (design 3.3): Étterem · Kávézó / brunch · Pizzéria · Fine dining — mindegyik a saját sablonját
 * tölti be (termek, asztalok, nyitvatartás, foglalási idő); utána minden szabadon átírható. */
RESTAURANT_TEMPLATES.push(
  {
    id: 'brunch',
    label: 'Kávézó / brunch',
    description: 'Nyitott tér kis asztalokkal és bárpulttal, reggeltől délutánig — rövidebb foglalási idő, 15 perces lépték.',
    turn_duration_minutes: 75,
    slot_step_minutes: 15,
    lead_time_hours: 1,
    rooms: [
      { name: 'Belső tér', sort_order: 1, tables: tablesOf('', [[2, 6], [4, 4]]) },
      { name: 'Bárpult', sort_order: 2, tables: tablesOf('B', [[1, 6]]) },
      { name: 'Terasz', sort_order: 3, tables: tablesOf('T', [[2, 3], [4, 2]]) },
    ],
    // hétköznap 8–16, hétvégén 9–17 (a brunch)
    opening_hours: customDays({
      monday: ['08:00', '16:00'], tuesday: ['08:00', '16:00'], wednesday: ['08:00', '16:00'], thursday: ['08:00', '16:00'], friday: ['08:00', '16:00'],
      saturday: ['09:00', '17:00'], sunday: ['09:00', '17:00'],
    }),
  },
  {
    id: 'pizzeria',
    label: 'Pizzéria',
    description: 'Belső terem családi és nagyobb asztalokkal, terasz — gyors forgás (75 perc), ebédtől késő estig, minden nap.',
    turn_duration_minutes: 75,
    slot_step_minutes: 15,
    lead_time_hours: 1,
    rooms: [
      { name: 'Belső terem', sort_order: 1, tables: tablesOf('', [[2, 4], [4, 6], [6, 3], [8, 1]]) },
      { name: 'Terasz', sort_order: 2, tables: tablesOf('T', [[2, 2], [4, 4]]) },
    ],
    opening_hours: weekHours(['11:30', '22:00'], ['11:30', '23:00']),
  },
  {
    id: 'fine_dining',
    label: 'Fine dining',
    description: 'Kevés, tágas asztal és egy különterem — hosszú vacsora (2,5 óra), szerdától szombatig este, vasárnap ebéd, hétfőn-kedden zárva, egy nappal előre foglalható.',
    turn_duration_minutes: 150,
    slot_step_minutes: 30,
    lead_time_hours: 24,
    rooms: [
      { name: 'Étterem', sort_order: 1, tables: tablesOf('', [[2, 6], [4, 3]]) },
      { name: 'Különterem', sort_order: 2, tables: tablesOf('K', [[8, 1]]) },
    ],
    opening_hours: customDays({
      wednesday: ['18:00', '23:00'], thursday: ['18:00', '23:00'], friday: ['18:00', '23:30'], saturday: ['18:00', '23:30'], sunday: ['12:00', '16:00'],
    }),
  },
)

RESTAURANT_TEMPLATES.push(
  {
    id: 'bistro',
    label: 'Bisztró / vendéglő',
    description: 'Egy hangulatos terem kis és közepes asztalokkal, napi menü — ebédtől estig, 90 perces foglalás, vasárnap zárva.',
    turn_duration_minutes: 90,
    slot_step_minutes: 15,
    lead_time_hours: 1,
    rooms: [{ name: 'Terem', sort_order: 1, tables: tablesOf('', [[2, 5], [4, 5], [6, 1]]) }],
    opening_hours: customDays({
      monday: ['11:00', '21:00'], tuesday: ['11:00', '21:00'], wednesday: ['11:00', '21:00'], thursday: ['11:00', '21:00'], friday: ['11:00', '22:00'], saturday: ['12:00', '22:00'],
    }),
  },
  {
    id: 'steakhouse',
    label: 'Steakhouse / grill',
    description: 'Belső terem nagyobb asztalokkal és terasz — esti hangsúly, 2 órás foglalás, hétfőn zárva.',
    turn_duration_minutes: 120,
    slot_step_minutes: 30,
    lead_time_hours: 2,
    rooms: [
      { name: 'Belső terem', sort_order: 1, tables: tablesOf('', [[2, 4], [4, 6], [6, 2]]) },
      { name: 'Terasz', sort_order: 2, tables: tablesOf('T', [[4, 4]]) },
    ],
    opening_hours: customDays({
      tuesday: ['12:00', '23:00'], wednesday: ['12:00', '23:00'], thursday: ['12:00', '23:00'], friday: ['12:00', '00:00'], saturday: ['12:00', '00:00'], sunday: ['12:00', '22:00'],
    }),
  },
  {
    id: 'asian',
    label: 'Ázsiai / sushi',
    description: 'Sushipult egyfős helyekkel és asztalok — gyors forgás (75 perc), ebédtől estig, minden nap.',
    turn_duration_minutes: 75,
    slot_step_minutes: 15,
    lead_time_hours: 1,
    rooms: [
      { name: 'Terem', sort_order: 1, tables: tablesOf('', [[2, 6], [4, 4], [6, 1]]) },
      { name: 'Sushipult', sort_order: 2, tables: tablesOf('P', [[1, 8]]) },
    ],
    opening_hours: weekHours(['11:30', '22:00'], ['11:30', '23:00']),
  },
  {
    id: 'cocktail_bar',
    label: 'Bár / koktélbár',
    description: 'Bárpult és boxok kis asztalokkal — csak este és éjjel (éjfél után is), 2 órás foglalás, vasárnap-hétfő zárva.',
    turn_duration_minutes: 120,
    slot_step_minutes: 30,
    lead_time_hours: 1,
    rooms: [
      { name: 'Bár', sort_order: 1, tables: tablesOf('B', [[1, 8]]) },
      { name: 'Boxok', sort_order: 2, tables: tablesOf('', [[2, 4], [4, 4], [6, 2]]) },
    ],
    opening_hours: customDays({
      tuesday: ['18:00', '01:00'], wednesday: ['18:00', '01:00'], thursday: ['18:00', '02:00'], friday: ['18:00', '03:00'], saturday: ['18:00', '03:00'],
    }),
  },
  {
    id: 'pub',
    label: 'Pub / söröző',
    description: 'Nagy asztalok társaságoknak (6–10 fő) és kisebbek — meccsnézés, délutántól éjfélig, 2,5 órás foglalás.',
    turn_duration_minutes: 150,
    slot_step_minutes: 30,
    lead_time_hours: 1,
    rooms: [
      { name: 'Söröző', sort_order: 1, tables: tablesOf('', [[4, 4], [6, 3], [10, 2]]) },
      { name: 'Kerthelyiség', sort_order: 2, tables: tablesOf('K', [[6, 3], [8, 2]]) },
    ],
    opening_hours: weekHours(['15:00', '00:00'], ['14:00', '02:00']),
  },
  {
    id: 'wine_bar',
    label: 'Borbár / borozó',
    description: 'Kis asztalok és pult, estétől — 2 órás foglalás, vasárnap-hétfő zárva.',
    turn_duration_minutes: 120,
    slot_step_minutes: 30,
    lead_time_hours: 1,
    rooms: [
      { name: 'Borbár', sort_order: 1, tables: tablesOf('', [[2, 6], [4, 3]]) },
      { name: 'Pult', sort_order: 2, tables: tablesOf('P', [[1, 6]]) },
    ],
    opening_hours: customDays({
      tuesday: ['16:00', '23:00'], wednesday: ['16:00', '23:00'], thursday: ['16:00', '00:00'], friday: ['16:00', '01:00'], saturday: ['14:00', '01:00'],
    }),
  },
  {
    id: 'confectionery',
    label: 'Cukrászda / teázó',
    description: 'Kis asztalok napközben, rövid (60 perces) foglalás — 9-től 19-ig, minden nap.',
    turn_duration_minutes: 60,
    slot_step_minutes: 15,
    lead_time_hours: 1,
    rooms: [
      { name: 'Szalon', sort_order: 1, tables: tablesOf('', [[2, 6], [4, 3]]) },
      { name: 'Terasz', sort_order: 2, tables: tablesOf('T', [[2, 4]]) },
    ],
    opening_hours: everyDay('09:00', '19:00'),
  },
  {
    id: 'event_venue',
    label: 'Rendezvényhely / különterem',
    description: 'Nagy asztalok társaságoknak és egy rendezvényterem — hosszú foglalás (5 óra), legalább 3 nappal előre, csütörtöktől vasárnapig.',
    turn_duration_minutes: 300,
    slot_step_minutes: 60,
    lead_time_hours: 72,
    rooms: [
      { name: 'Rendezvényterem', sort_order: 1, tables: tablesOf('R', [[10, 4], [12, 2]]) },
      { name: 'Különterem', sort_order: 2, tables: tablesOf('K', [[8, 2]]) },
    ],
    opening_hours: customDays({
      thursday: ['12:00', '00:00'], friday: ['12:00', '02:00'], saturday: ['12:00', '02:00'], sunday: ['12:00', '22:00'],
    }),
  },
)

/** A regisztráció 1. lépésének étterem-típusai, sorrendben → a betöltendő sablon (a szálloda kimarad: külön rendszer lesz). */
export const REGISTER_RESTAURANT_TYPES: { id: string; label: string }[] = [
  { id: 'classic', label: 'Étterem' },
  { id: 'bistro', label: 'Bisztró / vendéglő' },
  { id: 'brunch', label: 'Kávézó / brunch' },
  { id: 'pizzeria', label: 'Pizzéria' },
  { id: 'fine_dining', label: 'Fine dining' },
  { id: 'steakhouse', label: 'Steakhouse / grill' },
  { id: 'asian', label: 'Ázsiai / sushi' },
  { id: 'cocktail_bar', label: 'Bár / koktélbár' },
  { id: 'pub', label: 'Pub / söröző' },
  { id: 'wine_bar', label: 'Borbár / borozó' },
  { id: 'confectionery', label: 'Cukrászda / teázó' },
  { id: 'event_venue', label: 'Rendezvényhely' },
]

export function getTemplate(id: string): RestaurantTemplate | undefined {
  return RESTAURANT_TEMPLATES.find((t) => t.id === id)
}
