import { ArrowRight, Banknote, Bell, Cake, CalendarDays, Clock, Moon, Sun, Users, Wallet } from 'lucide-react'
import { Avatar, Button, Card, IconCircle, ListRow, Meta, Pill, StatusPill, MarqueeText } from '@/components/ui-kit'
import { ShareRow } from './charts'

/* Napi összefoglaló (design 22.x) — reggel: mi vár ma; este: hogy ment a nap, mi maradt, mi jön holnap. Szalonnál és
 * étteremnél ugyanaz a felépítés, csak a számok mások (szalon: szolgáltatás / szakember, étterem: fő / asztal / alkalom).
 * Csak megjelenítés; az adat a `DigestData` (élőben a cron állítja össze — notifications.metadata). */

export type DigestKind = 'morning' | 'evening'
export type DigestTodo = { key: string; label: string; count: number; tone: 'pending' | 'bad' | 'neutral'; href?: string }
export type DigestPerson = { name: string; img?: string | null; meta: string; value: string }
export type DigestData = {
  kind: DigestKind
  restaurant?: boolean
  /** „Csütörtök, Nov. 6.” */
  day: string
  /** a fő számok (pill-sor): foglalás, vendég / fő, munkatárs, bevétel */
  stats: { icon: 'calendar' | 'users' | 'wallet' | 'clock'; label: string }[]
  /** reggel: az első / utolsó vendég, nyitás */
  firstLast?: { first: string; last: string; open?: string } | null
  /** reggel: ki dolgozik ma (foglalásszámmal, első kezdéssel); este: ki mennyit vitt */
  people: DigestPerson[]
  /** teendők: jóváhagyásra vár, fizetésre vár / lezáratlan, születésnapos vendég… */
  todos: DigestTodo[]
  /** este: hogy ment — teljesült / lemondva / nem jött */
  outcome?: { done: number; cancelled: number; noShow: number } | null
  /** este: bevétel (rögzített fizetés + előleg) és a múlt heti ugyanez a nap */
  revenue?: { value: string; vsLastWeek?: string | null } | null
  /** a legnépszerűbb szolgáltatások / alkalmak (név, darab, arány) */
  top?: { name: string; value: string; pct: number }[]
  /** új / visszatérő vendég */
  guests?: { fresh: number; returning: number } | null
  /** este: holnap — foglalás, első időpont */
  tomorrow?: { count: string; first: string } | null
  /** a nap tippje (heti tipp) */
  tip?: { title: string; body: string } | null
}

const STAT_ICON = { calendar: CalendarDays, users: Users, wallet: Wallet, clock: Clock } as const

