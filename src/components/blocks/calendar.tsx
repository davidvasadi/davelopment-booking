import { Fragment } from 'react'
import { TodayScroller } from './TodayScroller'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Download, FileText, Pencil, Phone, Trash2, Undo2, Upload, UserRound, X } from 'lucide-react'
import { Avatar, Button, Card, IconButton, IconCircle, Input, Marquee, MarqueeText, Meta, Pagination, Panel, Pill, SegmentBar, FieldRow, ListRow, Note, Segmented, Textarea } from '@/components/ui-kit'
import { Switch } from '@/components/ui/toggle-switch'
import { MockSwitch } from './MockSwitch'
import { Legend, MiniBar } from './charts'
import { MobileDayStrip } from './overview'
import { MonthPicker } from '@/components/shared/DatePickerPopover'
import { MONTHS_SHORT } from '@/lib/schedule'

/* Naptár (beosztás) kártyái — a /design 11.1–11.5 és a landing „Naptár” funkció-oldala is ezeket mutatja. */

/** Nap-fejléc a heti nézetekben (6.4, 6.5): nap neve + dátum, a mai sötét, a zárt halvány piros. */
export function DayHead({ d, n, today = false, closed = false }: { d: string; n: number; today?: boolean; closed?: boolean }) {
  return <span className={`flex flex-col items-center rounded-ui-control py-1.5 ${today ? 'bg-ui-dark text-white' : closed ? 'text-ui-bad-dot' : 'text-ui-muted'}`}><span className="text-ui-label">{d}</span><span className="text-ui-title font-light">{n}</span></span>
}

/** Egy munkatárs a naptár bal listájában. `a` / `b`: az óra-sáv két része (munka sárga, távollét sötét) %-ban. */
export type HoursPerson = { id: string; name: string; role: string; img?: string | null; a: number; b: number }
const SAMPLE_PEOPLE: HoursPerson[] = [{ id: 'viktoria', name: 'Viktória', role: 'Stylist', img: '/landing/funkciok/csapat/avatar/viktoria.webp', a: 142, b: 16 }, { id: 'csaba', name: 'Csaba', role: 'Barber', img: '/landing/funkciok/csapat/avatar/csaba.webp', a: 120, b: 8 }, { id: 'szabina', name: 'Szabina', role: 'Recepció', img: '/landing/funkciok/csapat/avatar/szabina.webp', a: 80, b: 0 }, { id: 'dave', name: 'Dávid', role: 'Stylist · tulajdonos', img: '/landing/funkciok/csapat/avatar/dave.webp', a: 96, b: 24 }].map((p) => ({ ...p, a: (p.a / 168) * 100, b: (p.b / 168) * 100 }))

/** 11.1 bal: munkatársak háromszínű óra-sávval (munka / beteg / szabad). `selected`: a kiválasztott (fehér) — Mind
 *  szűrőnél nincs kiválasztott, a naptár a csapaté; `stylist`: a pozíció-szűrő után csak a stylistok (mintában).
 *  Élőben `people` (és `title`), `onPick`: egy emberre kattintva a naptár az övé. */
