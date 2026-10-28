'use client'

import { Search } from 'lucide-react'

/**
 * Közös adattábla — a „RECENT BOOKING” referencia-táblázat nyelve (Dave etalonja): fehér,
 * lekerekített kártya vékony kerettel; fejléc = félkövér NAGYBETŰS cím balra, kereső + körvonalas
 * akció-gomb jobbra; világosszürke, lekerekített oszlopfejléc-sáv; elválasztó nélküli sorok;
 * a státusz színes pötty + színes szöveg (nem pill). Rács-alapú (grid-template), így mobilon is kezelhető.
 */

export function DataTableCard({ title, search, actions, children }: {
  title: string
  search?: { value: string; onChange: (v: string) => void; placeholder: string }
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[22px] border border-line bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          {search && (
            <label className="flex h-10 w-full items-center gap-2 rounded-[12px] border border-line bg-white px-3 sm:w-[220px]">
              <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.8} />
              <input
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-soft2 focus:outline-none"
              />
            </label>
          )}
          {actions}
        </div>
      </div>
      {children}
    </div>
  )
}

/** Körvonalas akció-gomb / szűrő a fejléc jobb oldalán (mint a referencia „+ Add Booking”). */
export const tableActionCls = 'inline-flex h-10 items-center gap-1.5 rounded-[12px] border border-line bg-white px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong'

/** Oszlopfejléc-sáv: világosszürke, lekerekített. `cols` = grid-template-columns (Tailwind arbitrary). */
export function DataTableHead({ cols, labels }: { cols: string; labels: React.ReactNode[] }) {
  return (
    <div className={`hidden ${cols} items-center gap-3 rounded-[10px] bg-[#EFEFEF] px-3 py-2.5 text-[13px] font-semibold text-ink md:grid`}>
      {labels.map((l, i) => <div key={i} className="truncate">{l}</div>)}
    </div>
  )
}

export type StatusTone = 'ok' | 'warn' | 'bad' | 'muted'
const TONE: Record<StatusTone, { dot: string; text: string }> = {
  ok: { dot: 'bg-ok-fill', text: 'text-ok' },
  warn: { dot: 'bg-[#D99A1E]', text: 'text-[#B7790B]' },
  bad: { dot: 'bg-[#D64545]', text: 'text-[#C0392B]' },
  muted: { dot: 'bg-[#B7B2A4]', text: 'text-ink-soft' },
}

/** Státusz: színes pötty + színes szöveg. */
export function StatusDot({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const t = TONE[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${t.text}`}>
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${t.dot}`} />
      {children}
    </span>
  )
}
