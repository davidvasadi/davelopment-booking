'use client'

// Import — párosító lépés: a fájlban talált munkatárs-, szolgáltatás-, kategória-, asztal- és
// teremnevek összevetése a vállalkozás meglévő elemeivel, MIELŐTT az import bármit létrehozna.
// (A megjelenítés: components/blocks/importer.tsx › ImportMatch — design 23.4.)
// ✅ biztos egyezés → automatikusan párosítva (lenyitva átállítható)
// ⚠️ javaslat      → előre kiválasztva, de ellenőrizni kell
// ➕ nincs egyezés  → alapból új elem (vendég-/foglalás-importnál inaktívan)

import type { Candidate, EntityKind, EntityMap, MatchDecision } from '@/lib/importMatching'
import type { MatchGroup } from '@/components/blocks/importer'

export type MatchRow = {
  value: string
  count: number
  status: 'exact' | 'probable' | 'none'
  suggestion: Candidate | null
  alternatives: (Candidate & { score: number })[]
}
export type MatchReport = { kinds: Partial<Record<EntityKind, { rows: MatchRow[]; options: Candidate[] }>> }

const KIND_LABEL: Record<EntityKind, { title: string; one: string }> = {
  staff: { title: 'Munkatársak', one: 'munkatárs' },
  services: { title: 'Szolgáltatások', one: 'szolgáltatás' },
  categories: { title: 'Kategóriák', one: 'kategória' },
  tables: { title: 'Asztalok', one: 'asztal' },
  rooms: { title: 'Termek / zónák', one: 'terem' },
}

const KIND_ORDER: EntityKind[] = ['services', 'staff', 'categories', 'tables', 'rooms']

/** A javaslatokból képzett kiinduló döntések (a felhasználó ezt írja át). */
export function initialDecisions(report: MatchReport): EntityMap {
  const out: EntityMap = {}
  for (const kind of KIND_ORDER) {
    const block = report.kinds[kind]
    if (!block) continue
    out[kind] = Object.fromEntries(
      block.rows.map((r) => [
        r.value,
        r.suggestion && r.status !== 'none' ? { action: 'match', id: r.suggestion.id } : { action: 'new' },
      ] as [string, MatchDecision]),
    )
  }
  return out
}

export const encodeDecision = (d: MatchDecision | undefined) => (!d ? 'new' : d.action === 'match' ? `id:${d.id}` : d.action)
export const decodeDecision = (v: string): MatchDecision => (v.startsWith('id:') ? { action: 'match', id: Number(v.slice(3)) } : v === 'skip' ? { action: 'skip' } : { action: 'new' })

/** A párosító lépés sorai az ImportMatch blokknak (design 23.4): csoportonként (szolgáltatás, munkatárs…) a fájlbeli
 *  név, alatta hány sorban szerepel és mi a helyzet, jobbra a választó (meglévő elem / új / kihagyás). Az „új” és a
 *  „kihagyás” jelentése típusonként más — a felirat megmondja a következményt. */
export function buildMatchGroups(report: MatchReport, decisions: EntityMap, catalogImport: boolean): MatchGroup[] {
  return KIND_ORDER.filter((k) => report.kinds[k]?.rows.length).map((kind) => {
    const block = report.kinds[kind]!
    const label = KIND_LABEL[kind]
    const newLabel = catalogImport ? `+ Új ${label.one}` : `+ Új ${label.one} (inaktív)`
    const skipLabel = catalogImport ? '— kihagyom, nem kerül be —' : kind === 'services' ? '— kihagyom, ezek a látogatások nem kerülnek be —' : '— kihagyom, az első aktív munkatárshoz kerül —'
    const options = [
      ...block.options.map((o) => ({ value: `id:${o.id}`, label: `${o.name}${o.is_active === false ? ' (inaktív)' : ''}` })),
      { value: 'new', label: newLabel }, { value: 'skip', label: skipLabel },
    ]
    // a javaslatok és az újak elöl — azokat kell átnézni; a biztos egyezések a végén
    const order: Record<MatchRow['status'], number> = { probable: 0, none: 1, exact: 2 }
    const rows = [...block.rows].sort((a, b) => order[a.status] - order[b.status])
    return {
      key: kind, title: label.title,
      items: rows.map((r) => ({
        value: r.value, status: r.status, choice: encodeDecision(decisions[kind]?.[r.value]), options,
        sub: `${r.count} sorban · ${r.status === 'exact' ? 'egyezik' : r.status === 'probable' ? `javaslat: ${r.suggestion?.name ?? '—'} — nézd meg` : r.alternatives.length ? `nincs ilyen — hasonló: ${r.alternatives.map((a) => a.name).join(', ')}` : 'nincs ilyen — újként jön létre'}`,
      })),
    }
  })
}

/** Egy választás beírása a döntésekbe (a blokk `onChoice`-ából). */
export function setMatchChoice(decisions: EntityMap, kind: string, value: string, choice: string): EntityMap {
  const k = kind as EntityKind
  return { ...decisions, [k]: { ...(decisions[k] ?? {}), [value]: decodeDecision(choice) } }
}
