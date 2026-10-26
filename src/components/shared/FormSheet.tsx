'use client'

// „Adatlap” építőelemek a foglaló panelekhez (szalon + étterem közös): szekció-cím ikonnal,
// egyforma sorok vékony elválasztóval (bal oldalt címke, jobb oldalt keret nélküli érték),
// kis pill-gombok. Így a két panel pontosan ugyanúgy néz ki.

export const ROW_INPUT = 'h-9 border-0 bg-transparent px-0 text-[14px] text-ink shadow-none placeholder:text-ink-soft2 focus-visible:ring-0 focus-visible:ring-offset-0'
export const STEP_BTN = 'flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-[17px] font-semibold text-ink transition-colors hover:border-line-strong disabled:opacity-30'
// kis pill — forrás, státusz (5 db egy sorban), alkalom
export const pillSmCls = (on: boolean) =>
  `inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-semibold transition-colors ${
    on ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong'
  }`

/** Szekció-cím ikonnal (háttér nélkül), alatta vékony vonal. */
export function SectionBar({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }) {
  return (
    // szekció-címke ikonnal, háttér nélkül — alatta a sorok vékony vonallal
    <div className="flex items-center gap-1.5 border-b border-line px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-ink">
      <Icon className="h-3.5 w-3.5" strokeWidth={2} /> {label}
    </div>
  )
}

/** Egy adatlap-sor: bal oldalt címke, jobb oldalt az érték; `stacked` = az érték a címke alatt. */
export function FieldRow({
  label, children, stacked = false, last = false, hint, hintTone = 'muted', aside,
}: {
  label: React.ReactNode
  children: React.ReactNode
  stacked?: boolean
  last?: boolean
  hint?: string
  hintTone?: 'muted' | 'ok' | 'warn' | 'bad'
  aside?: React.ReactNode
}) {
  const tone = hintTone === 'ok' ? 'text-[#1D7A4C]' : hintTone === 'warn' ? 'text-amber-600' : hintTone === 'bad' ? 'text-[#C0453F]' : 'text-ink-soft2'
  return (
    <div className={`px-3 py-2.5 ${last ? '' : 'border-b border-line'}`}>
      <div className={stacked ? 'space-y-2' : 'flex min-h-9 items-center gap-3'}>
        <div className={`flex shrink-0 items-center justify-between gap-2 text-[13px] text-ink-soft ${stacked ? '' : 'w-24'}`}>
          {label}
          {stacked && aside}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
        {!stacked && aside}
      </div>
      {hint && <p className={`mt-1 text-[11px] font-medium leading-snug ${tone} ${stacked ? '' : 'pl-[108px]'}`}>{hint}</p>}
    </div>
  )
}


