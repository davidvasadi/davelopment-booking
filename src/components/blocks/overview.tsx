import { ArrowUpRight, Briefcase, CalendarDays, Code, Link2, MapPin, MessageSquare, Plus, QrCode, Wallet, Clock } from 'lucide-react'
import { socialIconDataUri } from '@/lib/socialLinks'
import { OverviewTimeline } from '@/components/shared/OverviewTimeline'
import { WeekBars, type WeekBar } from './charts'
import { MobileDayTimeline } from './day-timeline'
export { MobileDayTimeline, type DayRow } from './day-timeline'
import { Avatar, Button, Card, IconButton, IconCircle, Input, ListRow, Pill, TaskRow, Meta, SegmentBar, Kpi, CardTitle, MarqueeText } from '@/components/ui-kit'
import { CountText } from '@/components/ui-kit'

/* Az Áttekintés kártyái — a /design (4.1, 4.4) és a landing hero („Foglalás” funkció-oldal) is ezeket mutatja. */

export type UpBlock = { s: number; e: number; t: string; n?: string; st: string }
/** Közelgő foglalások kártya mintaadattal — az ÉLŐ idővonal (shared/OverviewTimeline), így a design (4.1, 4.6) és a
 *  landing pontosan azt mutatja, amit az app. `hours`: a látható órák; a blokkok `s`/`e`-je órában az első órától;
 *  `now`: a „most” vonal helye (0–1); `n`: létszám (étterem) — nélküle az időtartam látszik (szalon). */
export function UpcomingCard({ hours, now, rows, className, sub }: { hours: string[]; now?: number; rows: { key: string; label: React.ReactNode; blocks: UpBlock[] }[]; className?: string; sub?: string }) {
  const h0 = parseInt(hours[0], 10)
  const span = hours.length - 1
  const pax = rows.some((r) => r.blocks.some((bk) => bk.n))
  return (
    <OverviewTimeline
      className={className}
      hourMin={h0}
      hourMax={h0 + span}
      initialWin={h0}
      dayLabel={sub ? sub[0].toUpperCase() + sub.slice(1) : 'Ma'}
      nowAt={now === undefined ? undefined : Math.round((h0 + now * span) * 60)}
      badge={pax ? 'pax' : 'duration'}
      tableCol={96}
      allHref="#"
      rows={rows.map((r) => ({
        table: r.key,
        label: r.label,
        blocks: r.blocks.map((bk) => ({ id: bk.t, name: bk.t, startMin: (h0 + bk.s) * 60, endMin: (h0 + bk.e) * 60, pax: parseInt(bk.n ?? '1', 10), status: bk.st, source: 'online' })),
      }))}
    />
  )
}

/** Mai teendők (sötét kártya): a nap feladatai, a kész áthúzva sárga pipával. : alul „Új teendő” (desktop). */
export function TodayTasks({ add = false, className = '' }: { add?: boolean; className?: string }) {
  return (
    <Card tone="dark" className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between"><span className="text-ui-title">Mai teendők</span><span className="text-ui-sub font-light">1/3</span></div>
      <div className="mt-2">
        {/* a meta-sorban: ki vette fel (kis avatar) és mikorra */}
        {([[Briefcase, 'Festék-rendelés', 'dave', 'Dávid', 'ma 09:30', true], [CalendarDays, 'Hétvégi beosztás', 'szabina', 'Szabina', 'ma 13:00', false], [MessageSquare, 'Balayage-fotók posztolása', 'viktoria', 'Viktória', 'ma 16:30', false]] as const).map(([I, t, img, who, when, done]) => (
          <TaskRow key={t} icon={I} title={t} done={done} meta={<span className="inline-flex items-center gap-1.5"><Avatar size="xs" src={`/landing/funkciok/csapat/avatar/${img}.webp`} className="h-4 w-4" />{who} · {when}</span>} />
        ))}
      </div>
      {add && <Pill tone="onDark" className="mt-auto gap-2"><Plus className="h-4 w-4" />Új teendő</Pill>}
    </Card>
  )
}

