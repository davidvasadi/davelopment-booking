import { Accessibility, ArrowLeft, ArrowRight, Baby, CalendarPlus, Car, Check, Clock, MapPin, Lock, Phone, Printer, Star, Users, Wifi, CreditCard, Dog, Download, Gift, Languages, X } from 'lucide-react'
import { Avatar, Button, IconButton, IconCircle, Input, Pill, SheetHandle } from '@/components/ui-kit'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS, type SocialPlatform } from '@/lib/socialLinks'
import type { LucideIcon } from 'lucide-react'
import { AV } from './assets'
import { BIZ_LOGO, PoweredBy } from './brand'
import { MockSwitch } from './MockSwitch'
import { DayPicker, SlotGrid, type PickDay } from './booking'
import { VoucherCard } from './money'

/* A publikus foglalóoldal (a vendég látja) és a foglalás menete — a /design 21.x; a lépések a foglaló
 * kártyán (LiveBookingCard), szalonra és étteremre. Élesben: [slug]/page.tsx
 * (PublicPlaceView) és [slug]/book. A vendég-oldal a kit nyelvén, alul mindig a davelopment booking jele. */

/** Az üzlet márkaszíne: a vendég-oldalon minden kiemelés (fő gomb, kiválasztott sor, választott időpont) ezt kapja —
 *  a rendszer maga semleges (fehér, szürke, sötét), így minden cég a saját arculatával jelenik meg. A színt a
 *  szülő `--biz-accent` / `--biz-accent-fg` változója adja; alapból a mi sárgánk. */
/** Ami közvetlenül a fotón ül (értékelés, jó tudni, nyelvváltó, „Legközelebb szabad”): sötét üveg — bármilyen képen
 *  olvasható, és ugyanaz a felület, mint a foglaló kártyáé. A kit `onDark` tónusára kerül rá. */
export const ON_PHOTO = 'border border-white/10 bg-ui-dark/45 backdrop-blur-md' // ui-allow: sötét üveg a fotón
export const ACCENT = 'ui-accent' // globals.css: az üzlet saját márkaszíne (--biz-accent / --biz-accent-fg)

/** Egy értékelés-forrás a borítón: átlag, honnan, hány értékelés. */
export type RatingItem = { score: number; source: string; count?: number | null }
const SAMPLE_RATINGS: RatingItem[] = [{ score: 4.8, source: 'Google', count: 132 }]
/** Értékelés-jelvények: Google (élesben is), étteremnél mellette a TripAdvisor (tervben, 52. tétel). `dark`: fotón.
 *  Élőben `items`, és `onOpen` (kattintásra megnyílnak a vélemények). */
export function RatingBadges({ restaurant = false, dark = false, items, onOpen, className = '' }: { restaurant?: boolean; dark?: boolean; items?: RatingItem[]; onOpen?: () => void; className?: string }) {
  const tone = dark ? 'onDark' : 'white'
  const list = items ?? (restaurant ? [...SAMPLE_RATINGS, { score: 4.5, source: 'TripAdvisor', count: 860 }] : SAMPLE_RATINGS)
  const body = (
    <span className={`flex flex-wrap gap-1.5 ${className}`}>
      {list.map((r) => (
        <Pill key={r.source} tone={tone} size="sm" className={dark ? ON_PHOTO : ''}><Star className="h-3.5 w-3.5 fill-ui-yellow text-ui-yellow" />{r.score.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} · {r.source}{r.count ? ` · ${r.count}` : ''}</Pill>
      ))}
    </span>
  )
  return onOpen ? <button type="button" onClick={onOpen} className="ui-press rounded-full text-left">{body}</button> : body
}

// „Jó tudni” — élesben a goodToKnow + a telefonszám; `t` a rövid felirat (pill), `d` a teljes szöveg (a lista-ablakban)
const INFO = [
  { icon: Car, t: 'Parkolás', d: 'Parkolás a ház előtt, az első óra ingyenes' },
  { icon: Wifi, t: 'Wifi', d: 'Ingyen wifi — a jelszó a pultnál' },
  { icon: Phone, t: '+36 1 234 5678', d: '+36 1 234 5678 — hívj bátran, kedd–szombat' },
  { icon: Accessibility, t: 'Akadálymentes', d: 'Akadálymentes bejárat és mosdó' },
  { icon: CreditCard, t: 'Kártyás fizetés', d: 'Kártya, Apple Pay, Google Pay, SZÉP-kártya' },
  { icon: Baby, t: 'Gyerekbarát', d: 'Gyerekhajvágás 10 éves korig kedvezménnyel' },
  { icon: Dog, t: 'Kutyabarát', d: 'Kistestű kutyát szívesen látunk' },
  { icon: Languages, t: 'English', d: 'We speak English' },
] as const
const INFO_MAX = 3

/** Egy „Jó tudni” pont: ikon, rövid felirat (a pillen), teljes szöveg (a listában); `href`: pl. a telefon hívható. */
export type InfoItem = { icon: LucideIcon; t: string; d: string; href?: string }

/** „Jó tudni” a borítón: legfeljebb 3 áttetsző pill, a többit egy „+N” pill jelzi — arra kattintva nyílik a teljes lista
 *  (desktopon felugró ablak, mobilon felcsúszó lap: `InfoList`). A minta 8 elemmel: „+5”. Élőben `items` és `onMore`. */
export function GoodToKnow({ restaurant = false, items: live, onMore, className = '' }: { restaurant?: boolean; items?: InfoItem[]; onMore?: () => void; className?: string }) {
  const items: InfoItem[] = live ?? INFO.map((x) => ({ ...x, t: restaurant && x.icon === Phone ? '+36 1 765 4321' : x.t }))
  const rest = items.length - INFO_MAX
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.slice(0, INFO_MAX).map(({ icon: I, t }) => {
        const pill = <Pill tone="onDark" size="sm" className={ON_PHOTO}><I className="h-3.5 w-3.5" />{t}</Pill>
        return onMore ? <button key={t} type="button" onClick={onMore} className="ui-press rounded-full">{pill}</button> : <span key={t}>{pill}</span>
      })}
      {rest > 0 && (onMore ? <button type="button" onClick={onMore} className="ui-press rounded-full"><Pill tone="white" size="sm">+{rest}</Pill></button> : <Pill tone="white" size="sm">+{rest}</Pill>)}
    </div>
  )
}

/** A nyitvatartás a „Jó tudni” alján: felül a most-állapot (nyitva / zárva, mikor nyit-zár), alatta a hét napjai, a mai
 *  kiemelve. Élőben az üzlet heti rendjéből (`PublicPlaceView`). */
