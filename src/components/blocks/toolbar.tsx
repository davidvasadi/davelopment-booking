'use client'

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button, IconButton, Panel, SearchField } from '@/components/ui-kit'

/** Oldal-eszköztár (Munkatársak, Naptár, Vendégek — design 10.1 / 11.1): kereső, szűrő-chipek darabszámmal (az aktív
 *  sötét), a végén a további szűrők ikonja (aktív szűrőnél pöttyel). Props nélkül minta. Élőben: `query` / `onQuery`
 *  (a kereső mező), `onChip`, és `filters` (a szűrő-ikonra nyíló panel tartalma). */
export function ChipToolbar({ search, chips, active = 0, dot = false, query, onQuery, onChip, filters }: {
  search: string
  chips: [string, number][]
  active?: number
  dot?: boolean
  query?: string
  onQuery?: (q: string) => void
  onChip?: (i: number) => void
  filters?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-[5px] flex flex-wrap items-center gap-1.5">
      <SearchField className="w-[200px]" value={query} onChange={onQuery}>{search}</SearchField>
      {chips.map(([t, n], i) => (
        <Button key={t} variant={i === active ? 'dark' : 'glass'} onClick={onChip && (() => onChip(i))}>{t}<span className={i === active ? 'text-white/50' : 'text-ui-muted'}>{n}</span></Button>
      ))}
      {/* flex: a szűrő-gomb nem ül a szöveg alapvonalára (különben lejjebb csúszik a chipekhez képest) */}
      <span className="relative flex">
        <IconButton icon={SlidersHorizontal} label="Szűrők" dot={dot} onClick={filters ? () => setOpen((v) => !v) : undefined} aria-expanded={open} />
        {filters && open && (
          <>
            <span className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <Panel className="ui-pop-in absolute left-0 top-full z-50 mt-2 w-[320px] origin-top-left">{filters}</Panel>
          </>
        )}
      </span>
    </div>
  )
}
