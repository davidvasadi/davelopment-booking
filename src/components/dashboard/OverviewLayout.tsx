import { PageHead, SegmentBar, type Segment } from '@/components/ui-kit'
import { WeekBars, type WeekBar } from '@/components/blocks/charts'
import { capsWords } from '@/lib/utils'

/**
 * Az Áttekintés váza (a /design 4.1 / 4.4 / 4.6) — a szalon és az étterem oldala is ezt tölti ki.
 * Desktop: fejléc (cím + Indulás-pill, dátum · üzlet, megoszlás-csík, nagy számok), alatta 4 oszlop: üzlet-kártya fotóval,
 * hét, ma, Teendők (két sor magas); 2. sor: akkordeon + Közelgő foglalások (2 oszlop).
 * Mobil (4.4): a fotó kimarad; a fejléc után a Közelgő foglalások, majd hét, ma, Teendők, akkordeon.
 */
export function OverviewLayout({ start, sub, bar, kpis, photo, week, today, tasks, accordion, timeline }: {
  start?: React.ReactNode
  sub: string
  bar: Segment[]
  kpis: React.ReactNode
  photo: React.ReactNode
  week: React.ReactNode
  today: React.ReactNode
  tasks: React.ReactNode
  accordion: React.ReactNode
  timeline: React.ReactNode
}) {
  return (
    <div className="p-4 lg:p-0">
      <PageHead
        title={<span className="flex flex-wrap items-center gap-3">Áttekintés{start}</span>}
        sub={sub}
        bar={<SegmentBar segments={bar} />}
        kpis={kpis}
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-[5px] lg:grid-cols-4">
        <div className="hidden lg:block [&>*]:h-full">{photo}</div>
        <div className="order-2 lg:order-none [&>*]:h-full">{week}</div>
        <div className="order-3 lg:order-none [&>*]:h-full">{today}</div>
        <div className="order-4 lg:order-none lg:row-span-2 [&>*]:h-full">{tasks}</div>
        {/* az akkordeon nem növeli a sort: desktopon kitölti a cellát (a sor magasságát a Közelgő foglalások adja), a tartalma görget */}
        <div className="order-5 lg:relative lg:order-none lg:min-h-[260px] [&>*]:h-full lg:[&>*]:absolute lg:[&>*]:inset-0">{accordion}</div>
        <div className="order-1 flex min-w-0 lg:order-none lg:col-span-2">{timeline}</div>
      </div>
    </div>
  )
}

/** A megoszlás-csík szegmensei darabszámból: üresen minden rész 0-val, egyenlő szélességgel (mint minden üres állapotnál);
 *  különben arányosan — a 0-s rész is ott marad kis pillként (a design szerint). */
export function segments(parts: { label: string; value: number; tone: Segment['tone']; show?: string }[]): Segment[] {
  const max = Math.max(0, ...parts.map((p) => p.value))
  // a pillben a szám mellett az egység is („28 db”) — ahol más (pl. „4 óra”), a hívó `show`-val adja meg
  return parts.map((p) => ({ label: p.label, value: p.show ?? `${p.value} db`, tone: p.tone, weight: max === 0 ? 25 : Math.max(p.value, max * 0.12) }))
}

/** A fejléc dátuma: „Kedd, November 3.” (nagy kezdőbetűvel, mert a sor eleje) */
export const headDate = (d: Date) => {
  const day = d.toLocaleDateString('hu-HU', { weekday: 'long' })
  return capsWords(`${day}, ${d.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}`)
}

/** Ezres kerekítés a nagy számokhoz: 164 000 → „164 e”. */
export const thousands = (v: number) => (v >= 10_000 ? `${Math.round(v / 1000)} e` : v.toLocaleString('hu-HU'))

/** A hét / következő 7 nap részletei (a kártya ↗-jára nyíló lapon): nagy szám, oszlopok, napi lista. */
export function WeekDetail({ total, unit, days }: { total: number; unit: string; days: WeekBar[] }) {
  const max = Math.max(1, ...days.map((d) => d.v))
  return (
    <>
      <div className="flex items-baseline gap-2"><span className="text-ui-page font-light text-ui-text">{total}</span><span className="text-ui-meta text-ui-muted">{unit}</span></div>
      <WeekBars className="mt-6" h={140} days={days} />
      <div className="mt-6">
        {days.map((d) => (
          <div key={d.d} className="flex items-center gap-3 border-t border-dashed border-ui-divider py-2.5 first:border-t-0">
            <span className="w-10 shrink-0 text-ui-body text-ui-muted">{d.d}</span>
            <span className="flex h-2 flex-1 gap-0.5 overflow-hidden rounded-full">
              {d.v > 0 && <span className={`rounded-full ${d.peak ? 'bg-ui-yellow' : 'bg-ui-dark'}`} style={{ width: `${Math.round((d.v / max) * 100)}%` }} />}
              <span className="ui-hatch-cell flex-1 rounded-full" />
            </span>
            <span className="w-8 shrink-0 text-right text-ui-body text-ui-text">{d.v}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** Kulcs–érték sorok szaggatott elválasztóval (részletek-lap, akkordeon). */
export function KeyRows({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div>
      {rows.map(([k, v], i) => (
        <div key={i} className="flex items-center justify-between gap-3 border-t border-dashed border-ui-divider py-2 text-ui-body first:border-t-0">
          <span className="text-ui-muted">{k}</span><span className="text-ui-text">{v}</span>
        </div>
      ))}
    </div>
  )
}