export type HoursInfo = { status: string; open: boolean; rows: { day: string; time: string; today?: boolean; closed?: boolean }[]; todayLabel?: string }
const SAMPLE_HOURS: HoursInfo = {
  status: 'Nyitva · zár 19:00-kor', open: true,
  rows: [['Hétfő', '9:00 – 19:00'], ['Kedd', '9:00 – 19:00'], ['Szerda', '9:00 – 19:00'], ['Csütörtök', '9:00 – 19:00'], ['Péntek', '9:00 – 19:00'], ['Szombat', '9:00 – 14:00'], ['Vasárnap', 'Zárva']]
    .map(([day, time], i) => ({ day, time, today: i === 3, closed: time === 'Zárva' })),
}
function HoursBlock({ h }: { h: HoursInfo }) {
  return (
    <div className={`mt-1 px-3 py-2.5 ${DARK_ROW}`}>
      <div className="flex items-center gap-3">
        <span className="relative"><IconCircle size="sm" tone="onDark" icon={Clock} /><span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ${h.open ? 'bg-ui-ok' : 'bg-white/30'}`} /></span>
        <span className="text-ui-body">{h.status}</span>
      </div>
      <div className="mt-2 space-y-0.5">
        {h.rows.map((r) => (
          <div key={r.day} className={`flex items-center justify-between rounded-ui-control px-3 py-1.5 text-ui-meta ${r.today ? 'bg-white/10 text-white' : 'text-white/60'}`}>
            <span>{r.day}{r.today && <span className="ml-2 text-ui-label text-white/50">{h.todayLabel ?? 'Ma'}</span>}</span>
            <span className={r.closed ? 'text-white/30' : ''}>{r.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** A „Jó tudni” teljes listája a sötét üvegen: cím, soronként ikon és a teljes szöveg; a telefon sora hívható; alul a
 *  nyitvatartás. Élőben `items`, `hours` (null: nincs megadva), `title` (a nyelvén) és `onClose`. */
export function InfoList({ items, hours = SAMPLE_HOURS, title = 'Jó tudni', onClose, className = '' }: { items?: InfoItem[]; hours?: HoursInfo | null; title?: string; onClose?: () => void; className?: string }) {
  const list: InfoItem[] = items ?? INFO.map((x) => ({ ...x }))
  return (
    <div className={`rounded-ui-card p-5 text-white ${DARK_GLASS} ${className}`}>
      <div className="flex items-center justify-between"><span className="text-ui-title font-light">{title}</span><IconButton icon={X} label="Bezárás" size="sm" variant="onDark" onClick={onClose} /></div>
      <div className="mt-3 space-y-1">
        {list.map(({ icon: I, d, href }) => {
          const row = <><IconCircle size="sm" tone="onDark" icon={I} /><span className="text-ui-body">{d}</span></>
          return href
            ? <a key={d} href={href} className={`flex items-center gap-3 px-3 py-2.5 ${DARK_ROW}`}>{row}</a>
            : <div key={d} className={`flex items-center gap-3 px-3 py-2.5 ${DARK_ROW}`}>{row}</div>
        })}
      </div>
      {hours && <HoursBlock h={hours} />}
    </div>
  )
}

/** A minta-szolgáltatások képpel (a szolgáltatás-szerkesztőben feltölthető kép) — a vendég-oldal listái ezt mutatják. */
// minta-képek a davelopment cikk-képeiből (public/design/szolgaltatas-*.webp) — élesben az üzlet saját feltöltött képe
const SERVICE_IMG = ['/design/szolgaltatas-hajvagas.webp', '/design/szolgaltatas-balayage.webp', '/design/szolgaltatas-ferfi.webp', '/design/szolgaltatas-gellakk.webp']
const SERVICES: [string, string, string, string][] = [
  ['Női hajvágás + szárítás', '60 perc', '11 900 Ft', SERVICE_IMG[0]],
  ['Balayage + vágás', '150 perc · foglaló', '48 000 Ft', SERVICE_IMG[1]],
  ['Férfi hajvágás', '30 perc', '6 500 Ft', SERVICE_IMG[2]],
  ['Géllakk', '60 perc', '8 500 Ft', SERVICE_IMG[3]],
]
/** A szolgáltatás képe kicsiben, a sor elején (lekerekített négyzet). */
// eslint-disable-next-line @next/next/no-img-element
const ServiceThumb = ({ src }: { src: string }) => <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-ui-control object-cover" />

/* ── Az élő koncepció (PublicPlaceView + ProfileCard) az új elemekkel ───────────────────────────────────── */

export const COVER_SAMPLE = '/design/boritokep-minta.webp'
// az élő oldal sötét üveg-kártyája (ProfileCard: fehér 6% + vékony fehér keret + elmosás) — a kit tokenjeivel
const DARK_GLASS = 'border border-white/10 bg-white/[0.06] backdrop-blur-xl' // ui-allow: az élő sötét üveg-kártya
const DARK_ROW = 'rounded-ui-inner border border-white/10 bg-white/[0.04]' // ui-allow: sor a sötét üvegen

/** Az alap arculat háttere (még nincs borítókép): semleges, mély sötét — felül egy halvány fehér fény, alul sötétebb, így
 *  van mélysége, de nem színes; a márkaszín csak a gombokon jelenik meg. */
export function DefaultCover({ color, flat = false }: { /** az üzlet választott alap színe — fentről a saját sötétebb árnyalatába fut */ color?: string | null; /** kikapcsolt sötétítés: egyszínű, átmenet nélkül */ flat?: boolean }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-ui-dark to-black" style={color ? { background: flat ? color : `linear-gradient(to bottom, ${color}, color-mix(in srgb, ${color} 55%, black))` } : undefined}> {/* ui-allow: az üzlet saját borító-színe */}
      <div className="absolute -top-[35%] left-[10%] h-[80%] w-[80%] rounded-full bg-white/[0.07] blur-[120px]" /> {/* ui-allow: halvány fény */}
    </div>
  )
}

/** Logó helyett: az üzlet nevének kezdőbetűi sötét üveg-négyzetben (mint a fotón ülő elemek), fehér betűvel. */
function Monogram({ mobile = false, letters = 'FB' }: { mobile?: boolean; letters?: string }) {
  // a sáv többi eleme (utalvány, nyelvek) Pill md = 36 px — a monogram is ennyi, mobilon és desktopon is
  return <span className={`flex h-9 w-9 items-center justify-center rounded-ui-control font-medium text-white ${ON_PHOTO} ${mobile ? 'text-ui-meta' : 'text-ui-body'}`}>{letters}</span>
}

/** Felső sáv a borítón: az üzlet logója (a mi jelünk csak a foglaló kártya alján), középen a számlálók, jobbra az
 *  ajándékutalvány és a nyelv-váltó. Élőben: `logo` (null → monogram az üzlet kezdőbetűiből), `counts`, `voucher`
 *  (a gomb — null: nincs utalvány), `langs` (a nyelv-váltó). */
export function PageNav({ mobile = false, blank = false, restaurant = false, logo, letters, logoAlt = '', counts, voucher, langs, editIds }: {
  mobile?: boolean; blank?: boolean; restaurant?: boolean
  logo?: string | null; letters?: string; logoAlt?: string; counts?: [string, string][]
  voucher?: React.ReactNode | null; langs?: React.ReactNode
  /** a szerkesztő kijelöléséhez (`data-edit-id`) */
  editIds?: { logo?: string; counts?: string; langs?: string; voucher?: string }
}) {
  const live = logo !== undefined
  const showLogo = live ? !!logo : !blank
  const cnt = counts ?? (restaurant ? [['9', 'asztal'], ['36', 'férőhely']] : [['12', 'szolgáltatás'], ['4', 'munkatárs']])
  return (
    <div className={`relative z-10 flex items-center justify-between gap-3 ${mobile ? 'px-5 pt-5' : 'px-8 pt-6'}`}>
      {/* logó nélkül: monogram (az üzlet nevének kezdőbetűi) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <span data-edit-id={editIds?.logo}>{showLogo ? <img src={live ? logo! : BIZ_LOGO} alt={logoAlt} className="h-9 w-auto max-w-[160px] object-contain" /> : <Monogram mobile={mobile} letters={letters ?? (restaurant ? 'BA' : 'FB')} />}</span>
      {!mobile && cnt.length > 0 && <span data-edit-id={editIds?.counts} className="flex items-center gap-5 text-ui-meta text-white/70">{cnt.map(([n, l], i) => <span key={l} className="flex items-center gap-5">{i > 0 && <span className="h-4 w-px bg-white/20" />}<span><span className="text-white">{n}</span> {l}</span></span>)}</span>}
      {/* jobbra: az ajándékutalvány (ugyanaz a kártya, a vásárlás lépéseivel) és a nyelv-váltó — az aktív nyelv fehér */}
      {/* a sáv jobb oldala: utalvány + nyelvek — mind 36 px magas, egy vonalban (mobilon és desktopon is) */}
      <span className="flex items-center gap-1">
        {live ? (voucher && <span data-edit-id={editIds?.voucher} className="flex items-center">{voucher}</span>) : <Pill tone="onDark" className={ON_PHOTO}><Gift className="h-4 w-4" />{!mobile && 'Ajándékutalvány'}</Pill>}
        <span data-edit-id={editIds?.langs} className="flex items-center gap-1">{live ? langs : ['HU', 'EN', 'DE'].map((l, i) => <Pill key={l} tone={i === 0 ? 'white' : 'onDark'} className={`justify-center ${i ? ON_PHOTO : 'border border-white'}`}>{l}</Pill>)}</span>
      </span>
    </div>
  )
}

/** Az ajándékutalvány-gomb a sávban (a fotón): élőben kattintásra a foglaló kártya az utalvány-vásárlásra vált. */
export function VoucherPill({ label, mobile = false, onClick }: { label: string; mobile?: boolean; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="ui-press flex rounded-full"><Pill tone="onDark" className={ON_PHOTO}><Gift className="h-4 w-4" />{!mobile && label}</Pill></button>
}

/** Nyelv-váltó a sávban: az aktív fehér, a többi sötét üveg. Élőben `onSelect` (ugyanazon az URL-en vált — süti). */
export function LangPills({ langs, onSelect, busy = false }: { langs: { code: string; active: boolean }[]; onSelect: (code: string) => void; busy?: boolean }) {
  return <>{langs.map((l) => <button key={l.code} type="button" disabled={busy} aria-pressed={l.active} onClick={() => onSelect(l.code)} className="ui-press flex rounded-full disabled:opacity-60"><Pill tone={l.active ? 'white' : 'onDark'} className={`justify-center ${l.active ? 'border border-white' : ON_PHOTO}`}>{l.code.toUpperCase()}</Pill></button>)}</>
}

export const SOCIALS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'website']

/** Az üzlet közösségi linkjei kis kör-ikonokként (a Pill sm magassága), a platform-ikon az élő `socialIconDataUri`-ból.
 *  Élőben `links` (a platformot a linkből ismeri fel), új lapon nyílnak. */
export function SocialIcons({ links, className = '' }: { links?: string[]; className?: string }) {
  const items = links ? links.map((url) => ({ url: /^https?:\/\//i.test(url) ? url : `https://${url}`, p: detectPlatform(url) })) : SOCIALS.map((p) => ({ url: '', p }))
  return (
    <span className={`flex gap-1.5 ${className}`}>
      {items.map(({ url, p }, i) => {
        // eslint-disable-next-line @next/next/no-img-element
        const img = <img src={socialIconDataUri(p)} alt={SOCIAL_LABELS[p]} className="h-7 w-7 rounded-full" />
        return url ? <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="ui-press rounded-full" aria-label={SOCIAL_LABELS[p]}>{img}</a> : <span key={p}>{img}</span>
      })}
    </span>
  )
}

// élesben az üzlet galériája, legfeljebb 12 kép
export const GALLERY_TOTAL = 12

/** Képsor a borítón: 3 egymásra csúszó bélyegkép (vékony fehér kerettel) és a többi száma — kattintásra nyílik a galéria.
 *  Élőben `items` (az első 3 látszik) és `onOpen` (melyik képre kattintott). */
export function GalleryStrip({ items, onOpen, className = '' }: { items?: { src: string; t: string }[]; onOpen?: (i: number) => void; className?: string }) {
  const all = items ?? GALLERY_ITEMS
  const shown = (items ? all : GALLERY.map((src) => ({ src, t: '' }))).slice(0, 3)
  const more = (items ? all.length : GALLERY_TOTAL) - shown.length
  return (
    <div className={`flex w-fit items-center gap-2 ${className}`}>
      <span className="flex">
        {shown.map((g, i) => {
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={g.src} alt={g.t} className="h-11 w-11 rounded-ui-control object-cover ring-2 ring-white/80" />
          return onOpen ? <button key={g.src + i} type="button" onClick={() => onOpen(i)} className={`ui-press rounded-ui-control ${i ? '-ml-3' : ''}`}>{img}</button> : <span key={g.src + i} className={i ? '-ml-3' : ''}>{img}</span>
        })}
      </span>
      {more > 0 && (onOpen ? <button type="button" onClick={() => onOpen(3)} className="ui-press rounded-full"><Pill tone="white" size="sm">+{more}</Pill></button> : <Pill tone="white" size="sm">+{more}</Pill>)}
    </div>
  )
}

// a galéria minta-képei felirattal (élesben: az üzlet képei, a felirat az alt-szöveg is)
export const GALLERY_ITEMS = [
  { src: '/landing/teamsection/munkatarsak-davelopment-booking.jpg', t: 'A csapat a szalonban' },
  { src: SERVICE_IMG[1], t: 'Balayage — természetes, napszítta hatás' },
  { src: SERVICE_IMG[3], t: 'Géllakk, három hétig tart' },
  { src: SERVICE_IMG[0], t: 'Női vágás és szárítás' },
  { src: SERVICE_IMG[2], t: 'Férfi hajvágás' },
  { src: COVER_SAMPLE, t: 'A pult és a váróterem' },
]

const GALLERY = GALLERY_ITEMS.slice(0, 3).map((g) => g.src) // a borítón az első 3

/** A galéria megnyitva — a borító fölött sötét, elmosott háttér, középen a kép (a teljes kép látszik, nem vágjuk),
 *  alatta a felirata; fent a számláló és a bezárás, oldalt a lapozó nyilak (mobilon húzással), alul a bélyegképek
 *  (a kiválasztott fehér kerettel). Esc / a háttér is bezárja. */
export function GalleryViewer({ mobile = false, active = 1, items, onClose, onPick, fixed = false }: {
  mobile?: boolean; active?: number; items?: { src: string; t: string }[]
  /** élőben: bezárás, lapozás (a kért index) — `fixed`: a teljes képernyő fölött (nem a szülő dobozán belül) */
  onClose?: () => void; onPick?: (i: number) => void; fixed?: boolean
}) {
  const list = items ?? GALLERY_ITEMS
  const total = items ? list.length : GALLERY_TOTAL
  const cur = list[Math.min(active, list.length - 1)]
  const go = (d: number) => onPick?.((active + d + list.length) % list.length)
  if (!cur) return null
  return (
    <div role={fixed ? 'dialog' : undefined} aria-modal={fixed || undefined} onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose() } : undefined}
      className={`${fixed ? 'fixed z-[300]' : 'absolute z-40'} inset-0 flex flex-col bg-ui-dark/85 text-white backdrop-blur-xl ${mobile ? 'p-4' : 'p-8'}`}>
      <div className="flex items-center justify-between">
        <span className="text-ui-meta text-white/70">{active + 1} / {total}</span>
        <IconButton icon={X} label="Bezárás" size="sm" variant="onDark" className={ON_PHOTO} onClick={onClose} />
      </div>
      <div className={`relative flex min-h-0 flex-1 items-center justify-center ${mobile ? 'py-4' : 'px-16 py-6'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.src} alt={cur.t} className="max-h-full max-w-full rounded-ui-card object-contain" />
        {!mobile && list.length > 1 && <IconButton icon={ArrowLeft} label="Előző" variant="onDark" onClick={onPick ? () => go(-1) : undefined} className={`absolute left-0 top-1/2 -translate-y-1/2 ${ON_PHOTO}`} />}
        {!mobile && list.length > 1 && <IconButton icon={ArrowRight} label="Következő" variant="onDark" onClick={onPick ? () => go(1) : undefined} className={`absolute right-0 top-1/2 -translate-y-1/2 ${ON_PHOTO}`} />}
        {/* mobilon a kép két szélére koppintva lapoz (a húzás helyett / mellett) */}
        {mobile && onPick && list.length > 1 && <><button type="button" aria-label="Előző" onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" /><button type="button" aria-label="Következő" onClick={() => go(1)} className="absolute inset-y-0 right-0 w-1/3" /></>}
      </div>
      {cur.t && <div className="text-center text-ui-body text-white/85">{cur.t}</div>}
      {mobile && (
        <div className="mt-3 flex justify-center gap-1.5">{list.map((g, i) => <span key={g.src + i} className={`h-1.5 rounded-full ${i === active ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`} />)}</div>
      )}
      {/* p-1: a kiválasztott bélyegkép fehér kerete ne vágódjon le (mobilon a sor levágja a túllógó képeket) */}
      <div className={`mt-3 flex justify-center gap-2 p-1 ${mobile ? 'overflow-hidden' : ''}`}>
        {list.map((g, i) => {
          // eslint-disable-next-line @next/next/no-img-element
          const img = <img src={g.src} alt="" className={`shrink-0 rounded-ui-control object-cover ${mobile ? 'h-12 w-12' : 'h-16 w-16'} ${i === active ? 'ring-2 ring-white' : 'opacity-50'}`} />
          return onPick ? <button key={g.src + i} type="button" onClick={() => onPick(i)} className="ui-press shrink-0 rounded-ui-control">{img}</button> : <span key={g.src + i}>{img}</span>
        })}
      </div>
    </div>
  )
}

export type LiveCard = 'dark' | 'black' | 'glass' | 'white'
// a foglaló kártya három stílusa (a szerkesztő Arculat › Foglaló kártya): felület, szöveg, sorok, pillek, mellékszöveg
const LIVE_CARD = {
  dark: { box: `text-white ${DARK_GLASS}`, row: DARK_ROW, pill: 'onDark', meta: 'text-white/55', dark: true },
  black: { box: 'bg-ui-dark text-white', row: 'rounded-ui-inner bg-white/10', pill: 'onDark', meta: 'text-white/55', dark: true },
  glass: { box: 'border border-white/25 bg-white/15 text-white backdrop-blur-lg', row: 'rounded-ui-inner bg-white/10', pill: 'onDark', meta: 'text-white/65', dark: true }, // ui-allow: világos üveg-kártya
  white: { box: 'bg-white text-ui-dark shadow-ui-float', row: 'rounded-ui-inner bg-ui-cell', pill: 'cell', meta: 'text-ui-muted', dark: false },
} as const

/** Üveg-mező a sötét felületeken (a foglaló kártya, a belépés mobilon): áttetsző, vékony fehér kerettel. */
// NINCS backdrop-blur: iPhone Safarin a beviteli mezőn a háttér-elmosás gépelés közben a beírt szöveget is elmossa
// (bejelentkezés, foglalóoldal űrlapjai) — helyette kicsit erősebb üveg-háttér
export const GLASS_FIELD = 'flex h-11 w-full items-center rounded-ui-control border border-white/10 bg-white/[0.08] px-4 text-ui-body text-white' // ui-allow: üveg-mező sötét felületen
/** Ugyanez beviteli mezőre (input / select): `flex` NÉLKÜL — iPhone Safarin a flexes inputban a beírt szöveg feljebb
 *  csúszik és levágódik. */
export const GLASS_INPUT = 'block h-11 w-full rounded-ui-control border border-white/10 bg-white/[0.08] px-4 text-ui-body text-white' // ui-allow: üveg-mező sötét felületen

export type CardTone = (typeof LIVE_CARD)[LiveCard]
/** A foglaló kártya stílusa (Beállítások › Foglalóoldal › Arculat): felület, sorok, pillek, mellékszöveg — az élő kártya is ezt használja. */
export const cardTone = (card: LiveCard = 'dark'): CardTone => LIVE_CARD[card] ?? LIVE_CARD.dark

/** Egy választható sor a kártyán: a kiválasztott a márkaszínben, a többi a kártya sor-stílusában. Élőben `onClick`
 *  (gombként), `wrapMeta` (a mellékszöveg több sorba törhet). */
export function CardRow({ c, on = false, leading, title, meta, trailing, onClick, wrapMeta = false, editId }: { c: CardTone; on?: boolean; leading?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode; onClick?: () => void; wrapMeta?: boolean; editId?: string }) {
  const cls = `flex w-full items-center gap-3 px-3 py-2.5 text-left ${on ? `rounded-ui-inner ${ACCENT}` : c.row}`
  const body = (
    <>
      {leading}
      <span className="min-w-0 flex-1"><span className="block truncate text-ui-body">{title}</span>{meta && <span className={`block text-ui-label ${wrapMeta ? '' : 'truncate'} ${on ? 'opacity-60' : c.meta}`}>{meta}</span>}</span>
      {trailing}
    </>
  )
  return onClick ? <button type="button" data-edit-id={editId} onClick={onClick} className={`${cls} ui-press`}>{body}</button> : <div data-edit-id={editId} className={cls}>{body}</div>
}
/** Pill-választó a kártyán: a kiválasztott kiemelve (sötét kártyán fehér, fehéren sötét). */
const cardPills = (c: CardTone, opts: string[], on: number) => opts.map((t, i) => <Pill key={t} size="sm" tone={i === on ? (c.dark ? 'white' : 'dark') : c.pill}>{t}</Pill>)
/** Pill-választó élőben: kattintható pillek (`onSelect`), a kiválasztott kiemelve. */
export function CardPills({ c, options, active, onSelect, className = '' }: { c: CardTone; options: string[]; active: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((t, i) => <button key={`${t}-${i}`} type="button" aria-pressed={i === active} onClick={() => onSelect(i)} className="ui-press rounded-full"><Pill size="sm" tone={i === active ? (c.dark ? 'white' : 'dark') : c.pill}>{t}</Pill></button>)}
    </div>
  )
}
/** A nap-sáv cellái a kártya tónusában: a sima nap üveg / szürke, a nem foglalható (zárva, betelt, elmúlt) erősen sötétítve. */
const CARD_DAY = {
  cell: (c: CardTone) => (c.dark ? 'border border-white/10 bg-white/[0.04] text-white' : 'bg-ui-cell text-ui-text'), // ui-allow: sötét kártyán a nap-cellák
  off: (c: CardTone) => (c.dark ? 'bg-black/40 text-white/20' : 'bg-ui-cell text-ui-muted opacity-40'), // ui-allow: sötét kártyán a zárt nap
}
const SAMPLE_CARD_DAYS: PickDay[] = ([['Ma', 5], ['P', 6], ['Szo', 7], ['V', 8], ['H', 9], ['K', 10], ['Sze', 11], ['Cs', 12], ['P', 13]] as const)
  .map(([d, n], i) => ({ key: String(n), d, n, today: i === 0, on: i === 1, off: d === 'V' || i === 0 }))

/** A napok a kártyán (élőben): a design `DayPicker`-e a kártya tónusában — a választott a márkaszínben, ami nem foglalható,
 *  halvány. `calendar`: a naptár-gomb (a távolabbi napokhoz) — a cella osztályát a blokk adja, hogy a tónusban legyen. */
export function CardDayPicker({ c, days = SAMPLE_CARD_DAYS, onPick, className = '' }: { c: CardTone; days?: PickDay[]; onPick?: (key: string) => void; className?: string }) {
  return <DayPicker scroll className={className} days={days} onPick={onPick ? (k) => { if (!days.find((x) => x.key === k)?.off) onPick(k) } : undefined}
    cell={CARD_DAY.cell(c)} onClass={ACCENT} offClass={CARD_DAY.off(c)} todayClass={c.dark ? 'ring-1 ring-inset ring-white/70' : 'ring-1 ring-inset ring-ui-dark'} />
}
/** A szabad időpontok a kártyán (élőben): a design `SlotGrid`-je a kártya tónusában, a választott a márkaszínben. */
export function CardSlotGrid({ c, slots, on, onPick, className = '' }: { c: CardTone; slots: string[]; on?: string; onPick: (t: string) => void; className?: string }) {
  return <SlotGrid className={className} slots={slots} on={on ?? ''} busy={[]} onPick={onPick} cell={CARD_DAY.cell(c)} onClass={ACCENT} />
}

/** A szolgáltatás képe kicsiben a kártya sorában (élőben: `src`). */
export function CardThumb({ src, alt = '' }: { src: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-11 w-11 shrink-0 rounded-ui-control object-cover" />
}
/** Mező a kártyán: sötét kártyán üveg-mező, fehéren a kit mezője. `phone`: elöl az ország zászlója és hívószáma — a
 *  számból ismerjük fel (+36 → Magyarország), így országot / várost külön nem kérünk. */
function CardField({ c, label, value, phone = false }: { c: CardTone; label: string; value: string; phone?: boolean }) {
  const flag = phone && <span className="flex shrink-0 items-center gap-1.5 pr-1"><span className="text-ui-row leading-none">🇭🇺</span><span className={c.dark ? 'text-white/50' : 'text-ui-muted'}>+36</span></span>
  return (
    <div>
      <div className={`mb-1.5 text-ui-label ${c.meta}`}>{label}</div>
      {c.dark ? <div className={`${GLASS_FIELD} gap-2`}>{flag}{value}</div> : phone ? <span className="relative block"><span className="absolute left-4 top-1/2 -translate-y-1/2">{flag}</span><Input defaultValue={value} className="pl-[72px]" /></span> : <Input defaultValue={value} />}
    </div>
  )
}
/** A vendég adatai egymás alatt (keskeny kártyán is elfér): név, telefon zászlóval, e-mail. */
const GuestFields = ({ c }: { c: CardTone }) => (
  <div className="mt-3 space-y-3"><CardField c={c} label="Teljes név" value="Juhász Hanna" /><CardField c={c} label="Telefon" value="30 555 1234" phone /><CardField c={c} label="E-mail" value="hanna.juhasz@gmail.com" /></div>
)
/** A feltételek egy mondatban, a „foglalási feltételek” link a teljes listát nyitja (TermsPanel). */
const TermsLine = ({ c, extra = '' }: { c: CardTone; extra?: string }) => (
  <div className={`mt-2 text-ui-label leading-relaxed ${c.meta}`}>A foglalással elfogadod az ÁSZF-et és a <span className={`underline underline-offset-4 ${c.dark ? 'text-white' : 'text-ui-text'}`}>foglalási feltételeket</span>.{extra}</div>
)

/** A foglalási feltételek a kártyán (a „foglalási feltételek” linkre): az üzlet saját szabályai pontokba szedve —
 *  lemondás, késés, előleg, ha nem jön el —, alul Rendben (vissza az adatokhoz). A szöveget az üzlet a Beállításokban írja. */
function TermsPanel({ c, restaurant = false }: { c: CardTone; restaurant?: boolean }) {
  const rows: [typeof Clock, string, string][] = restaurant
    ? [[CalendarPlus, 'Lemondás', 'Díjmentesen az érkezés előtt 3 óráig, a foglalási e-mailből egy kattintással.'], [Clock, 'Késés', 'Az asztalt 15 percig tartjuk — ha késel, hívj minket.'], [Users, 'Létszám', '8 fő fölött a különterem; a létszámot előző nap 12 óráig lehet módosítani.'], [X, 'Ha nem jössz el', 'Kétszeri meg nem jelenés után az online foglalást letiltjuk.']]
    : [[CalendarPlus, 'Lemondás', 'Díjmentesen 24 órával előtte, a foglalási e-mailből egy kattintással.'], [Clock, 'Késés', '15 perc késés felett a szolgáltatás rövidülhet, vagy új időpontot adunk.'], [CreditCard, 'Előleg', '10 000 Ft, a végösszegbe beszámítjuk. 24 órán belüli lemondásnál nem jár vissza.'], [X, 'Ha nem jössz el', 'Az előleg elvész; kétszeri meg nem jelenés után az online foglalást letiltjuk.']]
  return (
    <>
      <div className="mt-5 text-ui-title font-light">Foglalási feltételek</div>
      <div className={`mt-1 text-ui-meta ${c.meta}`}>{restaurant ? 'Bistro Andrássy' : 'Fodrászat Budapest'} · frissítve: 2026. okt. 1.</div>
      <div className="mt-3 space-y-1">{rows.map(([I, t, d]) => <CardRow key={t} c={c} leading={<IconCircle tone={c.dark ? 'onDark' : 'cell'} size="sm" icon={I} />} title={t} meta={d} />)}</div>
      <div className={`mt-3 text-ui-label ${c.meta}`}>A teljes ÁSZF és az adatkezelési tájékoztató: <span className="underline underline-offset-4">megnyitás</span></div>
      <Button className={`mt-5 w-full ${ACCENT}`}>Rendben</Button>
    </>
  )
}
/** A választott eddig (szolgáltatás · munkatárs) egy sorban, Módosít — a 2. lépéstől. */
const Picked = ({ c, t, m }: { c: CardTone; t: string; m: string }) => (
  <CardRow c={c} leading={<Avatar size="sm" src={`${AV}/viktoria.webp`} />} title={t} meta={m} trailing={<Pill size="sm" tone={c.dark ? 'white' : 'cell'}>Módosít</Pill>} />
)

/** Fizetés a kártyán — a Stripe beágyazott fizetési mezője (Payment Element), a kártya stílusában: fent a gyors
 *  fizetés (Apple Pay / Google Pay — amelyik az eszközön van), alatta kártyával: szám, lejárat, CVC; alul hogy a Stripe
 *  kezeli (a kártyaadat hozzánk nem jut el). Az előleg és az utalvány is ezt használja. */
function StripePay({ c }: { c: CardTone }) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-1.5"><Button variant={c.dark ? 'onDark' : 'cell'}>Apple Pay</Button><Button variant={c.dark ? 'onDark' : 'cell'}>Google Pay</Button></div>
      <div className={`my-3 flex items-center gap-3 text-ui-label ${c.meta}`}><span className={`flex-1 border-t ${c.dark ? 'border-white/15' : 'border-ui-divider'}`} />vagy kártyával<span className={`flex-1 border-t ${c.dark ? 'border-white/15' : 'border-ui-divider'}`} /></div>
      <div className="space-y-3">
        <CardField c={c} label="Kártyaszám" value="4242 4242 4242 4242" />
        <div className="grid grid-cols-2 gap-3"><CardField c={c} label="Lejárat" value="08 / 28" /><CardField c={c} label="CVC" value="•••" /></div>
      </div>
      <div className={`mt-2 flex items-center gap-1.5 text-ui-label ${c.meta}`}><Lock className="h-3 w-3" />Biztonságos fizetés: Stripe — a kártyaadatokat mi nem látjuk.</div>
    </>
  )
}

/** Ajándékutalvány vásárlása ugyanazon a kártyán (a fejléc „Ajándékutalvány” gombjára): 1. melyik és mennyi, 2. kinek
 *  és mikor menjen, 3. a vevő adatai — és ha az üzletnél be van kapcsolva a számlázó (Számlázz.hu), a számlázási adatok —,
 *  4. fizetés; utána a kész utalvány. */
function VoucherStep({ c, step, restaurant }: { c: CardTone; step: number; restaurant: boolean }) {
  const next = (t = 'Tovább') => <Button className={`mt-5 w-full ${ACCENT}`}>{t}<ArrowRight className="h-4 w-4" /></Button>
  if (step === 0) return (
    <>
      <div className="mt-5 text-ui-title font-light">Ajándékutalvány</div>
      <div className={`mt-1 text-ui-meta ${c.meta}`}>{restaurant ? 'Az étteremben váltható be, 1 évig érvényes.' : 'Bármelyik szolgáltatásra beváltható, 1 évig érvényes.'}</div>
      <div className="mt-3 space-y-1">
        {(restaurant ? [['Szabad összegű', 'bármire beváltható', ''], ['Vacsora két főre', 'háromfogásos menü', '24 000 Ft'], ['Kóstolómenü', 'borpárosítással, két főre', '38 000 Ft']] : [['Szabad összegű', 'bármire beváltható', ''], ['Balayage + vágás', '150 perc', '48 000 Ft'], ['Géllakk', '60 perc', '8 500 Ft']]).map(([t, m, p], i) => (
          <CardRow key={t} c={c} on={i === 0} leading={<IconCircle tone={i === 0 ? 'dark' : c.dark ? 'onDark' : 'cell'} size="md" icon={Gift} />} title={t} meta={m} trailing={p && <span className="text-ui-body">{p}</span>} />
        ))}
      </div>
      <div className={`mt-4 text-ui-label ${c.meta}`}>Összeg</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{cardPills(c, ['10 000', '20 000', '30 000', 'Egyedi'], 1)}</div>
      {next()}
    </>
  )
  if (step === 1) return (
    <>
      <div className="mt-5 text-ui-title font-light">Kinek szól?</div>
      <div className="mt-3 space-y-3">
        <CardField c={c} label="A megajándékozott neve" value="Lili" />
        <CardField c={c} label="Üzenet (rákerül az utalványra)" value="Boldog szülinapot! Kényeztesd magad." />
      </div>
      <div className={`mt-4 text-ui-label ${c.meta}`}>Hogyan kapja meg?</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{cardPills(c, ['E-mailben most', 'Megadott napon', 'Kinyomtatom'], 1)}</div>
      <div className="mt-3 space-y-3"><CardField c={c} label="Lili e-mail címe" value="lili.kovacs@gmail.com" /><CardField c={c} label="Mikor" value="november 14., 8:00" /></div>
      {next()}
    </>
  )
  if (step === 2) return (
    <>
      <div className="mt-5 text-ui-title font-light">Adataid</div>
      <GuestFields c={c} />
      {/* csak ha az üzletnél be van kapcsolva a számlázó: a számlához kell a cím (a foglalásnál nem kérünk címet) */}
      <div className={`mt-4 border-t border-dashed pt-3 ${c.dark ? 'border-white/15' : 'border-ui-divider'}`}>
        <div className="flex items-center justify-between"><span className="text-ui-body">Számla</span><span className="flex items-center gap-2 text-ui-meta">Cégként vásárolok<MockSwitch defaultOn={false} /></span></div>
        <div className="mt-3 space-y-3">
          <CardField c={c} label="Számlázási név" value="Juhász Hanna" />
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3"><CardField c={c} label="Irányítószám" value="1137" /><CardField c={c} label="Város" value="Budapest" /></div>
          <CardField c={c} label="Utca, házszám" value="Pozsonyi út 14." />
        </div>
        <div className={`mt-2 text-ui-label ${c.meta}`}>A számlát a {restaurant ? 'Bistro Andrássy' : 'szalon'} számlázója állítja ki, e-mailben kapod.</div>
      </div>
      {next()}
    </>
  )
  if (step === 3) return (
    <>
      <div className="mt-5 text-ui-title font-light">Fizetés</div>
      <div className="mt-3 space-y-1">
        <CardRow c={c} title="Ajándékutalvány · szabad összegű" meta="Lilinek · november 14., 8:00, e-mailben" trailing={<span className="text-ui-body">20 000 Ft</span>} />
        <CardRow c={c} title="Számla" meta="Juhász Hanna · 1137 Budapest, Pozsonyi út 14." />
      </div>
      <StripePay c={c} />
      {next('Fizetés · 20 000 Ft')}
    </>
  )
  return (
    <div className="mt-2 flex flex-col items-center text-center">
      <IconCircle size="lg" icon={Check} className={ACCENT} />
      <div className="mt-4 text-ui-sub font-light">Kész, Hanna!</div>
      <div className={`mt-1 text-ui-meta ${c.meta}`}>Lili november 14-én 8:00-kor kapja meg e-mailben. A másolatot és a számlát elküldtük neked.</div>
      <div className="mt-5 w-full text-left"><VoucherCard small bg="yellow" to="Lili" restaurant={restaurant} /></div>
      <div className="mt-2 grid w-full grid-cols-2 gap-1.5"><Button variant={c.dark ? 'onDark' : 'cell'} icon={Download}>Letöltés (PDF)</Button><Button variant={c.dark ? 'onDark' : 'cell'} icon={Printer}>Nyomtatás</Button></div>
    </div>
  )
}

/** A foglaló lépései — szalon: Szolgáltatás · Szakember · Időpont · Adatok (+ Kész); étterem: Időpont · Adatok ·
 *  Összefoglalás (+ Kész). */
/** A szerkesztőben a kártyán kijelölt elem (21.6.3): időpontok, megjegyzés-mező, a feltételek szövege, a köszönő cím. */
export type CardSel = 'slots' | 'note' | 'terms' | 'done' | 'staff'
/** Kijelölés a kártyán: ugyanaz a sárga keret, mint a borítón (`sel`), fölötte a szerkesztő gyors-sávja (`quick`). */
function SelWrap({ on, quick, children }: { on: boolean; quick?: React.ReactNode; children: React.ReactNode }) {
  if (!on) return <>{children}</>
  return <>{quick && <div className="my-3">{quick}</div>}<div className="rounded-ui-inner outline-dashed outline-[3px] outline-offset-4 outline-ui-yellow">{children}</div></>
}

function CardStep({ c, step, restaurant, sel, quick }: { c: CardTone; step: number; restaurant: boolean; sel?: CardSel; quick?: React.ReactNode }) {
  const slots = { cell: CARD_DAY.cell(c), onClass: ACCENT, busyClass: c.dark ? 'text-white/30 line-through' : 'ui-hatch-cell text-ui-muted line-through' }
  const next = (t = 'Tovább') => <Button className={`mt-5 w-full ${ACCENT}`}>{t}<ArrowRight className="h-4 w-4" /></Button>
  if (restaurant) {
    if (step === 0) return (
      <>
        <div className="mt-5 text-ui-title font-light">Hányan jöttök?</div>
        <div className="mt-2 grid grid-cols-6 gap-1.5">{['1', '2', '3', '4', '5', '6+'].map((n, i) => <Pill key={n} tone={i === 1 ? (c.dark ? 'white' : 'dark') : c.pill} className="justify-center">{n}</Pill>)}</div>
        <div className="mt-5 text-ui-title font-light">Mikor?</div>
        <CardDayPicker c={c} className="mt-2" />
        <div className="mt-2"><SelWrap on={sel === 'slots'} quick={quick}><SlotGrid {...slots} slots={['17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']} on="19:30" busy={['18:30', '20:00']} /></SelWrap></div>
        <div className="mt-3 flex items-center justify-between"><span className="text-ui-body">Teraszon, ha lehet</span><span className="flex gap-1">{cardPills(c, ['Mindegy', 'Terasz'], 1)}</span></div>
        {next()}
      </>
    )
    if (step === 1) return (
      <>
        <div className="mt-5 text-ui-title font-light">Adataid</div>
        <GuestFields c={c} />
        <div className={`mt-4 text-ui-label ${c.meta}`}>Milyen alkalomból? (nem kötelező)</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{cardPills(c, ['Születésnap', 'Évforduló', 'Üzleti', 'Más'], 0)}</div>
        <div className="mt-3"><SelWrap on={sel === 'note'} quick={quick}><CardField c={c} label="Megjegyzés" value="Születésnapi torta 21:00-ra" /></SelWrap></div>
        {next()}
      </>
    )
    if (step === 2) return (
      <>
        <div className="mt-5 text-ui-title font-light">Összefoglalás</div>
        <div className="mt-3 space-y-1">
          {([['Mikor', 'péntek, nov. 7. · 19:30'], ['Hányan', '2 fő · terasz'], ['Név', 'Juhász Hanna · +36 30 555 1234'], ['Alkalom', 'Születésnap — torta 21:00-ra']] as const).map(([k, v]) => <CardRow key={k} c={c} title={v} meta={k} />)}
        </div>
        <SelWrap on={sel === 'terms'} quick={quick}><TermsLine c={c} extra=" Az asztalt 15 percig tartjuk." /></SelWrap>
        {next('Foglalás véglegesítése')}
      </>
    )
  } else {
    if (step === 0) return (
      <>
        <div className="mt-5 text-ui-title font-light">Mit szeretnél?</div>
        <div className="mt-2 flex gap-1.5">{cardPills(c, ['Mind', 'Hajvágás', 'Festés', 'Köröm'], 0)}</div>
        <div className="mt-3 space-y-1">{SERVICES.map(([n, d, p, img], i) => <CardRow key={n} c={c} on={i === 1} leading={<ServiceThumb src={img} />} title={n} meta={d} trailing={<span className="text-ui-body">{p}</span>} />)}</div>
        {next()}
      </>
    )
    if (step === 1) return (
      <>
        <div className="mt-5 text-ui-title font-light">Kihez szeretnél menni?</div>
        <div className={`mt-1 text-ui-meta ${c.meta}`}>Balayage + vágás · 150 perc</div>
        <div className="mt-3 space-y-1">
          <CardRow c={c} leading={<IconCircle tone={c.dark ? 'onDark' : 'cell'} size="md" icon={Users} />} title="Bárki" meta="a legkorábbi szabad időpont" trailing={<span className="text-ui-meta">ma 14:30</span>} />
          {([['viktoria', 'Viktória', 'Senior stylist · festés, balayage', 'ma 14:30', true], ['szabina', 'Szabina', 'Stylist · festés, köröm', 'holnap 10:00', false], ['dave', 'Dávid', 'Tulajdonos · vágás', 'csüt. 13:00', false]] as const).map(([img, n, r, nx, on]) => (
            <div key={n}>
              <CardRow c={c} on={on} leading={<Avatar size="md" src={`${AV}/${img}.webp`} />} title={n} meta={r} trailing={<span className="text-ui-meta">{nx}</span>} />
              {/* a kiválasztott bemutatkozása (a munkatárs profiljából: bio, Instagram) */}
              {on && (
                <SelWrap on={sel === 'staff'} quick={quick}>
                <div className={`mt-1 px-3 py-2.5 ${c.row}`}>
                  <div className="text-ui-meta leading-relaxed">12 éve festek, a balayage és a természetes szőke a kedvencem. Ha nem tudod, mit szeretnél, egy rövid konzultációval kezdünk.</div>
                  <div className={`mt-2 flex items-center gap-2 text-ui-label ${c.meta}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={socialIconDataUri('instagram')} alt="" className="h-6 w-6 rounded-full" />@viktoria.hair — munkái
                  </div>
                </div>
                </SelWrap>
              )}
            </div>
          ))}
        </div>
        {next()}
      </>
    )
    if (step === 2) return (
      <>
        <div className="mt-5"><Picked c={c} t="Balayage + vágás · Viktória" m="150 perc · 48 000 Ft" /></div>
        <div className="mt-5 text-ui-title font-light">Mikor legyen?</div>
        <CardDayPicker c={c} className="mt-2" />
        <SlotGrid className="mt-2" {...slots} />
        {next()}
      </>
    )
    if (step === 3) return (
      <>
        <div className="mt-5"><Picked c={c} t="kedd, nov. 11. · 13:30" m="Balayage + vágás · Viktória" /></div>
        <div className="mt-5 text-ui-title font-light">Adataid</div>
        <GuestFields c={c} />
        <div className={`mt-4 text-ui-label ${c.meta}`}>A szalon kérdése: jártál már nálunk festésen?</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">{cardPills(c, ['Igen', 'Nem', 'Nem tudom'], 1)}</div>
        <div className="mt-3 flex items-center justify-between"><span className="text-ui-meta">Kérek hírlevelet (akciók, újdonságok)</span><MockSwitch defaultOn={false} /></div>
        <TermsLine c={c} extra=" Foglaló: 10 000 Ft, a következő lépésben — a helyszínen beszámít a végösszegbe." />
        {next('Tovább a foglalóhoz · 10 000 Ft')}
      </>
    )
    if (step === 4) return (
      <>
        <div className="mt-5"><Picked c={c} t="kedd, nov. 11. · 13:30" m="Balayage + vágás · Viktória · 48 000 Ft" /></div>
        <div className="mt-5 text-ui-title font-light">Foglaló</div>
        <div className={`mt-1 text-ui-meta ${c.meta}`}>10 000 Ft most, a többit a szalonban fizeted — a végösszegbe beszámítjuk. 24 órán belüli lemondásnál nem jár vissza.</div>
        <StripePay c={c} />
        {next('Fizetés · 10 000 Ft')}
      </>
    )
  }
  // Kész
  return (
    <div className="mt-2 flex flex-col items-center text-center">
      <IconCircle size="lg" icon={Check} className={ACCENT} />
      <div className="mt-4"><SelWrap on={sel === 'done'} quick={quick}><div className="text-ui-sub font-light">{restaurant ? 'Várunk, Hanna!' : 'Lefoglaltuk, Hanna!'}</div></SelWrap></div>
      <div className={`mt-1 text-ui-meta ${c.meta}`}>A visszaigazolást elküldtük ide: hanna.juhasz@gmail.com</div>
      <div className={`mt-5 w-full px-4 py-4 text-left ${c.row}`}>
        <div className={`text-ui-meta ${c.meta}`}>{restaurant ? 'péntek, nov. 7. · 2 fő · terasz' : 'kedd, nov. 11. · Viktória'}</div>
        <div className="text-ui-num font-light leading-none">{restaurant ? '19:30' : '13:30'}</div>
        <div className={`mt-1 text-ui-meta ${c.meta}`}>{restaurant ? 'Bistro Andrássy · Születésnap' : 'Balayage + vágás · foglaló fizetve'}</div>
      </div>
      <div className="mt-2 grid w-full grid-cols-2 gap-1.5"><Button variant={c.dark ? 'onDark' : 'cell'} icon={CalendarPlus}>Naptárba</Button><Button variant={c.dark ? 'onDark' : 'cell'} icon={MapPin}>Útvonal</Button></div>
      <div className={`mt-3 text-ui-label ${c.meta}`}>Közbejött valami? <span className="underline underline-offset-4">Lemondás vagy módosítás</span></div>
    </div>
  )
}

