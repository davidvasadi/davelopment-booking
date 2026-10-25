// Szerveroldali feloldó az importhoz: egy fájlbeli névhez (munkatárs, szolgáltatás, kategória,
// asztal, terem) a felhasználó párosító döntése alapján visszaadja a meglévő elem id-ját, vagy
// létrehozza az újat. Döntés hiányában (pl. több munkalapos import) csak a biztos egyezést
// párosítja, minden mást újként hoz létre.
//
// A vendég-/foglalás-import MELLÉKHATÁSKÉNT létrehozott elemei INAKTÍVAK (a szolgáltatások az
// „Importált” kategóriában) — így nem jelennek meg a publikus foglalóoldalon, a tulaj átnézi
// őket. A katalógus-importok (munkatársak, szolgáltatások, asztalok…) szándékos feltöltések,
// ott az új elem aktív.
import type { Payload } from 'payload'
import type { Service } from '@/payload/payload-types'
import { SILENT_IMPORT } from './silentImport'
import {
  type Candidate,
  type EntityKind,
  type EntityMap,
  type MatchDecision,
  defaultDecision,
  matchName,
  normalizeName,
  splitPeople,
} from './importMatching'

const COLLECTION: Record<EntityKind, 'staff' | 'services' | 'service-categories' | 'tables' | 'rooms'> = {
  staff: 'staff',
  services: 'services',
  categories: 'service-categories',
  tables: 'tables',
  rooms: 'rooms',
}

export const IMPORT_CATEGORY_NAME = 'Importált'

export class ImportResolver {
  private candidates: Partial<Record<EntityKind, Candidate[]>> = {}
  private resolved: Partial<Record<EntityKind, Map<string, number | null>>> = {}
  private servicePrice = new Map<number, { price: number; currency: string }>()
  private importCategoryId: number | null = null
  // az import során újonnan létrehozott elemek (a felület „nézd át” listájához)
  readonly created: Record<EntityKind, string[]> = { staff: [], services: [], categories: [], tables: [], rooms: [] }

  constructor(
    private payload: Payload,
    private businessId: number,
    private isRestaurant: boolean,
    private entityMap: EntityMap | undefined,
    // katalógus-importnál az új elem aktív, mellékhatásként létrehozottnál inaktív
    private createActive: boolean,
  ) {}

  private get ownerField(): 'salon' | 'restaurant' {
    return this.isRestaurant ? 'restaurant' : 'salon'
  }

