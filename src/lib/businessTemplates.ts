export type BusinessType =
  | 'fodraszszalon'
  | 'koromszalon'
  | 'szepsegszalon'
  | 'tetovalo'
  | 'masszazs'
  | 'csontkovacs'
  | 'fogaszat'
  | 'fizioterapia'
  | 'pszichologus'
  | 'fitnesz'
  | 'joga'
  | 'taplalkozas'
  | 'fotos'
  | 'oktato'

export type MainCategory = 'szepseg' | 'egeszseg' | 'fitnesz' | 'egyeb'

export interface MainCategoryDef {
  id: MainCategory
  label: string
  description: string
  types: BusinessType[]
}

export interface SubTypeDef {
  type: BusinessType
  label: string
  description: string
}

export interface TemplateCategory {
  name: string
  duration_label?: string
  sort_order: number
}

export interface TemplateService {
  name: string
  description?: string
  category: string
  subcategory?: string
  duration_minutes: number
  price: number
}

export interface BusinessTemplate {
  type: BusinessType
  label: string
  description: string
  categories: TemplateCategory[]
  services: TemplateService[]
}

export const MAIN_CATEGORIES: MainCategoryDef[] = [
  {
    id: 'szepseg',
    label: 'Szépség & Testápolás',
    description: 'Fodrász, köröm, tetoválás...',
    types: ['fodraszszalon', 'koromszalon', 'szepsegszalon', 'tetovalo'],
  },
  {
    id: 'egeszseg',
    label: 'Egészség & Wellness',
    description: 'Masszázs, csontkovács, fogászat...',
    types: ['masszazs', 'csontkovacs', 'fogaszat', 'fizioterapia', 'pszichologus'],
  },
  {
    id: 'fitnesz',
    label: 'Fitness & Sport',
    description: 'Személyi edző, jóga, táplálkozás...',
    types: ['fitnesz', 'joga', 'taplalkozas'],
  },
  {
    id: 'egyeb',
    label: 'Egyéb',
    description: 'Fotós, oktató, coaching...',
    types: ['fotos', 'oktato'],
  },
]

export const SUB_TYPES: SubTypeDef[] = [
  { type: 'fodraszszalon', label: 'Fodrászat', description: 'Hajvágás, festés, kezelések' },
  { type: 'koromszalon', label: 'Körömszalon', description: 'Manikűr, pedikűr, műköröm' },
  { type: 'szepsegszalon', label: 'Szépségszalon', description: 'Arckezelések, szőrtelenítés' },
  { type: 'tetovalo', label: 'Tetováló stúdió', description: 'Tetoválás, piercing' },
  { type: 'masszazs', label: 'Masszázs / Spa', description: 'Relaxáció, testkezelések' },
  { type: 'csontkovacs', label: 'Csontkovács / Kiropraktikus', description: 'Gerinckezelés, manuálterápia' },
  { type: 'fogaszat', label: 'Fogászat', description: 'Fogászati kezelések, fehérítés' },
  { type: 'fizioterapia', label: 'Fizioterápia', description: 'Rehabilitáció, mozgásterápia' },
  { type: 'pszichologus', label: 'Pszichológus / Terapeuta', description: 'Terápia, tanácsadás' },
  { type: 'fitnesz', label: 'Személyi edző', description: 'Edzés, coaching' },
  { type: 'joga', label: 'Jóga / Pilates', description: 'Csoportos és egyéni órák' },
  { type: 'taplalkozas', label: 'Táplálkozási tanácsadó', description: 'Diéta, életmódváltás' },
  { type: 'fotos', label: 'Fotós / Videós', description: 'Portré, esemény, termékfotó' },
  { type: 'oktato', label: 'Oktató / Tanár', description: 'Különóra, nyelvtanfolyam, coaching' },
]

