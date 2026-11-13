'use client'

import { motion } from 'framer-motion'
import {
  BarChart3, CalendarCheck, Check, CheckCircle2, Clock, CreditCard, Download, Gift, Globe, Link2, Mail, MessageSquare, QrCode,
  ReceiptText, Scissors, Send, ShieldCheck, Star, Tag, Timer, Users, UtensilsCrossed, Wallet, type LucideIcon,
} from 'lucide-react'
import { inView, rise, stagger, StepsK2 } from './landing-concepts'

/**
 * A funkció-oldalak „Így indulsz el” lépéseinek képei — a főoldal „Mindennapok” blokkjának két mintájával (DailyOps):
 *  - `notif`: értesítés-kártyák egy telefon-sziluett előtt (elöl a fő kártya, mögötte egy halványabb);
 *  - `rows`: üveges sorok egy fotón (a középső kiemelt, tömör fehér).
 * A lépés-doboz teljes méretét kitöltik (240 × ~236 px gépen, teljes szélesség × 240 px telefonon).
 */

const AV = (n: string) => `/landing/funkciok/csapat/avatar/${n}.webp`
const HERO = (n: string) => `/landing/hero/${n}-davelopment-booking.webp`

type Thumb = { img: string } | { icon: LucideIcon; tone?: 'ok' | 'yellow' | 'dark' }
type Card = { t: string; s: string; meta?: string; dot?: boolean; thumb: Thumb }
type Row = { thumb: Thumb; t: string; s: string; rt?: string; rs?: string }
type Visual = { kind: 'notif'; main: Card; sub: Card } | { kind: 'rows'; photo: string; rows: [Row, Row, Row] }

function ThumbBox({ thumb, size }: { thumb: Thumb; size: 'lg' | 'sm' }) {
  const box = size === 'lg' ? 'h-10 w-10 rounded-ui-control' : 'h-7 w-7 rounded-[7px]'
  if ('img' in thumb) return <span className={`${box} shrink-0 overflow-hidden`}><img src={thumb.img} alt="" className="h-full w-full object-cover" /></span> // eslint-disable-line @next/next/no-img-element
  const I = thumb.icon
  const tone = thumb.tone === 'ok' ? 'bg-ui-ok-bg text-ui-ok' : thumb.tone === 'yellow' ? 'bg-ui-yellow/25 text-ui-text' : thumb.tone === 'dark' ? 'bg-ui-dark text-white' : 'bg-ui-cell text-ui-text'
  return <span className={`${box} flex shrink-0 items-center justify-center ${tone}`}><I aria-hidden className={size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5'} strokeWidth={1.8} /></span>
}

/** értesítés-kártyák a telefon-sziluett előtt (a főoldali „Minden foglalásról és fizetésről azonnal tudsz” képe) */
function NotifVisual({ main, sub }: { main: Card; sub: Card }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#F7F7F7]">
      <div className="absolute bottom-0 left-1/2 h-[80%] w-[52%] -translate-x-1/2 rounded-t-[32px] border-[7px] border-b-0 border-white bg-white/50" /> {/* ui-allow: telefon-sziluett */}
      <motion.div {...inView} variants={stagger(0.15)} className="relative w-[88%] max-w-[280px] space-y-1.5">
        <motion.div variants={rise} className="flex items-center gap-2.5 rounded-ui-card bg-white p-2.5 shadow-[0_20px_50px_-24px_rgba(0,0,0,.3)]"> {/* ui-allow: lebegő kártya */}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 truncate text-ui-body font-medium">{main.t}{main.dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ui-ok-dot" />}</span>
            <span className="mt-0.5 block truncate text-ui-meta text-ui-muted">{main.s}</span>
            {main.meta && <span className="mt-1 block truncate text-ui-label text-ui-muted">{main.meta}</span>}
          </span>
          <ThumbBox thumb={main.thumb} size="lg" />
        </motion.div>
        <motion.div variants={rise} className="mx-3 flex items-center gap-2.5 rounded-ui-card bg-white/70 p-2 opacity-75">
          <span className="min-w-0 flex-1"><span className="block truncate text-ui-meta text-ui-text">{sub.t}</span><span className="block truncate text-ui-label text-ui-muted">{sub.s}</span></span>
          <ThumbBox thumb={sub.thumb} size="sm" />
        </motion.div>
      </motion.div>
    </div>
  )
}

