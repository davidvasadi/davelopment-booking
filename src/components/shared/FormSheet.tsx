'use client'

// „Adatlap” építőelemek a foglaló panelekhez (szalon + étterem közös): szekció-cím ikonnal,
// egyforma sorok vékony elválasztóval (bal oldalt címke, jobb oldalt keret nélküli érték),
// kis pill-gombok. Így a két panel pontosan ugyanúgy néz ki.

// a kit szerint (/design 1.7): keret nélküli érték a sorban, a léptető a kit kis kerek gombja
export const ROW_INPUT = 'h-9 border-0 bg-transparent px-0 text-ui-body text-ui-text shadow-none placeholder:text-ui-muted focus-visible:ring-0 focus-visible:ring-offset-0'
export const STEP_BTN = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-cell text-ui-row text-ui-text transition-colors hover:bg-ui-grey/40 disabled:opacity-30'
// kis pill — forrás, státusz (5 db egy sorban), alkalom
export const pillSmCls = (on: boolean) =>
  `inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-ui-label transition-colors ${
    on ? 'bg-ui-dark text-white' : 'bg-ui-cell text-ui-text hover:bg-ui-grey/40'
  }`

/** Szekció-cím ikonnal (háttér nélkül), alatta vékony vonal. */
export function SectionBar({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }) {
  return (
    // szekció-címke ikonnal, háttér nélkül — alatta a sorok vékony vonallal
    <div className="flex items-center gap-1.5 border-b border-dashed border-ui-divider px-3 pb-2 text-ui-label text-ui-muted">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.8} /> {label}
    </div>
  )
}

/** Egy adatlap-sor: bal oldalt címke, jobb oldalt az érték; `stacked` = az érték a címke alatt.
 *  `hintUnderLabel` = a hint a CÍMKE alatt (bal oszlop), nem az érték alatt. */
export function FieldRow({
  label, children, stacked = false, last = false, hint, hintTone = 'muted', aside, hintUnderLabel = false, wideLabel = false,
}: {
  label: React.ReactNode
  children: React.ReactNode
  stacked?: boolean
  last?: boolean
  hint?: string
  hintTone?: 'muted' | 'ok' | 'warn' | 'bad'
  aside?: React.ReactNode
  hintUnderLabel?: boolean
  /** a címke(+hint) kitölti a sort, az érték a jobb szélre kerül (pl. léptető) */
  wideLabel?: boolean
}) {
  const tone = hintTone === 'ok' ? 'text-ui-ok' : hintTone === 'warn' ? 'text-ui-warn' : hintTone === 'bad' ? 'text-ui-bad' : 'text-ui-muted'
  return (
    <div className={`px-3 py-2.5 ${last ? '' : 'border-b border-dashed border-ui-divider'}`}>
      <div className={stacked ? 'space-y-2' : 'flex min-h-9 items-center gap-3'}>
        <div className={`flex shrink-0 items-center justify-between gap-2 text-ui-body text-ui-muted ${stacked ? '' : wideLabel ? 'min-w-0 flex-1' : 'w-24'}`}>
          {hintUnderLabel && hint && !stacked ? (
            <span className="flex flex-col gap-0.5">
              {label}
              <span className={`text-ui-label leading-snug ${tone}`}>{hint}</span>
            </span>
          ) : label}
          {stacked && aside}
        </div>
        <div className={wideLabel && !stacked ? 'shrink-0' : 'min-w-0 flex-1'}>{children}</div>
        {!stacked && aside}
      </div>
      {hint && !(hintUnderLabel && !stacked) && <p className={`mt-1 text-ui-label leading-snug ${tone} ${stacked ? '' : 'pl-[108px]'}`}>{hint}</p>}
    </div>
  )
}