export const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    type: 'fodraszszalon',
    label: 'Fodrászat',
    description: 'Hajvágás, festés, kezelések',
    categories: [
      { name: 'Hajvágás', duration_label: '30–60 perc', sort_order: 0 },
      { name: 'Hajfestés', duration_label: '90–180 perc', sort_order: 1 },
      { name: 'Kezelések', duration_label: '45–60 perc', sort_order: 2 },
    ],
    services: [
      { name: 'Hajvágás (nők)', category: 'Hajvágás', duration_minutes: 60, price: 5000 },
      { name: 'Hajvágás (férfi)', category: 'Hajvágás', duration_minutes: 30, price: 3000 },
      { name: 'Mosás + szárítás', category: 'Hajvágás', duration_minutes: 45, price: 3500 },
      { name: 'Balayage', category: 'Hajfestés', duration_minutes: 180, price: 25000 },
      { name: 'Hajfestés (tő)', category: 'Hajfestés', duration_minutes: 90, price: 12000 },
      { name: 'Melír', category: 'Hajfestés', duration_minutes: 120, price: 18000 },
      { name: 'Hajpakolás', category: 'Kezelések', duration_minutes: 45, price: 4000 },
      { name: 'Tartós hullám', category: 'Kezelések', duration_minutes: 90, price: 12000 },
    ],
  },
  {
    type: 'koromszalon',
    label: 'Körömszalon',
    description: 'Manikűr, pedikűr, műköröm',
    categories: [
      { name: 'Manikűr', duration_label: '45–60 perc', sort_order: 0 },
      { name: 'Pedikűr', duration_label: '60–75 perc', sort_order: 1 },
      { name: 'Műköröm', duration_label: '90–120 perc', sort_order: 2 },
    ],
    services: [
      { name: 'Gél lakk manikűr', category: 'Manikűr', duration_minutes: 60, price: 6000 },
      { name: 'Klasszikus manikűr', category: 'Manikűr', duration_minutes: 45, price: 4000 },
      { name: 'Körömlakk csere', category: 'Manikűr', duration_minutes: 30, price: 3000 },
      { name: 'Pedikűr', category: 'Pedikűr', duration_minutes: 60, price: 7000 },
      { name: 'Spa pedikűr', category: 'Pedikűr', duration_minutes: 75, price: 9000 },
      { name: 'Zselé köröm (teljes szett)', category: 'Műköröm', duration_minutes: 90, price: 12000 },
      { name: 'Porcelán köröm (teljes szett)', category: 'Műköröm', duration_minutes: 120, price: 15000 },
      { name: 'Feltöltés', category: 'Műköröm', duration_minutes: 60, price: 7000 },
    ],
  },
  {
    type: 'szepsegszalon',
    label: 'Szépségszalon',
    description: 'Arckezelések, szőrtelenítés',
    categories: [
      { name: 'Arckezelések', duration_label: '60–90 perc', sort_order: 0 },
      { name: 'Szőrtelenítés', duration_label: '15–45 perc', sort_order: 1 },
      { name: 'Smink & szemöldök', duration_label: '20–60 perc', sort_order: 2 },
    ],
    services: [
      { name: 'Alapápolás', category: 'Arckezelések', duration_minutes: 60, price: 8000 },
      { name: 'Mélytisztítás', category: 'Arckezelések', duration_minutes: 75, price: 12000 },
      { name: 'Anti-aging kezelés', category: 'Arckezelések', duration_minutes: 90, price: 18000 },
      { name: 'Viasz szőrtelenítés (lábak)', category: 'Szőrtelenítés', duration_minutes: 45, price: 5000 },
      { name: 'Arcgyanta', category: 'Szőrtelenítés', duration_minutes: 15, price: 2000 },
      { name: 'Szemöldök formázás', category: 'Smink & szemöldök', duration_minutes: 20, price: 2500 },
      { name: 'Szempilla festés', category: 'Smink & szemöldök', duration_minutes: 30, price: 3000 },
    ],
  },
  {
    type: 'tetovalo',
    label: 'Tetováló stúdió',
    description: 'Tetoválás, piercing',
    categories: [
      { name: 'Tetoválás', duration_label: '60–240 perc', sort_order: 0 },
      { name: 'Piercing', duration_label: '15–30 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Konzultáció', category: 'Tetoválás', duration_minutes: 30, price: 0, description: 'Ingyenes tervezési alkalom' },
      { name: 'Kis tetoválás', category: 'Tetoválás', duration_minutes: 120, price: 25000 },
      { name: 'Közepes tetoválás', category: 'Tetoválás', duration_minutes: 180, price: 40000 },
      { name: 'Nagy tetoválás', category: 'Tetoválás', duration_minutes: 240, price: 60000 },
      { name: 'Javítás / retusálás', category: 'Tetoválás', duration_minutes: 60, price: 10000 },
      { name: 'Piercing', category: 'Piercing', duration_minutes: 30, price: 8000 },
      { name: 'Piercing csere', category: 'Piercing', duration_minutes: 15, price: 3000 },
    ],
  },
  {
    type: 'masszazs',
    label: 'Masszázs / Spa',
    description: 'Relaxáció, testkezelések',
    categories: [
      { name: 'Masszázs', duration_label: '30–90 perc', sort_order: 0 },
      { name: 'Testkezelések', duration_label: '60–90 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Relaxációs masszázs (30 perc)', category: 'Masszázs', duration_minutes: 30, price: 5000 },
      { name: 'Relaxációs masszázs (60 perc)', category: 'Masszázs', duration_minutes: 60, price: 9000 },
      { name: 'Sportmasszázs', category: 'Masszázs', duration_minutes: 60, price: 10000 },
      { name: 'Talpmasszázs', category: 'Masszázs', duration_minutes: 30, price: 5000 },
      { name: 'Aromamasszázs', category: 'Masszázs', duration_minutes: 60, price: 11000 },
      { name: 'Forró köves masszázs', category: 'Masszázs', duration_minutes: 90, price: 16000 },
      { name: 'Testpakolás', category: 'Testkezelések', duration_minutes: 60, price: 10000 },
      { name: 'Bőrradírozás', category: 'Testkezelések', duration_minutes: 45, price: 7000 },
    ],
  },
  {
    type: 'csontkovacs',
    label: 'Csontkovács / Kiropraktikus',
    description: 'Gerinckezelés, manuálterápia',
    categories: [
      { name: 'Gerinckezelés', duration_label: '30–60 perc', sort_order: 0 },
      { name: 'Konzultáció', duration_label: '30–45 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Első konzultáció', category: 'Konzultáció', duration_minutes: 45, price: 8000 },
      { name: 'Kontroll vizsgálat', category: 'Konzultáció', duration_minutes: 30, price: 5000 },
      { name: 'Nyaki gerinc kezelés', category: 'Gerinckezelés', duration_minutes: 45, price: 12000 },
      { name: 'Ágyéki gerinc kezelés', category: 'Gerinckezelés', duration_minutes: 45, price: 12000 },
      { name: 'Teljes gerinc kezelés', category: 'Gerinckezelés', duration_minutes: 60, price: 18000 },
      { name: 'Sportolói kezelés', category: 'Gerinckezelés', duration_minutes: 60, price: 15000 },
    ],
  },
  {
    type: 'fogaszat',
    label: 'Fogászat',
    description: 'Fogászati kezelések, fehérítés',
    categories: [
      { name: 'Alap fogászat', duration_label: '30–60 perc', sort_order: 0 },
      { name: 'Fogfehérítés', duration_label: '60–90 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Fogászati konzultáció', category: 'Alap fogászat', duration_minutes: 30, price: 5000 },
      { name: 'Fogkő eltávolítás', category: 'Alap fogászat', duration_minutes: 45, price: 8000 },
      { name: 'Fogtömés', category: 'Alap fogászat', duration_minutes: 60, price: 15000 },
      { name: 'Röntgenfelvétel', category: 'Alap fogászat', duration_minutes: 15, price: 3000 },
      { name: 'Fogfehérítés (tálcás)', category: 'Fogfehérítés', duration_minutes: 30, price: 25000 },
      { name: 'Lézeres fogfehérítés', category: 'Fogfehérítés', duration_minutes: 90, price: 45000 },
    ],
  },
  {
    type: 'fizioterapia',
    label: 'Fizioterápia',
    description: 'Rehabilitáció, mozgásterápia',
    categories: [
      { name: 'Fizioterápia', duration_label: '45–60 perc', sort_order: 0 },
      { name: 'Mozgásterápia', duration_label: '30–45 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Első felmérés', category: 'Fizioterápia', duration_minutes: 60, price: 10000 },
      { name: 'Egyéni fizioterápia', category: 'Fizioterápia', duration_minutes: 45, price: 8000 },
      { name: 'Ultrahangos kezelés', category: 'Fizioterápia', duration_minutes: 30, price: 6000 },
      { name: 'TENS terápia', category: 'Fizioterápia', duration_minutes: 30, price: 5000 },
      { name: 'Egyéni mozgásterápia', category: 'Mozgásterápia', duration_minutes: 45, price: 8000 },
      { name: 'Csoportos torna', category: 'Mozgásterápia', duration_minutes: 45, price: 3000 },
    ],
  },
  {
    type: 'pszichologus',
    label: 'Pszichológus / Terapeuta',
    description: 'Terápia, tanácsadás',
    categories: [
      { name: 'Egyéni terápia', duration_label: '50–60 perc', sort_order: 0 },
      { name: 'Páros / Csoportos', duration_label: '60–90 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Bevezető konzultáció', category: 'Egyéni terápia', duration_minutes: 50, price: 8000, description: 'Ismerkedő alkalom' },
      { name: 'Egyéni pszichoterápia', category: 'Egyéni terápia', duration_minutes: 50, price: 12000 },
      { name: 'Online konzultáció', category: 'Egyéni terápia', duration_minutes: 50, price: 10000 },
      { name: 'Páros terápia', category: 'Páros / Csoportos', duration_minutes: 60, price: 16000 },
      { name: 'Csoportos foglalkozás', category: 'Páros / Csoportos', duration_minutes: 90, price: 5000 },
    ],
  },
  {
    type: 'fitnesz',
    label: 'Személyi edző',
    description: 'Edzés, coaching',
    categories: [
      { name: 'Személyi edzés', duration_label: '60–90 perc', sort_order: 0 },
      { name: 'Konzultáció', duration_label: '30–60 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Személyi edzés (60 perc)', category: 'Személyi edzés', duration_minutes: 60, price: 10000 },
      { name: 'Személyi edzés (90 perc)', category: 'Személyi edzés', duration_minutes: 90, price: 14000 },
      { name: 'Páros edzés', category: 'Személyi edzés', duration_minutes: 60, price: 14000 },
      { name: 'Online edzés', category: 'Személyi edzés', duration_minutes: 60, price: 8000 },
      { name: 'Első konzultáció', category: 'Konzultáció', duration_minutes: 30, price: 0, description: 'Ingyenes bemutatkozó alkalom' },
      { name: 'Táplálkozási tanácsadás', category: 'Konzultáció', duration_minutes: 60, price: 8000 },
    ],
  },
  {
    type: 'joga',
    label: 'Jóga / Pilates',
    description: 'Csoportos és egyéni órák',
    categories: [
      { name: 'Csoportos óra', duration_label: '60–75 perc', sort_order: 0 },
      { name: 'Egyéni óra', duration_label: '60 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Csoportos jóga', category: 'Csoportos óra', duration_minutes: 60, price: 3000 },
      { name: 'Csoportos pilates', category: 'Csoportos óra', duration_minutes: 60, price: 3500 },
      { name: 'Reggeli flow', category: 'Csoportos óra', duration_minutes: 45, price: 2500 },
      { name: 'Yin jóga', category: 'Csoportos óra', duration_minutes: 75, price: 3500 },
      { name: 'Egyéni jóga', category: 'Egyéni óra', duration_minutes: 60, price: 10000 },
      { name: 'Egyéni pilates', category: 'Egyéni óra', duration_minutes: 60, price: 10000 },
    ],
  },
  {
    type: 'taplalkozas',
    label: 'Táplálkozási tanácsadó',
    description: 'Diéta, életmódváltás',
    categories: [
      { name: 'Tanácsadás', duration_label: '45–60 perc', sort_order: 0 },
    ],
    services: [
      { name: 'Első konzultáció', category: 'Tanácsadás', duration_minutes: 60, price: 10000 },
      { name: 'Kontroll alkalom', category: 'Tanácsadás', duration_minutes: 45, price: 7000 },
      { name: 'Online tanácsadás', category: 'Tanácsadás', duration_minutes: 45, price: 8000 },
      { name: 'Étrend összeállítás', category: 'Tanácsadás', duration_minutes: 60, price: 15000 },
    ],
  },
  {
    type: 'fotos',
    label: 'Fotós / Videós',
    description: 'Portré, esemény, termékfotó',
    categories: [
      { name: 'Fotózás', duration_label: '1–4 óra', sort_order: 0 },
      { name: 'Videózás', duration_label: '2–8 óra', sort_order: 1 },
    ],
    services: [
      { name: 'Portréfotózás', category: 'Fotózás', duration_minutes: 60, price: 20000 },
      { name: 'Páros / Családi fotózás', category: 'Fotózás', duration_minutes: 90, price: 30000 },
      { name: 'Termékfotózás (fél nap)', category: 'Fotózás', duration_minutes: 240, price: 50000 },
      { name: 'Eseményfotózás (egész nap)', category: 'Fotózás', duration_minutes: 480, price: 120000 },
      { name: 'Reel / Shorts videó', category: 'Videózás', duration_minutes: 120, price: 40000 },
      { name: 'Esküvői videó', category: 'Videózás', duration_minutes: 480, price: 200000 },
    ],
  },
  {
    type: 'oktato',
    label: 'Oktató / Tanár',
    description: 'Különóra, nyelvtanfolyam, coaching',
    categories: [
      { name: 'Különóra', duration_label: '45–60 perc', sort_order: 0 },
      { name: 'Coaching', duration_label: '60–90 perc', sort_order: 1 },
    ],
    services: [
      { name: 'Egyéni különóra (45 perc)', category: 'Különóra', duration_minutes: 45, price: 5000 },
      { name: 'Egyéni különóra (60 perc)', category: 'Különóra', duration_minutes: 60, price: 7000 },
      { name: 'Online különóra', category: 'Különóra', duration_minutes: 60, price: 6000 },
      { name: 'Első coaching alkalom', category: 'Coaching', duration_minutes: 60, price: 0, description: 'Ingyenes bemutatkozó' },
      { name: 'Coaching session', category: 'Coaching', duration_minutes: 60, price: 15000 },
      { name: 'Online coaching', category: 'Coaching', duration_minutes: 60, price: 12000 },
    ],
  },
]

export function getTemplate(type: BusinessType): BusinessTemplate | undefined {
  return BUSINESS_TEMPLATES.find(t => t.type === type)
}

export function getSubTypesForCategory(categoryId: MainCategory): SubTypeDef[] {
  const cat = MAIN_CATEGORIES.find(c => c.id === categoryId)
  if (!cat) return []
  return cat.types.map(t => SUB_TYPES.find(s => s.type === t)!).filter(Boolean)
}
