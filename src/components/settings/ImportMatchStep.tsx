'use client'

// Import — párosító lépés: a fájlban talált munkatárs-, szolgáltatás-, kategória-, asztal- és
// teremnevek összevetése a vállalkozás meglévő elemeivel, MIELŐTT az import bármit létrehozna.
// ✅ biztos egyezés → automatikusan párosítva (lenyitva átállítható)
// ⚠️ javaslat      → előre kiválasztva, de ellenőrizni kell
// ➕ nincs egyezés  → alapból új elem (vendég-/foglalás-importnál inaktívan)

import { useMemo, useState } from 'react'
import { ChevronDown, CircleCheck, CircleAlert, CirclePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Candidate, EntityKind, EntityMap, MatchDecision } from '@/lib/importMatching'

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

const encode = (d: MatchDecision | undefined) => (!d ? 'new' : d.action === 'match' ? `id:${d.id}` : d.action)
const decode = (v: string): MatchDecision => (v.startsWith('id:') ? { action: 'match', id: Number(v.slice(3)) } : v === 'skip' ? { action: 'skip' } : { action: 'new' })

export function ImportMatchStep({
  report,
  decisions,
  onChange,
  catalogImport,
}: {
  report: MatchReport
  decisions: EntityMap
  onChange: (next: EntityMap) => void
  // katalógus-import (munkatársak, szolgáltatások…) — az új elem aktív, a meglévő nem változik
  catalogImport: boolean
}) {
  const kinds = KIND_ORDER.filter((k) => report.kinds[k]?.rows.length)
  if (!kinds.length) return null

  const setDecision = (kind: EntityKind, value: string, d: MatchDecision) =>
    onChange({ ...decisions, [kind]: { ...(decisions[kind] ?? {}), [value]: d } })

  return (
    <div className="rounded-[22px] dav-card-glass p-5 space-y-5">
      <div>
        <p className="text-sm font-semibold text-ink">Párosítás</p>
        <p className="text-xs text-ink-soft mt-1">
          A fájlban szereplő neveket összevetettük a meglévő elemeiddel, hogy az import ne hozzon létre duplikátumot.
          Nézd át a <span className="font-medium text-ink">javaslatokat</span> és az <span className="font-medium text-ink">új elemeket</span> — a biztos egyezések már párosítva vannak.
        </p>
      </div>
      {kinds.map((kind) => (
        <KindBlock
          key={kind}
          kind={kind}
          block={report.kinds[kind]!}
          decisions={decisions[kind] ?? {}}
          onSet={(value, d) => setDecision(kind, value, d)}
          catalogImport={catalogImport}
        />
      ))}
    </div>
  )
}

function KindBlock({
  kind,
  block,
  decisions,
  onSet,
  catalogImport,
}: {
  kind: EntityKind
  block: { rows: MatchRow[]; options: Candidate[] }
  decisions: Record<string, MatchDecision>
  onSet: (value: string, d: MatchDecision) => void
  catalogImport: boolean
}) {
  const [showExact, setShowExact] = useState(false)
  const label = KIND_LABEL[kind]
  const counts = useMemo(() => {
    const c = { exact: 0, probable: 0, none: 0 }
    for (const r of block.rows) c[r.status]++
    return c
  }, [block.rows])

  const needsReview = block.rows.filter((r) => r.status !== 'exact')
  const exact = block.rows.filter((r) => r.status === 'exact')

  // Mit jelent az „új” és a „kihagyás” ennél a típusnál — a felhasználó a következményt lássa
  const newLabel = catalogImport ? `Új ${label.one} létrehozása` : `Új ${label.one} létrehozása (inaktív)`
  const skipLabel = catalogImport
    ? 'Kihagyás — ez a sor nem kerül be'
    : kind === 'services'
      ? 'Kihagyás — ezek a látogatások nem kerülnek be'
      : 'Kihagyás — az első aktív munkatárshoz kerül'

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-ink mr-1">{label.title}</p>
        {counts.exact > 0 && <Chip tone="ok" icon={<CircleCheck className="h-3 w-3" />}>{counts.exact} biztos</Chip>}
        {counts.probable > 0 && <Chip tone="warn" icon={<CircleAlert className="h-3 w-3" />}>{counts.probable} javaslat</Chip>}
        {counts.none > 0 && <Chip tone="new" icon={<CirclePlus className="h-3 w-3" />}>{counts.none} nincs egyezés</Chip>}
      </div>

      <div className="space-y-1.5">
        {needsReview.map((r) => (
          <MatchLine key={r.value} row={r} options={block.options} decision={decisions[r.value]} onSet={onSet} newLabel={newLabel} skipLabel={skipLabel} />
        ))}
      </div>

      {exact.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowExact((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showExact && 'rotate-180')} />
            {showExact ? 'Biztos egyezések elrejtése' : `${exact.length} biztos egyezés megjelenítése`}
          </button>
          {showExact && (
            <div className="space-y-1.5 mt-1.5">
              {exact.map((r) => (
                <MatchLine key={r.value} row={r} options={block.options} decision={decisions[r.value]} onSet={onSet} newLabel={newLabel} skipLabel={skipLabel} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MatchLine({
  row,
  options,
  decision,
  onSet,
  newLabel,
  skipLabel,
}: {
  row: MatchRow
  options: Candidate[]
  decision: MatchDecision | undefined
  onSet: (value: string, d: MatchDecision) => void
  newLabel: string
  skipLabel: string
}) {
  const current = encode(decision)
  const changedFromSuggestion =
    row.status === 'probable' && !(decision?.action === 'match' && decision.id === row.suggestion?.id)

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl px-3 py-2',
        row.status === 'probable' ? 'bg-gold/[0.08] ring-1 ring-gold/30' : 'bg-paper',
      )}
    >
      <div className="sm:w-[44%] min-w-0">
        <p className="text-xs font-medium text-ink truncate" title={row.value}>{row.value}</p>
        <p className="text-[11px] text-ink-soft2">
          {row.count} sorban
          {row.status === 'probable' && row.suggestion && !changedFromSuggestion && (
            <> · javaslat: <span className="text-ink-soft">{row.suggestion.name}</span> ({Math.round((row.alternatives[0]?.score ?? 0.99) * 100)}%)</>
          )}
          {row.status === 'none' && row.alternatives.length > 0 && (
            <> · hasonló: <span className="text-ink-soft">{row.alternatives.map((a) => a.name).join(', ')}</span></>
          )}
        </p>
      </div>
      <div className="relative flex-1">
        <select
          value={current}
          onChange={(e) => onSet(row.value, decode(e.target.value))}
          className="w-full text-xs rounded-xl border border-line-strong bg-white px-3 py-2 pr-7 text-ink appearance-none focus:outline-none focus:ring-2 focus:ring-gold/50"
        >
          <optgroup label="Párosítás meglévővel">
            {options.map((o) => (
              <option key={o.id} value={`id:${o.id}`}>
                {o.name}{o.is_active === false ? ' (inaktív)' : ''}
              </option>
            ))}
          </optgroup>
          <optgroup label="Egyéb">
            <option value="new">➕ {newLabel}</option>
            <option value="skip">{skipLabel}</option>
          </optgroup>
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-soft2 pointer-events-none" />
      </div>
    </div>
  )
}

function Chip({ tone, icon, children }: { tone: 'ok' | 'warn' | 'new'; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'ok' && 'bg-green-600/10 text-green-700',
        tone === 'warn' && 'bg-gold/15 text-ink',
        tone === 'new' && 'bg-paper text-ink-soft ring-1 ring-line-strong',
      )}
    >
      {icon}
      {children}
    </span>
  )
}