export function StaffHoursList({ selected = 'viktoria', stylist = false, people, title, onPick, className = '' }: { selected?: string | null; stylist?: boolean; people?: HoursPerson[]; title?: string; onPick?: (id: string) => void; className?: string }) {
  const list = people ?? (stylist ? SAMPLE_PEOPLE.filter((p) => p.role.startsWith('Stylist')) : SAMPLE_PEOPLE)
  return (
    <Card pad="xs" className={`flex flex-col ${className}`}>
      <div className="flex items-baseline justify-between px-3 pb-1 pt-2"><span className="text-ui-row text-ui-text">{title ?? (stylist ? 'Stylistok' : 'Munkatársak')}</span><span className="text-ui-meta text-ui-muted">{list.length} fő</span></div>
      {list.map((p) => {
        const body = (
          <>
            <div className="flex items-center gap-2.5">
              <Avatar size="sm" src={p.img ?? null} name={p.name} />
              <span className="min-w-0 flex-1"><MarqueeText className="text-ui-body text-ui-text">{p.name}</MarqueeText><MarqueeText className="text-ui-label text-ui-muted">{p.role}</MarqueeText></span>
            </div>
            <MiniBar className="mt-2.5" parts={[{ pct: p.a, tone: 'yellow' }, { pct: p.b, tone: 'dark' }]} />
          </>
        )
        const cls = `mb-1 block w-full rounded-ui-inner p-3 text-left ${p.id === selected ? 'bg-white' : ''}`
        return onPick
          ? <button key={p.id} type="button" onClick={() => onPick(p.id)} aria-pressed={p.id === selected} className={`${cls} outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{body}</button>
          : <div key={p.id} className={cls}>{body}</div>
      })}
    </Card>
  )
}

/** Több napos esemény a havi naptárban: a típus színével (műszak sárga, beteg sötét, szabadság szürke), csapat-nézetben
 *  elöl a munkatárs avatarja. `from` / `span`: a hét hányadik napjától hány napon át. */
export type MonthBar = { key?: string; from: number; span: number; tone: 'yellow' | 'dark' | 'grey' | 'white'; label: string; range: string; on?: boolean; who?: { src?: string | null; name: string } }
/** Egy nap a havi naptárban. `closed`: zárt nap felirata (ünnepnap, a nyitvatartásból) — csíkos, piros; `out`: hónapon
 *  kívüli; `weekend`: hétvége (alsó fele csíkos); `count`: csapat-nézetben hány fő dolgozik. */
export type MonthCell = { key?: string; n: number; out?: boolean; closed?: string; weekend?: boolean; today?: boolean; count?: number; /** a kiválasztott nap (fehér) */ selected?: boolean }
export type MonthRow = { cells: MonthCell[]; bars: MonthBar[] }

type SampleWeek = { days: number[]; out: number[]; bar: MonthBar | null; single?: { i: number; label: string } }
const SAMPLE_WEEKS: SampleWeek[] = [
  { days: [27, 28, 29, 30, 31, 1, 2], out: [0, 1, 2, 3, 4], bar: null, single: { i: 5, label: 'Zárva · Mindenszentek' } },
  { days: [3, 4, 5, 6, 7, 8, 9], out: [], bar: { from: 0, span: 5, tone: 'yellow', label: 'Műszak · 9–17', range: 'Nov. 3–7.' } },
  { days: [10, 11, 12, 13, 14, 15, 16], out: [], bar: { from: 1, span: 2, tone: 'dark', label: 'Beteg', range: 'Nov. 11–12.', on: true } },
  { days: [17, 18, 19, 20, 21, 22, 23], out: [], bar: { from: 0, span: 3, tone: 'white', label: 'Szabadság', range: 'Nov. 17–19.' } },
  { days: [24, 25, 26, 27, 28, 29, 30], out: [], bar: { from: 1, span: 3, tone: 'yellow', label: 'Műszak · 12–20', range: 'Nov. 25–27.' } },
]
const av = (n: string, img: string) => ({ name: n, src: `/landing/funkciok/csapat/avatar/${img}.webp` })
const SAMPLE_TEAM_BARS: (MonthBar | null)[] = [null, { from: 1, span: 2, tone: 'dark', label: 'Csaba · beteg', range: 'Nov. 4–5.', who: av('Csaba', 'csaba') }, { from: 1, span: 2, tone: 'dark', label: 'Viktória · beteg', range: 'Nov. 11–12.', who: av('Viktória', 'viktoria') }, { from: 0, span: 3, tone: 'white', label: 'Viktória · szabadság', range: 'Nov. 17–19.', who: av('Viktória', 'viktoria') }, { from: 2, span: 3, tone: 'white', label: 'Dávid · szabadság', range: 'Nov. 26–28.', who: av('Dávid', 'dave') }]
/** A minta hónap (2026. November) sorai — a design oldal és a landing props nélkül ezt mutatja. */
function sampleRows(compact: boolean, team: boolean): MonthRow[] {
  return SAMPLE_WEEKS.map((w, wi) => {
    // mobilon a hétköznap alapból munkanap, ezért ott csak az eltérő (beteg, szabadság, más idősáv) kap kártyát
    const bar = team ? SAMPLE_TEAM_BARS[wi] : compact && wi === 1 ? null : w.bar
    return {
      cells: w.days.map((n, i) => {
        const out = w.out.includes(i)
        const closed = w.single?.i === i ? w.single.label : undefined
        const busy = bar && i >= bar.from && i < bar.from + bar.span ? 1 : 0
        return { n, out, closed, weekend: i > 4, today: wi === 1 && n === 5, count: team && !out && !closed && i < 5 ? 4 - busy : undefined }
      }),
      bars: bar ? [bar] : [],
    }
  })
}

/** mobil (compact) esemény-kártya: ugyanaz a színkód, mint a desktop sávjain (műszak sárga, beteg sötét, szabadság szürke) */
const BAR_CARD = { yellow: ['bg-ui-yellow text-ui-dark', 'text-ui-dark/60'], dark: ['bg-ui-dark text-white', 'text-white/60'], grey: ['bg-ui-grey text-ui-dark', 'text-ui-dark/60'], white: ['bg-white text-ui-dark', 'text-ui-dark/60'] } as const
/** A hét eseményei sávokba: ami nem ütközik (más napokra esik), egy sorban marad; ütközésnél a második sor (legfeljebb 2). */
function laned(bars: MonthBar[]) {
  const ends: number[] = []
  return [...bars].sort((a, b) => a.from - b.from).flatMap((bar) => {
    let lane = ends.findIndex((e) => e < bar.from)
    if (lane === -1) { lane = ends.length; ends.push(-1) }
    ends[lane] = bar.from + bar.span - 1
    return lane < 2 ? [{ bar, lane }] : []
  })
}
/** A típus pöttye a pill elején: műszak sötét, beteg piros, szabadság a mi zöldünk (csapat-nézetben az avatar áll helyette). */
const BAR_DOT = { yellow: 'bg-ui-dark', dark: 'bg-ui-bad-dot', grey: 'bg-ui-dark', white: 'bg-ui-ok-dot' } as const

/** Esemény-pill a havi naptárban — a típus színével, mint a csík és a jelmagyarázat; csapat-nézetben elöl a munkatárs
 *  avatarja; középen rövid csíkos sáv, végén az időszak. */
function MonthBarPill({ bar, mini = false }: { bar: MonthBar; /** mobil: vékony szalag — mindig felirat + időszak; 4+ napon köztük a csíkos sáv, rövidebben egy sorban, elúszva ha kell */ mini?: boolean }) {
  // egynapos esemény: csak a felirat (levágva), a csíkos sáv és az időszak nem fér el
  const one = bar.span === 1
  if (mini) return (
    <Pill tone={bar.tone} size="sm" className={`h-5 w-full gap-1 px-1.5 shadow-ui-float ${bar.who ? 'pl-0.5' : ''} ${bar.on ? 'ring-2 ring-ui-dark' : ''}`}>
      {bar.who ? <Avatar size="xs" src={bar.who.src ?? null} name={bar.who.name} className="h-4 w-4" /> : <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${BAR_DOT[bar.tone]}`} />}
      {/* egy szabály minden szalagra: felirat + időszak. 4+ napon (van hely) külön, köztük a csíkos sáv, mint desktopon;
          rövidebben egy sorban („Műszak · 9–17 · Nov. 4–5.”), és ha nem fér ki, az egész elúszik (szalagcím) */}
      {bar.span >= 4 ? <>
        <MarqueeText className="flex-initial">{bar.label}</MarqueeText>
        <span className="mx-1 h-2 min-w-2 flex-1 rounded-full opacity-60 ui-hatch" />
        <span className="shrink-0 whitespace-nowrap opacity-70">{bar.range}</span>
      </> : <MarqueeText className="min-w-0 flex-1">{bar.label} · {bar.range}</MarqueeText>}
    </Pill>
  )
  return (
    <Pill tone={bar.tone} size="sm" className={`w-full shadow-ui-float ${bar.who ? 'pl-1' : ''}`}>
      {bar.who ? <Avatar size="xs" src={bar.who.src ?? null} name={bar.who.name} className="h-5 w-5" /> : <span className={`h-2 w-2 shrink-0 rounded-full ${BAR_DOT[bar.tone]}`} />}
      {/* ha nem fér ki, a felirat elúszik (szalagcím, mint mindenhol) — a láthatatlan példány adja a természetes szélességét,
          így a rugalmas sorban csak akkor megy össze, ha kell; a dátum mindig látszik */}
      <MarqueeText className={one ? 'flex-1' : 'flex-initial'}>{bar.label}</MarqueeText>
      {!one && <span className="mx-2 h-2.5 min-w-2 flex-1 rounded-full opacity-60 ui-hatch" />}
      {!one && <span className="shrink-0 whitespace-nowrap">{bar.range}</span>}
    </Pill>
  )
}

/** 11.1 közép (a Crextio „Salary” naptára szerint): a hónap órái és bére, a csík (munkanap / beteg / szabadság) és az
 *  egész hónap cellákban. A több napos esemény a cellák alján pill (a dátum fölötte szabad), a zárt nap (ünnepnap,
 *  a nyitvatartásból) csíkos cella piros dátummal és felirattal; a hétvége alja és a hónapon kívüli nap csíkos.
 *  `team` (Mind szűrő, nincs kiválasztott ember): az egész csapat összesen, a pillen a munkatárs avatarja, csak a távollétek.
 *  `compact` (mobil): egyforma magas cellák, a több napos esemény a napjai helyén egy kártya, a desktop sávjainak színével
 *  (műszak sárga, beteg sötét, szabadság szürke); a kiválasztott kártya és nap kerettel, a mai nap csak a sötét körrel.
 *  Élőben: `head` (ki), `total`, `month` (a hónap-választó), `segments`, `rows`, `onDay`, `onBar`. */
export function MonthHours({ compact = false, mobile = false, team = false, head, total, month, segments, rows, onDay, onBar, drawKey, className = '' }: {
  compact?: boolean
  /** mobil, a desktop kinézetével (design 11.7): fejléc avatarral, a napszám mindig látszik, alatta vékony szalag */
  mobile?: boolean
  team?: boolean
  head?: React.ReactNode
  total?: React.ReactNode
  month?: React.ReactNode
  segments?: React.ComponentProps<typeof SegmentBar>['segments']
  rows?: MonthRow[]
  onDay?: (key: string) => void
  onBar?: (key: string) => void
  /** változásakor (pl. másik munkatárs / hónap) a csík pilljei és a műszak-sávok újra kirajzolódnak */
  drawKey?: string
  className?: string
}) {
  const weeks = rows ?? sampleRows(compact, team)
  const segs = segments ?? (team
    ? [{ label: 'Munkanap', value: '546 ó', weight: 78, tone: 'yellow' as const }, { label: 'Beteg', value: '32 ó', weight: 9, tone: 'dark' as const }, { label: 'Szabadság', value: '48 ó', weight: 13, tone: 'white' as const }]
    : [{ label: 'Munkanap', value: '142 ó', weight: 64, tone: 'yellow' as const }, { label: 'Beteg', value: '16 ó', weight: 12, tone: 'dark' as const }, { label: 'Szabadság', value: '24 ó', weight: 24, tone: 'white' as const }])
  const cellBtn = (key: string | undefined, cls: string, body: React.ReactNode, style?: React.CSSProperties, i?: number) => onDay && key
    ? <button key={key} type="button" onClick={() => onDay(key)} className={`${cls} text-left outline-none transition-[filter] hover:brightness-[.97] focus-visible:ring-2 focus-visible:ring-ui-dark/20`} style={style}>{body}</button>
    : <div key={key ?? i} className={cls} style={style}>{body}</div>
  return (
    <Card className={className}>
      {/* mobil: felül végig a ki (avatar + név / Csapat), alatta balra a két szám egymás alatt, jobbra a hónap-választó */}
      {mobile && <span className="mb-2 flex items-center gap-2 text-ui-meta text-ui-muted">{head ?? (team ? <>Csapat · 4 fő</> : <><Avatar size="xs" src="/landing/funkciok/csapat/avatar/viktoria.webp" className="h-5 w-5" />Viktória</>)}</span>}
      <div className={`flex items-start justify-between gap-3 ${mobile ? '' : 'flex-wrap'}`}>
        <span>
          {!compact && !mobile && <span className="mb-2 flex items-center gap-2 text-ui-meta text-ui-muted">{head ?? (team ? <>Csapat · 4 fő</> : <><Avatar size="xs" src="/landing/funkciok/csapat/avatar/viktoria.webp" className="h-5 w-5" />Viktória</>)}</span>}
          <span className="block font-light leading-none text-ui-text text-ui-num">{total ?? (compact || mobile ? <><span className="block">{team ? '594 ó' : '158 ó'}</span><span className="mt-1 block whitespace-nowrap">{team ? '1,49 M Ft' : '395 e Ft'}</span></> : team ? '594 ó / 1 486 000 Ft' : '158 ó / 395 000 Ft')}</span>
        </span>
        {month ?? <Button variant="glass">November <ChevronDown className="h-4 w-4 text-ui-muted" /></Button>}
      </div>
      <SegmentBar key={drawKey} size="md" className="mt-4" segments={segs} />
      <div className="mt-5 grid grid-cols-7 gap-1 text-center text-ui-label">
        {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((d, i) => <span key={d} className={i > 4 ? 'text-ui-bad-dot' : 'text-ui-muted'}>{d}</span>)}
      </div>
      <div className="mt-1.5 space-y-1">
        {weeks.map((w, wi) => {
          // mobil: a hét MINDEN szakasza a saját napjain (eddig csak az első jelent meg — a többi, pl. egy beteg nap, eltűnt)
          const barAt = (i: number) => (compact ? w.bars.find((b) => i >= b.from && i < b.from + b.span) : undefined)
          return (
            <div key={wi} className="relative grid grid-cols-7 gap-1">
              {w.cells.map((c, i) => {
                // mobil: az esemény napjai helyén egy kártya
                const cbar = barAt(i)
                if (cbar) {
                  if (i !== cbar.from) return null
                  const [tone, sub] = BAR_CARD[cbar.tone]
                  const body = <>
                    {/* ha nem fér ki (keskeny kártya), a felirat elúszik */}
                    {/* a típus pöttye a jobb felső sarokban — mint a Foglalások blokkjain; csapat-nézetben is */}
                    <span className={`absolute right-2 top-2 h-2 w-2 rounded-full ${BAR_DOT[cbar.tone]}`} />
                    <MarqueeText className="pr-3 text-ui-meta">{cbar.label}</MarqueeText>
                    <Marquee className={`text-ui-label ${sub}`}>{cbar.range}</Marquee>
                  </>
                  // a kiválasztott kártya kerettel (a színe a típusé marad)
                  const cls = `relative flex flex-col justify-end overflow-hidden rounded-ui-control p-1.5 ${tone} ${cbar.on ? 'ring-2 ring-inset ring-ui-dark' : ''}`
                  return onBar && cbar.key
                    ? <button key={i} type="button" onClick={() => onBar(cbar.key!)} className={`${cls} text-left outline-none`} style={{ gridColumn: `span ${cbar.span}` }}>{body}</button>
                    : <div key={i} className={cls} style={{ gridColumn: `span ${cbar.span}` }}>{body}</div>
                }
                const cls = `relative overflow-hidden rounded-ui-control ${mobile ? 'h-[54px] p-1.5 text-ui-label' : 'text-ui-meta'} ${mobile ? '' : compact ? 'h-[52px] p-1.5' : 'aspect-square p-2'} ${c.closed ? 'ui-hatch-cell-dense text-ui-bad-dot' : c.out ? 'ui-hatch-lines-dense text-ui-muted' : c.selected ? 'bg-white text-ui-dark' : 'bg-ui-cell text-ui-dark'} ${c.today && !compact ? 'ring-2 ring-ui-dark' : ''} ${(compact || mobile) && c.selected ? 'ring-2 ring-inset ring-ui-dark' : ''}`
                return cellBtn(c.key, cls, <>
                  {c.today ? <IconCircle size="xs">{c.n}</IconCircle> : c.n}
                  {/* csapat-nézet: munkanapon hány fő dolgozik — sárga, mint mindenhol a munka */}
                  {c.count != null && !compact && !mobile && <Pill tone="yellow" size="sm" className="absolute right-1.5 top-1.5">{c.count} fő</Pill>}
                  {/* mobil: a napi létszám kicsiben a jobb felső sarokban — a dátum mellett, a szalag fölött */}
                  {c.count != null && mobile && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ui-yellow px-1 text-ui-label leading-none text-ui-dark">{c.count}</span>}
                  {/* mobil (csapat): a napi létszám kicsiben — sárga számláló a jobb alsó sarokban, a dátumot nem takarja */}
                  {c.count != null && compact && <span className="absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ui-yellow px-1 text-ui-label leading-none text-ui-dark">{c.count}</span>}
                  {c.closed && !compact && !mobile && <span className="absolute inset-x-2 bottom-1.5 line-clamp-2 text-ui-label leading-tight">{c.closed}</span>}
                  {c.weekend && !c.out && !c.closed && <span className="absolute inset-x-0 bottom-0 h-1/2 opacity-60 ui-hatch-cell-dense" />}
                </>, undefined, i)
              })}
              {!compact && laned(w.bars).map(({ bar, lane }, bi) => (
                <div key={`${drawKey ?? ''}|${bar.key ?? bi}`} className={`absolute inset-x-0 grid grid-cols-7 gap-1 ${onBar && bar.key ? '' : 'pointer-events-none'} ${mobile ? (lane ? 'bottom-[26px]' : 'bottom-1') : lane ? 'bottom-[38px]' : 'bottom-2'}`}>
                  {/* a sáv balról jobbra kirajzolódik (mint a csík pilljei), hetenként kicsit később */}
                  <div className="ui-draw-x" style={{ gridColumn: `${bar.from + 1} / span ${bar.span}`, ['--i' as string]: wi }}>
                    {onBar && bar.key ? <button type="button" onClick={() => onBar(bar.key!)} className="block w-full rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><MonthBarPill bar={bar} mini={mobile} /></button> : <MonthBarPill bar={bar} mini={mobile} />}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      {!compact && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-dashed border-ui-divider pt-3 text-ui-label text-ui-muted">
          <Legend items={team ? [['bg-ui-yellow', 'Dolgozik (fő)'], ['bg-ui-dark', 'Beteg'], ['bg-white', 'Szabadság']] : [['bg-ui-yellow', 'Műszak'], ['bg-ui-dark', 'Beteg'], ['bg-white', 'Szabadság']]} />
          {/* mobil: a csíkos jelölés egy tétel (szabadnap, hétvége, zárva), a „Ma” nem kell — két sorban elfér */}
          {mobile ? <>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-ui-control bg-ui-cell" />Munkanap</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-ui-control ui-hatch-cell-dense" />Szabadnap / zárva</span>
          </> : <>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-ui-control ui-hatch-cell-dense" />Szabadnap / hétvége</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-ui-control bg-ui-cell" />Munkanap</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-ui-control ui-hatch-cell-dense" /><span className="text-ui-bad-dot">1</span>Zárva (ünnepnap)</span>
          <span className="flex items-center gap-1.5"><IconCircle tone="dark" size="xs">{weeks.flatMap((w) => w.cells).find((c) => c.today)?.n ?? 5}</IconCircle>Ma</span>
          </>}
        </div>
      )}
    </Card>
  )
}

/** Egy távollét a hónapban (csapat-nézet jobb oldala). */
export type AbsenceRow = { key: string; name: string; img?: string | null; type: string; range: string; tone: 'dark' | 'grey' | 'hatchCell' }
const SAMPLE_ABSENCES: AbsenceRow[] = ([['csaba', 'Csaba', 'Beteg', 'Nov. 4–5. · 2 nap', 'dark'], ['viktoria', 'Viktória', 'Beteg', 'Nov. 11–12. · 2 nap', 'dark'], ['viktoria', 'Viktória', 'Szabadság', 'Nov. 17–19. · 3 nap', 'grey'], ['dave', 'Dávid', 'Szabadság', 'Nov. 26–28. · 3 nap', 'grey']] as const).map(([img, n, t, d, tone]) => ({ key: n + d, name: n, img: `/landing/funkciok/csapat/avatar/${img}.webp`, type: t, range: d, tone }))

/** 11.1 jobb, csapat-nézetben (Mind): kik nincsenek bent a hónapban — munkatárs, típus, időszak. Sorra kattintva a
 *  nap-szerkesztő (11.5) nyílik. Élőben `month`, `rows`, `holidays` (a zárt napok sora), `onPick`. */
export function TeamAbsences({ month = 'November', rows = SAMPLE_ABSENCES, holidays = 'Ünnepnap: Nov. 1. (zárva, a nyitvatartásból)', onPick, className = '' }: { month?: string; rows?: AbsenceRow[]; holidays?: string | null; onPick?: (key: string) => void; className?: string }) {
  return (
    <Card pad="xs" className={className}>
      <div className="flex items-baseline justify-between px-3 pb-1 pt-2"><span className="text-ui-row text-ui-text">Távollétek</span><span className="text-ui-meta text-ui-muted">{month}</span></div>
      {rows.length === 0 && <Meta className="px-3 py-2">Ebben a hónapban mindenki bent van.</Meta>}
      {rows.map((r) => {
        const row = <ListRow leading={<Avatar size="sm" src={r.img ?? null} name={r.name} />} title={r.name} meta={r.range} trailing={<Pill tone={r.tone} size="sm">{r.type}</Pill>} />
        return onPick
          ? <button key={r.key} type="button" onClick={() => onPick(r.key)} className="block w-full rounded-ui-inner text-left outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button>
          : <div key={r.key}>{row}</div>
      })}
      {holidays && <Meta className="px-3 pb-2 pt-1">{holidays}</Meta>}
    </Card>
  )
}

/** Mobil Hónap: a kiválasztott esemény részletei sötét kártyán (a havi naptár alatt) — típus, időszak, megjegyzés,
 *  mennyi órát érint, és betegségnél a feltöltött táppénzes papír. Élőben: `title`, `note`, `hours`, `meta`, `file`. */
export function ShiftDetailCard({ title = 'Beteg', note = 'Influenza — orvosnál volt, két nap pihenés. A 4 foglalását Dávid vette át.', hours = '16 ó', meta = ['betegszabadság · fizetett', 'Nov. 11–12.'], file = <SickNoteFile onDark />, tone = 'dark', onEdit, className = '' }: {
  /** a típus pöttye (műszak sárga, beteg piros, szabadság zöld — mint a naptár pilljein) */
  tone?: 'yellow' | 'dark' | 'grey'
  /** élőben: a kiválasztott szakasz szerkesztése (gomb a kártya alján) */
  onEdit?: () => void
  title?: string; note?: string | null; hours?: string; meta?: string[]; file?: React.ReactNode; className?: string }) {
  return (
    <Card tone="dark" className={className}>
      <div className="flex items-center gap-2 text-ui-title"><span className={`h-2 w-2 rounded-full ${tone === 'yellow' ? 'bg-ui-yellow' : tone === 'grey' ? 'bg-ui-ok-dot' : 'bg-ui-bad-dot'}`} />{title}</div>
      {note && <div className="mt-2 text-ui-meta leading-snug text-white/55">{note}</div>}
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-dotted border-white/25 pt-4">
        <span className="text-ui-num font-light leading-none">{hours}</span>
        <span className="text-right text-ui-label text-white/55">{meta.map((x) => <span key={x} className="block">{x}</span>)}</span>
      </div>
      {file && <div className="mt-4">{file}</div>}
      {onEdit && <Button variant="yellow" icon={Pencil} className="mt-4 w-full" onClick={onEdit}>Szerkesztés</Button>}
    </Card>
  )
}

/** 11.1 jobb: a kiválasztott munkatárs adatlapja és statisztikája; jobb felül nyíl a teljes adatlapra, a kártya alján
 *  teljes szélességű hívás-gomb. Élőben: `person`, `rows` (alapadatok), `stats`, `href` (adatlap), `phone`. */
export function StaffProfile({ person = { name: 'Viktória', role: 'Stylist', img: '/landing/funkciok/csapat/avatar/viktoria.webp' }, rows = [['Belépés', '2024. Márc. 4.'], ['Telefon', '+36 30 412 7781'], ['Heti óra', '40 ó']], stats = [['Ledolgozott', '142 ó', 85, 'yellow'], ['Beteg', '2 nap', 10, 'dark'], ['Szabadság', '3 nap', 15, 'grey']], href, phone, onEdit, className = '' }: {
  person?: { name: string; role: string; img?: string | null }
  rows?: [string, string][]
  stats?: [string, string, number, 'yellow' | 'dark' | 'grey'][]
  href?: string
  phone?: string | null
  /** élőben: a munkatárs nap-szerkesztője (sötét gomb a hívás fölött) */
  onEdit?: () => void
  className?: string
}) {
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-ui-card bg-white ${className}`}>
      {/* a teljes adatlap (Munkatársak 10.2) */}
      <IconButton icon={ArrowUpRight} label="Adatlap megnyitása" variant="cell" size="sm" href={href} className="absolute right-4 top-4" />
      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <Avatar src={person.img ?? null} name={person.name} className="h-[72px] w-[72px] text-ui-title" />
        <div className="mt-2 text-ui-title font-normal text-ui-text">{person.name}</div>
        <div className="text-ui-meta text-ui-muted">{person.role}</div>
      </div>
      <div className="px-5 pb-5">
        <div className="mt-4 text-ui-body text-ui-text">Alapadatok</div>
        {rows.map(([k, v]) => (
          <ListRow key={k} className="px-0" title={<span className="text-ui-muted">{k}</span>} trailing={<span className="text-ui-body text-ui-text">{v}</span>} />
        ))}
        <div className="mt-4 text-ui-body text-ui-text">Statisztika</div>
        {stats.map(([k, v, w, tone]) => (
          <div key={k} className="mt-2.5">
            <div className="mb-1 flex justify-between text-ui-meta"><span className="text-ui-muted">{k}</span><span className="text-ui-text">{v}</span></div>
            <MiniBar pct={w} tone={tone} />
          </div>
        ))}
      </div>
      {/* hívás: a kártya legalján, teljes szélességben */}
      <div className="mt-auto space-y-1.5 px-5 pb-5">
        {onEdit && <Button icon={Pencil} className="w-full" onClick={onEdit}>Szerkesztés</Button>}
        <Button variant="yellow" icon={Phone} className="w-full" href={phone ? `tel:${phone.replace(/\s/g, '')}` : undefined} disabled={phone === null}>Hívás</Button>
      </div>
    </div>
  )
}

/** A heti rács egy sora: cellánként a műszak ideje (`'9–17'`), vagy `'B'` beteg, `'S'` szabadság, `'X'` szabadnap /
 *  nincs beosztva (csíkos). `keys`: a cellák kulcsa (élőben a dátum — kattintásra a nap-szerkesztő). */
export type WeekRow = { id: string; name: string; img?: string | null; d: string[]; h: string }
const SAMPLE_WEEK_ROWS: WeekRow[] = [
  { id: 'v', name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp', d: ['9–17', '9–17', 'S', '12–20', '9–17', 'X', 'X'], h: '32 / 40' },
  { id: 'c', name: 'Csaba', img: '/landing/funkciok/csapat/avatar/csaba.webp', d: ['10–18', 'B', 'B', '10–18', '10–18', '9–14', 'X'], h: '29 / 40' },
  { id: 's', name: 'Szabina', img: '/landing/funkciok/csapat/avatar/szabina.webp', d: ['9–13', '9–13', '9–13', 'X', '9–13', 'X', 'X'], h: '16 / 20' },
  { id: 'd', name: 'Dávid', img: '/landing/funkciok/csapat/avatar/dave.webp', d: ['X', '12–20', '12–20', '12–20', '12–22', '9–14', 'X'], h: '39 / 40' },
]
const SAMPLE_WEEK_DAYS = ([['H', 3], ['K', 4], ['Sze', 5], ['Cs', 6], ['P', 7], ['Szo', 8], ['V', 9]] as const).map(([d, n]) => ({ d, n, today: n === 5, closed: n > 7 }))

/** 11.2: heti beosztás — munkatárs × nap, műszak sárga, beteg sötét, szabadság szürke, szabadnap csíkos; a mai oszlop
 *  kiemelve, a sor végén a heti óra / szerződött óra. `compact`: csak H–P (keskeny helyre, pl. landing). Élőben:
 *  `range` (a hét), `onStep`, `total`, `days`, `rows`, `onCell(rowId, dayIndex)`. */
export function WeekSchedule({ compact = false, range = 'Nov. 3–9.', onStep, total = '142 ó', days = SAMPLE_WEEK_DAYS, rows = SAMPLE_WEEK_ROWS, onCell, action, slideDir = 0, className = '' }: {
  compact?: boolean
  /** hét-váltáskor a rács becsúszik (mint a többi lapozásnál): 1 előre, -1 vissza, 0 nincs */
  slideDir?: number
  range?: string
  onStep?: (dir: -1 | 1) => void
  total?: string
  days?: { d: string; n: number; today?: boolean; closed?: boolean }[]
  rows?: WeekRow[]
  onCell?: (rowId: string, day: number) => void
  /** jobb felül a heti összes mellett (élőben a szerkesztés) */
  action?: React.ReactNode
  className?: string
}) {
  const n = compact ? 5 : 7
  const todayIdx = days.findIndex((x) => x.today)
  // hét-váltáskor csak a napok (dátumsor + cellák) csúsznak be — a nevek és az óra-oszlop állnak
  const slide = slideDir ? { cls: 'ui-slide-in', style: { ['--dx' as string]: `${slideDir * 56}px` } } : { cls: '', style: undefined }
  return (
    // mobilon (sm alatt) mint a Foglalások hete: a lap fehér, a rács saját dobozban görgethető (dátumsor fent, nevek bal
    // oldalt ragadósak, a név-oszlopban csak az avatar), és a mai napra görget
    <Card className={`max-sm:bg-white ${className}`}>
      {/* mobilon a hét-váltó egy sorban, tördelés nélkül (hónapközi hétnél is: „Okt. 26. – Nov. 1.”), a heti összes alatta */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2">
          <IconButton icon={ArrowLeft} label="Előző" size="sm" onClick={onStep && (() => onStep(-1))} />
          <span className="whitespace-nowrap text-ui-title text-ui-text">{range}</span>
          <IconButton icon={ArrowRight} label="Következő" size="sm" onClick={onStep && (() => onStep(1))} />
        </span>
        <span className="flex items-center gap-3"><span className="whitespace-nowrap text-ui-meta text-ui-muted">Heti összes: <span className="text-ui-text">{total}</span></span>{action}</span>
      </div>
      <TodayScroller k={`${range}|${todayIdx}`} className="overflow-x-auto max-sm:max-h-[70dvh] max-sm:overflow-y-auto">
      <div className={`relative grid gap-1.5 text-ui-meta ${compact ? 'grid-cols-[110px_repeat(5,minmax(0,1fr))_64px]' : 'min-w-[760px] grid-cols-[150px_repeat(7,minmax(0,1fr))_80px] max-sm:min-w-[560px] max-sm:grid-cols-[44px_repeat(7,minmax(0,1fr))_56px]'}`}>
        <span data-first-col className={`${WK_STICKY} ${WK_TOP} max-sm:z-30`} />
        {days.slice(0, n).map((x) => <span key={`${range}|${x.n}`} data-today={x.today || undefined} className={WK_TOP}><span className={`block ${slide.cls}`} style={slide.style}><DayHead d={x.d} n={x.n} today={x.today} closed={x.closed} /></span></span>)}
        <span className={`self-end text-right text-ui-muted ${WK_TOP}`}>Óra</span>
        {rows.map((r) => (
          <Fragment key={r.id}>
            <span className={`flex items-center gap-2 py-1 ${WK_STICKY}`} title={r.name}>
              <Avatar size="sm" src={r.img ?? null} name={r.name} />
              <MarqueeText className="text-ui-body text-ui-text max-sm:hidden">{r.name}</MarqueeText>
            </span>
            {r.d.slice(0, n).map((c, i) => {
              const cls = `flex h-11 items-center justify-center overflow-hidden rounded-ui-control ${c === 'B' || c === 'S' ? (compact ? 'px-1 text-ui-label' : 'text-ui-meta max-sm:text-ui-label') : 'text-ui-meta'} ${c === 'X' ? 'ui-hatch-cell-dense' : c === 'B' ? 'bg-ui-dark text-white' : c === 'S' ? 'bg-white text-ui-dark ring-1 ring-inset ring-ui-divider' : 'bg-ui-yellow text-ui-dark'} ${i === todayIdx ? 'ring-1 ring-ui-dark/30' : ''}`
              const body = c === 'X' ? '' : c === 'B' ? 'Beteg' : c === 'S' ? 'Szabadság' : c
              return onCell
                ? <button key={`${range}|${i}`} type="button" onClick={() => onCell(r.id, i)} style={slide.style} className={`${cls} ${slide.cls} outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{body}</button>
                : <span key={`${range}|${i}`} style={slide.style} className={`${cls} ${slide.cls}`}>{body}</span>
            })}
            <span className="flex items-center justify-end text-ui-body text-ui-text">{r.h}</span>
          </Fragment>
        ))}
      </div>
      </TodayScroller>
    </Card>
  )
}

/** A heti beosztás mobilon: a név-oszlop bal oldalt, a dátumsor fent ragadós (a görgető dobozban), fehér alappal. */
const WK_STICKY = 'max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:bg-white'
const WK_TOP = 'max-sm:sticky max-sm:top-0 max-sm:z-20 max-sm:bg-white'

/** Feltöltött táppénzes papír (orvosi igazolás): fájl-ikon, név, méret, letöltés és törlés. A nap-szerkesztő Beteg
 *  típusa (11.5) és a mobil részlet-kártya (11.7, `onDark`) is ezt mutatja. Élőben: `name`, `meta`, `href` (letöltés),
 *  `onDelete`; ha nincs még papír, `onUpload`-dal a feltöltés sora. */
export function SickNoteFile({ onDark = false, name = 'tappenz-viktoria-nov11.pdf', meta = 'Orvosi igazolás · PDF · 240 KB', href, onDelete, onUpload, busy = false, className = '' }: { onDark?: boolean; name?: string | null; meta?: string; href?: string; onDelete?: () => void; onUpload?: (file: File) => void; busy?: boolean; className?: string }) {
  if (!name && onUpload) {
    return (
      <ListRow filled className={`bg-ui-cell ${className}`} leading={<IconCircle tone="white" size="md" icon={Upload} />}
        title="Táppénzes papír feltöltése" meta="PDF vagy fotó · legfeljebb 10 MB"
        trailing={<label className="cursor-pointer"><input type="file" accept="application/pdf,image/*" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} /><Pill tone="white" size="sm">{busy ? 'Feltöltés…' : 'Fájl választása'}</Pill></label>} />
    )
  }
  return (
    <ListRow filled className={`${onDark ? 'bg-white/10' : 'bg-ui-cell'} ${className}`} leading={<IconCircle tone={onDark ? 'onDark' : 'white'} size="md" icon={FileText} />}
      title={<span className={onDark ? 'text-white' : ''}>{name}</span>} meta={<span className={onDark ? 'text-white/55' : ''}>{meta}</span>}
      trailing={<span className="flex gap-1">
        <IconButton icon={Download} label="Letöltés" variant={onDark ? 'onDark' : 'glass'} size="sm" href={href} />
        {!onDark && <IconButton icon={X} label="Törlés" variant="glass" size="sm" onClick={onDelete} disabled={busy} />}
      </span>} />
  )
}

/** A nap-szerkesztő értékei: típus (0 = Műszak, 1 = Szabadság, 2 = Beteg, 3 = Szabadnap), műszaknál az idő, a szünet
 *  („12:30–13:00”, több vesszővel) és az ismétlés (be = minden munkanapján, ki = csak erre a napra); távollétnél a
 *  tól–ig, fizetett, megjegyzés. */
export type DayEditorValue = { type: number; start: string; end: string; breaks: string; repeat: boolean; from: string; to: string; paid: boolean; note: string }
const SAMPLE_EDITOR: Record<number, DayEditorValue> = {
  0: { type: 0, start: '09:00', end: '17:00', breaks: '12:30–13:00', repeat: true, from: '', to: '', paid: false, note: '' },
  1: { type: 1, start: '', end: '', breaks: '', repeat: false, from: 'Nov. 17.', to: 'Nov. 19.', paid: true, note: 'Családi út — a heti festéseket Szabina viszi.' },
  2: { type: 2, start: '', end: '', breaks: '', repeat: false, from: 'Nov. 11.', to: 'Nov. 12.', paid: true, note: 'Influenza — orvosnál volt, két nap pihenés.' },
}

/** 11.5: nap-szerkesztő popup — `type` 0 = Műszak (idő, szünet, ismétlés), 1 = Szabadság (tól–ig, fizetett, az éves
 *  keretből hátralévő napok, megjegyzés), 2 = Beteg (tól–ig, fizetett, megjegyzés, táppénzes papír — a könyvelő a havi
 *  exporttal kapja), 3 = Szabadnap (tól–ig, megjegyzés). Props nélkül minta; élőben `value` / `onChange` és a többi.
 *  `people` / `onPerson`: ha a napot nem egy emberre nyitották (csapat-nézet), itt választható, kié. */
export function DayEditor({ type = 0, bare = false, person = { name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp' }, dateLabel, people, personId, onPerson, value, onChange, shiftHint = '7,5 óra · ezen a napon 3 foglalása van', leaveHint = 'Éves keret: 21 nap · ezzel 15 marad', warn, file, extra, dateInput, timeInput, breaksInput, onSave, onCancel, onDelete, busy = false, className = '' }: {
  type?: number
  bare?: boolean
  person?: { name: string; img?: string | null } | null
  dateLabel?: string
  people?: { id: string; name: string; img?: string | null; disabled?: boolean; title?: string }[]
  personId?: string | null
  onPerson?: (id: string) => void
  value?: DayEditorValue
  onChange?: (v: DayEditorValue) => void
  shiftHint?: React.ReactNode
  leaveHint?: React.ReactNode
  warn?: React.ReactNode
  file?: React.ReactNode
  extra?: React.ReactNode
  /** élő dátum-mező (a kit felugró naptára) a tól–ig mezőkhöz — nélküle szöveg */
  dateInput?: (k: 'from' | 'to', value: string, set: (v: string) => void) => React.ReactNode
  /** élő idő-mező (a kit időválasztója) a kezdéshez / véghez */
  timeInput?: (k: 'start' | 'end', value: string, set: (v: string) => void) => React.ReactNode
  /** élő szünet-mező(k) (kezdés–vége párok) */
  breaksInput?: (value: string, set: (v: string) => void) => React.ReactNode
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  busy?: boolean
  className?: string
}) {
  const Box = bare ? 'div' : Panel
  const v = value ?? SAMPLE_EDITOR[type] ?? SAMPLE_EDITOR[1]
  const live = !!onChange
  const set = (patch: Partial<DayEditorValue>) => onChange?.({ ...v, ...patch })
  const field = (k: 'start' | 'end' | 'breaks' | 'from' | 'to', placeholder?: string) => (k === 'from' || k === 'to') && dateInput
    ? dateInput(k, v[k], (val) => set({ [k]: val }))
    : (k === 'start' || k === 'end') && timeInput
      ? <span className="block w-[220px] max-w-full">{timeInput(k, v[k], (val) => set({ [k]: val }))}</span>
      : k === 'breaks' && breaksInput
        ? breaksInput(v.breaks, (val) => set({ breaks: val }))
        : <Input size="sm" value={v[k]} readOnly={!live} placeholder={placeholder} inputMode={k === 'start' || k === 'end' ? 'numeric' : undefined} onChange={live ? (e) => set({ [k]: e.target.value }) : undefined} className="w-[220px] max-w-full" />
  const paid = live ? <Switch checked={v.paid} onChange={(on) => set({ paid: on })} ariaLabel="Fizetett" /> : <MockSwitch defaultOn={v.paid} />
  const t = v.type
  return (
    <Box {...(bare ? {} : { pad: 'lg' as const, size: 'md' as const })} className={className}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          {person ? <Avatar size="md" src={person.img ?? null} name={person.name} /> : <IconCircle tone="cell" size="md" icon={UserRound} />}
          <span><span className="block text-ui-row text-ui-text">{person?.name ?? 'Kinek?'}</span><span className="block text-ui-meta text-ui-muted">{dateLabel ?? (type === 2 ? 'Kedd, Nov. 11.' : 'Csütörtök, Nov. 6.')}</span></span>
        </span>
        <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onCancel} />
      </div>
      {people && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {people.map((p) => (
            <button key={p.id} type="button" disabled={p.disabled} title={p.title ?? p.name} onClick={onPerson && (() => onPerson(p.id))} aria-pressed={personId === p.id} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-not-allowed disabled:opacity-50">
              <Pill tone={personId === p.id ? 'dark' : 'cell'} className="pl-1"><Avatar size="xs" src={p.img ?? null} name={p.name} />{p.name}</Pill>
            </button>
          ))}
        </div>
      )}
      <Segmented tone="cell" full className="mt-5" options={['Műszak', 'Szabadság', 'Beteg', 'Szabadnap']} active={t} onSelect={live ? (i) => set({ type: i }) : undefined} />
      {t === 0 ? (
        <>
          <div className="mt-3">
            <FieldRow label="Kezdés">{field('start', '09:00')}</FieldRow>
            <FieldRow label="Vége">{field('end', '17:00')}</FieldRow>
            <FieldRow label="Szünet">{field('breaks', 'nincs (pl. 12:30–13:00)')}</FieldRow>
            <FieldRow label="Minden munkanapján" hint={v.repeat ? 'Az idő és a szünet minden napjára, amikor dolgozik' : 'Csak erre a napra (egyedi)'}>
              {live ? <Switch checked={v.repeat} onChange={(on) => set({ repeat: on })} ariaLabel="Minden munkanapján" /> : <MockSwitch defaultOn={v.repeat} />}
            </FieldRow>
            {extra}
          </div>
          {shiftHint && <Meta className="mt-2">{shiftHint}</Meta>}
        </>
      ) : (
        <>
          <div className="mt-3">
            <FieldRow label="Ettől">{field('from')}</FieldRow>
            <FieldRow label="Eddig">{field('to')}</FieldRow>
            {t !== 3 && <FieldRow label={t === 2 ? 'Fizetett (táppénz)' : 'Fizetett'} hint={t === 1 ? leaveHint : undefined}>{paid}</FieldRow>}
            <FieldRow label="Megjegyzés" stacked><Textarea rows={2} value={v.note} readOnly={!live} onChange={live ? (e) => set({ note: e.target.value }) : undefined} className="w-full" /></FieldRow>
            {t === 2 && (
              <FieldRow label="Táppénzes papír" hint="A havi exportban a könyvelő egyben letölti" stacked>
                {file ?? <SickNoteFile className="w-full" />}
              </FieldRow>
            )}
            {extra}
          </div>
          {warn !== undefined ? warn : t !== 3 && <Note warn className="mt-2">{t === 2 ? '2 nap · erre az időre 4 foglalása van' : '3 nap · erre az időre 5 foglalása van'} — áthelyezed őket? <span className="whitespace-nowrap underline underline-offset-4">Foglalások áthelyezése</span></Note>}
        </>
      )}
      <div className="mt-5 flex gap-1.5">
        <Button className="flex-1" onClick={onSave} disabled={busy}>{busy ? 'Mentés…' : 'Mentés'}</Button>
        <Button variant="cell" onClick={onCancel}>Mégse</Button>
        {onDelete && <IconButton icon={Trash2} label="Bejegyzés törlése" variant="cell" className="text-ui-bad" onClick={onDelete} disabled={busy} />}
      </div>
    </Box>
  )
}