/** üveges sorok a fotón (a főoldali „A csapat beosztása kézi egyeztetés nélkül” képe): a középső kiemelt */
function RowsVisual({ photo, rows }: { photo: string; rows: [Row, Row, Row] }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <motion.div {...inView} variants={stagger(0.12)} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-[6%]">
        {rows.map((r, i) => {
          const on = i === 1
          return (
            <motion.div key={r.t} variants={rise}
              className={`flex w-full max-w-[270px] items-center gap-2 rounded-ui-inner p-1.5 ${on ? 'z-10 scale-[1.04] bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,.35)]' : 'bg-white/70 backdrop-blur-md'}`}> {/* ui-allow: üveges / kiemelt sor */}
              <ThumbBox thumb={r.thumb} size="sm" />
              <span className="min-w-0 flex-1"><span className="block truncate text-ui-meta font-medium text-ui-text">{r.t}</span><span className="block truncate text-ui-label text-ui-muted">{r.s}</span></span>
              {r.rt && <span className="shrink-0 pr-0.5 text-right"><span className="block text-ui-label text-ui-ok">{r.rt}</span>{r.rs && <span className="block text-ui-label text-ui-muted">{r.rs}</span>}</span>}
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}

const V: Record<string, Visual[]> = {
  // a főoldal „Kezdd el 3 egyszerű lépésben” blokkja
  home: [
    { kind: 'rows', photo: HERO('new-york-studio-online-foglalas'), rows: [
      { thumb: { icon: UtensilsCrossed }, t: 'Étterem', s: 'asztalfoglalás' },
      { thumb: { icon: Scissors, tone: 'dark' }, t: 'Szalon', s: 'időpontfoglalás · kész sablon', rt: 'Kiválasztva' },
      { thumb: { icon: Globe, tone: 'yellow' }, t: 'Google Cégprofil', s: 'az adatok betöltve', rt: 'Összekötve' },
    ] },
    { kind: 'notif', main: { t: 'Új foglalás', dot: true, s: 'Kiss Réka · a foglalási linkről', meta: 'app nélkül · 1 perce', thumb: { img: AV('viktoria') } },
      sub: { t: 'Foglalási link', s: 'booking.davelopment.hu/fodraszat-budapest', thumb: { icon: Link2 } } },
    { kind: 'rows', photo: HERO('csapat-beosztas-szalon'), rows: [
      { thumb: { img: AV('dave') }, t: 'Dávid', s: 'Tulajdonos · saját naptár', rt: 'Aktív' },
      { thumb: { img: AV('viktoria') }, t: 'Viktória', s: 'Stylist · saját naptár', rt: 'Elfogadta', rs: 'most' },
      { thumb: { img: AV('csaba') }, t: 'Csaba', s: 'Barber · meghívó e-mailben', rt: 'Meghívva' },
    ] },
  ],
  booking: [
    { kind: 'notif', main: { t: 'Oldal közzétéve', dot: true, s: 'Fodrászat Budapest', meta: 'borító · bemutatkozás · 4 szolgáltatás', thumb: { img: HERO('kinek-szakember') } },
      sub: { t: 'Szolgáltatások', s: 'Balayage · Női vágás · Festés', thumb: { img: '/landing/marquee/fodrasz-idopontfoglalas-davelopment-booking.webp' } } },
    { kind: 'rows', photo: HERO('new-york-studio-online-foglalas'), rows: [
      { thumb: { icon: Clock }, t: 'Nyitvatartás', s: 'hétfő–péntek', rt: 'Beállítva', rs: '9–18' },
      { thumb: { icon: CheckCircle2, tone: 'ok' }, t: 'Jóváhagyás', s: 'új foglalásnál', rt: 'Automatikus', rs: 'bekapcsolva' },
      { thumb: { icon: Timer }, t: 'Foglalási időköz', s: 'szolgáltatások között', rt: '15 perc' },
    ] },
    { kind: 'notif', main: { t: 'Új foglalás', dot: true, s: 'Kiss Réka · Instagramról', meta: '2 perce', thumb: { img: AV('viktoria') } },
      sub: { t: 'Google Cégprofil', s: '„Időpont foglalása” gomb él', thumb: { icon: Globe, tone: 'yellow' } } },
  ],
  calendar: [
    { kind: 'rows', photo: HERO('csapat-beosztas-szalon'), rows: [
      { thumb: { img: AV('csaba') }, t: 'Csaba', s: 'Barber · órabér', rt: 'Aktív' },
      { thumb: { img: AV('viktoria') }, t: 'Viktória', s: 'Stylist · napidíj', rt: 'Meghívva', rs: 'most' },
      { thumb: { img: AV('szabina') }, t: 'Szabina', s: 'Recepció · órabér', rt: 'Aktív' },
    ] },
    { kind: 'notif', main: { t: 'Heti beosztás kész', dot: true, s: 'Hétfő–vasárnap · 4 munkatárs', meta: 'fedetlen nap: 0', thumb: { icon: CalendarCheck, tone: 'ok' } },
      sub: { t: 'Csaba · ma 10–18', s: 'Beosztva', thumb: { img: AV('csaba') } } },
    { kind: 'notif', main: { t: 'Szabadság rögzítve', s: 'Viktória · Dec. 10–14.', meta: '5 nap · a keretből 15 marad', thumb: { img: AV('viktoria') } },
      sub: { t: 'Bér frissítve', s: 'November · magától számolva', thumb: { icon: Wallet } } },
  ],
  guests: [
    { kind: 'notif', main: { t: 'Új vendég', dot: true, s: 'Kovács Emese · első foglalás', meta: 'a vendégkártya létrejött', thumb: { img: AV('szabina') } },
      sub: { t: 'Új foglalás', s: 'Juhász Hanna · ma 14:30', thumb: { img: AV('viktoria') } } },
    { kind: 'rows', photo: HERO('kinek-szakember'), rows: [
      { thumb: { icon: Gift }, t: 'Születésnap', s: 'Kovács Emese', rt: 'Márc. 12.' },
      { thumb: { icon: Tag, tone: 'yellow' }, t: 'Csoport', s: 'Kovács Emese', rt: 'Törzsvendég' },
      { thumb: { icon: MessageSquare }, t: 'Megjegyzés', s: 'kávét kér, cukor nélkül' },
    ] },
    { kind: 'notif', main: { t: 'Export kész', s: '1 045 vendég · CSV', meta: 'Excelben megnyitható', thumb: { icon: Download, tone: 'dark' } },
      sub: { t: 'Hírlevél-feliratkozók', s: '412 vendég', thumb: { icon: Mail } } },
  ],
  money: [
    { kind: 'notif', main: { t: 'Stripe összekötve', dot: true, s: 'A vendég fizetése hozzád érkezik', meta: 'most', thumb: { icon: CreditCard, tone: 'dark' } },
      sub: { t: 'Előleg beérkezett', s: '10 000 Ft · Juhász Hanna', thumb: { img: AV('szabina') } } },
    { kind: 'rows', photo: HERO('kinek-szakember'), rows: [
      { thumb: { icon: Wallet }, t: 'Előleg', s: '12 000 Ft feletti foglalásnál', rt: '10%' },
      { thumb: { icon: Gift, tone: 'yellow' }, t: 'Ajándékutalvány', s: '3 típus · 1 évig érvényes', rt: 'Bekapcsolva' },
      { thumb: { icon: Clock }, t: 'Visszatérítés', s: 'lemondáskor', rt: '24 órán belül' },
    ] },
    { kind: 'notif', main: { t: 'Számla elkészült', dot: true, s: 'E-TUJGY-2026-40 · 20 000 Ft', meta: 'elküldve a vendégnek', thumb: { icon: ReceiptText, tone: 'ok' } },
      sub: { t: 'Számlázz.hu', s: 'Összekötve', thumb: { icon: Link2 } } },
  ],
  marketing: [
    { kind: 'notif', main: { t: 'Új feliratkozó', dot: true, s: 'Kiss Réka kér hírlevelet', meta: 'foglaláskor jelezte', thumb: { img: AV('viktoria') } },
      sub: { t: '412 feliratkozó', s: '+18 ebben a hónapban', thumb: { icon: Users } } },
    { kind: 'rows', photo: HERO('new-york-studio-online-foglalas'), rows: [
      { thumb: { icon: Globe }, t: 'Google-link', s: 'Fodrászat Budapest', rt: 'Beállítva' },
      { thumb: { icon: Star, tone: 'yellow' }, t: 'Értékeléskérés', s: 'e-mailben, a látogatás után', rt: 'Bekapcsolva' },
      { thumb: { icon: Clock }, t: 'Időzítés', s: 'a foglalás vége után', rt: '1 órával' },
    ] },
    { kind: 'notif', main: { t: 'Hírlevél kiküldve', dot: true, s: 'Őszi frissítés −15%', meta: '66% megnyitotta', thumb: { icon: Send, tone: 'dark' } },
      sub: { t: 'QR-kód letöltve', s: 'kirakatra, asztalra', thumb: { icon: QrCode } } },
  ],
  team: [
    { kind: 'rows', photo: HERO('csapat-beosztas-szalon'), rows: [
      { thumb: { img: AV('dave') }, t: 'Dávid', s: 'Tulajdonos', rt: 'Aktív' },
      { thumb: { img: AV('szabina') }, t: 'Szabina', s: 'meghívó e-mailben', rt: 'Elfogadta', rs: 'most' },
      { thumb: { img: AV('csaba') }, t: 'Csaba', s: 'meghívó e-mailben', rt: 'Meghívva' },
    ] },
    { kind: 'rows', photo: HERO('new-york-studio-online-foglalas'), rows: [
      { thumb: { icon: ShieldCheck, tone: 'dark' }, t: 'Tulajdonos', s: 'minden jog', rt: '1 tag' },
      { thumb: { icon: Users, tone: 'yellow' }, t: 'Recepció', s: 'foglalások, vendégek', rt: '8 jog' },
      { thumb: { icon: Check }, t: 'Stylist', s: 'saját naptár', rt: '5 jog' },
    ] },
    { kind: 'notif', main: { t: 'Heti bevétel', s: '2,3 M Ft · 187 foglalás', meta: 'Statisztikák', thumb: { icon: BarChart3, tone: 'yellow' } },
      sub: { t: 'Audit-napló', s: 'Dávid módosította az árlistát', thumb: { img: AV('dave') } } },
  ],
}

/** a csoport három lépés-képe (ismeretlen csoportnál a Foglalásé) */
export function stepVisuals(groupId: string): React.ReactNode[] {
  return (V[groupId] ?? V.booking).map((v, i) => v.kind === 'notif' ? <NotifVisual key={i} main={v.main} sub={v.sub} /> : <RowsVisual key={i} photo={v.photo} rows={v.rows} />)
}

/** A főoldal „Kezdd el 3 egyszerű lépésben” blokkja a kártya-képekkel (kliens-komponens: a szerveres főoldal elemként teszi ki). */
export function HomeSteps() {
  return <StepsK2 fills={stepVisuals('home')} />
}

/** Egy kártya-kompozíció csoport + sorszám szerint (pl. a kézikönyv-oldalak képeihez). */
export function StepVisual({ group, index }: { group: string; index: number }) {
  return <>{stepVisuals(group)[index] ?? null}</>
}
