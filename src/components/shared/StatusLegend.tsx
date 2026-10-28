/**
 * Színmagyarázat a foglalás-kártyák alá (mobil idősáv nézet). Ugyanaz a forma, mint az asztali
 * „Mai szervizterv" fejlécében: kis lekerekített színminta + felirat.
 */
export type LegendItem = { c: string; l: string }

const HATCH = 'repeating-linear-gradient(115deg,#f3efe4 0 3px,#e8e4d8 3px 5px)'

export const RESTAURANT_LEGEND: LegendItem[] = [
  { c: '#1D1C19', l: 'Megerősített' },
  { c: '#F1CE45', l: 'Függő' },
  { c: '#1D9D63', l: 'Leültetve' },
  { c: HATCH, l: 'Befejezett' },
  { c: '#C0564A', l: 'Lemondva' },
]

export const SALON_LEGEND: LegendItem[] = [
  { c: '#1D1C19', l: 'Megerősített' },
  { c: '#F1CE45', l: 'Függő' },
  { c: HATCH, l: 'Befejezett' },
  { c: '#C0564A', l: 'Lemondva' },
  { c: 'repeating-linear-gradient(115deg,#F3D9D6 0 3px,#EFC5C0 3px 5px)', l: 'Szünet' },
]

export function StatusLegend({ items, className = '' }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-1.5 ${className}`}>
      {items.map((x) => (
        <div key={x.l} className="flex items-center gap-[7px]">
          <span className="h-[11px] w-[11px] rounded-[3px] border border-line" style={{ background: x.c }} />
          <span className="text-xs font-medium text-ink-soft2">{x.l}</span>
        </div>
      ))}
    </div>
  )
}