/** A foglalóoldal megosztása: a link másolás-gombbal, alatta a csatornák lépésekkel (Indulás-panel, landing 3. lépés). */
export function ShareChannels({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
    <div className="flex items-center gap-1.5"><Input defaultValue="booking.davelopment.hu/fodraszat-budapest" className="min-w-0 flex-1" /><IconButton icon={Link2} label="Link másolása" variant="yellow" /></div>
    <div className="mt-3 space-y-1">
      {([
        { img: socialIconDataUri('instagram'), t: 'Instagram és Facebook', d: '„Foglalj” gomb a profilodon — Meta Business › Műveletgomb', a: 'Lépések' },
        { I: MapPin, t: 'Google Cégprofil', d: '„Időpont foglalása” a Google Térképen — Cégprofil › Foglalások', a: 'Lépések' },
        { I: Code, t: 'Saját weboldal', d: 'Beágyazható foglaló — egy kódrészlet, magától igazodik', a: 'Kód másolása' },
        { I: QrCode, t: 'Pult, kirakat, névjegy', d: 'Nyomtatható QR — beolvasva a foglalóoldal nyílik', a: 'PDF letöltése' },
      ] as { img?: string; I?: typeof MapPin; t: string; d: string; a: string }[]).map((c) => (
        <Card key={c.t} tone="cell" inner pad="sm" className="flex items-center gap-3">
          {c.img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.img} alt="" className="h-9 w-9 shrink-0 rounded-full" />
            : c.I && <IconCircle tone="dark" size="md" icon={c.I} />}
          <span className="min-w-0 flex-1"><span className="block text-ui-body text-ui-text">{c.t}</span><span className="block text-ui-label leading-snug text-ui-muted">{c.d}</span></span>
          <Button variant="glass" size="sm">{c.a}</Button>
        </Card>
      ))}
    </div>
    </div>
  )
}

