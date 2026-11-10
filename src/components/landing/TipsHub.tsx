'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Lightbulb, Search, X } from 'lucide-react'
import { IconCircle } from '@/components/ui-kit'
import { TipsIndexGrid } from '@/components/landing/TipsIndexGrid'
import { buttonHover, SPRING_SNAPPY } from '@/lib/motion'
import type { Tip } from '@/lib/tips-content'

type Tab = 'tippek' | 'cikkek'
type Audience = 'mind' | 'szakember' | 'vendeglato'
const AUDIENCES: [Audience, string][] = [['mind', 'Mindenkinek'], ['szakember', 'Szakembereknek'], ['vendeglato', 'Vendéglátóknak']]

/** kinek szól egy cikk — a kapcsolódó iparági oldalaiból (étterem / asztalfoglalás → vendéglátó, a többi időpontfoglalás →
 *  szakember; a csapatkezelés mindkettő) */
function audiencesOf(t: Tip): Set<Audience> {
  const out = new Set<Audience>()
  for (const sl of t.relatedIndustrySlugs ?? []) {
    if (/etterem|asztalfoglalas|kavezo|pizzeria|bisztro/.test(sl)) out.add('vendeglato')
    else if (sl.startsWith('csapatkezeles')) { out.add('vendeglato'); out.add('szakember') }
    else out.add('szakember')
  }
  if (!out.size) { out.add('vendeglato'); out.add('szakember') }
  return out
}

/** lenyíló szűrő-pill (natív select — telefonon a rendszer saját választója nyílik); aktív szűrésnél sötét, egyébként #F7F7F7 */
function SelectPill<T extends string>({ label, value, onChange, options, active }: {
  label: string; value: T; onChange: (v: T) => void; options: [T, string][]; active: boolean
}) {
  return (
    <label className={`relative flex h-11 shrink-0 items-center rounded-full font-onest text-ui-body transition-colors ${active ? 'bg-ui-dark text-white' : 'bg-[#F7F7F7] text-ui-text'}`}>
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent pl-4 pr-9 outline-none focus-visible:ring-2 focus-visible:ring-ui-yellow/60">
        {options.map(([v, l]) => <option key={v} value={v} className="text-ui-text">{l}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 h-4 w-4 opacity-60" />
    </label>
  )
}
const TABS: [Tab, string][] = [['tippek', 'Tippek'], ['cikkek', 'Cikkek']]

/**
 * A /tips gyűjtőoldal két része, egy váltóval (ugyanaz a pill-váltó, mint az árazásnál):
 *  - Tippek: „hogyan csináld a rendszerben" útmutatók (tips-content.ts `kind: 'tipp'`);
 *  - Cikkek: a szokásos blogcikkek (a többi). A szűrők (kategória, kinek, keresés) az aktív fülre vonatkoznak.
 */
export function TipsHub({ articles }: { articles: Tip[] }) {
  const [tab, setTab] = useState<Tab>('cikkek')
  const [touched, setTouched] = useState(false)
  // cikk-szűrők: kategória, kinek szól, keresés (cím + rövid leírás)
  const [cat, setCat] = useState<string | null>(null)
  const [aud, setAud] = useState<Audience>('mind')
  const [q, setQ] = useState('')
  const list = useMemo(() => articles.filter((t) => (t.kind ?? 'cikk') === (tab === 'tippek' ? 'tipp' : 'cikk')), [articles, tab])
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of list) m.set(t.category, (m.get(t.category) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [list])
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return list.filter((t) =>
      (!cat || t.category === cat)
      && (aud === 'mind' || audiencesOf(t).has(aud))
      && (!needle || `${t.title} ${t.excerpt}`.toLowerCase().includes(needle)))
  }, [list, cat, aud, q])
  const filtered = !!cat || aud !== 'mind' || !!q.trim()
  const reset = () => { setCat(null); setAud('mind'); setQ('') }
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-1 self-center rounded-full bg-[#F7F7F7] p-1.5">
        {TABS.map(([id, label]) => {
          const on = tab === id
          return (
            <motion.button
              key={id}
              type="button"
              onClick={() => { setTouched(true); setTab(id); setCat(null) }}
              variants={buttonHover}
              initial="rest"
              whileHover="hover"
              aria-pressed={on}
              className={`relative rounded-full px-5 py-2.5 font-onest text-ui-row transition-colors duration-200 ${on ? 'text-white' : 'text-ui-text'}`}
            >
              {on && <motion.span layoutId={touched ? 'tips-hub-pill' : undefined} className="absolute inset-0 rounded-full bg-ui-dark" transition={SPRING_SNAPPY} />}
              <span className="relative z-10">{label}</span>
            </motion.button>
          )
        })}
      </div>

      {list.length ? (
        <div className="flex flex-col gap-6">
          {/* szűrők egy sorban: kategória és kinek (lenyíló), mellettük a kereső */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <SelectPill label="Kategória" value={cat ?? ''} onChange={(v) => setCat(v || null)} active={!!cat}
                options={[['', `Minden kategória (${list.length})`], ...cats.map(([c, n]): [string, string] => [c, `${c} (${n})`])]} />
              <SelectPill label="Kinek" value={aud} onChange={setAud} active={aud !== 'mind'} options={AUDIENCES} />
            </div>
            <label className="relative flex h-11 items-center sm:ml-auto sm:w-[300px]">
              <Search aria-hidden className="pointer-events-none absolute left-4 h-4 w-4 text-ui-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'tippek' ? 'Keresés a tippek között' : 'Keresés a cikkek között'} aria-label="Keresés"
                className="h-full w-full rounded-full bg-[#F7F7F7] pl-10 pr-10 font-onest text-ui-body text-ui-text outline-none placeholder:text-ui-muted focus:ring-2 focus:ring-ui-yellow/60" />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Keresés törlése" className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-ui-muted hover:text-ui-text"><X className="h-4 w-4" /></button>}
            </label>
          </div>
          {shown.length ? (
            // key: szűréskor a rács újra beúszik
            <TipsIndexGrid key={`${tab}|${cat}|${aud}|${q}`} tips={shown} />
          ) : (
            <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-ui-card bg-[#F7F7F7] px-8 py-12 text-center">
              <IconCircle icon={Search} tone="cell" size="md" />
              <p className="text-ui-title font-medium">Nincs találat</p>
              <p className="text-ui-meta text-ui-muted">Próbálj más kategóriát vagy keresőszót.</p>
              {filtered && <button type="button" onClick={reset} className="ui-press rounded-full bg-ui-dark px-5 py-2.5 font-onest text-ui-body text-white">Szűrők törlése</button>}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-ui-card bg-[#F7F7F7] px-8 py-12 text-center">
          <IconCircle icon={Lightbulb} tone="cell" size="md" />
          <p className="text-ui-title font-medium">Hamarosan: tippek a rendszerhez</p>
          <p className="text-ui-meta text-ui-muted">Rövid, lépésről lépésre útmutatók — előleg, emlékeztetők, beosztás, Google-értékelés és a többi funkció beállításához.</p>
        </div>
      )}
    </div>
  )
}
