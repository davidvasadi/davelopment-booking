import { Pill } from '@/components/ui-kit'

/* Egyszerű diagram-darabok — a /design és a landing közös elemei. */

/** Vékony arány-sáv: kitöltött rész(ek) (sötét, kiemelve sárga, vagy több tónusú részek) + csíkos maradék. Statisztikák (ShareRow) és a heti
 *  étterem-cellák is ezt használják. */
const BAR_TONE = { yellow: 'bg-ui-yellow', dark: 'bg-ui-dark', grey: 'bg-ui-grey' } as const
type BarTone = keyof typeof BAR_TONE
export function MiniBar({ pct = 0, hi = false, tone, parts, className = '' }: { pct?: number; hi?: boolean; tone?: BarTone; parts?: { pct: number; tone: BarTone }[]; className?: string }) {
  // több részből álló sáv (pl. munka / beteg), vagy egy rész a tónussal (alap: sötét, kiemelve sárga)
  const segs = parts ?? [{ pct, tone: tone ?? (hi ? 'yellow' : 'dark') }]
  return <div className={`flex h-[6px] gap-0.5 overflow-hidden rounded-full ${className}`}>{segs.filter((p) => p.pct > 0).map((p, i) => <span key={i} className={`rounded-full ${BAR_TONE[p.tone]}`} style={{ width: `${p.pct}%` }} />)}<span className="flex-1 rounded-full ui-hatch-cell" /></div>
}

/** Heti oszlopdiagram (Crextio „Progress”): sötét oszlop + sötét pötty, a kiemelt nap sárga címkével, a zárt és az üres (0) nap
 *  alapmagasságú (60%) csíkos oszlop, a zárt szürke pöttyel. Egy elem — az Áttekintés, a mobil és az Elemek is ezt használja. */
export type WeekBar = { d: string; v: number; peak?: boolean; closed?: boolean }
export function WeekBars({ days, h = 70, tag = (v) => String(v), max: maxIn, className = '' }: { days: WeekBar[]; h?: number; tag?: (v: number) => string; /** közös skála, ha a napok külön-külön rajzolódnak */ max?: number; className?: string }) {
  const max = maxIn ?? Math.max(...days.map((b) => b.v), 1)
  return (
    <div className={`flex items-end justify-between gap-1.5 ${className}`}>
      {days.map((b, i) => (
        <div key={b.d} className="flex flex-1 flex-col items-center justify-end">
          {b.peak && <Pill tone="yellow" size="sm" className="mb-1.5">{tag(b.v)}</Pill>}
          <div className={`ui-grow-y w-[7px] rounded-full ${b.closed || !b.v ? 'ui-hatch-cell' : b.peak ? 'bg-ui-yellow' : 'bg-ui-dark'}`} style={{ height: b.closed || !b.v ? h * 0.6 : (b.v / max) * h, ['--i' as string]: i }} />
          <span className={`mt-1.5 h-[6px] w-[6px] rounded-full ${b.peak ? 'bg-ui-yellow' : b.closed ? 'bg-ui-grey' : 'bg-ui-dark'}`} />
          <span className="mt-1.5 text-ui-label text-ui-muted">{b.d}</span>
        </div>
      ))}
    </div>
  )
}

/** Vízszintes arány-sáv egy sorban (Top szolgáltatás mintája): név, érték, alatta sárga/sötét sáv + csíkos maradék. */
export function ShareRow({ lead, name, value, pct, hi = false }: { lead?: React.ReactNode; name: string; value: string; pct: number; hi?: boolean }) {
  return (
    <div className="border-t border-dashed border-ui-divider py-2.5 first:border-t-0">
      <div className="flex items-center gap-2 text-ui-body"><span>{lead}</span><span className="flex-1 text-ui-text">{name}</span><span className="text-ui-muted">{value}</span></div>
      <MiniBar className="mt-1.5" pct={pct} hi={hi} />
    </div>
  )
}

/** Sima görbe a pontokon át (Catmull–Rom jelleg, a dashboard-grafikonok nyelve). */
export function smooth(data: number[], w: number, h: number, min: number, max: number) {
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / (max - min)) * h])
  return pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`
    const [px, py] = pts[i - 1]
    const cx = (px + x) / 2
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`
  }, '')
}

