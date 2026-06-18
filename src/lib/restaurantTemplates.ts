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

export function getTemplate(id: string): RestaurantTemplate | undefined {
  return RESTAURANT_TEMPLATES.find((t) => t.id === id)
}