  async loadCandidates(kind: EntityKind): Promise<Candidate[]> {
    if (this.candidates[kind]) return this.candidates[kind]!
    const res = await this.payload.find({
      collection: COLLECTION[kind],
      where: { [kind === 'tables' || kind === 'rooms' ? 'restaurant' : 'salon']: { equals: this.businessId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const list: Candidate[] = []
    for (const doc of res.docs as unknown as (Candidate & Partial<Service>)[]) {
      list.push({ id: Number(doc.id), name: String(doc.name ?? ''), is_active: doc.is_active ?? null })
      if (kind === 'services') {
        this.servicePrice.set(Number(doc.id), { price: Number(doc.price ?? 0), currency: String(doc.currency ?? 'HUF') })
      }
    }
    this.candidates[kind] = list
    return list
  }

  priceOf(serviceId: number) {
    return this.servicePrice.get(serviceId) ?? { price: 0, currency: 'HUF' }
  }

  async defaultStaffId(): Promise<number | null> {
    const staff = await this.loadCandidates('staff')
    return (staff.find((s) => s.is_active !== false) ?? staff[0])?.id ?? null
  }

  /** A felhasználó döntése egy fájlbeli értékre (ha nem döntött: biztos egyezés → párosít, egyébként új). */
  async decide(kind: EntityKind, value: string): Promise<MatchDecision> {
    const explicit = this.entityMap?.[kind]?.[value]
    if (explicit) return explicit
    return defaultDecision(matchName(value, await this.loadCandidates(kind), kind))
  }

  /** Az „Importált” kategória id-ja (létrehozza, ha nincs) — ide kerül minden kategória nélküli új szolgáltatás. */
  async getImportCategoryId(): Promise<number | null> {
    if (this.importCategoryId) return this.importCategoryId
    const cats = await this.loadCandidates('categories')
    const existing = cats.find((c) => normalizeName(c.name) === normalizeName(IMPORT_CATEGORY_NAME))
    if (existing) return (this.importCategoryId = existing.id)
    const created = await this.payload.create({
      collection: 'service-categories',
      data: { name: IMPORT_CATEGORY_NAME, salon: this.businessId },
      overrideAccess: true,
      context: SILENT_IMPORT,
    })
    this.importCategoryId = Number(created.id)
    this.candidates.categories?.push({ id: this.importCategoryId, name: IMPORT_CATEGORY_NAME })
    return this.importCategoryId
  }

  /**
   * Fájlbeli név → id. `null`, ha a felhasználó kihagyta, vagy nem hozható létre.
   * `extra`: új elem létrehozásakor a további mezők (pl. szolgáltatás ára, asztal férőhelye).
   */
  async resolve(kind: EntityKind, rawValue: string, extra: Record<string, unknown> = {}): Promise<number | null> {
    const value = rawValue.trim()
    if (!value) return null
    const cache = (this.resolved[kind] ??= new Map())
    const key = normalizeName(value)
    if (cache.has(key)) return cache.get(key)!

    const decision = await this.decide(kind, value)
    let id: number | null = null
    if (decision.action === 'match') {
      id = decision.id
    } else if (decision.action === 'new') {
      id = await this.create(kind, value, extra)
    }
    cache.set(key, id)
    return id
  }

  hasExplicitDecision(kind: EntityKind, value: string): boolean {
    return Boolean(this.entityMap?.[kind]?.[value.trim()])
  }

  /** Munkatárs-cella, amiben több név is lehet: az első feloldható név id-ja. */
  async resolveStaff(rawValue: string): Promise<number | null> {
    for (const name of splitPeople(rawValue)) {
      const id = await this.resolve('staff', name)
      if (id) return id
    }
    return null
  }

  private async create(kind: EntityKind, name: string, extra: Record<string, unknown>): Promise<number | null> {
    const active = this.createActive
    let data: Record<string, unknown>
    switch (kind) {
      case 'services': {
        const category = (extra.category as number | undefined) ?? (await this.getImportCategoryId())
        if (!category) return null
        data = { name, salon: this.businessId, category, duration_minutes: 60, price: 0, ...extra, is_active: active }
        break
      }
      case 'staff':
        data = { name, salon: this.businessId, ...extra, is_active: active, import_review: !active }
        break
      case 'categories':
        data = { name, salon: this.businessId, ...extra }
        break
      case 'tables':
        data = { name, restaurant: this.businessId, capacity: 2, ...extra, is_active: active }
        break
      case 'rooms':
        data = { name, restaurant: this.businessId, is_outdoor: false, ...extra, is_active: active }
        break
    }
    const created = await this.payload.create({
      collection: COLLECTION[kind],
      data: data as never,
      overrideAccess: true,
      context: SILENT_IMPORT,
    })
    const id = Number(created.id)
    this.candidates[kind]?.push({ id, name, is_active: kind === 'categories' ? null : active })
    if (kind === 'services') {
      this.servicePrice.set(id, { price: Number((data as { price?: number }).price ?? 0), currency: 'HUF' })
    }
    this.created[kind].push(name)
    return id
  }
}

// ── Párosító lépés: a fájlból kigyűjtött nevek + javaslatok ────────────────────

export type MatchRow = {
  value: string
  count: number
  status: 'exact' | 'probable' | 'none'
  suggestion: Candidate | null
  alternatives: (Candidate & { score: number })[]
}

export async function buildMatchReport(
  resolver: ImportResolver,
  values: Partial<Record<EntityKind, Map<string, number>>>,
): Promise<{ kinds: Partial<Record<EntityKind, { rows: MatchRow[]; options: Candidate[] }>> }> {
  const kinds: Partial<Record<EntityKind, { rows: MatchRow[]; options: Candidate[] }>> = {}
  for (const [kind, counts] of Object.entries(values) as [EntityKind, Map<string, number>][]) {
    if (!counts.size) continue
    const options = await resolver.loadCandidates(kind)
    const rows: MatchRow[] = [...counts.entries()]
      .map(([value, count]) => {
        const r = matchName(value, options, kind)
        return { value, count, status: r.status, suggestion: r.match ?? null, alternatives: r.alternatives }
      })
      // a döntést igénylők elöl, aztán gyakoriság szerint
      .sort((a, b) => (a.status === 'exact' ? 1 : 0) - (b.status === 'exact' ? 1 : 0) || b.count - a.count)
    kinds[kind] = { rows, options: [...options].sort((a, b) => a.name.localeCompare(b.name, 'hu')) }
  }
  return { kinds }
}

// A fájlbeli értékek kigyűjtése típusonként (melyik oszlop melyik entitásra hivatkozik)
export function collectEntityValues(
  importType: string,
  isRestaurant: boolean,
  rows: string[][],
  getField: (row: string[], field: string) => string,
): Partial<Record<EntityKind, Map<string, number>>> {
  const out: Partial<Record<EntityKind, Map<string, number>>> = {}
  const add = (kind: EntityKind, raw: string) => {
    const v = raw.trim()
    if (!v) return
    const m = (out[kind] ??= new Map())
    // ugyanaz a név más írásmóddal ("Bence Csonka" / "Csonka Bence") egy sorként jelenjen meg
    const existingKey = [...m.keys()].find((k) => normalizeName(k) === normalizeName(v))
    m.set(existingKey ?? v, (m.get(existingKey ?? v) ?? 0) + 1)
  }
  for (const row of rows) {
    if (!row.some((c) => c.trim())) continue
    if (importType === 'customers' && !isRestaurant) {
      for (const n of splitPeople(getField(row, 'staff_name_hint'))) add('staff', n)
      add('services', getField(row, 'first_service_name'))
      add('services', getField(row, 'last_service_name'))
    } else if (importType === 'bookings' && !isRestaurant) {
      for (const n of splitPeople(getField(row, 'staff'))) add('staff', n)
      add('services', getField(row, 'service'))
    } else if (importType === 'staff') {
      add('staff', getField(row, 'name'))
    } else if (importType === 'services') {
      add('services', getField(row, 'name'))
      add('categories', getField(row, 'category'))
    } else if (importType === 'service_categories') {
      add('categories', getField(row, 'name'))
    } else if (importType === 'tables') {
      add('tables', getField(row, 'name'))
    } else if (importType === 'rooms') {
      add('rooms', getField(row, 'name'))
    }
  }
  return out
}

