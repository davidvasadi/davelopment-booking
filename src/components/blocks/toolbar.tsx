'use client'

import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button, IconButton, Meta, Panel, Pill, SearchField } from '@/components/ui-kit'
import { useExclusivePopover } from '@/lib/exclusivePopover'

/** Oldal-eszköztár (Munkatársak, Naptár, Vendégek — design 10.1 / 11.1): kereső, szűrő-chipek darabszámmal (az aktív
 *  sötét), a végén a további szűrők ikonja (aktív szűrőnél pöttyel). Props nélkül minta. Élőben: `query` / `onQuery`
 *  (a kereső mező), `onChip`, és `filters` (a szűrő-ikonra nyíló panel tartalma). */
export function ChipToolbar({ search, chips, active = 0, dot = false, query, onQuery, onChip, filters, chipsInFilter = false, chipsLabel = 'Csoport' }: {
  search: string
  chips: [string, number][]
  active?: number
  dot?: boolean
  query?: string
  onQuery?: (q: string) => void
  onChip?: (i: number) => void
  filters?: React.ReactNode
  /** a chipek ne a sorban, hanem a szűrő-panel tetején legyenek (a szűrő-ikon a kereső mellett) — pl. a Naptárban */
  chipsInFilter?: boolean
  /** a panelbe tett chipek címkéje */
  chipsLabel?: string
}) {
  const [open, setOpen] = useState(false)
  useExclusivePopover(open, () => setOpen(false))
  return (
    <div className="mb-[5px] flex flex-wrap items-center gap-1.5">
      <SearchField className="w-[200px]" value={query} onChange={onQuery}>{search}</SearchField>
      {!chipsInFilter && chips.map(([t, n], i) => (
        <Button key={t} variant={i === active ? 'dark' : 'glass'} onClick={onChip && (() => onChip(i))}>{t}<span className={i === active ? 'text-white/50' : 'text-ui-muted'}>{n}</span></Button>
      ))}
      {/* flex: a szűrő-gomb nem ül a szöveg alapvonalára (különben lejjebb csúszik a chipekhez képest) */}
      <span className="relative flex">
        <IconButton icon={Settings2} label="Szűrők" dot={dot || (chipsInFilter && active !== 0)} onClick={filters || chipsInFilter ? () => setOpen((v) => !v) : undefined} aria-expanded={open} />
        {(filters || chipsInFilter) && open && (
          <>
            <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <Panel className="ui-pop-in absolute left-0 top-full z-50 mt-2 w-[320px] origin-top-left">
              {filters}
              {chipsInFilter && (
                <>
                  <Meta className="mt-4">{chipsLabel}</Meta>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {chips.map(([t, n], i) => (
                      <button key={t} type="button" onClick={onChip && (() => onChip(i))} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={i === active ? 'dark' : 'cell'}>{t} <span className={i === active ? 'text-white/50' : 'text-ui-muted'}>{n}</span></Pill></button>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </>
        )}
      </span>
    </div>
  )
}