/** Mit visz végig a kártya: foglalást vagy ajándékutalvány-vásárlást. */
export type LiveFlow = 'booking' | 'voucher'

/** A foglaló kártya (élesben a ProfileCard): fent az állapotsor (vissza, pötty-haladás, „2/4”), alatta a lépés, alul a
 *  rendszer jele. `card`: sötét üveg (alap), fekete, világos üveg vagy fehér. `step`: szalonnál 0–4 (a 4. az előleg), étteremnél 0–2,
 *  utána a Kész (szalon 5, étterem 3) — ott nincs állapotsor. `flow`: foglalás vagy utalvány-vásárlás; `terms`: a
 *  foglalási feltételek nyitva (az Adatok lépés linkjéről). `sheet`: mobilon a felcsúszó lap. */
function LiveBookingCard({ className = '', card = 'dark', sheet = false, step = 0, restaurant = false, flow = 'booking', terms = false, sel, quick }: { className?: string; card?: LiveCard; sheet?: boolean; step?: number; restaurant?: boolean; flow?: LiveFlow; terms?: boolean; sel?: CardSel; quick?: React.ReactNode }) {
  const c = LIVE_CARD[card]
  const total = flow === 'voucher' ? 4 : restaurant ? 3 : 5 // szalon: az 5. az előleg (ha az üzlet kér előleget)
  return (
    // `sheet`: a telefon alján felcsúszó lap — felül a kártya íve, alul a telefon sarka, így az üveg is pontosan ott ér véget
    <div className={`p-6 ${sheet ? 'rounded-t-ui-card rounded-b-ui-container' : 'rounded-ui-card'} ${c.box} ${className}`}>
      {step < total && (
        <div className="flex items-center justify-between">
          <IconButton icon={ArrowLeft} label="Vissza" size="sm" variant={c.dark ? 'onDark' : 'cell'} />
          <span className="flex items-center gap-1.5">{Array.from({ length: total }, (_, i) => <span key={i} className={`h-1.5 rounded-full ${i === step ? `w-6 ${c.dark ? 'bg-white' : 'bg-ui-dark'}` : `w-1.5 ${c.dark ? 'bg-white/30' : 'bg-ui-dark/20'}`}`} />)}</span>
          <span className={`text-ui-meta ${c.meta}`}>{step + 1}/{total}</span>
        </div>
      )}
      {terms ? <TermsPanel c={c} restaurant={restaurant} /> : flow === 'voucher' ? <VoucherStep c={c} step={step} restaurant={restaurant} /> : <CardStep c={c} step={step} restaurant={restaurant} sel={sel} quick={quick} />}
      <div className="mt-4 flex justify-center"><PoweredBy dark={c.dark} /></div>
    </div>
  )
}