/** Egy sor a bér-összesítőben: munkatárs, óra × díj (vagy „havi bér”), borravaló, összesen. */
export type PayrollRow = { id: string; name: string; img?: string | null; h: string; t: string; s: string }
const SAMPLE_PAYROLL: PayrollRow[] = [
  { id: 'v', name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp', h: '142 × 2 400', t: '64 000', s: '404 800' },
  { id: 'c', name: 'Csaba', img: '/landing/funkciok/csapat/avatar/csaba.webp', h: '120 × 2 200', t: '58 000', s: '322 000' },
  { id: 's', name: 'Szabina', img: '/landing/funkciok/csapat/avatar/szabina.webp', h: '80 × 1 900', t: '—', s: '152 000' },
]

/** 11.3 bal: a hónap bérköltsége, csík (bér / borravaló / túlóra), munkatársanként óra × díj, borravaló, összesen.
 *  Élőben: `month`, `total`, `segments`, `rows`, `onExport` (Bérlista CSV). */
export function Payroll({ month = 'November', total = '1 284 000 Ft', segments = [{ label: 'Bér', value: '1 002 000', weight: 70, tone: 'dark' }, { label: 'Borravaló', value: '206 000', weight: 17, tone: 'yellow' }, { label: 'Túlóra', value: '76 000', weight: 13, tone: 'grey' }], rows = SAMPLE_PAYROLL, onExport, empty, className = '' }: {
  month?: string
  total?: string
  segments?: { label: string; value: string; weight: number; tone: 'dark' | 'yellow' | 'grey' }[]
  rows?: PayrollRow[]
  onExport?: () => void
  /** ha még senkinek nincs bére: a csík helyett ez (pl. hová lehet beírni) */
  empty?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="text-ui-meta text-ui-muted">Bérköltség · {month}</div><div className="text-ui-num font-light leading-none text-ui-text">{total}</div></div>
        <Button variant="glass" onClick={onExport}><Download className="h-4 w-4" /> Bérlista</Button>
      </div>
      {empty ? <Note className="mt-4">{empty}</Note> : <SegmentBar size="md" className="mt-4" segments={segments} />}
      <div className="mt-5 grid grid-cols-[1fr_90px_90px_100px] text-ui-meta text-ui-muted">
        <span className="px-1 pb-2">Munkatárs</span><span className="pb-2 text-right">Óra × díj</span><span className="pb-2 text-right">Borravaló</span><span className="pb-2 text-right">Összesen</span>
        {rows.map((r) => (
          <Fragment key={r.id}>
            <span className="flex min-w-0 items-center gap-2 border-t border-dashed border-ui-divider px-1 py-2.5">
              <Avatar size="xs" src={r.img ?? null} name={r.name} />
              <MarqueeText className="text-ui-body text-ui-text">{r.name}</MarqueeText>
            </span>
            <span className="flex items-center justify-end border-t border-dashed border-ui-divider text-ui-muted">{r.h}</span>
            <span className="flex items-center justify-end border-t border-dashed border-ui-divider text-ui-text">{r.t}</span>
            <span className="flex items-center justify-end border-t border-dashed border-ui-divider text-ui-body text-ui-text">{r.s === '—' ? r.s : `${r.s} Ft`}</span>
          </Fragment>
        ))}
      </div>
    </Card>
  )
}

/** Egy sor a napi borravaló-elosztásban: `amount` null = nem jogosult. */
export type TipRow = { id: string; name: string; img?: string | null; amount: string | null }
const SAMPLE_TIPS: TipRow[] = [
  { id: 'v', name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp', amount: '12 000' },
  { id: 'c', name: 'Csaba', img: '/landing/funkciok/csapat/avatar/csaba.webp', amount: '12 000' },
  { id: 'd', name: 'Dávid', img: '/landing/funkciok/csapat/avatar/dave.webp', amount: '12 000' },
  { id: 's', name: 'Szabina', img: '/landing/funkciok/csapat/avatar/szabina.webp', amount: null },
]

/** 11.3 jobb: a napi borravaló elosztása (sötét kártya). Élőben: `day` (a nap felirata), `total`, `rows`. */
export function TipSplit({ day = 'Péntek, Nov. 7.', total = '36 000 Ft', rows = SAMPLE_TIPS, className = '' }: { day?: string; total?: string; rows?: TipRow[]; className?: string }) {
  return (
    <Card tone="dark" className={className}>
      <div className="text-ui-row">Napi borravaló</div>
      <div className="mt-0.5 text-ui-label text-white/50">{day} · egyenlően a jogosultak közt</div>
      <div className="mt-4 text-ui-num font-light leading-none text-ui-yellow">{total}</div>
      {rows.length === 0 && <div className="mt-3 border-t border-white/10 pt-3 text-ui-meta text-white/50">Ezen a napon senki nem dolgozik.</div>}
      {rows.map((r) => r.amount != null ? (
        <div key={r.id} className="mt-3 flex items-center gap-2.5 border-t border-white/10 pt-3 text-ui-body">
          <Avatar size="xs" src={r.img ?? null} name={r.name} />
          <MarqueeText className="flex-1">{r.name}</MarqueeText><span>{r.amount} Ft</span>
        </div>
      ) : (
        <div key={r.id} className="mt-3 flex items-center gap-2.5 border-t border-white/10 pt-3 text-ui-body text-white/40">
          <Avatar size="xs" src={r.img ?? null} name={r.name} className="opacity-50 grayscale" />
          <MarqueeText className="flex-1">{r.name}</MarqueeText>
          <Pill tone="onDark" size="sm">Nem jogosult</Pill>
        </div>
      ))}
    </Card>
  )
}

/** Egy munkatárs a mobil nap-listában: `kind` = műszak (sárga, az idővel), beteg (sötét), szabadság (szürke), szabadnap.
 *  `note`: a beírt megjegyzés (a pozíció után), `file`: betegnél a táppénzes papír letöltése. */
export type DayShiftRow = { key: string; name: string; img?: string | null; role: string; kind: 'shift' | 'sick' | 'leave' | 'off' | 'none'; time?: string; note?: string | null; file?: string | null }
const SAMPLE_DAY_SALON: DayShiftRow[] = ([['viktoria', 'Viktória', 'Stylist', '', 'leave'], ['csaba', 'Csaba', 'Barber', '', 'sick'], ['szabina', 'Szabina', 'Recepció', '9–13', 'shift'], ['dave', 'Dávid', 'Tulajdonos', '12–20', 'shift']] as const).map(([img, n, r, t, k]) => ({ key: n, name: n, img: `/landing/funkciok/csapat/avatar/${img}.webp`, role: r, kind: k, time: t }))
const SAMPLE_DAY_REST: DayShiftRow[] = ([['csaba', 'Csaba', 'Pincér', '16–23', 'shift'], ['dave', 'Dávid', 'Szakács', '14–22', 'shift'], ['szabina', 'Szabina', 'Hostess', '18–23', 'shift'], ['viktoria', 'Viktória', 'Pultos', '', 'off']] as const).map(([img, n, r, t, k]) => ({ key: n, name: n, img: `/landing/funkciok/csapat/avatar/${img}.webp`, role: r, kind: k, time: t }))
/** Egy nap-sor (mobil lista és a csapat-nézet jobb oszlopa): a megjegyzés a pozíció után, a papír letöltése a pill előtt.
 *  Élőben (`onPick`) az egész sor kattintható; a letöltés nem nyitja meg a szerkesztőt. */
function DayRow({ r, onPick, flush = false }: { r: DayShiftRow; onPick?: (key: string) => void; flush?: boolean }) {
  const file = r.file ? <span onClick={onPick ? (e) => e.stopPropagation() : undefined}><IconButton icon={FileText} label="Táppénzes papír letöltése" variant="glass" size="sm" href={r.file} /></span> : null
  const row = <ListRow className={flush ? 'px-0' : undefined} leading={<Avatar size="sm" src={r.img ?? null} name={r.name} />} title={r.name} meta={r.note ? `${r.role} · ${r.note}` : r.role} trailing={<span className="flex items-center gap-1.5">{file}{DAY_TAG[r.kind](r.time)}</span>} />
  return onPick
    ? <div role="button" tabIndex={0} onClick={() => onPick(r.key)} onKeyDown={(e) => { if (e.key === 'Enter') onPick(r.key) }} className={`block w-full cursor-pointer text-left outline-none ${flush ? '' : 'rounded-ui-inner transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ui-dark/20'}`}>{row}</div>
    : <div>{row}</div>
}
const DAY_TAG: Record<DayShiftRow['kind'], (t?: string) => React.ReactNode> = { shift: (t) => <Pill tone="yellow" size="sm">{t}</Pill>, sick: () => <Pill tone="dark" size="sm">Beteg</Pill>, leave: () => <Pill tone="grey" size="sm">Szabadság</Pill>, off: () => <Pill tone="hatchCell" size="sm">Szabadnap</Pill>, none: () => <span className="text-ui-label text-ui-muted">nincs beosztva</span> }

/** Mobil (11.7): egy nap beosztása munkatársanként — fent a Foglalások mobil nap-csíkja, soronként avatar, név, a
 *  műszak (sárga), beteg (sötét), szabadság (szürke) vagy szabadnap; alul a nap összes órája. Élőben: `strip` (a nap-csík),
 *  `rows`, `foot`, `onPick`. */
export function DayShiftList({ restaurant = false, strip, rows, foot, onPick, action }: { restaurant?: boolean; strip?: React.ReactNode; rows?: DayShiftRow[]; foot?: string; onPick?: (key: string) => void; action?: React.ReactNode }) {
  const list = rows ?? (restaurant ? SAMPLE_DAY_REST : SAMPLE_DAY_SALON)
  return (
    <>
      <Card className="mt-4">
        {strip ?? <MobileDayStrip n={5} label="Szerda, Nov. 5." />}
        <div className="mt-3">
          {list.length === 0 && <Meta className="py-3">Erre a napra nincs beosztás.</Meta>}
          {list.map((r) => <DayRow key={r.key} r={r} onPick={onPick} flush />)}
        </div>
      </Card>
      <div className="mt-2 flex items-center justify-between gap-2 px-1">
        <Meta>{foot ?? (restaurant ? 'Ma 23 óra · 3 fő dolgozik' : 'Ma 11,5 óra · 2 fő dolgozik, 1 beteg, 1 szabadságon')}</Meta>
        {action}
      </div>
    </>
  )
}

/** A kiválasztott nap munkatársai (a Naptár csapat-nézetének jobb oszlopa): ugyanazok a sorok, mint a mobil nap-listán
 *  (11.7) — ki dolgozik (sárga, idővel), ki beteg / szabadságon, kinek nincs beosztása; sorra kattintva a nap-szerkesztő. */
export function DayStaffCard({ title, sub, rows, onPick, action, className = '' }: { title: string; sub?: string; rows: DayShiftRow[]; onPick?: (key: string) => void; action?: React.ReactNode; className?: string }) {
  return (
    <Card pad="xs" className={className}>
      <div className="flex items-start justify-between gap-2 px-3 pb-1 pt-2">
        <span><span className="block text-ui-row text-ui-text">{title}</span>{sub && <span className="block text-ui-meta text-ui-muted">{sub}</span>}</span>
        {action}
      </div>
      {rows.map((r) => <DayRow key={r.key} r={r} onPick={onPick} />)}
    </Card>
  )
}

/** Dátumválasztó (mobil lapokon és szűrőkben): hónap-léptető, H–V fejléc, a napok körben. Egy nap (`from`) vagy
 *  tartomány (`from`–`to`): a két vég sötét, köztük cella-szín. `weeks`: csak az első n hét (szűk helyre). A Foglalások
 *  nézet-lapja (6.11) és a Marketing szűrése (13.7) is ez. 2026. november: 1-je vasárnap. */
export function MiniMonth({ from, to, weeks = 6, className = '' }: { from: number; to?: number; weeks?: number; className?: string }) {
  const cells = Array.from({ length: weeks * 7 }, (_, i) => i - 5) // az első sor Okt. 26-tól (H)
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <IconButton icon={ArrowLeft} label="Előző hónap" size="sm" variant="cell" />
        <span className="text-ui-body text-ui-text">2026. November</span>
        <IconButton icon={ArrowRight} label="Következő hónap" size="sm" variant="cell" />
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-ui-label">
        {['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((d, i) => <span key={d} className={i > 4 ? 'text-ui-bad-dot' : 'text-ui-muted'}>{d}</span>)}
        {cells.map((n, i) => {
          const out = n < 1 || n > 30
          const end = !out && (n === from || n === to)
          const inside = !out && to !== undefined && n > from && n < to
          return (
            <span key={i} className={`flex h-9 items-center justify-center text-ui-meta ${inside ? 'bg-ui-cell' : ''} ${inside && i % 7 === 0 ? 'rounded-l-full' : ''} ${inside && i % 7 === 6 ? 'rounded-r-full' : ''}`}>
              {end ? <IconCircle size="md">{n}</IconCircle> : <span className={out ? 'text-ui-muted/50' : 'text-ui-text'}>{out ? (n < 1 ? 31 + n : n - 30) : n}</span>}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Időszak-választó (szűrők, export): gyors-gombok, Egyedinél -tól / -ig mező és a dátumválasztó (MiniMonth). `single`:
 *  egy nap (pl. Vendégek „Adott nap”). Egy elem — a Marketing szűrés, az Export, a Statisztikák és a Vendégek is ez. */
export function PeriodPicker({ presets = ['30 nap', 'Év', 'Mind', 'Egyedi'], active, from = 3, to = 21, single = false, live, className = '' }: {
  presets?: string[]
  active?: number
  from?: number
  to?: number
  single?: boolean
  /** élőben: a kijelölt nap / időszak (`YYYY-MM-DD`), a nap választása a naptárban és a gyors-gomb — a naptár az élő
   *  MonthPicker (a design MiniMonth-ja) */
  live?: { from: string; to?: string; onPick: (d: string) => void; onPreset?: (i: number) => void }
  className?: string
}) {
  if (live) {
    const lbl = (d?: string) => { if (!d) return ''; const [y, m, dd] = d.split('-').map(Number); return `${single ? `${y}. ` : ''}${MONTHS_SHORT[m - 1]} ${dd}.` }
    // a dátum-mezők és a naptár csak „Egyedi” időszaknál (az utolsó gyors-gomb)
    const custom = (active ?? presets.length - 1) === presets.length - 1
    // egyetlen „gyors-gomb” (pl. csak Egyedi) nem kell — ilyenkor rögtön a dátumok és a naptár
    const showPresets = !single && presets.length > 1
    return (
      <div className={className}>
        {showPresets && <Segmented tone="cell" full options={presets} active={active ?? presets.length - 1} onSelect={live.onPreset} />}
        {single
          ? <Input size="sm" value={lbl(live.from)} readOnly aria-label="Nap" className="mt-2" />
          : custom && <div className={`${showPresets ? 'mt-2' : ''} grid grid-cols-2 gap-1.5`}><Input size="sm" value={lbl(live.from)} readOnly aria-label="Ettől" /><Input size="sm" value={lbl(live.to)} readOnly aria-label="Eddig" /></div>}
        {(single || custom) && <div className="mt-2"><MonthPicker value={live.from} rangeTo={single ? null : live.to} onPick={live.onPick} /></div>}
      </div>
    )
  }
  return (
    <div className={className}>
      {!single && <Segmented tone="cell" full options={presets} active={active ?? presets.length - 1} />}
      {single
        ? <Input size="sm" defaultValue={`2026. Nov. ${from}.`} aria-label="Nap" className="mt-2" />
        : <div className="mt-2 grid grid-cols-2 gap-1.5"><Input size="sm" defaultValue={`Nov. ${from}.`} aria-label="Ettől" /><Input size="sm" defaultValue={`Nov. ${to}.`} aria-label="Eddig" /></div>}
      <MiniMonth from={from} to={single ? undefined : to} className="mt-2" />
    </div>
  )
}

/** Az előnézet egy sora: cellánként `''` műszak (sárga), `'B'` beteg (sötét), `'S'` szabadság (szürke) — ezek kimaradnak —,
 *  `'X'` nem dolgozik (csíkos). `t`: cellánként a felirat (a kurzor alatt). */
/** `existing`: nem a tervben lévő ember meglévő beosztása (előzmény) — rákattintva bekerül a beosztásba */
export type ShiftPreviewRow = { id: string; name: string; img?: string | null; d: string[]; t?: string[]; existing?: boolean }
export type NewShiftValue = { people: string[]; from: string; to: string; days: boolean[]; start: string; end: string; breaks: string; template: boolean }
const SAMPLE_NEW_SHIFT: NewShiftValue = { people: ['viktoria', 'csaba'], from: 'Nov. 10.', to: 'Nov. 30.', days: [true, true, true, true, true, false, false], start: '09:00', end: '17:00', breaks: '12:30 – 13:00', template: true }
const SAMPLE_NEW_PEOPLE = [['viktoria', 'Viktória'], ['csaba', 'Csaba'], ['szabina', 'Szabina'], ['dave', 'Dávid']].map(([id, name]) => ({ id, name, img: `/landing/funkciok/csapat/avatar/${id}.webp` }))
const SAMPLE_PREVIEW_DAYS = ([['H', 10], ['K', 11], ['Sze', 12], ['Cs', 13], ['P', 14], ['Szo', 15], ['V', 16]] as const).map(([d, n]) => ({ d, n }))
const SAMPLE_PREVIEW: ShiftPreviewRow[] = [{ id: 'v', name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp', d: ['', '', '', 'S', 'S', 'X', 'X'] }, { id: 'c', name: 'Csaba', img: '/landing/funkciok/csapat/avatar/csaba.webp', d: ['', '', '', '', '', 'X', 'X'] }]

/** 11.6: „+ Beosztás” (több napra, több emberre) — desktopon kéthasábos popup, `stacked` mobilon egy hasábban (11.7).
 *  Gyors indítás (előző hét másolása, mentett sablonok), kiknek, időszak, napok, idő, szünet; jobbra élő előnézet a hétre
 *  figyelmeztetéssel (szabadság, beteg — kihagyva); alul „Mentés sablonként” és a létrehozás. Props nélkül minta. */
export function NewShiftForm({ title = 'Új beosztás', stacked = false, framed = true, dateInput, timeInput, breaksInput, onPreviewCell, previewDays = SAMPLE_PREVIEW_DAYS, onPreviewStep, previewPage, shake, quick, people = SAMPLE_NEW_PEOPLE, value, onChange, previewLabel = 'Előnézet · Nov. 10–16.', previewStats = '2 fő · 30 műszak · 225 óra', preview = SAMPLE_PREVIEW, warn = <>Viktória Nov. 13–14-én szabadságon van — ezeket a napokat kihagyjuk.</>, submitLabel = '30 műszak létrehozása', onSubmit, onCancel, busy = false }: {
  stacked?: boolean
  /** saját panel-keret (a design oldalon); egy ablakban (élőben) az ablak adja a keretet */
  framed?: boolean
  /** élő dátum-mező (a kit felugró naptára) az időszakhoz — nélküle szöveg */
  dateInput?: (k: 'from' | 'to', value: string, set: (v: string) => void) => React.ReactNode
  timeInput?: (k: 'start' | 'end', value: string, set: (v: string) => void) => React.ReactNode
  breaksInput?: (value: string, set: (v: string) => void) => React.ReactNode
  /** élőben az előnézet cellái kattinthatók: egy ember egy napja ki / be (személyenként egyedi napok) */
  onPreviewCell?: (rowId: string, day: number) => void
  /** az előnézet oszlopainak fejléce: a nap neve és a dátuma */
  previewDays?: { d: string; n: number; today?: boolean }[]
  /** az előnézet hetének lapozása (az időszakon belül) — nélküle nincs nyíl */
  onPreviewStep?: { prev?: () => void; next?: () => void }
  /** a fejléc címe — új beosztásnál „Új beosztás”, meglévő nap / sáv szerkesztésénél a szerkesztett nap */
  title?: string
  /** sok sornál az előnézet lapozója alul (a sorok a hívótól már lapozva jönnek) */
  previewPage?: { page: number; pages: number; onPage: (p: number) => void }
  /** az épp hozzáadott ember: az ütköző (beteg / szabadság) napjai megrezegnek; `n` minden hozzáadáskor nő (újraindítja) */
  shake?: { row: string; n: number } | null
  quick?: { label: string; on?: boolean; undo?: boolean; onClick?: () => void; onDelete?: () => void }[]
  people?: { id: string; name: string; img?: string | null; disabled?: boolean; title?: string }[]
  value?: NewShiftValue
  onChange?: (v: NewShiftValue) => void
  previewLabel?: string
  previewStats?: string
  preview?: ShiftPreviewRow[]
  warn?: React.ReactNode
  submitLabel?: string
  onSubmit?: () => void
  onCancel?: () => void
  busy?: boolean
}) {
  const Box = stacked || !framed ? 'div' : Panel
  const v = value ?? SAMPLE_NEW_SHIFT
  const live = !!onChange
  const set = (patch: Partial<NewShiftValue>) => onChange?.({ ...v, ...patch })
  const q = quick ?? [{ label: 'Előző hét másolása', on: true, undo: true }, { label: 'Sablon: Alap hét' }, { label: 'Sablon: Ünnepi' }]
  const inp = (k: 'from' | 'to' | 'start' | 'end' | 'breaks', placeholder?: string, cls = 'w-[105px]') => (k === 'from' || k === 'to') && dateInput
    ? dateInput(k, v[k], (val) => set({ [k]: val }))
    : (k === 'start' || k === 'end') && timeInput
      ? <span className={`block ${cls}`}>{timeInput(k, v[k], (val) => set({ [k]: val }))}</span>
      : k === 'breaks' && breaksInput
        ? breaksInput(v.breaks, (val) => set({ breaks: val }))
        : <Input size="sm" value={v[k]} readOnly={!live} placeholder={placeholder} inputMode={k === 'start' || k === 'end' ? 'numeric' : undefined} onChange={live ? (e) => set({ [k]: e.target.value }) : undefined} className={cls} />
  return (
    <Box {...(stacked || !framed ? {} : { pad: 'lg' as const, size: 'lg' as const, className: 'mx-auto' })}>
      <div className="flex items-center justify-between">
        <span className="text-ui-sub font-light text-ui-text">{title}</span>
        {!stacked && <IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onCancel} />}
      </div>
      <div className={stacked ? '' : 'grid gap-x-6 lg:grid-cols-2'}>
        <div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {q.map((x) => {
              const pill = <Pill tone={x.on ? 'yellow' : 'cell'}>{x.undo && <Undo2 className="h-3.5 w-3.5" />}{x.label}</Pill>
              // mentett sablon: a pill végén X-szel törölhető
              if (x.onClick && x.onDelete) return (
                <Pill key={x.label} tone={x.on ? 'yellow' : 'cell'} className="pr-1">
                  <button type="button" onClick={x.onClick} className="outline-none focus-visible:underline">{x.label}</button>
                  <button type="button" onClick={x.onDelete} aria-label={`${x.label} törlése`} className="grid h-5 w-5 place-items-center rounded-full outline-none transition-colors hover:bg-white focus-visible:bg-white"><X className="h-3 w-3" /></button>
                </Pill>
              )
              return x.onClick ? <button key={x.label} type="button" onClick={x.onClick} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button> : <span key={x.label}>{pill}</span>
            })}
          </div>

          <Meta className="mt-5">Kiknek</Meta>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {people.map((p) => {
              const on = v.people.includes(p.id)
              const pill = <Pill tone={on ? 'dark' : 'cell'} size="lg" className="pl-1.5"><Avatar src={p.img ?? null} name={p.name} size="sm" />{p.name}{on && <Check className="h-3.5 w-3.5" />}</Pill>
              return live
                ? <button key={p.id} type="button" disabled={p.disabled} title={p.title} onClick={() => set({ people: on ? v.people.filter((x) => x !== p.id) : [...v.people, p.id] })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-not-allowed disabled:opacity-50">{pill}</button>
                : <span key={p.id}>{pill}</span>
            })}
          </div>

          <FieldRow label="Időszak" className="mt-4"><span className="flex gap-1.5">{inp('from')}{inp('to')}</span></FieldRow>
          <FieldRow label="Napok" stacked={stacked}>
            <span className="flex gap-1">{['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((d, j) => {
              const c = <IconCircle size="md" tone={v.days[j] ? 'dark' : 'cell'} className="text-ui-label">{d}</IconCircle>
              return live ? <button key={d} type="button" aria-pressed={v.days[j]} onClick={() => set({ days: v.days.map((x, k) => (k === j ? !x : x)) })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{c}</button> : <span key={d}>{c}</span>
            })}</span>
          </FieldRow>
          <FieldRow label="Idő"><span className="flex gap-1.5">{inp('start', '09:00')}{inp('end', '17:00')}</span></FieldRow>
          <FieldRow label="Szünet">{inp('breaks', 'nincs (pl. 12:30–13:00)', 'w-[220px] max-w-full')}</FieldRow>
        </div>
        <div>
          <div className="mt-4 rounded-ui-inner bg-ui-cell p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-ui-meta">
              <span className="flex items-center gap-1 text-ui-muted">
                {onPreviewStep && <IconButton icon={ArrowLeft} label="Előző hét" variant="glass" size="sm" onClick={onPreviewStep.prev} disabled={!onPreviewStep.prev} />}
                {previewLabel}
                {onPreviewStep && <IconButton icon={ArrowRight} label="Következő hét" variant="glass" size="sm" onClick={onPreviewStep.next} disabled={!onPreviewStep.next} />}
              </span>
              <span className="text-ui-text">{previewStats}</span>
            </div>
            {preview.length === 0 && <Meta className="py-2">Válaszd ki, kiknek.</Meta>}
            {onPreviewCell && preview.length > 0 && <Meta className="mb-1 text-ui-label">{preview.some((r) => !r.existing) ? 'Egy napra kattintva csak annál az embernél kapcsolod ki / be.' : 'Egy sorra kattintva az ember bekerül a beosztásba.'}</Meta>}
            {/* dátum-sor: melyik oszlop melyik nap */}
            <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] gap-1 text-center text-ui-label leading-tight">
              <span />
              {previewDays.map((x, i) => <span key={i} className={x.today ? 'text-ui-text' : 'text-ui-muted'}><span className="block">{x.d}</span><span className="block text-ui-meta text-ui-text">{x.n}</span></span>)}
            </div>
            {preview.map((r) => (
              // a meglévő beosztás (nem a tervben lévő ember) ugyanúgy színezve — rákattintva az ember bekerül a beosztásba
              <div key={r.id} title={r.existing ? `${r.name} — meglévő beosztás` : undefined} className="mt-1 grid grid-cols-[28px_repeat(7,minmax(0,1fr))] items-center gap-1">
                <Avatar size="xs" src={r.img ?? null} name={r.name} />
                {r.d.map((c, i) => {
                  // a közös színek: műszak sárga, beteg sötét, szabadság szürke, nem dolgozik csíkos
                  const cls = `h-6 rounded-ui-control ${c === 'X' ? 'ui-hatch-cell-dense' : c === 'B' ? 'bg-ui-dark' : c === 'S' ? 'bg-ui-grey' : 'bg-ui-yellow'}`
                  const title = r.t?.[i]
                  const shaking = shake && shake.row === r.id && (c === 'S' || c === 'B')
                  return onPreviewCell && (r.existing || (c !== 'S' && c !== 'B'))
                    ? <button key={i} type="button" title={r.existing ? `${r.name} hozzáadása a beosztáshoz` : title ?? (c === 'X' ? 'Beosztom erre a napra' : 'Erre a napra nem kell')} onClick={() => onPreviewCell(r.id, i)} className={`${cls} outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ui-dark/20`} />
                    : <span key={shaking ? `${i}-${shake.n}` : i} title={title} className={`${cls} ${shaking ? 'animate-ui-shake motion-reduce:animate-none' : ''}`} />
                })}
              </div>
            ))}
            {preview.length > 0 && <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"><Legend items={[['bg-ui-yellow', 'Műszak'], ['bg-ui-dark', 'Beteg'], ['bg-white', 'Szabadság']]} /><span className="flex items-center gap-1.5 text-ui-label text-ui-muted"><span className="h-2 w-3 rounded-ui-control ui-hatch-cell-dense" />Nem dolgozik</span></div>}
            {previewPage && previewPage.pages > 1 && <Pagination full page={previewPage.page} pages={previewPage.pages} onPage={previewPage.onPage} className="mt-2.5" />}
            {warn && <Note warn className="mt-2.5">{warn}</Note>}
          </div>
        </div>
      </div>

      <div className={`mt-5 flex items-center gap-1.5 ${stacked ? 'flex-wrap' : ''}`}>
        <span className={`inline-flex items-center gap-2 text-ui-meta text-ui-muted ${stacked ? 'w-full pb-2' : 'mr-auto'}`}>
          {live ? <Switch checked={v.template} onChange={(on) => set({ template: on })} ariaLabel="Mentés sablonként" /> : <MockSwitch defaultOn={v.template} />} Mentés sablonként
        </span>
        {stacked
          ? <><Button className="flex-1" onClick={onSubmit} disabled={busy}>{busy ? 'Létrehozás…' : submitLabel}</Button><Button variant="cell" onClick={onCancel}>Mégse</Button></>
          : <><Button variant="cell" onClick={onCancel}>Mégse</Button><Button variant="dark" onClick={onSubmit} disabled={busy}>{busy ? 'Létrehozás…' : submitLabel}</Button></>}
      </div>
    </Box>
  )
}