/** Jelmagyarázat: pötty + felirat — a grafikonok fejlécében és a kör-diagramok alatt. */
export function Legend({ items, dark = false }: { items: [string, string][]; dark?: boolean }) {
  return (
    <span className={`flex items-center gap-3 text-ui-label ${dark ? 'text-white/70' : 'text-ui-muted'}`}>
      {items.map(([dot, l]) => <span key={l} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${dot}`} />{l}</span>)}
    </span>
  )
}

/** Kör-mérő (a Statisztikák kihasználtság-gyűrűje): halvány osztás-vonalak, sárga ív `pct` %-ig, középen az érték.
 *  A Statisztikák (5.x) és a Tippek egészség-pontszáma (14.1) is ez. */
export function Ring({ pct, size = 140, children, className = '' }: { pct: number; size?: number; children?: React.ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        {/* kerekítve: a szerver és a böngésző az utolsó tizedesekben másképp számol (hidratálási eltérés) */}
        {Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * 2 * Math.PI; const r2 = (v: number) => Math.round(v * 100) / 100; return <line key={i} x1={r2(70 + Math.cos(a) * 50)} y1={r2(70 + Math.sin(a) * 50)} x2={r2(70 + Math.cos(a) * 55)} y2={r2(70 + Math.sin(a) * 55)} stroke="var(--ui-dark)" strokeOpacity=".3" strokeWidth="1.2" /> })}
        <circle className="ui-ring-draw" cx="70" cy="70" r="63" fill="none" stroke="var(--ui-yellow)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 2 * Math.PI * 63} ${2 * Math.PI * 63}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}


/** Buborék a grafikon pontja fölött: középen a pont fölé áll, a szélső pontoknál (az első / utolsó ötödben) a grafikon
 *  széléhez igazodik — így sosem lóg ki a kártyából, és nem bújik a szomszéd kártya mögé. `gap`: a pont és a buborék távolsága. */
export function tipStyle(xPct: number, topPct: number, gap = 12): React.CSSProperties {
  const y = `calc(-100% - ${gap}px)`
  if (xPct <= 20) return { left: 0, top: `${topPct}%`, transform: `translateY(${y})` }
  if (xPct >= 80) return { right: 0, top: `${topPct}%`, transform: `translateY(${y})` }
  return { left: `${xPct}%`, top: `${topPct}%`, transform: `translate(-50%, ${y})` }
}

/** Sötét vonal-grafikon (Crextio „Test Statistics”, a Statisztikák bevétel-részlete): sárga = most, szaggatott fehér =
 *  előző / átlag, a kijelölt ponton fehér karika és fehér címke-pill; alul a tengely-feliratok, a kijelölt pillben.
 *  Sötét kártyába való. A Statisztikák (5.x) és a Marketing nyitási arány (13.x) is ez. */
export function DarkLineChart({ now, prev, sel, label, ticks, selTick, min, max, h = 110, drawIn = false, className = '' }: { now: number[]; prev?: number[]; sel: number; label: string; ticks: string[]; selTick?: number; min: number; max: number; h?: number; /** belépő: a görbe kirajzolódik, utána a pont és a címke beúszik (landing) */ drawIn?: boolean; className?: string }) {
  const x = (i: number) => (i / (now.length - 1)) * 100
  const top = 100 - ((now[sel] - min) / (max - min)) * 100
  return (
    <div className={className}>
      <div className="relative mt-10" style={{ height: h }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`absolute inset-0 h-full w-full overflow-visible ${drawIn ? 'ui-reveal-x' : ''}`}>
          {prev && <path d={smooth(prev, 100, 100, min, max)} fill="none" stroke="white" strokeOpacity=".4" strokeWidth="1.2" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
          <path d={smooth(now, 100, 100, min, max)} fill="none" stroke="var(--ui-yellow)" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-white bg-ui-dark transition-all duration-200 ${drawIn ? 'ui-fade-up' : ''}`} style={{ left: `${x(sel)}%`, top: `${top}%`, ['--d' as string]: '1100ms' }} />
        {/* a szélső pontoknál a grafikon széléhez igazodik, hogy ne lógjon ki a kártyából */}
        <span className={`absolute whitespace-nowrap transition-[top,left] duration-200 ${drawIn ? 'ui-fade-up' : ''}`} style={{ ['--d' as string]: '1250ms', ...tipStyle(x(sel), top, 14) }}><Pill tone="white" size="md" className="gap-2"><span className="h-1.5 w-1.5 rounded-full bg-ui-yellow" />{label}</Pill></span>
      </div>
      <div className="mt-4 flex items-center justify-between text-ui-meta text-white/45">
        {ticks.map((w, i) => i === selTick ? <Pill key={i} tone="onDark" size="sm">{w}</Pill> : <span key={i}>{w}</span>)}
      </div>
    </div>
  )
}