/** Az élő koncepció az új elemekkel: teljes képes borító (az üzlet fotója) felül és alul sötétedő átmenettel, fent a
 *  sáv, desktopon bal alul az üzlet (név, cím, értékelés, leírás, fő gomb + legközelebbi időpont), jobbra a sötét
 *  üveg-kártya a foglalóval; mobilon alul az üzlet és a gomb, a foglaló felcsúszó sötét üveg-lapon. */
export type LiveArea = 'cover' | 'nav' | 'gallery' | 'intro' | 'desc' | 'rating' | 'social' | 'cta' | 'card'

// a két minta-üzlet adatai: szalon (időpont) és étterem (asztal)
const RESTO_PHOTO = '/landing/tips/asztalfoglalas-online-etterem-davelopment-booking.jpg'
const BIZ = {
  salon: { name: 'Fodrászat Budapest', addr: '1061 Budapest, Andrássy út 12.', desc: 'Belvárosi szalon 2012 óta: vágás, festés, balayage és köröm — kedd–szombat este 8-ig.', cta: 'Időpontot foglalok', next: 'ma 14:30', photo: COVER_SAMPLE },
  restaurant: { name: 'Bistro Andrássy', addr: '1061 Budapest, Andrássy út 34.', desc: 'Magyar konyha szezonális menüvel, terasszal a sugárúton. Csoportoknak különterem.', cta: 'Asztalt foglalok', next: 'ma 19:30 · 2 fő', photo: RESTO_PHOTO },
}