export const SAMPLE_DIGEST_MORNING: DigestData = {
  kind: 'morning', day: 'Csütörtök, Nov. 6.',
  stats: [{ icon: 'calendar', label: '18 foglalás' }, { icon: 'users', label: '4 munkatárs' }, { icon: 'wallet', label: '~ 186 e Ft várható' }],
  firstLast: { first: '09:00 · Gál Zsófia', last: '18:30 · Papp Máté', open: '9:00–19:00' },
  people: [
    { name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp', meta: 'első: 09:00', value: '6 foglalás' },
    { name: 'Dávid', img: '/landing/funkciok/csapat/avatar/dave.webp', meta: 'első: 10:30', value: '5 foglalás' },
    { name: 'Csaba', img: '/landing/funkciok/csapat/avatar/csaba.webp', meta: 'első: 11:00', value: '4 foglalás' },
    { name: 'Szabina', img: '/landing/funkciok/csapat/avatar/szabina.webp', meta: 'első: 13:00', value: '3 foglalás' },
  ],
  todos: [
    { key: 'pending', label: 'Jóváhagyásra vár', count: 3, tone: 'pending' },
    { key: 'unclosed', label: 'Tegnapról lezáratlan', count: 1, tone: 'bad' },
    { key: 'bday', label: 'Születésnapos vendég ma', count: 2, tone: 'neutral' },
  ],
  tip: { title: 'Kedden üres a délelőtt', body: 'Egy -15%-os keddi délelőtti akció a hírlevélben általában 4–6 foglalást hoz.' },
}

export const SAMPLE_DIGEST_EVENING: DigestData = {
  kind: 'evening', day: 'Csütörtök, Nov. 6.',
  stats: [{ icon: 'calendar', label: '17 foglalás' }, { icon: 'users', label: '15 vendég' }, { icon: 'wallet', label: '172 400 Ft' }],
  outcome: { done: 15, cancelled: 1, noShow: 1 },
  revenue: { value: '172 400 Ft', vsLastWeek: '+12% a múlt csütörtökhöz' },
  people: [
    { name: 'Viktória', img: '/landing/funkciok/csapat/avatar/viktoria.webp', meta: '6 vendég', value: '64 200 Ft' },
    { name: 'Dávid', img: '/landing/funkciok/csapat/avatar/dave.webp', meta: '5 vendég', value: '48 500 Ft' },
    { name: 'Csaba', img: '/landing/funkciok/csapat/avatar/csaba.webp', meta: '4 vendég', value: '41 900 Ft' },
  ],
  top: [{ name: 'Női hajvágás', value: '6', pct: 100 }, { name: 'Balayage + vágás', value: '3', pct: 50 }, { name: 'Géllakk', value: '3', pct: 50 }],
  guests: { fresh: 4, returning: 11 },
  todos: [{ key: 'pay', label: 'Fizetésre vár (nincs lezárva)', count: 2, tone: 'pending' }, { key: 'pending', label: 'Jóváhagyásra vár', count: 1, tone: 'pending' }],
  tomorrow: { count: '14 foglalás', first: '09:00 · Kiss Réka' },
}

export const SAMPLE_DIGEST_REST: DigestData = {
  kind: 'evening', restaurant: true, day: 'Csütörtök, Nov. 6.',
  stats: [{ icon: 'calendar', label: '24 foglalás' }, { icon: 'users', label: '86 fő' }, { icon: 'clock', label: '72% telítettség' }],
  outcome: { done: 21, cancelled: 2, noShow: 1 },
  revenue: { value: '40 000 Ft előleg', vsLastWeek: null },
  people: [{ name: 'Kovács Bence', img: '/landing/funkciok/csapat/avatar/dave.webp', meta: 'műszakvezető', value: '17–23' }],
  top: [{ name: 'Születésnap', value: '4', pct: 100 }, { name: 'Évforduló', value: '2', pct: 50 }, { name: 'Céges', value: '1', pct: 25 }],
  guests: { fresh: 9, returning: 15 },
  todos: [{ key: 'pending', label: 'Jóváhagyásra vár', count: 2, tone: 'pending' }],
  tomorrow: { count: '19 foglalás · 64 fő', first: '12:00 · Nagy család (6 fő)' },
}

/** 22.1 — az értesítés a csengőben: ikon (reggel nap, este hold), cím, egy sor a lényeggel. Kattintásra a popup (22.2). */
export function DigestNotice({ data = SAMPLE_DIGEST_MORNING, time = '07:30', unread = true, onOpen, className = '' }: { data?: DigestData; time?: string; unread?: boolean; onOpen?: () => void; className?: string }) {
  const morning = data.kind === 'morning'
  return (
    <button type="button" onClick={onOpen} className={`flex w-full items-start gap-3 rounded-ui-inner px-3 py-3 text-left transition-colors hover:bg-ui-cell/60 ${unread ? 'bg-ui-cell/40' : ''} ${className}`}>
      <IconCircle size="md" tone={morning ? 'yellow' : 'dark'} icon={morning ? Sun : Moon} />
      <span className="min-w-0 flex-1">
        <span className="block text-ui-body font-medium text-ui-text">{morning ? 'Reggeli összefoglaló' : 'Esti összefoglaló'}</span>
        <span className="block text-ui-label text-ui-muted">{data.day} · {time}</span>
        <MarqueeText className="mt-1 text-ui-meta text-ui-text">{data.stats.map((s) => s.label).join(' · ')}</MarqueeText>
      </span>
      {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ui-yellow" />}
    </button>
  )
}

/** Szakasz-cím a popupban. */
function Head({ children }: { children: React.ReactNode }) {
  return <Meta className="mb-1.5 mt-5 text-ui-label">{children}</Meta>
}

/**
 * 22.2 — az összefoglaló maga (popup tartalma, és ugyanez megy e-mailben is): fent a fő számok, reggel az első / utolsó
 * vendég és ki dolgozik, este hogy ment (teljesült / lemondva / nem jött), a bevétel és ki mennyit vitt; mindkettőben a
 * teendők (kattintható — oda visz, ahol intézni kell), a legnépszerűbbek, új / visszatérő vendég; este a holnap.
 * Alul a napi foglalások.
 */
export function DigestBody({ data = SAMPLE_DIGEST_MORNING, wide = false, onTodo, onOpenDay }: { data?: DigestData; /** desktopon széles, két hasáb: balra a nap (számok, teendők), jobbra a részletek */ wide?: boolean; onTodo?: (key: string) => void; onOpenDay?: () => void }) {
  const morning = data.kind === 'morning'
  const r = data.restaurant
  const left = (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {data.stats.map((s) => <Pill key={s.label} icon={STAT_ICON[s.icon]}>{s.label}</Pill>)}
      </div>

      {morning && data.firstLast && (
        <Card tone="cell" pad="sm" inner className="mt-3 grid grid-cols-2 gap-3">
          <span><Meta className="text-ui-label">Első {r ? 'foglalás' : 'vendég'}</Meta><span className="block text-ui-body text-ui-text">{data.firstLast.first}</span></span>
          <span><Meta className="text-ui-label">Utolsó</Meta><span className="block text-ui-body text-ui-text">{data.firstLast.last}</span></span>
        </Card>
      )}

      {!morning && data.outcome && <>
        <Head>Hogy ment</Head>
        <div className="flex flex-wrap gap-1.5">
          <StatusPill status="ok">{data.outcome.done} teljesült</StatusPill>
          <StatusPill status="bad">{data.outcome.cancelled} lemondva</StatusPill>
          <StatusPill status="bad">{data.outcome.noShow} nem jött el</StatusPill>
        </div>
      </>}

      {!morning && data.revenue && (
        <Card tone="dark" pad="md" className="mt-3">
          <Meta dark className="text-ui-label">{r ? 'Beszedett előleg' : 'Mai bevétel'}</Meta>
          <div className="mt-1 text-ui-num font-light text-white">{data.revenue.value}</div>
          {data.revenue.vsLastWeek && <Meta dark className="mt-1">{data.revenue.vsLastWeek}</Meta>}
        </Card>
      )}

      {data.todos.length > 0 && <>
        <Head>Teendők</Head>
        <Card tone="cell" pad="none" inner className="px-1">
          {data.todos.map((t) => (
            <button key={t.key} type="button" onClick={onTodo ? () => onTodo(t.key) : undefined} className="block w-full text-left">
              <ListRow title={t.label} leading={<IconCircle tone={t.tone === 'bad' ? 'bad' : t.tone === 'pending' ? 'yellow' : 'white'} icon={t.key === 'bday' ? Cake : t.key === 'pay' || t.key === 'unclosed' ? Banknote : Bell} />}
                trailing={<span className="flex items-center gap-2"><span className="text-ui-body text-ui-text">{t.count}</span><ArrowRight className="h-4 w-4 text-ui-muted" /></span>} />
            </button>
          ))}
        </Card>
      </>}

    </div>
  )
  const right = (
    <div>
      {data.people.length > 0 && <>
        <Head>{morning ? 'Ma dolgoznak' : r ? 'Műszak' : 'Szakemberek'}</Head>
        <Card tone="cell" pad="none" inner className="px-1">
          {data.people.map((p) => <ListRow key={p.name} leading={<Avatar size="sm" src={p.img} name={p.name} />} title={p.name} meta={p.meta} trailing={<span className="text-ui-body text-ui-text">{p.value}</span>} />)}
        </Card>
      </>}

      {data.top && data.top.length > 0 && <>
        <Head>{r ? 'Alkalmak' : 'Legnépszerűbb'}</Head>
        <div>{data.top.map((t, i) => <ShareRow key={t.name} name={t.name} value={t.value} pct={t.pct} hi={i === 0} />)}</div>
      </>}

      {data.guests && (
        <div className="mt-4 grid grid-cols-2 gap-[5px]">
          <Card tone="cell" pad="sm" inner className="text-center"><div className="text-ui-sub font-light text-ui-text">{data.guests.fresh}</div><Meta className="text-ui-label">új vendég</Meta></Card>
          <Card tone="cell" pad="sm" inner className="text-center"><div className="text-ui-sub font-light text-ui-text">{data.guests.returning}</div><Meta className="text-ui-label">visszatérő</Meta></Card>
        </div>
      )}

      {!morning && data.tomorrow && (
        <Card tone="cell" pad="sm" inner className="mt-4 flex items-center gap-3">
          <IconCircle tone="white" icon={Sun} />
          <span className="min-w-0"><span className="block text-ui-body text-ui-text">Holnap: {data.tomorrow.count}</span><Meta className="text-ui-label">első: {data.tomorrow.first}</Meta></span>
        </Card>
      )}

      {data.tip && (
        <Card tone="white" pad="sm" inner className="mt-4 ring-1 ring-ui-divider">
          <Meta className="text-ui-label">A nap tippje</Meta>
          <div className="mt-0.5 text-ui-body text-ui-text">{data.tip.title}</div>
          <Meta className="mt-0.5">{data.tip.body}</Meta>
        </Card>
      )}

    </div>
  )
  const cta = <Button size="lg" icon={ArrowRight} onClick={onOpenDay} className={wide ? 'mt-6 w-full lg:ml-auto lg:w-auto' : 'mt-5 w-full'}>{morning ? 'A mai nap' : 'A nap foglalásai'}</Button>
  if (!wide) return <div>{left}{right}{cta}</div>
  // széles: két hasáb (lg-től), a jobb hasáb címei fent kezdődnek; alatta a gomb jobbra
  return (
    <div>
      <div className="grid gap-x-8 lg:grid-cols-2 lg:[&>div:last-child>*:first-child]:mt-0">{left}{right}</div>
      <div className="flex">{cta}</div>
    </div>
  )
}