/** A kiválasztott nap a hét közepén, a szomszédos napok halványulnak (mobil) — Foglalások (6.11), Naptár (11.7). */
export function MobileDayStrip({ n = 7, label = 'Péntek, Nov. 7.' }: { n?: number; label?: string }) {
  const names = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'] // 2026. Nov. 3. Hétfő
  return (
    <>
      <div className="flex items-start justify-between">
        <span><span className="block text-ui-sub font-light text-ui-text">Ma</span><span className="block text-ui-label text-ui-muted">{label}</span></span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        {[-3, -2, -1, 0, 1, 2, 3].map((o) => {
          const dist = Math.abs(o), day = n + o
          return (
            <div key={day} className="text-center text-ui-dark" style={{ opacity: [1, 0.55, 0.32, 0.16][dist] }}>
              <div className={dist === 0 ? 'text-ui-body' : 'text-ui-label'}>{names[(((day - 3) % 7) + 7) % 7]}</div>
              <div className={`font-light leading-tight ${dist === 0 ? 'text-ui-num' : 'text-ui-sub'}`}>{day}</div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/** Indulás-pill az Áttekintés címe mellett: feltűnő, de kicsi — pöttyönként egy lépés, a kész lépések sötétek.
 *  Kattintásra nyílik a panel. Ha minden lépés kész vagy kihagyva, eltűnik. */
export function StartPill({ done = 3, total = 6 }: { done?: number; total?: number }) {
  return (
    <Pill tone="yellow" size="lg" className="gap-2.5 pr-3">
      <span className="font-medium">Indulás</span>
      <span className="flex gap-1">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-2 w-2 rounded-full ${i < done ? 'bg-ui-dark' : 'bg-white/70'}`} />)}</span>
      <span>{done}/{total}</span>
      <ArrowUpRight className="h-4 w-4" />
    </Pill>
  )
}

const open = (label = 'Megnyitás') => <IconButton icon={ArrowUpRight} label={label} />

/** Üzlet-kártya fotóval (Áttekintés 4.1, csak desktopon): a borítókép, alul a név és a mai nyitvatartás a fotó-fátyolon.
 *  Fotó nélkül sötét kártya a logóval. `action`: a jobb alsó gomb (alapból ↗). */
export function PhotoCard({ img, logo, title, sub, action, className = '' }: { img?: string | null; logo?: string | null; title: string; sub?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={`relative min-h-[260px] overflow-hidden rounded-ui-card bg-ui-dark ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img && <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!img && logo && <img src={logo} alt="" className="absolute left-1/2 top-[40%] h-16 w-auto -translate-x-1/2 -translate-y-1/2 opacity-80" />}
      <div className="absolute inset-x-0 bottom-0 p-4">
        {img && <div className="ui-photo-veil pointer-events-none absolute inset-x-0 bottom-0 top-[-56px]" />}
        <div className="ui-photo-text relative flex items-center justify-between gap-2 text-white">
          <div className="min-w-0"><MarqueeText className="text-ui-title font-medium">{title}</MarqueeText>{sub && <div className="text-ui-meta text-white/85">{sub}</div>}</div>
          {action ?? <IconButton icon={ArrowUpRight} label="Megnyitás" variant="onDark" />}
        </div>
      </div>
    </div>
  )
}

/** Heti foglalások kártya (4.1 / 4.4): cím, nagy szám, alatta a napi oszlopok (a csúcsnap sárga, címkével). */
export function WeekCard({ title = 'Foglalások', total, unit = 'a héten', days, tag = (v) => `ma ${v}`, action, className = '' }: { title?: string; total: number; unit?: string; days: WeekBar[]; tag?: (v: number) => string; action?: React.ReactNode; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between"><span className="text-ui-title text-ui-text">{title}</span>{action ?? open()}</div>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-ui-num font-light text-ui-text"><CountText text={String(total)} /></span><span className="text-ui-label leading-tight text-ui-muted">{unit}</span></div>
      <WeekBars className="mt-auto h-[110px] pt-3" tag={tag} days={days} />
    </Card>
  )
}

/** Mai kihasználtság kártya (4.1 / 4.4): sárga gyűrű a százalékkal, alul két adat szaggatott vonal alatt. `dark`: sötét
 *  kártyán (pl. a Vendégek „Ma érkezik” kártyája). */
export function RingCard({ title = 'Ma', sub = 'a nyitvatartásból foglalt', pct, foot, action, dark = false, className = '' }: { title?: string; sub?: string; pct: number; foot: [React.ReactNode, React.ReactNode]; action?: React.ReactNode; dark?: boolean; className?: string }) {
  return (
    <Card tone={dark ? 'dark' : undefined} className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between"><span><span className={`block text-ui-title ${dark ? 'text-white' : 'text-ui-text'}`}>{title}</span><span className={`block text-ui-label ${dark ? 'text-white/55' : 'text-ui-muted'}`}>{sub}</span></span>{action ?? open()}</div>
      <div className="relative mx-auto mt-2 h-[120px] w-[120px]">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          {Array.from({ length: 48 }, (_, i) => { const a = (i / 48) * 2 * Math.PI; const r2 = (v: number) => Math.round(v * 100) / 100; return <line key={i} x1={r2(70 + Math.cos(a) * 50)} y1={r2(70 + Math.sin(a) * 50)} x2={r2(70 + Math.cos(a) * 55)} y2={r2(70 + Math.sin(a) * 55)} className={dark ? 'stroke-white' : 'stroke-ui-dark'} strokeOpacity=".3" strokeWidth="1.2" /> })}
          {pct > 0 && <circle className="ui-ring-draw" cx="70" cy="70" r="63" fill="none" stroke="var(--ui-yellow)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 2 * Math.PI * 63} ${2 * Math.PI * 63}`} />}
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-ui-sub font-light ${dark ? 'text-white' : 'text-ui-text'}`}><CountText text={`${pct}%`} /></div>
      </div>
      <div className={`mt-auto flex items-center justify-between gap-2 border-t border-dashed pt-3 text-ui-meta ${dark ? 'border-white/15' : 'border-ui-divider'}`}><span className={dark ? 'text-white/55' : 'text-ui-muted'}>{foot[0]}</span><span className={dark ? 'text-white' : 'text-ui-text'}>{foot[1]}</span></div>
    </Card>
  )
}

/** Az Áttekintés mobil első képernyője (cím, a nap csíkja, a nagy számok, közelgő foglalások) — a 4.4 és a 4.5 is ezt
 *  mutatja; `start`: új fióknál az Indulás-pill a dátum alatt. */
export function MobileOverviewTop({ start = false }: { start?: boolean }) {
  return (
    <>
          <div className="mt-5 text-ui-num font-light leading-none text-ui-text">Áttekintés</div>
          <Meta className="mt-1">Péntek, Nov. 7. · Fodrászat Budapest</Meta>
          {start && <div className="mt-3"><StartPill /></div>}
          <SegmentBar size="md" className="mt-4" segments={[{ label: 'Megerősített', value: '14', weight: 56, tone: 'dark' }, { label: 'Függő', value: '2', weight: 14, tone: 'yellow' }, { label: 'Szabad', value: '5', weight: 30, tone: 'hatch' }]} />
          <div className="mt-5 flex justify-between gap-2 pr-6">
            <Kpi size="sm" icon={CalendarDays} value="18" label="foglalás ma" />
            <Kpi size="sm" icon={Wallet} value="164 e" label="várható bevétel" />
            <Kpi size="sm" icon={Clock} value="11:00" label="következő" />
          </div>
          <Card className="mt-4">
            <div className="flex items-start justify-between">
              <span><CardTitle>Közelgő foglalások</CardTitle><Meta className="text-ui-label">10:00 – 14:00</Meta></span>
              <IconButton icon={ArrowUpRight} label="Megnyitás" size="sm" />
            </div>
            <div className="mt-3">
              <MobileDayTimeline rows={[
                { t: '10:00', st: 'past', ev: { n: 'Gál Zsófia', s: '10:00–11:00 · Hajvágás', tone: 'dark', dot: 'bg-ui-yellow' } },
                { t: '11:00', st: 'now', ev: { n: 'Kiss Réka', s: '11:00–12:00 · Géllakk', tone: 'light', dot: 'bg-ui-dark' } },
                { t: '12:00' },
                { t: '13:00', ev: { n: 'Juhász Hanna', s: '13:30–16:00 · Balayage', tone: 'light', dot: 'bg-ui-yellow', avatars: ['/landing/funkciok/csapat/avatar/viktoria.webp'] } },
              ]} />
            </div>
          </Card>
    </>
  )
}

/** Közelgő műszak a munkatárs áttekintőjén. */
export type StaffShiftRow = { key: string; day: string; time: string; hours: string; today?: boolean }
const SAMPLE_STAFF_SHIFTS: StaffShiftRow[] = [
  { key: '1', day: 'Ma, Csütörtök', time: '09:00 – 17:00', hours: '8 ó', today: true },
  { key: '2', day: 'Péntek, Nov. 7.', time: '10:00 – 18:00', hours: '8 ó' },
  { key: '3', day: 'Szombat, Nov. 8.', time: '09:00 – 14:00', hours: '5 ó' },
  { key: '4', day: 'Kedd, Nov. 11.', time: '09:00 – 17:00', hours: '8 ó' },
]
const SAMPLE_STAFF_WEEK: WeekBar[] = [['H', 0], ['K', 8], ['Sze', 8], ['Cs', 8], ['P', 8], ['Szo', 5], ['V', 0]].map(([d, v]) => ({ d: d as string, v: v as number, peak: d === 'Cs', closed: v === 0 }))

/** 4.7: a munkatárs (nem tulaj) áttekintője — üdvözlés, a hét számai (műszak, óra, következő műszak), a profil-kártya
 *  (→ Saját profil), a hét órái napra bontva, a hónap beosztott napjai, és a közelgő műszakok listája. Élőben minden adat
 *  a hívótól (`lib/myShifts`). */
export function StaffHome({ greeting = 'Jó napot, Viktória!', sub = 'Csütörtök, Nov. 6. · Fodrászat Budapest', weekCount = 4, weekHours = '37 ó', next = { value: '09:00', label: 'Ma' }, profile = { name: 'Kovács Viktória', role: 'Fodrász', img: null as string | null }, profileHref, week = SAMPLE_STAFF_WEEK, monthPct = 62, monthFoot = ['beosztott nap', '18 / 30'] as [string, string], shifts = SAMPLE_STAFF_SHIFTS, scheduleHref }: {
  greeting?: string; sub?: string; weekCount?: number; weekHours?: string; next?: { value: string; label: string } | null
  profile?: { name: string; role: string; img?: string | null }; profileHref?: string
  week?: WeekBar[]; monthPct?: number; monthFoot?: [string, string]; shifts?: StaffShiftRow[]; scheduleHref?: string
}) {
  const go = (href?: string, label = 'Megnyitás') => <IconButton icon={ArrowUpRight} label={label} href={href} />
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-ui-num font-light leading-none text-ui-text lg:text-ui-page">{greeting}</h1>
        <div className="mt-2 text-ui-body text-ui-muted">{sub}</div>
      </div>
      <div className="mb-6 flex flex-wrap gap-x-10 gap-y-4">
        <Kpi icon={CalendarDays} value={weekCount} label="műszak a héten" />
        <Kpi icon={Clock} value={weekHours} label="óra a héten" />
        <Kpi icon={Briefcase} value={next?.value ?? '—'} label={next ? `következő műszak · ${next.label}` : 'nincs közelgő műszak'} />
      </div>
      <div className="grid gap-[5px] md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_300px]">
        <PhotoCard img={profile.img} title={profile.name} sub={profile.role} action={go(profileHref, 'Saját profil')} />
        <WeekCard title="Munkaidő" total={Number.parseFloat(weekHours) || 0} unit="óra a héten" days={week} tag={(v) => `${v} ó`} action={go(scheduleHref, 'Naptár')} />
        <RingCard title="A hónap" sub="napjaiból beosztva" pct={monthPct} foot={monthFoot} action={go(scheduleHref, 'Naptár')} className="md:col-span-2 xl:col-span-1" />
      </div>
      <Card className="mt-[5px]">
        <div className="flex items-center justify-between"><CardTitle>Közelgő műszakok</CardTitle>{go(scheduleHref, 'Naptár')}</div>
        {shifts.length === 0
          ? <Meta className="py-6 text-center">Nincs közelgő beosztásod — ha kész a beosztás, itt látod.</Meta>
          : <div className="mt-2">{shifts.map((s) => <ListRow key={s.key} leading={<IconCircle tone={s.today ? 'yellow' : 'cell'} size="sm" icon={CalendarDays} />} title={s.day} meta={s.time} trailing={<span className="text-ui-body text-ui-text">{s.hours}</span>} />)}</div>}
      </Card>
    </div>
  )
}