/** `sel`: a szerkesztőben kijelölt terület sárga szaggatott kerettel (21.6) — körvonal, így nem tolja el az elrendezést.
 *  `info`: nyitva a „Jó tudni” teljes listája — desktopon felugró ablak, mobilon lap. `gallery`: nyitva a galéria.
 *  `blank`: az alap arculat — új üzlet, még semmi nincs beállítva: fotó helyett semleges sötét háttér, logó helyett
 *  monogram, és ami üres (galéria, értékelés, közösségi, leírás, jó tudni), az nem jelenik meg.
 *  `step`: a foglaló kártya lépése (LiveBookingCard); `restaurant`: az étterem (asztalfoglalás, TripAdvisor). */
export function LiveStage({ mobile = false, open = false, photo, sel, card = 'dark', info, gallery = false, blank = false, step = 0, restaurant = false, flow = 'booking', terms = false, paused = false, quick, desc, accent, cardSel }: { /** az online foglalás szünetel (az előfizetés lejárt / szünetel): a foglaló kártya és a CTA helyén a BookingPausedCard */ paused?: boolean; mobile?: boolean; open?: boolean; photo?: string; sel?: LiveArea; card?: LiveCard; info?: 'open'; gallery?: boolean; blank?: boolean; step?: number; restaurant?: boolean; flow?: LiveFlow; terms?: boolean
  /** helyben szerkesztés (21.6.3): a kijelölt elem (`sel` / `cardSel`) fölötti gyors-sáv */ quick?: React.ReactNode
  /** a leírás szövege (pl. szerkesztés közben, kiemeléssel) — mobilon csak kijelölve látszik */ desc?: React.ReactNode
  /** a márkaszín és a gomb-betűszín [háttér, betű] — a `ui-accent` elemek ezt kapják */ accent?: [string, string]
  /** a foglaló kártyán kijelölt elem */ cardSel?: CardSel }) {
  const b = BIZ[restaurant ? 'restaurant' : 'salon']
  const hl = (a: LiveArea) => (sel === a ? 'rounded-ui-inner outline-dashed outline-[3px] outline-offset-8 outline-ui-yellow' : '')
  return (
    <div className={`relative overflow-hidden rounded-ui-container bg-ui-dark ${mobile ? 'h-[780px] w-[360px] shrink-0' : 'min-h-[780px]'}`} style={accent ? { ['--biz-accent' as string]: accent[0], ['--biz-accent-fg' as string]: accent[1] } : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {blank ? <DefaultCover /> : <img src={photo ?? b.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-ui-dark/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ui-dark/90 to-transparent" />
      {sel === 'cover' && <span className="pointer-events-none absolute inset-3 z-20 rounded-ui-card border-[3px] border-dashed border-ui-yellow" />}
      <div className={hl('nav')}><PageNav mobile={mobile} blank={blank} restaurant={restaurant} /></div>
      {/* mobilon nyitott lapnál a hős-rész nem kell: a lap eltakarja, és az üvegen átderengene (pl. a sárga gomb) */}
      <div className={`absolute z-10 text-white ${mobile ? 'inset-x-5 bottom-8' : 'bottom-10 left-8 max-w-[46%]'} ${mobile && (open || info === 'open') ? 'invisible' : ''}`}>
        {!blank && <GalleryStrip className={`mb-4 ${hl('gallery')}`} />}
        <div className={hl('intro')}>
          <div className={`font-light leading-none ${mobile ? 'text-ui-num' : 'text-ui-page'}`}>{b.name}</div>
          <div className="mt-2 flex items-center gap-1.5 text-ui-meta text-white/65"><MapPin className="h-3.5 w-3.5" />{b.addr}</div>
        </div>
        {/* az értékelések egymás mellett, alattuk a közösségi linkek (élesben a social_links, a platform a linkből ismerve) */}
        {!blank && <>
        <div className={`mt-3 w-fit ${hl('rating')}`}><RatingBadges dark restaurant={restaurant} /></div>
        <SocialIcons className={`mt-2 w-fit ${hl('social')}`} />
        <div className={`mt-3 ${hl('intro')}`}>
          {sel === 'desc' && quick && <div className="mb-4">{quick}</div>}
          {(!mobile || sel === 'desc') && <div className={`mb-3 max-w-[460px] text-ui-body text-white/70 ${hl('desc')}`}>{desc ?? b.desc}</div>}
          <div className="relative">
            <GoodToKnow restaurant={restaurant} />
            {!mobile && info === 'open' && <InfoList className="absolute bottom-full left-0 z-30 mb-2 w-[400px] shadow-ui-popup" />}
          </div>
        </div>
        </>}
        {paused ? (mobile && <BookingPausedCard restaurant={restaurant} className="mt-5" />) : (
        <>
        {sel === 'cta' && quick && <div className="mt-5">{quick}</div>}
        <div className={`mt-5 flex gap-2 ${mobile ? 'flex-col' : 'w-fit flex-wrap items-center'} ${hl('cta')}`}>
          <Button className={`${mobile ? 'w-full' : ''} ${ACCENT}`}>{b.cta}<ArrowRight className="h-4 w-4" /></Button>
          <Button variant="onDark" icon={Clock} className={`${ON_PHOTO} ${mobile ? 'w-full' : ''}`}>Legközelebb szabad: {b.next}</Button>
        </div>
        </>
        )}
      </div>
      {!mobile && paused && <BookingPausedCard restaurant={restaurant} className="absolute right-8 top-1/2 z-10 w-[420px] -translate-y-1/2" />}
      {!mobile && !paused && <LiveBookingCard card={card} step={step} restaurant={restaurant} flow={flow} terms={terms} sel={cardSel} quick={cardSel ? quick : undefined} className={`absolute right-8 top-1/2 z-10 w-[420px] -translate-y-1/2 ${hl('card')}`} />}
      {gallery && <GalleryViewer mobile={mobile} />}
      {mobile && info === 'open' && (
        <>
          <div className="absolute inset-0 z-20 bg-ui-dark/40" />
          <div className="absolute inset-x-0 bottom-0 z-30"><SheetHandle className="pb-2 [&>*]:bg-white/40" /><InfoList className="rounded-b-ui-container" /></div>
        </>
      )}
      {mobile && open && (
        <>
          <div className="absolute inset-0 z-20 bg-ui-dark/40" />
          <div className="absolute inset-x-0 bottom-0 z-30 max-h-[94%] overflow-hidden"><SheetHandle className="pb-2 [&>*]:bg-white/40" /><LiveBookingCard card={card} sheet step={step} restaurant={restaurant} flow={flow} terms={terms} sel={cardSel} quick={cardSel ? quick : undefined} /></div>
        </>
      )}
    </div>
  )
}


/**
 * 21.13 — az online foglalás szünetel (az üzlet előfizetése lejárt / szünetel): a foglaló kártya helyén. Az oldal többi
 * része (bemutatkozás, képek, értékelés, elérhetőség) marad — a vendég megtalálja, és fel tudja hívni; csak online nem
 * foglalhat. Nem mondja meg, miért (az az üzlet dolga), és nem ijesztő. Élőben `phone` / `email`; nélkülük a minta.
 */
export function BookingPausedCard({ restaurant = false, phone = '+36 1 234 5678', email, l, className = '' }: { restaurant?: boolean; phone?: string | null; email?: string | null; /** a vendég nyelvén (élőben az i18n); nélküle magyar */ l?: { title: string; text: string }; className?: string }) {
  return (
    <div className={`rounded-ui-card bg-white p-6 text-ui-text ${className}`}>
      <IconCircle tone="cell" size="lg" icon={Clock} />
      <div className="mt-4 text-ui-sub font-light">{l?.title ?? `Az online ${restaurant ? 'asztalfoglalás' : 'foglalás'} most szünetel`}</div>
      <p className="mt-1.5 text-ui-body leading-relaxed text-ui-muted">{l?.text ?? `${restaurant ? 'Asztalt telefonon foglalhatsz' : 'Időpontot telefonon kérhetsz'} — vagy nézz vissza később.`}</p>
      <div className="mt-5 flex flex-col gap-1.5">
        {phone && <Button icon={Phone} href={`tel:${phone.replace(/\s/g, '')}`} className="w-full">{phone}</Button>}
        {email && <Button variant="cell" href={`mailto:${email}`} className="w-full">{email}</Button>}
      </div>
      <PoweredBy className="mt-5" />
    </div>
  )
}
