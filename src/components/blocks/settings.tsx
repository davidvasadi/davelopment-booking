import { SHEET_ROW } from './assets'
import { ArrowRight, ArrowUpRight, BarChart3, Bell, Building2, Download, Pencil, Briefcase, CalendarDays, Check, ChevronDown, Lock, Clock, CreditCard, FileText, Gift, Globe as Globe2, Link2, Mail, Megaphone, Monitor, MoreHorizontal, Plus, QrCode, Send, Settings, ShieldCheck, Smartphone, Star, UserRound, Users, X, Undo2, Trash2 } from 'lucide-react'
import { Avatar, BigNumber, Button, Card, CardTitle, NavItem, SearchField, Field, FieldRow, IconButton, IconCircle, Input, ListRow, Marquee, MarqueeText, Meta, Meter, Modal, OptionCard, Pill, RowCheck, SegmentBar, StatusPill, Segmented, Note, Table, Td, Th, Tr, UploadBox } from '@/components/ui-kit'
import { MockSwitch as DesignSwitch } from './MockSwitch'
import { DarkLineChart, WeekBars, type WeekBar } from './charts'
import { Switch } from '@/components/ui/toggle-switch'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BIZ_LOGO, ReferralCard } from './brand'


/* Beállítás-lapok és -darabok — a /design 16.x és a landing funkció-oldalai is ezeket mutatják. */

/** Beállítás-lap (a jóváhagyott Előleg-lap 16.1 felépítése): fehér lap, fent csoport + cím + állapot, alatta csoportok,
 *  alul a lebegő mentés-sáv, ha van módosítás. Mind a 8 beállítási fül ezt használja. */
export function SettingsPage({ group, title, status, save = true, aside, footer, children }: { group: string; title: string; status?: React.ReactNode; save?: boolean; aside?: React.ReactNode; /** a lap alján (a kártya aljára igazítva) — pl. a továbbvivő gombok */ footer?: React.ReactNode; children: React.ReactNode }) {
  const page = (
    <div className="relative flex min-w-0 flex-col overflow-hidden rounded-ui-card bg-white">
      {/* mobilon a cím a felcsúszó lap fejlécében van (16.20) — itt csak az állapot marad */}
      <div className={`flex items-start justify-between gap-3 px-6 pb-1 pt-6 max-lg:px-0 ${status ? '' : 'max-lg:hidden'}`}>
        <div className="max-lg:hidden"><Meta className="text-ui-label">{group}</Meta><div className="mt-0.5 text-ui-sub font-light text-ui-text">{title}</div></div>
        {status}
      </div>
      <div className={save ? 'pb-20' : 'pb-6'}>{children}</div>
      {footer && <div className="mt-auto flex flex-wrap gap-1.5 px-6 pb-6 max-lg:px-0">{footer}</div>}
      {save && (
        <SaveBar />
      )}
    </div>
  )
  if (!aside) return page
  // mint a Nyitvatartás-lap (16.8): mellette összegző oszlop, ami a téma-lista aljáig ér
  return (
    <div className="grid grid-cols-1 gap-[5px] xl:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
      {page}
      {/* mobilon (a fehér lapon) a világos oldalsó kártyák belső margó nélkül — a sötétek megtartják (ott látszik a háttér) */}
      <div className="flex flex-col gap-[5px] [&>*:last-child]:flex-1 max-lg:[&>*:not(.bg-ui-dark)]:!px-0">{aside}</div>
    </div>
  )
}

/** Csoport a lapon: ikonos alcím, alatta a sorai. */
export function SettingsGroup({ icon: Icon, title, children }: { icon: typeof Users; title: string; children: React.ReactNode }) {
  return (
    // mobilon a lap (felcsúszó ablak) már ad szélt — ott nincs külön oldalsó margó, a tartalom a lap szélességét kapja
    <div className="px-6 pt-5 max-lg:px-0">
      <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><Icon className="h-4 w-4" /> {title}</div>
      {children}
    </div>
  )
}

/** 16.13: Hírlevél — havi keret, kik kapják; `aside`: mellette az utolsó kampány és a feliratkozók. */
export type NewsletterSummary = {
  subscribers: number; newThisMonth: number; unsubscribed: number; used: number; cap: number; tier: string
  /** az utolsó (legfeljebb hat) kiküldött kampány, időrendben — a legutolsó a végén */
  campaigns: { subject: string; at: string; recipients: number; pct: number }[]
  /** az elmúlt hónapok kiküldött hírlevelei (a mostani a végén) — régi válaszban hiányozhat */
  months?: { ym: string; n: number }[]
}
const SAMPLE_NEWS: NewsletterSummary = {
  subscribers: 418, newThisMonth: 23, unsubscribed: 6, used: 3612, cap: 5000, tier: 'pro',
  months: [['2026-06', 820], ['2026-07', 1430], ['2026-08', 610], ['2026-09', 2380], ['2026-10', 1960], ['2026-11', 3612]].map(([ym, n]) => ({ ym: ym as string, n: n as number })),
  campaigns: [47, 52, 49, 61, 51, 58].map((pct, i) => ({ subject: 'Őszi frissítés −15%', at: ['2026-06-10', '2026-07-08', '2026-08-12', '2026-09-02', '2026-09-30', '2026-10-14'][i], recipients: 412, pct })),
}
const MONTH_SHORT = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']

/** 16.13: Hírlevél — mindig bekapcsolva; jobbra az utolsó kampány megnyitása (görbe az utolsó hatról, szaggatottal az
 *  átlag) és a feliratkozók; balra a havi keret és hogy kik kapják; lent a Marketing és a Feliratkozók. Élőben `data`
 *  (betöltés közben null) és a két link; nélkülük a minta. */
export function NewsletterSettings({ aside = true, data = SAMPLE_NEWS, marketingHref, subscribersHref }: { aside?: boolean; data?: NewsletterSummary | null; marketingHref?: string; subscribersHref?: string }) {
  const d = data
  const camps = d?.campaigns ?? []
  const last = camps[camps.length - 1]
  const avg = camps.length ? Math.round(camps.reduce((n, c) => n + c.pct, 0) / camps.length) : 0
  const series = camps.length > 1 ? camps.map((c) => c.pct) : camps.length ? [camps[0].pct, camps[0].pct] : []
  const lo = series.length ? Math.max(0, Math.min(...series, avg) - 10) : 0
  const hi = series.length ? Math.min(100, Math.max(...series, avg) + 10) : 100
  const tick = (iso: string) => MONTH_SHORT[new Date(iso).getMonth()]
  const day = (iso: string) => { const x = new Date(iso); return `${MONTH_SHORT[x.getMonth()]} ${x.getDate()}.` }
  const unlimited = d?.tier === 'egyedi'
  return (
<SettingsPage group="Vendégek" title="Hírlevél" save={false} status={<StatusPill status="ok">Mindig bekapcsolva</StatusPill>}
  footer={<><Button icon={Send} href={marketingHref}>Kampányok › Marketing</Button><Button variant="cell" href={subscribersHref}>Feliratkozók</Button></>} aside={aside && <>
  <Card tone="dark">{last ? <>
    <Meta dark>Utolsó kampány · {day(last.at)}</Meta><div className="mt-1 text-ui-num font-light leading-none">{last.pct}%</div>
    {/* az utolsó hat kampány megnyitása, szaggatottal az átlag (egy kampánynál még egyenes) */}
    <DarkLineChart now={series} prev={series.map(() => avg)} sel={series.length - 1} min={lo} max={hi} h={70} label={`${last.pct}%`} ticks={(camps.length > 1 ? camps : [last, last]).map((c) => tick(c.at))} selTick={series.length - 1} />
    <Meta dark className="mt-3">megnyitás · „{last.subject}” · {last.recipients.toLocaleString('hu-HU')} címzett</Meta>
  </> : <><Meta dark>Utolsó kampány</Meta><div className="mt-1 text-ui-title font-light">{d ? 'Még nem küldtél kampányt' : 'Betöltés…'}</div><Meta dark className="mt-2">Az első kampányt a Marketing menüben írod.</Meta></>}</Card>
  <Card>
    <CardTitle>Feliratkozók</CardTitle>
    <div className="mt-2 flex items-baseline gap-2"><span className="text-ui-num font-light leading-none text-ui-text">{d ? d.subscribers.toLocaleString('hu-HU') : '…'}</span>{d && d.newThisMonth > 0 && <StatusPill status="ok">+{d.newThisMonth} ebben a hónapban</StatusPill>}</div>
    <Meta className="mt-3">A foglaláskor feliratkozók automatikusan bekerülnek.</Meta>
  </Card>
</>}>
  <SettingsGroup icon={Send} title="Havi keret">
    {unlimited ? <Meta className="mt-2">Egyedi csomag · korlátlan levél.</Meta> : <Meter label="Ebben a hónapban" value={d?.used ?? 0} max={Math.max(1, d?.cap ?? 1)} className="mt-2" />}
    {!unlimited && <Meta className="mt-2">{d ? `${d.tier === 'starter' ? 'Starter' : 'Pro'} csomag · ${d.cap.toLocaleString('hu-HU')} levél / hó` : '…'} · Egyedi csomagban korlátlan.</Meta>}
    {/* az elmúlt 6 hónap kiküldött levelei — minden csomagnál (a korlátlannál a legtöbb a skála teteje, egyébként a keret) */}
    {d?.months?.length ? (
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-3"><span className="text-ui-body text-ui-text">Kiküldött levelek havonta</span><Meta>{unlimited ? `ebben a hónapban: ${d.used.toLocaleString('hu-HU')}` : `keret: ${d.cap.toLocaleString('hu-HU')} / hó`}</Meta></div>
        <WeekBars className="mt-4" h={90} tag={(v) => `${v.toLocaleString('hu-HU')} db`}
          max={unlimited ? undefined : Math.max(d.cap, ...d.months.map((m) => m.n), 1)}
          days={d.months.map((m, i, a) => ({ d: MONTH_SHORT[Number(m.ym.slice(5)) - 1], v: m.n, peak: i === a.length - 1 }))} />
      </div>
    ) : null}
  </SettingsGroup>
  <SettingsGroup icon={Users} title="Kik kapják">
    <FieldRow label="Feliratkozott vendég" hint="a vendég maga adta meg a hozzájárulást"><span className="text-ui-body text-ui-text">{d ? `${d.subscribers.toLocaleString('hu-HU')} fő` : '…'}</span></FieldRow>
    <FieldRow label="Leiratkozás" hint="minden levél alján, egy kattintással"><span className="text-ui-body text-ui-text">{d ? `${d.unsubscribed.toLocaleString('hu-HU')} fő` : '…'}</span></FieldRow>
  </SettingsGroup>
</SettingsPage>
  )
}

/** Az értékelés-kérés beállítása (élőben a `feature_modules`-ból; a mentés a hub közös sávján). */
export type ReviewsValue = { on: boolean; delay: 1 | 2 | 24; target: 'google' | 'tripadvisor' | 'facebook'; googleUrl: string; tripadvisorUrl: string; facebookUrl: string }
/** Az Értékelések-lap összesítője (`/api/reviews/summary`) — a saját értékelő-oldalról. */
export type ReviewsSummary = { monthCount: number; monthRequests: number; monthAvg: number | null; months: { label: string; reviews: number; requests: number }[]; recent: { name: string; rating: number; comment: string; at: string }[] }
const SAMPLE_REVIEWS: ReviewsSummary = {
  monthCount: 31, monthRequests: 48, monthAvg: 4.9,
  months: [['Jún.', 12, 30], ['Júl.', 18, 34], ['Aug.', 15, 31], ['Szept.', 22, 40], ['Okt.', 26, 44], ['Nov.', 31, 48]].map(([label, reviews, requests]) => ({ label: label as string, reviews: reviews as number, requests: requests as number })),
  recent: [],
}
const SAMPLE_RECENT = [['Kovács Anna', 5, 'Viktória csodát csinált, jövök még!', 'ma'], ['Tóth Bence', 5, 'Gyors, pontos, kedves.', 'tegnap'], ['Gál Zsófia', 4, 'Kicsit vártam, de megérte.', 'Nov. 4.']] as const
const DELAYS = [1, 2, 24] as const
const TARGETS = ['google', 'tripadvisor', 'facebook'] as const
const relDay = (iso: string) => {
  const d = new Date(iso); const t = new Date()
  const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000)
  return days === 0 ? 'ma' : days === 1 ? 'tegnap' : `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}.`
}

/** 16.15: Értékelések (`part` 'all' a teljes lap, 'reviews' csak a beállítások) és 16.15.1: Google Cégprofil (`part`
 *  'profile') — ahogy élesben működik: (1) a Google-profil kiválasztása — az átlagot, a darabszámot és a legutóbbi
 *  5 értékelést a Google Places API-ból kérjük le, naponta legfeljebb egyszer, akkor is csak ha valaki megnyitja a
 *  foglalóoldalt (fizetős API → költség-kontroll); (2) értékelés-kérés: a foglalás után X órával e-mail a SAJÁT
 *  értékelő-oldalunkra (ez a Google-től független, az értesítés is ebből jön), ahonnan az elégedett vendég egy gombbal a
 *  választott helyre megy — Google, TripAdvisor vagy Facebook (csak link: ezek pontszámát nem kérjük le); (3) az „Időpont foglalása” gomb a Cégprofilban.
 *  Élőben: `reviews` + `onReviews`, `urlErrors` (a linkek hibaüzenete), `profile` (a Google-profil csoport tartalma: az
 *  élő kereső), `summary` (betöltés közben null), `booking` (a foglalóoldal linkje, a jelölő és a másolás), `save={false}`. */
export function GoogleSettings({ part = 'all', restaurant = false, reviews, onReviews, urlErrors, profile, summary = SAMPLE_REVIEWS, booking, save }: {
  part?: 'all' | 'reviews' | 'profile'; restaurant?: boolean
  reviews?: ReviewsValue; onReviews?: (v: ReviewsValue) => void; urlErrors?: Partial<Record<'google' | 'tripadvisor' | 'facebook', string>>
  profile?: React.ReactNode; summary?: ReviewsSummary | null
  booking?: { url: string; confirmed: boolean; onConfirm: (on: boolean) => void; onCopy: () => void }
  save?: boolean
}) {
  const live = !!reviews
  const r = reviews
  const set = (p: Partial<ReviewsValue>) => r && onReviews?.({ ...r, ...p })
  const sm = summary
  const series = sm?.months ?? []
  const all = series.flatMap((m) => [m.reviews, m.requests])
  const hi = all.length ? Math.max(...all, 4) + 4 : 10
  const status = part === 'profile'
    ? (booking ? (booking.confirmed ? <StatusPill status="ok">Beállítva</StatusPill> : <StatusPill status="pending">1 lépés hátra</StatusPill>) : <StatusPill status="pending">1 lépés hátra</StatusPill>)
    : (!r || r.on ? <StatusPill status="ok">Bekapcsolva</StatusPill> : <StatusPill status="bad">Kikapcsolva</StatusPill>)
  const urlField = (k: 'google' | 'tripadvisor' | 'facebook', label: string, placeholder: string, sample: { defaultValue?: string; placeholder?: string }, hint?: string) => (
    <Field label={label} hint={hint} error={urlErrors?.[k]} className="mt-2">
      {r ? <Input type="url" inputMode="url" value={k === 'google' ? r.googleUrl : k === 'tripadvisor' ? r.tripadvisorUrl : r.facebookUrl} placeholder={placeholder}
        onChange={(e) => set(k === 'google' ? { googleUrl: e.target.value } : k === 'tripadvisor' ? { tripadvisorUrl: e.target.value } : { facebookUrl: e.target.value })} />
        : <Input {...sample} />}
    </Field>
  )
  return (
<SettingsPage group="Kapcsolatok" title={part === 'profile' ? 'Google Cégprofil' : 'Értékelések'} save={save ?? part !== 'reviews'} status={status} aside={part !== 'profile' && (part === 'all' || live) && <>
  <Card tone="dark">
    <Meta dark>Értékelés ebben a hónapban</Meta><div className="mt-1 text-ui-num font-light leading-none">{sm ? sm.monthCount : '…'}</div>
    {/* havonta hány értékelés jött; szaggatott: a kiküldött kérések */}
    {sm && series.length > 0 && <DarkLineChart now={series.map((m) => m.reviews)} prev={series.map((m) => m.requests)} sel={series.length - 1} min={0} max={hi} h={70} label={String(sm.monthCount)} ticks={series.map((m) => m.label)} selTick={series.length - 1} />}
    {sm && <Meta dark className="mt-3">{sm.monthRequests} kérésből{sm.monthAvg != null ? ` · átlag ${sm.monthAvg.toLocaleString('hu-HU')}` : ''} — a saját értékelő-oldaladon</Meta>}
  </Card>
  {/* a legutóbbi értékelések (a saját értékelő-oldalról) — ebből jön az értesítés is */}
  <Card>
    <CardTitle>Legutóbbi értékelések</CardTitle>
    <div className="mt-2">
      {(live ? (sm?.recent ?? []).map((x) => [x.name || 'Vendég', x.rating, x.comment || '—', relDay(x.at)] as const) : SAMPLE_RECENT).map(([n, st, t, d], i) => (
        <ListRow key={`${n}-${i}`} className="px-0" title={<span className="flex items-center gap-1.5">{n}<span className="text-ui-label text-ui-muted">★ {st}</span></span>} meta={<MarqueeText>{t}</MarqueeText>} trailing={<Meta className="text-ui-label">{d}</Meta>} />
      ))}
      {live && sm && !sm.recent.length && <Meta className="py-3">Még nem érkezett értékelés.</Meta>}
    </div>
  </Card>
</>}>
  {part !== 'profile' && <>
  <SettingsGroup icon={Globe2} title="Google-profil">
    {profile ?? <>
      <Field label="Az üzleted a Google-on" className="mt-1"><Input defaultValue="Fodrászat Budapest — Andrássy út 12." /></Field>
      <FieldRow label="★ 4,8 · 132 értékelés" hint="frissítve ma 08:12"><StatusPill status="ok">Összekötve</StatusPill></FieldRow>
      <Note tip className="mt-1">Az átlagot, a darabszámot és a legutóbbi 5 értékelést a Google-től kérjük le — naponta legfeljebb egyszer, amikor valaki megnyitja a foglalóoldalad. A foglalóoldalon ezek látszanak.</Note>
    </>}
  </SettingsGroup>
  {/* étterem: a TripAdvisor is a foglalóoldalra kerül (tervben — 52. tétel: a platform Content API kulcsa kell hozzá) — élőben még nincs */}
  {restaurant && !live && (
  <SettingsGroup icon={Star} title="TripAdvisor-profil">
    <Field label="Az éttermed a TripAdvisoron" className="mt-1"><Input defaultValue="Bistro Andrássy — Budapest, VI. ker." /></Field>
    <FieldRow label="★ 4,5 · 860 értékelés" hint="frissítve ma 08:12 · #312 a budapesti éttermek közt"><StatusPill status="ok">Összekötve</StatusPill></FieldRow>
    <Note tip className="mt-1">Ugyanúgy, mint a Google-nél: naponta legfeljebb egyszer kérjük le, és a foglalóoldalon a Google mellett látszik, a TripAdvisor jelével.</Note>
  </SettingsGroup>
  )}
  <SettingsGroup icon={Star} title="Értékelés kérése">
    <FieldRow label="Értékelés kérése e-mailben" hint="a foglalás után, a saját értékelő-oldaladra">{r ? <Switch checked={r.on} onChange={(on) => set({ on })} ariaLabel="Értékelés kérése e-mailben" /> : <DesignSwitch />}</FieldRow>
    <FieldRow label="Mikor menjen ki"><Segmented tone="cell" size="sm" options={['1 óra', '2 óra', 'Másnap']} active={r ? DELAYS.indexOf(r.delay) : 1} onSelect={r ? (i) => set({ delay: DELAYS[i] }) : undefined} /></FieldRow>
    {/* hova küldjük az elégedett vendéget: nem mindenkinek a Google a fő hely (étteremnél gyakran a TripAdvisor) */}
    <FieldRow label="Hol értékeljen még" hint="az elégedett vendég gombja az értékelő-oldalon"><Segmented tone="cell" size="sm" options={['Google', 'TripAdvisor', 'Facebook']} active={r ? TARGETS.indexOf(r.target) : restaurant ? 1 : 0} onSelect={r ? (i) => set({ target: TARGETS[i] }) : undefined} /></FieldRow>
    {urlField('google', 'Google értékelés link', 'https://g.page/r/…/review', { defaultValue: 'https://g.page/r/CYx7Fodraszat/review' }, r ? 'Cégprofil › Értékelések kérése — a rövid g.page/…/review link' : undefined)}
    {urlField('tripadvisor', 'TripAdvisor link', 'https://www.tripadvisor.com/UserReviewEdit-…', restaurant ? { defaultValue: 'https://www.tripadvisor.com/UserReviewEdit-g274887-d1234567' } : { placeholder: 'https://www.tripadvisor.com/UserReviewEdit-…' }, r?.target === 'tripadvisor' ? 'ide megy az elégedett vendég — ha üres, a Google-linkre' : 'opcionális')}
    {urlField('facebook', 'Facebook oldal', 'https://facebook.com/…/reviews', { placeholder: 'https://facebook.com/…/reviews' }, r?.target === 'facebook' ? 'ide megy az elégedett vendég — ha üres, a Google-linkre' : 'opcionális')}
  </SettingsGroup>
  </>}
  {part === 'profile' && (
  <SettingsGroup icon={Globe2} title="„Időpont foglalása” a Google Cégprofilban">
    <div className="mt-1 flex items-center gap-1.5"><Input {...(booking ? { value: booking.url, readOnly: true } : { defaultValue: 'booking.davelopment.hu/fodraszat-budapest' })} className="min-w-0 flex-1" /><IconButton icon={Link2} label="Link másolása" variant="yellow" onClick={booking?.onCopy} /></div>
    <div className="mt-3 space-y-1">
      {['Nyisd meg a business.google.com oldalt a céges fiókoddal', 'Válaszd ki a vállalkozásod', 'Foglalások › Foglalási link › illeszd be a fenti linket'].map((t, i) => (
        <ListRow key={t} filled leading={<IconCircle tone="dark" size="sm">{i + 1}</IconCircle>} title={t} />
      ))}
    </div>
    <FieldRow boxed label="Beállítottam a Google-nél" hint="a Google oldalán történik — itt csak jelölöd" className="mt-2">{booking ? <Switch checked={booking.confirmed} onChange={booking.onConfirm} ariaLabel="Beállítottam a Google-nél" /> : <DesignSwitch defaultOn={false} />}</FieldRow>
  </SettingsGroup>
  )}
</SettingsPage>
  )
}

/** 16.3: a szerep jogai csoportonként — pipás pillek, „mind” kapcsoló, a veszélyzóna piros keretben.
 *  `limit`: az első N csoport (keskeny helyre), `cols`: 2 hasáb desktopon. */
/** Egy jogcsoport: név, ikon, a jogok (chip — a bekapcsolt sötét, pipával). */
export type PermGroup = { name: string; icon: LucideIcon; caps: { value: string; label: string; on: boolean }[] }
const SAMPLE_PERMS: PermGroup[] = ([
  ['Foglalás', CalendarDays, [['Foglalások megtekintése', true], ['Foglalások kezelése', true]]],
  ['Naptár', Clock, [['Saját naptár — megtekintés', true], ['Saját naptár — szerkesztés', true], ['Teljes csapatnaptár kezelése', false]]],
  ['Vendégek', Users, [['Vendégek megtekintése', true], ['Vendégek kezelése', true]]],
  ['Szolgáltatások', Briefcase, [['Megtekintés', true], ['Kezelés', false]]],
  ['Nyitvatartás', Clock, [['Megtekintés', true], ['Kezelés', false]]],
  ['Utalványok', Gift, [['Megtekintés', true], ['Kezelés', true]]],
  ['Marketing', Megaphone, [['Megtekintés', false], ['Kampány-küldés', false]]],
  ['Munkatársak', Users, [['Megtekintés', true], ['Kezelés', false], ['Mások fizetése', false]]],
  ['Statisztika', BarChart3, [['Teljes cég', false], ['Saját', true], ['Tippek', true], ['Tippek alkalmazása', false]]],
  ['Beállítások', Settings, [['Saját profil', true], ['Üzleti beállítások', false], ['Jogosultságok megtekintése', false]]],
  ['Csapat', Users, [['Csapat megtekintése', true], ['Meghívás / szerep', false]]],
  ['Számlázás', CreditCard, [['Előfizetés', false], ['Előleg / Stripe', false]]],
  ['Audit', FileText, [['Audit-napló', false]]],
  ['Veszélyzóna', X, [['Üzlet törlése', false]]],
] as [string, LucideIcon, [string, boolean][]][]).map(([name, icon, caps]) => ({ name, icon, caps: caps.map(([label, on]) => ({ value: `${name}:${label}`, label, on })) }))

/** A jogcsoportok kártyái (16.3): csoportonként „mind” kapcsoló, a jogok chipek (bekapcsolt sötét, sárga pipával); a
 *  Veszélyzóna piros keretben. Élőben `onToggle` (egy jog) / `onToggleAll` (a csoport mind); `readOnly`: csak megjelenik. */
export function PermissionGroups({ groups = SAMPLE_PERMS, onToggle, onToggleAll, extra, limit = 99, cols = 2, className = '' }: { groups?: PermGroup[]; onToggle?: (value: string) => void; onToggleAll?: (group: PermGroup, on: boolean) => void; /** további kártya a rácsban (pl. a szerep foglalás-értesítése) */ extra?: React.ReactNode; limit?: number; cols?: 1 | 2; className?: string }) {
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'md:grid-cols-2' : ''} ${className}`}>
      {groups.slice(0, limit).map((g) => {
        const all = g.caps.every((c) => c.on)
        const danger = g.name === 'Veszélyzóna'
        const Icon = g.icon
        return (
          <div key={g.name} className={`rounded-ui-inner p-3.5 ${danger ? 'ring-1 ring-ui-bad-dot/40' : 'bg-ui-cell'}`}>
            <div className="flex items-center justify-between">
              <span className={`flex items-center gap-2 text-ui-body ${danger ? 'text-ui-bad' : 'text-ui-text'}`}><Icon className="h-4 w-4" strokeWidth={1.8} />{g.name}</span>
              <span className="flex items-center gap-1.5 text-ui-label text-ui-muted">mind{onToggleAll ? <Switch size="sm" checked={all} onChange={(on) => onToggleAll(g, on)} ariaLabel={`${g.name}: mind`} /> : <DesignSwitch defaultOn={all} />}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {g.caps.map((c) => {
                const pill = <Pill tone={c.on ? 'dark' : 'white'} size="sm">{c.on && <Check className="h-3 w-3 text-ui-yellow" strokeWidth={2.5} />}{c.label}</Pill>
                return onToggle ? <button key={c.value} type="button" aria-pressed={c.on} onClick={() => onToggle(c.value)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button> : <span key={c.value}>{pill}</span>
              })}
            </div>
          </div>
        )
      })}
      {extra}
    </div>
  )
}

/* ── 16.3: Csapat & jogok — Szerepek ── */

export type RoleItem = { id: string; name: string; desc: string; members: number; locked?: boolean }
const SAMPLE_ROLE_LIST: RoleItem[] = [
  { id: 'owner', name: 'Tulajdonos', desc: 'Minden jog, nem szerkeszthető', members: 1, locked: true },
  { id: 'r', name: 'Recepció', desc: 'Foglalások és vendégek', members: 2 },
  { id: 's', name: 'Szakember', desc: 'Saját naptár és vendégek', members: 3 },
  { id: 'v', name: 'Vezető', desc: 'Majdnem minden, számlázás nélkül', members: 1 },
]

/** A Szerepek nézet (16.3): bal oldalt a szerepek (leírás, tagok száma; a Tulajdonos zárolt), alul új szerep — üresen vagy
 *  sablonból; jobbra a kijelölt szerep neve, leírása, tagjai, az alap-belépő megjegyzés és MINDEN jogcsoport; változáskor
 *  lebegő mentés. `header`: a fejléc (cím + Tagok / Szerepek váltó). Props nélkül a design mintája. */
export function RolesEditor({ header, roles = SAMPLE_ROLE_LIST, selectedId = 'r', onSelect, templates = ['Recepció', 'Szakember', 'Vezető', 'Könyvelő'], onTemplate, onNew, name = 'Recepció', desc = 'Foglalások és vendégek kezelése, pénzügy nélkül', onName, onDesc, members = ['szabina', 'dave'].map((a) => ({ name: a, img: `/landing/funkciok/csapat/avatar/${a}.webp` })), groups, onToggle, onToggleAll, extra, readOnly = false, onDelete, save = { label: 'Recepció · 3 módosítás' }, className = '' }: {
  header?: React.ReactNode
  roles?: RoleItem[]; selectedId?: string | null; onSelect?: (id: string) => void
  templates?: string[]; onTemplate?: (name: string) => void; onNew?: () => void
  name?: string; desc?: string; onName?: (v: string) => void; onDesc?: (v: string) => void
  members?: { name: string; img?: string | null }[]
  groups?: PermGroup[]; onToggle?: (value: string) => void; onToggleAll?: (group: PermGroup, on: boolean) => void
  extra?: React.ReactNode
  /** a Tulajdonos (vagy nem tulaj néző): csak megtekintés */
  readOnly?: boolean
  onDelete?: () => void
  /** változáskor a lebegő mentés (nélküle nincs) */
  save?: { label: string; onSave?: () => void; onDiscard?: () => void; busy?: boolean }
  className?: string
}) {
  const live = !!onSelect
  return (
    <div className={`relative rounded-ui-card bg-white p-6 pb-24 ${className}`}>
      {header ?? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-ui-label text-ui-muted">Csapat</div><div className="text-ui-sub font-light text-ui-text">Csapat & jogok</div></div>
          <Segmented options={['Tagok', 'Szerepek']} active={1} tone="cell" />
        </div>
      )}
      <div className="mt-5 grid gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        <div className="space-y-1">
          {roles.map((r) => {
            const on = r.id === selectedId
            const card = (
              <div className={`rounded-ui-inner px-3.5 py-3 ${on ? 'bg-ui-dark text-white' : 'bg-ui-cell text-ui-text'}`}>
                <div className="flex items-center justify-between gap-2"><MarqueeText className="text-ui-body">{r.name}</MarqueeText><span className={`shrink-0 text-ui-label ${on ? 'text-white/55' : 'text-ui-muted'}`}>{r.locked ? 'zárolt' : `${r.members} tag`}</span></div>
                {r.desc && <div className={`mt-0.5 text-ui-label ${on ? 'text-white/55' : 'text-ui-muted'}`}>{r.desc}</div>}
              </div>
            )
            return live ? <button key={r.id} type="button" onClick={() => onSelect!(r.id)} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{card}</button> : <div key={r.id}>{card}</div>
          })}
          {(onNew || !live) && (
            <div className="rounded-ui-inner border border-dashed border-ui-dark/25 p-3">
              {onNew ? <button type="button" onClick={onNew} className="ui-press flex items-center gap-1.5 rounded-full text-ui-meta text-ui-text outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Plus className="h-3.5 w-3.5" />Új szerep</button>
                : <div className="flex items-center gap-1.5 text-ui-meta text-ui-text"><Plus className="h-3.5 w-3.5" />Új szerep</div>}
              <div className="mt-2 text-ui-label text-ui-muted">Sablonból:</div>
              <div className="mt-1 flex flex-wrap gap-1">{templates.map((t) => onTemplate
                ? <button key={t} type="button" onClick={() => onTemplate(t)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone="cell" size="sm">{t}</Pill></button>
                : <Pill tone="cell" size="sm" key={t}>{t}</Pill>)}</div>
            </div>
          )}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Input value={name} readOnly={readOnly || !onName} onChange={onName ? (e) => onName(e.target.value) : undefined} placeholder="Szerep neve" aria-label="Szerep neve" className="w-[200px]" />
            <Input value={desc} readOnly={readOnly || !onDesc} onChange={onDesc ? (e) => onDesc(e.target.value) : undefined} placeholder="Rövid leírás — mit csinál" aria-label="Leírás" className="min-w-[200px] flex-1" />
            {members.length > 0 && <span className="flex -space-x-2">{members.slice(0, 6).map((m, i) => <Avatar key={`${m.name}-${i}`} size="sm" src={m.img ?? null} name={m.name} className="ring-2 ring-white" />)}</span>}
            {onDelete && !readOnly && <Button variant="ghost" size="sm" icon={X} className="text-ui-bad" onClick={onDelete}>Szerep törlése</Button>}
          </div>
          <Meta className="mt-3 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />Áttekintés (alap belépő) — minden szerep megkapja, nem kapcsolható ki.</Meta>
          <PermissionGroups className="mt-3" groups={groups} onToggle={readOnly ? undefined : onToggle} onToggleAll={readOnly ? undefined : onToggleAll} extra={extra} />
        </div>
      </div>
      {save && <SaveBar label={save.label} className="bottom-5" onSave={save.onSave} onDiscard={save.onDiscard} busy={save.busy} />}
    </div>
  )
}

/** Beszúrható adat jelölése a levélben: kis szürke pill (ide kerül a valós adat). */
export function MergeTag({ children, tone = 'cell' }: { children: React.ReactNode; tone?: 'cell' | 'white' }) {
  // fehér csak desktopon (üveges kártyán); mobilon a téma fehér lapon nyílik, ott a szürke látszik
  return <Pill tone={tone} size="sm" className={`mx-0.5 ${tone === 'white' ? 'max-lg:bg-ui-cell' : ''}`}>{children}</Pill>
}

/** 16.6: az Emlékeztető levél beállításai — mikor menjen ki (24 és 3 órával előtte), beszúrható adatok, csatorna
 *  (e-mail, push), nyelv, feladó. */
export type GuestLetter = { key: string; title: string; when: string; on: boolean }
const SAMPLE_LETTERS: GuestLetter[] = [
  { key: 'confirm', title: 'Visszaigazolás', when: 'Azonnal, foglaláskor', on: true },
  { key: 'reminder', title: 'Emlékeztető', when: '24 és 3 órával előtte', on: true },
  { key: 'cancel', title: 'Lemondás', when: 'Lemondáskor', on: true },
  { key: 'feedback', title: 'Visszajelzés', when: 'Másnap, értékelés-kérés', on: false },
  { key: 'modification', title: 'Értesítő', when: 'Módosításkor', on: true },
]

/** A kijelölt vendég-levél beállításai (16.6 jobb oszlop): be / ki, emlékeztetőnél az időzítés és a csatorna, a beszúrható
 *  adatok (kattintva a kurzor helyére), a nyelv, a feladó, a sablon betöltése, teszt és mentés. Props nélkül a minta. */
export function ReminderSettingsCard({ title = 'Emlékeztető', on = true, onToggle, times = [['48h', '2 nappal', false], ['24h', '24 órával', true], ['3h', '3 órával', true]], onTime, channels = null, onChannel, tags = ['vendég', 'nap', 'idő', 'munkatárs', 'szolgáltatás'], onTag, language, sender = 'Fodrászat Budapest', extra, onTemplate, onPreview, onSave, saveBusy = false, saveDisabled = false, part = 'all', block, className = '' }: {
  title?: string; on?: boolean; onToggle?: (on: boolean) => void
  /** emlékeztetőnél: [kulcs, felirat, aktív] — több is választható; nélküle nincs időzítés-sor */
  times?: [string, string, boolean][] | null; onTime?: (key: string) => void
  channels?: [string, string, boolean][] | null; onChannel?: (key: string) => void
  tags?: string[]; onTag?: (tag: string) => void
  /** a nyelv-váltó (élőben a közös LocaleEditBar) */
  language?: React.ReactNode
  sender?: string
  /** a levél saját beállításai (pl. visszaigazolásnál a kapcsolat-blokk kapcsolói) */
  extra?: React.ReactNode
  onTemplate?: () => void; onPreview?: () => void; onSave?: () => void; saveBusy?: boolean; saveDisabled?: boolean
  /** a Vendég e-mailek lapján két kártya: `settings` (bal oszlop: be / ki, időzítés, csatorna, kapcsolat, nyelv, feladó) és
   *  `editor` (jobb oszlop, mint a Marketingnél: a kijelölt blokk, beszúrható adatok, sablon, előnézet, mentés) */
  part?: 'all' | 'settings' | 'editor'
  /** `editor`: a kijelölt blokk kártyája (`useBlockInspector`) — név és tartalom; kijelölés nélkül null */
  block?: { name: string | null; body: React.ReactNode }
  className?: string
}) {
  const showSettings = part !== 'editor'
  const showEditor = part !== 'settings'
  const chip = (k: string, label: string, active: boolean, on?: (k: string) => void) => {
    const p = <Pill size="sm" tone={active ? 'dark' : 'white'} className={active ? '' : 'max-lg:bg-ui-cell'}>{label}</Pill>
    return on ? <button key={k} type="button" aria-pressed={active} onClick={() => on(k)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{p}</button> : <span key={k}>{p}</span>
  }
  return (
      <Card pad="md" className={`flex flex-col ${className}`}>
        {showSettings && <>
        <div className="flex items-center justify-between"><CardTitle>{title}</CardTitle>{onToggle ? <Switch checked={on} onChange={onToggle} ariaLabel={`${title}: be / ki`} /> : <DesignSwitch defaultOn={on} />}</div>
        {times && <FieldRow label="Mikor menjen ki" stacked className="mt-2">{times.map(([k, l, a]) => chip(k, l, a, onTime))}<Meta className="w-full text-ui-label">a sötétek az aktívak — több is választható</Meta></FieldRow>}
        </>}
        {showEditor && block !== undefined && <>
          <div className="flex items-center justify-between gap-2"><CardTitle>Kijelölt blokk</CardTitle>{block.name && <Pill tone="yellow" size="sm">{block.name}</Pill>}</div>
          <div className="mt-1">{block.body ?? <Meta className="py-2.5 text-ui-label">Kattints egy blokkra a levélben.</Meta>}</div>
        </>}
        {showEditor && tags.length > 0 && <FieldRow label="Beszúrható adatok" stacked>{tags.map((v) => onTag ? <button key={v} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onTag(v)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><MergeTag tone="white">{v}</MergeTag></button> : <MergeTag key={v} tone="white">{v}</MergeTag>)}<Meta className="w-full text-ui-label">kattints, és a kurzor helyére kerül</Meta></FieldRow>}
        {showSettings && <>
        {channels && <FieldRow label="Csatorna" stacked>{channels.map(([k, l, a]) => chip(k, l, a, onChannel))}</FieldRow>}
        {extra}
        <FieldRow label="Nyelv" stacked>{language ?? <Segmented options={['HU', 'EN', 'DE']} active={0} />}</FieldRow>
        <FieldRow label="Feladó"><span className="text-ui-body text-ui-text">{sender}</span></FieldRow>
        </>}
        {showEditor && <>
        {onTemplate !== undefined || part === 'all' ? <div className="mt-2"><Button variant="yellow" size="sm" icon={Undo2} onClick={onTemplate}>Sablon betöltése</Button></div> : null}
        <div className="mt-auto flex flex-wrap gap-2 pt-5"><Button variant="glass" size="sm" icon={Send} className="max-lg:bg-ui-cell" onClick={onPreview}>{onPreview ? 'Előnézet' : 'Teszt magamnak'}</Button><Button size="sm" onClick={onSave} loading={saveBusy} disabled={saveDisabled}>Mentés</Button></div>
        </>}
      </Card>
  )
}

/** A Vendég e-mailek lapja (16.6) — ugyanaz a felépítés, mint a Marketing kampány-szerkesztője: bal a levelek kártyákon (mikor
 *  mennek ki, Be / Ki; a megnyitott sárga), közép maga a levél (tárgy, Desktop / Mobil, a levélben szerkesztesz, alatta a
 *  foglalás adatai és a gombok), jobb a beállítások (`settings`). `letter`: élőben a szerkeszthető levél-tartalom. */
export function GuestEmailsPage({ letters = SAMPLE_LETTERS, selected = 'reminder', onSelect, subject, letter, details = { line: 'Hétfő, Nov. 10. · 13:30', meta: 'Viktória · 60 perc' }, buttons = ['Naptárba', 'Útvonalterv'], biz = { name: 'Fodrászat Budapest', initials: 'FB', footer: 'Fodrászat Budapest · Andrássy út 12' }, device = 0, onDevice, settings, side, palette, paletteRow, cancelLink = true, className = '' , onBrand, brandSelected = false, logoH}: {
  letters?: GuestLetter[]; selected?: string; onSelect?: (key: string) => void
  /** a tárgy (élőben szerkeszthető mező) */
  subject?: React.ReactNode
  letter?: React.ReactNode
  details?: { line: string; meta: string } | null
  buttons?: string[]
  biz?: { name: string; initials: string; logo?: string | null; footer?: string }
  /** a levél fejléce kijelölhető (logó / ikon, méret — design 24.2); `logoH`: a kép magassága */
  onBrand?: () => void; brandSelected?: boolean; logoH?: number
  device?: number; onDevice?: (i: number) => void
  settings?: React.ReactNode
  /** a bal oszlopban a levelek alatt (élőben: a levél beállításai — be / ki, időzítés, kapcsolat, nyelv, feladó) */
  side?: React.ReactNode
  /** a gombok alatt apró, aláhúzott „Foglalás lemondása” (mint a kiküldött levélben) */
  cancelLink?: boolean
  /** élőben: a blokk-paletta a levél bal oldalán — a levél minden része (fejléc, szöveg, adatok, gombok) mellette, bentebb */
  palette?: React.ReactNode
  /** mobilon a blokk-paletta vízszintes sávként, a levél fölött (a függőleges, ragadós sáv a lap címére csúszna) */
  paletteRow?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`grid gap-[5px] lg:grid-cols-[240px_minmax(0,1fr)_280px] ${className}`}>
      <div className="flex flex-col gap-[5px] self-start">
      <Card pad="sm" className="space-y-1">
        <div className="px-2 pb-1 pt-1"><CardTitle>Levelek</CardTitle></div>
        {letters.map((m) => {
          const sel = m.key === selected
          const card = (
            <Card tone="white" inner pad="sm" className={sel ? 'bg-ui-yellow' : 'max-lg:bg-ui-cell'}>
              <div className="flex items-start justify-between gap-2">
                <span className={`text-ui-body font-medium ${m.on ? 'text-ui-text' : 'text-ui-muted'}`}>{m.title}</span>
                <StatusPill status={m.on ? 'ok' : 'bad'}>{m.on ? 'Be' : 'Ki'}</StatusPill>
              </div>
              <Meta className="mt-0.5 text-ui-label">{m.when}</Meta>
            </Card>
          )
          return onSelect ? <button key={m.key} type="button" onClick={() => onSelect(m.key)} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{card}</button> : <div key={m.key}>{card}</div>
        })}
      </Card>
      {side}
      </div>

      {/* mobil nézetben a paletta a „kijelzőn” kívül, bal oldalt áll — a keskeny levél teljes szélessége a tartalomé */}
      <div className="flex min-w-0 items-start justify-center gap-3">
      {device === 1 && palette && <div className="sticky top-3 z-10 shrink-0 pt-16">{palette}</div>}
      {/* mobilon nincs overflow-hidden: a lenti blokk-sáv így tud a lap aljához ragadni (sticky) */}
      <Card tone="white" pad="none" className={`flex flex-col self-stretch lg:overflow-hidden ${device === 1 ? 'w-full max-w-[390px]' : 'min-w-0 flex-1'}`}>
        <div className="flex items-center gap-2 border-b border-dashed border-ui-divider px-6 py-3.5">
          <Meta className="shrink-0">Tárgy:</Meta>
          <MarqueeText className="flex-1 text-ui-body text-ui-text">{subject ?? <>Holnap találkozunk — <MergeTag>idő</MergeTag></>}</MarqueeText>
          <Segmented options={['Desktop', 'Mobil']} active={device} onSelect={onDevice} className="max-lg:hidden" />
        </div>
        <div className="flex items-start">
        {palette && device !== 1 && <div className={`sticky top-3 z-10 shrink-0 pl-4 pt-5 ${paletteRow ? 'max-lg:hidden' : ''}`}>{palette}</div>}
        <div className={`min-w-0 flex-1 ${palette ? 'pb-5' : ''}`}>
        {/* a levél fejléce: az üzlet képe (a választott logó / ikon, a saját alakjában) és a neve — élőben kijelölhető */}
        {(() => {
          const head = <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {biz.logo ? <img src={biz.logo} alt="" className="h-8 w-auto max-w-[160px] object-contain" style={logoH ? { height: logoH } : undefined} /> : <span className="flex h-8 w-8 items-center justify-center rounded-ui-control bg-ui-dark text-ui-label font-medium text-white">{biz.initials}</span>}
            <Meta>{biz.name}</Meta>
          </>
          return onBrand
            ? <button type="button" onClick={onBrand} title="Logó vagy ikon, méret" className={`relative mx-3 mt-3 flex items-center gap-2 rounded-ui-control px-3 py-2 text-left outline-none ${brandSelected ? '' : 'hover:bg-ui-cell'}`}>{brandSelected && <span className="pointer-events-none absolute inset-0 rounded-ui-control border-2 border-dashed border-ui-yellow" />}{head}</button>
            : <div className="flex items-center gap-2 px-6 pt-5">{head}</div>
        })()}
        {letter ?? (
          <div className="relative mx-3 mt-3 px-3 py-3">
            <span className="pointer-events-none absolute inset-0 rounded-ui-control border-2 border-dashed border-ui-yellow" />
            <div className="text-ui-sub font-light text-ui-dark">Holnap találkozunk</div>
            <div className="mt-2 max-w-[560px] text-ui-body leading-loose text-ui-muted">Kedves <MergeTag>vendég</MergeTag>! Emlékeztetünk, hogy <MergeTag>nap</MergeTag> <MergeTag>idő</MergeTag>-kor vár <MergeTag>munkatárs</MergeTag> a <MergeTag>szolgáltatás</MergeTag> időpontodra. Ha mégsem tudsz jönni, egy kattintással lemondhatod.</div>
          </div>
        )}
        {details && <div className="mt-3 px-6"><Card tone="cell" inner pad="sm" className="max-w-[420px]"><span className="block text-ui-body text-ui-text">{details.line}</span><Meta>{details.meta}</Meta></Card></div>}
        {buttons.length > 0 && <div className={`flex gap-1.5 px-6 pt-5 ${cancelLink ? 'pb-2' : 'pb-5'}`}>{buttons.map((b, i) => <Button key={b} size="sm" variant={i ? 'cell' : 'dark'} className="pointer-events-none">{b}</Button>)}</div>}
        {cancelLink && <Meta className="px-6 pb-5 text-ui-label">Mégsem tudsz jönni? <span className="underline underline-offset-2">Foglalás lemondása</span></Meta>}
        </div>
        </div>
        {/* mobil: a blokk-sáv a levél alján — amíg a levelet görgeted, a képernyő aljához ragad, a végén itt marad */}
        {paletteRow && <div className="sticky bottom-3 z-10 px-3 pb-3 lg:hidden">{paletteRow}</div>}
        <Meta className="mt-auto border-t border-dashed border-ui-divider px-6 py-3 text-ui-label">{biz.footer ?? biz.name} · Kattints a levélbe a szerkesztéshez — a szürke mezők helyére a valós adat kerül.</Meta>
      </Card>
      </div>

      {settings ?? <ReminderSettingsCard />}
    </div>
  )
}

/** 16.8: heti nyitvatartás — naponta egy idősáv, a nyitott idő sárga, a szünet rés, a zárt nap csíkos; jobbra mettől
 *  meddig és hány óra (a sávban nincs szöveg, így mobilon sem csúszik el). Élőben `rows` (órában, tört is lehet) és
 *  `onDay` (a nap szerkesztése), `footer` a sorok alatt; nélkülük a minta. */
export type HoursRow = { d: string; from?: number; to?: number; br?: [number, number]; closed?: boolean; label?: string }
const SAMPLE_HOURS: HoursRow[] = [
  { d: 'H', from: 9, to: 19, br: [12.5, 13] }, { d: 'K', from: 9, to: 19, br: [12.5, 13] }, { d: 'Sze', from: 9, to: 19, br: [12.5, 13] },
  { d: 'Cs', from: 10, to: 20, br: [14, 14.5] }, { d: 'P', from: 9, to: 21 }, { d: 'Szo', from: 9, to: 14 }, { d: 'V', closed: true },
]
const hhmm = (h: number) => `${Math.floor(h)}${h % 1 ? `:${String(Math.round((h % 1) * 60)).padStart(2, '0')}` : ''}`
export function OpeningHoursCard({ rows = SAMPLE_HOURS, onDay, footer, scope = true, className = '' }: { rows?: HoursRow[]; onDay?: (i: number) => void; footer?: [string, React.ReactNode][]; /** a design „Üzlet / Munkatársanként” váltója */ scope?: boolean; className?: string }) {
  const lo = Math.min(8, ...rows.filter((r) => !r.closed).map((r) => Math.floor(r.from ?? 8)))
  const hi = Math.max(22, ...rows.filter((r) => !r.closed).map((r) => Math.ceil(r.to ?? 22)))
  const pct = (h: number) => ((h - lo) / (hi - lo)) * 100
  const ticks = [lo, ...[12, 16, 20].filter((h) => h > lo + 1 && h < hi - 1)]
  const total = rows.reduce((n, r) => n + (r.closed ? 0 : (r.to ?? 0) - (r.from ?? 0) - (r.br ? r.br[1] - r.br[0] : 0)), 0)
  const foot = footer ?? [['Utolsó foglalható időpont', <Input key="a" size="sm" defaultValue="zárás előtt 30 perccel" className="w-[220px] max-w-full" />], ['Munkaszüneti napokon', <DesignSwitch key="b" />], ['Heti összesen', <Input key="c" size="sm" defaultValue="54 óra" className="w-[220px] max-w-full" />]]
  return (
      <Card className={`flex flex-col ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-ui-title font-normal text-ui-text">Heti nyitvatartás</span>
          {scope && <Segmented options={['Üzlet', 'Munkatársanként']} active={0} />}
        </div>
        {/* az órák pontosan a sáv fölött (a felirat közepe az óra helyén) — keskeny kártyán is egy vonalban */}
        <div className="mt-5 grid grid-cols-[36px_1fr_76px] items-center gap-x-3 text-ui-label text-ui-muted">
          <span />
          <div className="relative h-4">{ticks.map((h) => <span key={h} className="absolute -translate-x-1/2" style={{ left: `${pct(h)}%` }}>{h}</span>)}</div>
          <span />
        </div>
        {rows.map((r, i) => {
          const row = (
            <div className="mt-2 grid grid-cols-[36px_1fr_76px] items-center gap-x-3">
              <span className={`text-left text-ui-body ${i >= 5 ? 'text-ui-bad-dot' : 'text-ui-text'}`}>{r.d}</span>
              <div className={`relative h-10 rounded-full ${r.closed ? 'ui-hatch' : 'bg-white/50'}`}>
                {!r.closed && (r.br ? [[r.from!, r.br[0]], [r.br[1], r.to!]] : [[r.from!, r.to!]]).map(([x, y], j) => (
                  <span key={j} className="absolute inset-y-1 rounded-full bg-ui-yellow" style={{ left: `${pct(x)}%`, width: `calc(${pct(y) - pct(x)}% - 2px)` }} />
                ))}
              </div>
              {/* jobbra: mettől meddig, alatta az óraszám — a sávba nem kerül szöveg, így keskenyen sem csúszik szét */}
              <span className="text-right leading-tight">{r.closed ? <span className="text-ui-meta text-ui-muted">Zárva</span> : <><span className="block text-ui-meta text-ui-text">{r.label ?? `${hhmm(r.from!)}–${hhmm(r.to!)}`}</span><span className="block text-ui-label text-ui-muted">{String(Math.round(((r.to! - r.from!) - (r.br ? r.br[1] - r.br[0] : 0)) * 10) / 10).replace('.', ',')} óra</span></>}</span>
            </div>
          )
          return onDay ? <button key={r.d} type="button" title={`${r.d} — szerkesztés`} onClick={() => onDay(i)} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button> : <div key={r.d}>{row}</div>
        })}
        <div className="mt-4 flex flex-wrap gap-4 text-ui-label text-ui-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-ui-yellow" />Nyitva</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-white/60" />Szünet</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full ui-hatch" />Zárva</span>
        </div>
        <div className="mt-auto pt-4">
          {(footer ? foot : foot).map(([k, v]) => (
            // keskenyen (mobil lap) a vezérlő a felirat alá törik, és ha még így is széles, vízszintesen görgethető
            <div key={k} className={`${SHEET_ROW} flex-wrap`}>
              <span className="text-ui-body text-ui-muted">{k}{k === 'Munkaszüneti napokon' && <span className="block text-ui-label">magától zárva, a kivételek közé kerül</span>}</span>
              <span className="min-w-0 max-w-full overflow-x-auto">{k === 'Heti összesen' && footer ? <span className="text-ui-body text-ui-text">{String(Math.round(total * 10) / 10).replace('.', ',')} óra</span> : v}</span>
            </div>
          ))}
        </div>
      </Card>
  )
}

/** 16.8: foglaltság a héten (sötét kártya) — a nyitvatartás hány %-a foglalt, naponta oszlopokkal (a legtelibb sárga), és
 *  egy mondat róla. */
export function OccupancyCard({ pct = 74, perDay = [{ d: 'H', v: 62 }, { d: 'K', v: 58 }, { d: 'Sze', v: 66 }, { d: 'Cs', v: 81 }, { d: 'P', v: 96 }, { d: 'Szo', v: 88 }, { d: 'V', v: 0, closed: true }], note, className = '' }: { pct?: number; perDay?: { d: string; v: number; closed?: boolean }[]; note?: string; className?: string }) {
  const open = perDay.filter((x) => !x.closed)
  const peak = open.length ? open.reduce((a, b) => (b.v > a.v ? b : a)) : null
  const low = open.length ? open.reduce((a, b) => (b.v < a.v ? b : a)) : null
  const DAYN: Record<string, string> = { H: 'Hétfőn', K: 'Kedden', Sze: 'Szerdán', Cs: 'Csütörtökön', P: 'Pénteken', Szo: 'Szombaton', V: 'Vasárnap' }
  const text = note ?? (peak && low && peak.v > 0 ? `${DAYN[peak.d] ?? peak.d} a legtelibb (${peak.v}%), ${(DAYN[low.d] ?? low.d).toLowerCase()} van a legtöbb szabad hely.` : 'Ezen a héten még nincs foglalás.')
  return (
    <Card tone="dark" className={className}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-ui-row">Foglaltság a héten</div>
          <div className="mt-0.5 text-ui-label text-white/50">a nyitvatartás hány %-a foglalt</div>
        </div>
        <span className="text-ui-num font-light leading-none">{pct}%</span>
      </div>
      <div className="mt-5 flex h-[96px] items-end justify-between gap-2">
        {perDay.map((b) => {
          const isPeak = !!peak && b === peak && b.v > 0
          return (
            <div key={b.d} className="flex flex-1 flex-col items-center justify-end">
              {isPeak && <span className="mb-1 text-ui-label text-ui-yellow">{b.v}%</span>}
              <div className={`w-full max-w-[18px] rounded-full ${isPeak ? 'bg-ui-yellow' : b.closed ? 'bg-white/10' : 'bg-white/35'}`} style={{ height: b.closed ? 72 * 0.6 : `${Math.max(4, (b.v / 100) * 72)}px` }} />
              <span className="mt-1.5 text-ui-label text-white/50">{b.d}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 border-t border-white/10 pt-3 text-ui-label leading-relaxed text-white/55">{text}</div>
    </Card>
  )
}

/** 16.8: kivételek (ünnep, szabadság, rövidített nap) a naptár fehér eseménysávjával; `onAdd` / `onOpen` élőben. */
export type HoursExceptionItem = { key: string; tone: 'closed' | 'short' | 'off'; title: string; range: string }
const SAMPLE_EXC: HoursExceptionItem[] = [
  { key: 'a', tone: 'closed', title: 'Zárva', range: 'Dec. 24–26.' }, { key: 'b', tone: 'short', title: 'Rövidített nap', range: 'Dec. 31. · 9–13' },
  { key: 'c', tone: 'closed', title: 'Újév', range: 'Jan. 1.' }, { key: 'd', tone: 'off', title: 'Csapat-szabadság', range: 'Jan. 2–5.' }, { key: 'e', tone: 'closed', title: 'Nemzeti ünnep', range: 'Márc. 15.' },
]
const EXC_DOT = { closed: 'bg-ui-dark', short: 'bg-ui-yellow', off: 'bg-ui-grey' } as const
export function HoursExceptionsCard({ items = SAMPLE_EXC, onAdd, onOpen, className = '' }: { items?: HoursExceptionItem[]; onAdd?: () => void; onOpen?: (key: string) => void; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-ui-row text-ui-text">Kivételek</span>
        <IconButton icon={Plus} label="Hozzáadás" size="sm" onClick={onAdd} />
      </div>
      {items.map((e) => {
        const pill = (
          <Pill tone="white" className="mt-2 w-full gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${EXC_DOT[e.tone]}`} />
            {/* ha nem fér ki (pl. „Karácsony másnapja · ünnepnap — mi legyen?”), a cím elúszik — mint az Opció-kártyákon; a dátum mindig látszik */}
            {/* a láthatatlan példány adja a cím természetes szélességét (a szalag a dobozából méri magát, magától 0 széles
                lenne egy rugalmas sorban); ha nincs elég hely, a doboz összemegy, és a szalag elúszik */}
            <span className="relative min-w-0 flex-initial overflow-hidden">
              <span aria-hidden className="invisible block whitespace-nowrap">{e.title}</span>
              <Marquee className="absolute inset-0">{e.title}</Marquee>
            </span>
            <span className="h-3 min-w-3 flex-1 rounded-full ui-hatch-cell" />
            <span className="shrink-0 whitespace-nowrap">{e.range}</span>
          </Pill>
        )
        return onOpen ? <button key={e.key} type="button" onClick={() => onOpen(e.key)} className="ui-press block w-full rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button> : <div key={e.key}>{pill}</div>
      })}
      {!items.length && <Meta className="mt-3">Nincs kivétel — ünnepet, szabadságot vagy rövidített napot a + gombbal adhatsz hozzá.</Meta>}
      <div className="mt-auto pt-3 text-ui-label leading-relaxed text-ui-muted">A foglalóoldal ezeken a napokon magától nem kínál időpontot.</div>
    </Card>
  )
}

export function SaveBar({ label = '1 módosítás', className = 'bottom-4', onSave, onDiscard, busy = false }: { label?: string; className?: string; onSave?: () => void; onDiscard?: () => void; busy?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center ${className}`}>
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ui-dark p-1.5 pl-4 text-ui-body text-white shadow-ui-float">
        <span className="mr-2 text-white/60">{label}</span>
        <Button variant="ghostDark" size="sm" onClick={onDiscard} disabled={busy}>Elvetés</Button>
        <Button variant="yellow" size="sm" onClick={onSave} loading={busy}>Mentés</Button>
      </div>
    </div>
  )
}

/* ── 16.2: Csapat & jogok — Tagok ── */

/** Egy tag sora: `staff` a fiókhoz kötött munkatárs-profil (üres = nem foglalható), `last` az utolsó belépés felirata. */
export type MemberRow = { id: string; name: string; email: string; img?: string | null; role: string; owner?: boolean; staff?: string | null; last: string; status: 'active' | 'suspended' }
export type PendingInvite = { id: string; email: string; meta: string }
const SAMPLE_MEMBERS: MemberRow[] = [
  { id: 'd', name: 'Dávid', email: 'hello@davelopment.hu', img: 'dave', role: 'Tulajdonos', owner: true, staff: 'Dávid', last: 'most', status: 'active' },
  { id: 's', name: 'Szabina', email: 'szabina@davelopment.hu', img: 'szabina', role: 'Recepció', staff: null, last: 'ma 09:12', status: 'active' },
  { id: 'v', name: 'Viktória', email: 'viktoria@davelopment.hu', img: 'viktoria', role: 'Szakember', staff: 'Viktória', last: 'tegnap', status: 'active' },
  { id: 'c', name: 'Csaba', email: 'csaba@davelopment.hu', img: 'csaba', role: 'Szakember', staff: 'Csaba', last: '3 napja', status: 'active' },
  { id: 'b', name: 'Kis Bence', email: 'bence@gmail.com', img: '', role: 'Szakember', staff: 'Kis Bence', last: '2 hónapja', status: 'suspended' },
].map((r) => ({ ...r, img: r.img ? `/landing/funkciok/csapat/avatar/${r.img}.webp` : null })) as MemberRow[]
const SAMPLE_PENDING: PendingInvite[] = [{ id: 'n', email: 'nora.kiss@gmail.com', meta: 'Recepció · 2 napja küldve' }]

/** A Csapat & jogok „Tagok” nézete (16.2): fejléc (Tagok / Szerepek váltó, + Meghívás), létszám-csík (aktív, meghívott,
 *  felfüggesztett), a tagok táblázata (pipa, tag, szerep — pill-választó, munkatárs-profil, utolsó belépés, állapot, ⋯),
 *  alatta a függő meghívók újraküldéssel / visszavonással. `renderRole` / `renderActions`: élőben a szerep- és a ⋯ menü
 *  (a hívó adja); nélkülük a design pillje / gombja. A kijelölt sor sárga. */
export function TeamMembers({ rows = SAMPLE_MEMBERS, pending = SAMPLE_PENDING, tab = 0, onTab, onInvite, selected = ['v'], onToggle, onToggleAll, renderRole, renderActions, onResend, onRevoke, bulk, className = '' }: {
  rows?: MemberRow[]; pending?: PendingInvite[]; tab?: number; onTab?: (i: number) => void; onInvite?: () => void
  selected?: string[]; onToggle?: (id: string) => void; onToggleAll?: () => void
  renderRole?: (r: MemberRow) => React.ReactNode; renderActions?: (r: MemberRow) => React.ReactNode
  onResend?: (id: string) => void; onRevoke?: (id: string) => void
  /** kijelöléskor a tömeges-művelet sáv (BulkDock-ban) */
  bulk?: React.ReactNode
  className?: string
}) {
  const active = rows.filter((r) => r.status === 'active').length
  const susp = rows.filter((r) => r.status === 'suspended').length
  const total = Math.max(1, active + susp + pending.length)
  const selectable = rows.filter((r) => !r.owner)
  const all = selectable.length > 0 && selectable.every((r) => selected.includes(r.id))
  return (
    <div className={`relative rounded-ui-card bg-white p-6 ${bulk ? 'pb-24' : ''} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-ui-label text-ui-muted">Csapat</div><div className="text-ui-sub font-light text-ui-text">Csapat & jogok</div></div>
        <div className="flex items-center gap-1.5">
          <Segmented options={['Tagok', 'Szerepek']} active={tab} onSelect={onTab} tone="cell" />
          {(onInvite || !onTab) && tab === 0 && <Button variant="yellow" icon={Plus} onClick={onInvite}>Meghívás</Button>}
        </div>
      </div>
      <SegmentBar size="md" className="mt-5 max-w-[460px]" segments={[
        { label: 'Aktív', value: `${active} fő`, weight: (active / total) * 100 || 4, tone: 'dark' },
        { label: 'Meghívott', value: `${pending.length} fő`, weight: (pending.length / total) * 100 || 4, tone: 'yellow' },
        { label: 'Felfüggesztett', value: `${susp} fő`, weight: (susp / total) * 100 || 4, tone: 'hatch' },
      ]} />
      <div className="mt-4 overflow-x-auto">
        <Table minWidth={760}>
          <thead><Tr><Th className="w-10"><RowCheck checked={all} onToggle={onToggleAll} label="Mind kijelölése" /></Th><Th>Tag</Th><Th>Szerep</Th><Th>Munkatárs-profil</Th><Th>Utolsó belépés</Th><Th>Állapot</Th><Th /></Tr></thead>
          <tbody>
            {rows.map((r) => {
              const sel = selected.includes(r.id)
              return (
                <Tr key={r.id} state={sel ? 'selected' : r.status === 'suspended' ? 'muted' : 'default'} onClick={onToggle && !r.owner ? () => onToggle(r.id) : undefined}>
                  <Td>{r.owner ? <span className="block h-6 w-6" /> : <RowCheck checked={sel} onToggle={onToggle ? () => onToggle(r.id) : undefined} />}</Td>
                  <Td><span className="flex items-center gap-2.5"><Avatar src={r.img ?? null} name={r.name} /><span className="min-w-0"><span className="block">{r.name}</span><Meta className="text-ui-label">{r.email}</Meta></span></span></Td>
                  <Td>{renderRole ? renderRole(r) : r.owner ? <Pill tone="dark" size="sm">Tulajdonos</Pill> : <Pill tone="white" size="sm">{r.role}<ChevronDown className="h-3.5 w-3.5 text-ui-muted" /></Pill>}</Td>
                  <Td>{r.staff ? <span className="inline-flex items-center gap-1"><Link2 className="h-3 w-3 text-ui-muted" />{r.staff}</span> : <Meta>nincs profil · nem foglalható</Meta>}</Td>
                  <Td><Meta>{r.last}</Meta></Td>
                  <Td><StatusPill status={r.status === 'active' ? 'ok' : 'bad'}>{r.status === 'active' ? 'Aktív' : 'Felfüggesztett'}</StatusPill></Td>
                  <Td>{renderActions ? renderActions(r) : !r.owner && <IconButton icon={MoreHorizontal} size="sm" variant="ghost" label="Műveletek" />}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </div>
      {pending.length > 0 && (
        <>
          <div className="mt-6 flex items-center gap-2 text-ui-meta text-ui-muted">Függő meghívók<span className="h-px flex-1 border-t border-dashed border-ui-divider" /></div>
          <div className="mt-2 space-y-1.5">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-ui-inner bg-ui-cell px-3 py-3">
                <IconCircle tone="white" size="md" icon={Mail} />
                <span className="min-w-0 flex-1"><MarqueeText className="text-ui-body text-ui-text">{p.email}</MarqueeText><span className="block text-ui-label text-ui-muted">{p.meta}</span></span>
                <Button variant="glass" size="sm" onClick={onResend ? () => onResend(p.id) : undefined}>Újraküldés</Button>
                <Button variant="ghost" size="sm" className="text-ui-bad" onClick={onRevoke ? () => onRevoke(p.id) : undefined}>Visszavonás</Button>
              </div>
            ))}
          </div>
        </>
      )}
      {bulk}
    </div>
  )
}

/* ── 16.1 / 16.20: a Beállítások kerete ── */

/** Egy téma a listában: `todo` sárga pötty (itt még teendő van), `badge` (pl. próbaidő), `locked` (lejárt előfizetés). */
export type SettingsTopic = { key: string; label: string; icon: LucideIcon; active?: boolean; todo?: boolean; badge?: string; locked?: boolean; danger?: boolean; href?: string; onClick?: () => void }
export type SettingsTopicGroup = { group: string; items: SettingsTopic[] }

const topicNode = (t: SettingsTopic, node: React.ReactNode, cls: string) => {
  if (t.locked) return <span key={t.key} aria-disabled title="Az előfizetésed lejárt — aktiváld a folytatáshoz" className="block cursor-not-allowed opacity-40">{node}</span>
  if (t.href) return <Link key={t.key} href={t.href} onClick={t.onClick} className={cls}>{node}</Link>
  if (t.onClick) return <button key={t.key} type="button" onClick={t.onClick} className={cls}>{node}</button>
  return <div key={t.key}>{node}</div>
}

/** A téma-lista (desktop, 16.1): csoportonként a pill-sorok, az aktív sötét, teendőnél sárga pötty. `collapsed`: csak az
 *  ikonok (a Foglalóoldal szerkesztőjénél, hogy az előnézetnek legyen hely). */
export function SettingsNav({ groups, collapsed = false, footer, className = '' }: { groups: SettingsTopicGroup[]; collapsed?: boolean; footer?: React.ReactNode; className?: string }) {
  const cls = 'ui-press block w-full rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20'
  return (
    <div className={className}>
      {groups.map((g) => (
        <div key={g.group} className="mt-2 first:mt-0">
          {!collapsed && g.group && <div className="px-3 pb-1 text-ui-label text-ui-muted">{g.group}</div>}
          {g.items.map((t) => {
            const trailing = collapsed ? undefined : t.locked ? <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} /> : t.badge ? <Pill tone="yellow" size="sm">{t.badge}</Pill> : t.todo ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ui-yellow" /> : undefined
            return topicNode(t, <NavItem icon={t.icon} active={t.active} trailing={trailing} className={`${t.danger && !t.active ? 'text-ui-bad' : ''} ${collapsed ? '[&>span:nth-child(2)]:hidden' : ''}`}>{t.label}</NavItem>, cls)
          })}
        </div>
      ))}
      {footer}
    </div>
  )
}

/** A téma-lista mobilon (16.20): a Beállítások első képernyője — cím, kereső, csoportonként (fejléc a darabszámmal) kártyában
 *  a témák ikonnal, teendőnél sárga pöttyel; koppintva a téma lapja alulról felcsúszik. */
export function SettingsMobileList({ groups, query, onQuery, onCloseSearch, footer, searchOpen = true, className = '' }: { groups: SettingsTopicGroup[]; query?: string; onQuery?: (q: string) => void; footer?: React.ReactNode
  /** a kereső látszik-e — élőben a fejléc kereső-ikonja nyitja (alapból nem foglal helyet) */
  searchOpen?: boolean
  /** a kereső X gombja (mint a többi oldalon: törli és bezárja) */
  onCloseSearch?: () => void; className?: string }) {
  const cls = 'ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20'
  return (
    <div className={className}>
      <div className="text-ui-num font-light leading-none text-ui-text">Beállítások</div>
      {/* a többi oldal mobil keresőjével egyezően: mező + mellette az X (törli és bezárja) */}
      {searchOpen && (
        <div className="ui-pop-in mt-4 flex items-center gap-1.5">
          <SearchField autoFocus={!!onQuery && !query} className="min-w-0 flex-1" value={query} onChange={onQuery}>Beállítás keresése</SearchField>
          {onCloseSearch && <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={onCloseSearch} />}
        </div>
      )}
      {groups.map((g) => (
        <div key={g.group} className="mt-4">
          <div className="mb-1.5 flex items-center gap-2 text-ui-label text-ui-muted">{g.group}<span className="h-px flex-1 border-t border-dashed border-ui-divider" />{g.items.length}</div>
          <Card pad="xs">{g.items.map((t) => topicNode(t, <ListRow leading={<IconCircle tone="cell" size="md" icon={t.icon} />} title={<span className={t.danger ? 'text-ui-bad' : ''}>{t.label}</span>} trailing={<span className="flex items-center gap-2">{t.badge && <Pill tone="yellow" size="sm">{t.badge}</Pill>}{t.todo && <span className="h-1.5 w-1.5 rounded-full bg-ui-yellow" />}{t.locked ? <Lock className="h-4 w-4 text-ui-muted" strokeWidth={1.8} /> : <ArrowRight className="h-4 w-4 text-ui-muted" />}</span>} />, cls))}</Card>
        </div>
      ))}
      {!groups.length && <Meta className="px-1 py-6 text-center">Nincs ilyen beállítás.</Meta>}
      {footer}
    </div>
  )
}

/** „Beállítás kész” (16.1, egyben az onboarding): sötét kártya — hány százalék, a sáv, a hiányzó lépések (koppintva a
 *  témájukra visz), és hány kész. 100%-nál is látszik (teli sáv, „Minden a helyén van.”). */
export function SetupProgressCard({ pct = 62, missing = [{ label: 'Stripe összekötése' }, { label: 'Első hírlevél' }], done = 6, className = '' }: { pct?: number; missing?: { label: string; onClick?: () => void }[]; done?: number; className?: string }) {
  return (
    <Card tone="dark" className={className}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-ui-title font-normal">Beállítás kész</div>
          <div className="mt-1 text-ui-meta text-white/55">{missing.length ? <>Még {missing.length} lépés, és {missing.length > 1 ? 'minden' : 'ez is'} a helyén van.</> : 'Minden a helyén van.'}</div>
        </div>
        <span className="text-ui-page font-light leading-none">{pct}%</span>
      </div>
      <div className="mt-4 flex gap-1.5">
        <span className="h-2.5 rounded-full bg-ui-yellow" style={{ flex: pct }} />
        <span className="h-2.5 rounded-full bg-white/15" style={{ flex: 100 - pct }} />
      </div>{/* ui-allow: a sáv aránya (adat) */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {missing.map((m) => {
          const pill = <Pill tone="onDark"><span className="h-1.5 w-1.5 rounded-full bg-ui-yellow" />{m.label}<ArrowUpRight className="h-3 w-3 opacity-60" /></Pill>
          return m.onClick ? <button key={m.label} type="button" onClick={m.onClick} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/30">{pill}</button> : <span key={m.label}>{pill}</span>
        })}
        {done > 0 && <span className="inline-flex items-center gap-1.5 px-3 text-ui-meta text-ui-ok-dot"><Check className="h-3 w-3" /> {done} kész</span>}
      </div>
    </Card>
  )
}

/* ── 16.5: Előfizetés ── */

export type PlanOption = { key: string; name: string; badge: string; price: string; perMonth?: boolean; cap: string; extra: string; current?: boolean; btn: string; onClick?: () => void; busy?: boolean; disabled?: boolean }
export type AccountInvoice = { key: string; period: string; plan: string; amount: string; status: string; url?: string | null }
const SAMPLE_PLANS: PlanOption[] = [
  { key: 'starter', name: 'Starter', badge: 'Belépő', price: '5 900', perMonth: true, cap: '500 hírlevél / hó', extra: 'Minden funkció', btn: 'Váltás' },
  { key: 'pro', name: 'Pro', badge: 'Népszerű', price: '9 800', perMonth: true, cap: '5 000 hírlevél / hó', extra: '+ 1 900 Ft / további munkatárs', current: true, btn: 'Jelenlegi' },
  { key: 'egyedi', name: 'Egyedi', badge: 'Vállalati', price: 'Ajánlatra', cap: '50 000 hírlevél / hó', extra: 'Veled egyeztetve', btn: 'Kapcsolat' },
]
const SAMPLE_INVOICES: AccountInvoice[] = [['2026. Október', 'Pro · havi', '9 800 Ft'], ['2026. Szeptember', 'Pro · havi', '9 800 Ft']].map(([period, plan, amount]) => ({ key: period, period, plan, amount, status: 'Fizetve' }))

/** Az Előfizetés lap (16.5): fent a jelenlegi csomag (sötét kártya) a próbaidővel / következő terheléssel és a fizetés fő
 *  gombjával; alatta a felhasználás (mérők) és a fizetési mód (a Stripe-tól élőben — nálunk nincs tárolva) a számlázási
 *  adatokkal; a csomagok (havi / éves váltóval); a számlák; legalul szüneteltetés / lemondás. Props nélkül a design mintája. */
export function SubscriptionPage({
  plan = 'Pro', statusPill = 'Próbaidő · még 9 nap', statusLine = 'Próbaidő vége: Nov. 16. — utána 9 800 Ft / hó, bármikor lemondható.', notice,
  primary = { label: 'Fizetési mód megadása' }, cardLine = 'Nincs mentett kártya',
  usageTitle = 'Felhasználás · November', usage = [{ label: 'Hírlevél-keret', value: 1240, max: 5000, unit: ' e-mail' }, { label: 'Munkatársak', value: 4, max: 6, unit: ' fő', yellow: true }],
  usageNote = 'Keret felett nem megy ki hírlevél — ilyenkor jelzünk, és a következő hónapban újraindul.',
  usageHistory = { months: [['jún', 820], ['júl', 1430], ['aug', 610], ['szept', 2380], ['okt', 1960], ['nov', 1240]].map(([d, v], i, a) => ({ d: d as string, v: v as number, peak: i === a.length - 1 })), cap: 5000 },
  card = null, cardHint = 'A próbaidő végéig ráérsz megadni.', onCard, billingRows = [['Számlázási név', 'Fodrászat Budapest Kft.'], ['Adószám', '12345678-2-42']], onEditBilling,
  cycle = 0, onCycle, showCycle = true, annualPct = 30, plans = SAMPLE_PLANS, invoices = SAMPLE_INVOICES,
  onPause, showPause = !onPause, cancel = { label: 'Lemondás' }, className = '',
}: {
  plan?: string; statusPill?: string | null; statusLine?: React.ReactNode; notice?: React.ReactNode
  primary?: { label: string; onClick?: () => void; busy?: boolean } | null; cardLine?: string
  usageTitle?: string; usage?: { label: string; value: number; max: number; unit?: string; yellow?: boolean }[]; usageNote?: string
  /** az elmúlt hónapok hírlevelei oszlopokban (a mostani sárga) és a havi keret (0 = korlátlan: a legtöbb a skála teteje) */
  usageHistory?: { months: WeekBar[]; cap: number }
  card?: { brand: string; last4: string; expiry: string } | null; cardHint?: string; onCard?: () => void
  billingRows?: [string, string][]; onEditBilling?: () => void
  cycle?: number; onCycle?: (i: number) => void; showCycle?: boolean; annualPct?: number; plans?: PlanOption[]; invoices?: AccountInvoice[]
  onPause?: () => void; /** a Szüneteltetés gomb (a design mintáján; élőben csak ha van `onPause`) */ showPause?: boolean; cancel?: { label: string; onClick?: () => void; busy?: boolean; note?: string } | null; className?: string
}) {
  return (
    <div className={`flex flex-col gap-[5px] [&>*:last-child]:flex-1 ${className}`}>
      <Card tone="dark" pad="lg" className="relative flex flex-wrap items-center justify-between gap-5">
        {/* a fizetést a Stripe-nál kezeli — mobilon kicsiben a kártya jobb felső sarkában (desktopon ott a gomb állna alatta) */}
        {primary && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brands/stripe.svg" alt="Stripe" title="A fizetés a Stripe-nál kezelhető" className="absolute right-6 top-6 h-7 w-7 rounded-ui-control lg:hidden" />
        )}
        <div>
          <Meta dark>Jelenlegi csomag</Meta>
          <div className="mt-1 flex items-center gap-3"><BigNumber dark>{plan}</BigNumber>{statusPill && <Pill tone="yellow" size="sm">{statusPill}</Pill>}</div>
          {statusLine && <Meta dark className="mt-2">{statusLine}</Meta>}
        </div>
        {primary && (
          // mobilon (a gomb a szöveg alá törik): balra igazítva, a kártyaszám a gomb FÖLÖTT; desktopon jobbra, a gomb alatt
          <div className="flex flex-col-reverse items-start gap-2 lg:flex-col lg:items-end">
            {/* desktopon a Stripe-logó a gomb mellett balra (a gomb a Stripe-ot nyitja); mobilon a kártya sarkában */}
            <span className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brands/stripe.svg" alt="Stripe" title="A fizetés a Stripe-nál kezelhető" className="hidden h-7 w-7 rounded-ui-control lg:block" />
              <Button variant="yellow" onClick={primary.onClick} loading={primary.busy}>{primary.label}</Button>
            </span>
            <Meta dark>{cardLine}</Meta>
          </div>
        )}
      </Card>
      {notice}

      <div className="grid gap-[5px] lg:grid-cols-2">
        <Card tone="white" pad="lg" className="max-lg:px-0">
          <CardTitle>{usageTitle}</CardTitle>
          <div className="mt-4 space-y-4">
            {usage.map((u) => <Meter key={u.label} label={u.label} value={u.value} max={u.max} unit={u.unit} tone={u.yellow ? 'yellow' : undefined} />)}
          </div>
          {usageNote && <Meta className="mt-4">{usageNote}</Meta>}
          {/* az elmúlt 6 hónap hírlevelei — a havi kerethez mérve (a keret a skála teteje, ha nagyobb a legtöbbnél) */}
          {usageHistory && (
            <div className="mt-6 border-t border-dashed border-ui-divider pt-5">
              <div className="flex items-baseline justify-between gap-3"><span className="text-ui-body text-ui-text">Hírlevelek havonta</span><Meta>{usageHistory.cap ? `keret: ${usageHistory.cap.toLocaleString('hu-HU')} / hó` : 'korlátlan'}</Meta></div>
              <WeekBars className="mt-4" h={90} days={usageHistory.months} max={usageHistory.cap ? Math.max(usageHistory.cap, ...usageHistory.months.map((m) => m.v), 1) : undefined} tag={(v) => `${v.toLocaleString('hu-HU')} db`} />
            </div>
          )}
        </Card>
        <Card tone="white" pad="lg" className="max-lg:px-0">
          <div className="flex items-center justify-between"><CardTitle>Fizetési mód</CardTitle><Button size="sm" variant="cell" icon={card ? undefined : Plus} onClick={onCard}>{card ? 'Csere' : 'Kártya'}</Button></div>
          <Card tone="cell" inner pad="sm" className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-14 items-center justify-center rounded-ui-control bg-ui-dark text-white"><CreditCard className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-ui-body text-ui-text">{card ? `${card.brand} •••• ${card.last4}` : 'Még nincs kártya'}</span>
              <Meta>{card ? `Lejár: ${card.expiry} · a Stripe-nál tárolva` : cardHint}</Meta>
            </span>
          </Card>
          {billingRows.map(([k, v], i) => <FieldRow key={k} label={k} className={i === 0 ? 'mt-2' : undefined}><span className="text-ui-body text-ui-text">{v || '—'}</span></FieldRow>)}
          {onEditBilling && <Button variant="ghost" size="sm" icon={Pencil} className="mt-1 px-0" onClick={onEditBilling}>Számlázási adatok szerkesztése</Button>}
        </Card>
      </div>

      <Card tone="white" pad="lg" className="max-lg:px-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Csomagok</CardTitle>
          {showCycle && <span className="flex items-center gap-2"><Segmented options={['Havi', 'Éves']} active={cycle} onSelect={onCycle} /><Pill tone="yellow" size="sm">éves −{annualPct}%</Pill></span>}
        </div>
        <div className="mt-4 grid gap-[5px] md:grid-cols-3">
          {plans.map((c) => (
            <Card key={c.key} tone={c.current ? 'dark' : 'cell'} inner pad="md" className="flex flex-col">
              <div className="flex items-center justify-between"><CardTitle dark={c.current}>{c.name}</CardTitle><Pill size="sm" tone={c.current ? 'yellow' : 'white'}>{c.badge}</Pill></div>
              <div className="mt-3 flex items-baseline gap-1.5"><BigNumber dark={c.current}>{c.price}</BigNumber>{c.perMonth && <Meta dark={c.current}>Ft / hó</Meta>}</div>
              <Meta dark={c.current} className="mt-2">{c.cap}</Meta>
              <Meta dark={c.current}>{c.extra}</Meta>
              <div className="mt-auto pt-5" />
              <Button variant={c.current ? 'yellow' : 'glass'} size="sm" onClick={c.onClick} loading={c.busy} disabled={c.disabled}>{c.btn}</Button>
            </Card>
          ))}
        </div>
      </Card>

      <Card tone="white" pad="lg" className="max-lg:px-0">
        <CardTitle>Számlák</CardTitle>
        {invoices.length ? (<>
          {/* mobilon lista: időszak, alatta csomag · összeg; jobbra az állapot és a letöltés */}
          <div className="mt-2 lg:hidden">
            {invoices.map((v) => (
              <ListRow key={v.key} title={v.period} meta={`${v.plan} · ${v.amount}`}
                trailing={<span className="flex shrink-0 items-center gap-1"><StatusPill status="ok">{v.status}</StatusPill>{v.url ? <IconButton icon={Download} size="sm" variant="ghost" label="Letöltés" href={v.url} download /> : <IconButton icon={Download} size="sm" variant="ghost" label="Letöltés" />}</span>} />
            ))}
          </div>
          <div className="overflow-x-auto max-lg:hidden">
            <Table className="mt-2" minWidth={520}>
              <thead><Tr><Th>Időszak</Th><Th>Csomag</Th><Th>Összeg</Th><Th>Állapot</Th><Th /></Tr></thead>
              <tbody>
                {invoices.map((v) => (
                  <Tr key={v.key}><Td>{v.period}</Td><Td><Meta>{v.plan}</Meta></Td><Td>{v.amount}</Td><Td><StatusPill status="ok">{v.status}</StatusPill></Td>
                    <Td>{v.url ? <IconButton icon={Download} size="sm" variant="ghost" label="Letöltés" href={v.url} download /> : <IconButton icon={Download} size="sm" variant="ghost" label="Letöltés" />}</Td></Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>) : <Meta className="mt-2">Még nincs számla — az első fizetés után itt jelenik meg.</Meta>}
      </Card>

      {(onPause || showPause || cancel) && (
        <Card tone="white" pad="lg" className="max-lg:px-0 flex flex-wrap items-center justify-between gap-3">
          <span><CardTitle>Szüneteltetés vagy lemondás</CardTitle><Meta className="mt-1">{cancel?.note ?? 'Az adataid megmaradnak; a foglalóoldal a szünet alatt nem fogad foglalást.'}</Meta></span>
          <span className="flex gap-2">{(onPause || showPause) && <Button variant="cell" onClick={onPause}>Szüneteltetés</Button>}{cancel && <Button variant={cancel.label === 'Lemondás' ? 'danger' : 'cell'} onClick={cancel.onClick} loading={cancel.busy}>{cancel.label}</Button>}</span>
        </Card>
      )}
    </div>
  )
}

/** Egy telephely sora a Telephelyek-lapon (16.16). `action`: a nem-aktuális sor gombja (élőben a „Váltás”). */
export type SiteRow = { key: string; name: string; meta?: string | null; logo?: string | null; initials?: string; type: 'salon' | 'restaurant'; role: string; team?: number | null; monthBookings?: number | null; current?: boolean; action?: React.ReactNode }
const SAMPLE_SITES: SiteRow[] = [
  { key: '1', name: 'Fodrászat Budapest', logo: BIZ_LOGO, type: 'salon', role: 'Tulajdonos', team: 4, monthBookings: 412, current: true },
  { key: '2', name: 'Bistro Andrássy', logo: BIZ_LOGO, type: 'restaurant', role: 'Tulajdonos', team: 9, monthBookings: 1180, action: <Button variant="cell" size="sm">Váltás</Button> },
]

/** 16.16: Telephelyek — az összes üzlet, amihez hozzáférsz (típus, szereped, csapat, e havi foglalás, melyik az aktuális),
 *  „Új telephely” (szalon / étterem), 3-nál több telephelyhez egyedi ajánlat, alatta az ajánló. Élőben `rows`, `count` +
 *  `plan` (a sötét kártya), `newHref` (a két típus regisztrációja), `contactHref`, `referral` (az ajánló — élőben még nincs). */
export function SitesPage({ rows = SAMPLE_SITES, count = '2 / 3', countLabel = 'Telephely a csomagban', plan = 'Pro csomag · még 1 hozzáadható', newHref, contactHref, referral = <ReferralCard wide className="mt-4" /> }: {
  rows?: SiteRow[]; count?: string; countLabel?: string; plan?: string; newHref?: { salon: string; restaurant: string }; contactHref?: string; referral?: React.ReactNode
}) {
  const opt = (type: 'salon' | 'restaurant') => {
    const card = <OptionCard stacked icon={type === 'salon' ? Users : Briefcase} title={type === 'salon' ? 'Szalon' : 'Étterem'}>{type === 'salon' ? 'Időpont' : 'Asztal'}</OptionCard>
    return newHref ? <Link key={type} href={newHref[type]} className="block rounded-ui-inner ui-press">{card}</Link> : <div key={type}>{card}</div>
  }
  return (
    <SettingsPage group="Csapat" title="Telephelyek" save={false} status={<Button variant="yellow" size="sm" icon={Plus} href={newHref?.salon}>Új telephely</Button>} aside={<>
      <Card tone="dark"><Meta dark>{countLabel}</Meta><div className="mt-1 text-ui-num font-light leading-none">{count}</div><Meta dark className="mt-2">{plan}</Meta></Card>
      {/* a burkoló div nyúlik az oszlop aljáig (a SettingsPage az utolsó elemet nyújtja), a kártya a saját méretén marad */}
      <div>
        <Card>
          <CardTitle>Új telephely</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-1.5">{opt('salon')}{opt('restaurant')}</div>
          <Meta className="mt-3 leading-relaxed">A csapat, a vendégek és a beállítások telephelyenként külön — egy belépéssel váltasz köztük.</Meta>
        </Card>
      </div>
    </>}>
      <div className="px-6 pt-4 max-lg:px-0">
        {/* mobilon lista (a táblázat nem fér ki): logó, név, alatta típus · szerep · csapat · foglalás; jobbra a jelenlegi / váltás */}
        <div className="space-y-1.5 lg:hidden">
          {rows.map((x) => (
            <ListRow key={x.key} filled open={x.current}
              // eslint-disable-next-line @next/next/no-img-element
              leading={x.logo ? <img src={x.logo} alt="" className="h-9 w-12 shrink-0 object-contain" /> : <IconCircle tone="dark" size="md"><span className="text-ui-label">{x.initials}</span></IconCircle>}
              title={x.name}
              meta={[x.type === 'restaurant' ? 'Étterem' : 'Szalon', x.role, x.team != null ? `${x.team} fő` : null, x.monthBookings != null ? `${x.monthBookings.toLocaleString('hu-HU')} foglalás / hó` : null].filter(Boolean).join(' · ')}
              trailing={x.current ? <Pill tone="white" size="sm">Jelenlegi</Pill> : x.action} />
          ))}
        </div>
        <Table minWidth={480} className="max-lg:hidden">
          <thead><tr><Th>Üzlet</Th><Th>Típus</Th><Th>Szerepem</Th><Th>Csapat</Th><Th>Foglalás / hó</Th><Th /></tr></thead>
          <tbody>
            {rows.map((x) => (
              <Tr key={x.key} state={x.current ? 'open' : 'default'}>
                <Td><span className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {x.logo ? <img src={x.logo} alt="" className="h-9 w-auto max-w-[72px] shrink-0 object-contain" /> : <IconCircle tone="dark" size="md"><span className="text-ui-label">{x.initials}</span></IconCircle>}
                  <span className="min-w-0"><span className="block">{x.name}</span>{x.meta && <span className="block text-ui-label text-ui-muted">{x.meta}</span>}</span>
                </span></Td>
                <Td>{x.type === 'restaurant' ? 'Étterem' : 'Szalon'}</Td>
                <Td>{x.role}</Td>
                <Td>{x.team != null ? `${x.team} fő` : '—'}</Td>
                <Td>{x.monthBookings != null ? x.monthBookings.toLocaleString('hu-HU') : '—'}</Td>
                <Td className="text-right">{x.current ? <Pill tone="white">Jelenlegi</Pill> : x.action}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <FieldRow label="3-nál több telephely?" hint="egyedi csomagot ajánlunk" className="mt-2"><Button variant="cell" size="sm" href={contactHref}>Írj nekünk</Button></FieldRow>
        {/* ajánló (terjedés): link, megosztás, eredmény, következő jutalom, kiket hoztál */}
        {referral}
      </div>
    </SettingsPage>
  )
}

/** Egy bejelentkezés (eszköz) a Saját profilon. */
export type DeviceRow = { id: string; device: string; meta: string; current?: boolean; mobile?: boolean }
const SAMPLE_DEVICES: DeviceRow[] = [{ id: '1', device: 'Chrome · macOS', meta: 'most', current: true }, { id: '2', device: 'Safari · iPhone', meta: '2 napja', mobile: true }, { id: '3', device: 'Safari · iPad', meta: '5 napja', mobile: true }]

/** A Saját profil személyes adatai (a bejelentkezett felhasználóé, nem az üzleté). `birthday`: 'YYYY-MM-DD' vagy üres. */
export type SelfProfileValue = { name: string; phone: string; birthday: string; emergency: string; address: string }

/** 16.17: Saját profil — fotó, név, e-mail (ezzel lépsz be), telefon, születésnap, vészhelyzeti kontakt, cím; a belépés;
 *  mellette a szerepeid. Élőben `value` + `onChange`, `email`, `avatar` + `onPhoto` / `onRemovePhoto` (`photoBusy`),
 *  `roles`, `login` (a Belépés csoport sorai — ami ma ténylegesen van), `extra` (további csoport, pl. a saját napi
 *  szünet), `save={false}` (a hub közös mentés-sávja); nélkülük a minta (az aktív eszközök és a nyelv csak a mintában). */
export function SelfProfilePage({ value, onChange, email = 'david@fodraszat.hu', avatar = '/landing/funkciok/csapat/avatar/dave.webp', onPhoto, onRemovePhoto, photoBusy = false, roles = [['Fodrászat Budapest', 'Tulajdonos'], ['Bistro Andrássy', 'Tulajdonos']], birthdayPicker, login, devices = SAMPLE_DEVICES, onRevoke, onRevokeOthers, extra, save = true }: {
  value?: SelfProfileValue; onChange?: (v: SelfProfileValue) => void; email?: string; avatar?: string | null
  onPhoto?: () => void; onRemovePhoto?: () => void; photoBusy?: boolean; roles?: readonly (readonly [string, string])[]
  /** élőben a közös dátumválasztó (nem a böngésző sajátja) */
  birthdayPicker?: React.ReactNode
  login?: React.ReactNode
  /** Aktív eszközök (lib/authSessions): hol vagy bejelentkezve — `onRevoke` egy eszközt, `onRevokeOthers` az összes többit kijelentkezteti */
  devices?: DeviceRow[] | null; onRevoke?: (id: string) => void; onRevokeOthers?: () => void
  extra?: React.ReactNode; save?: boolean
}) {
  const v = value
  const field = (k: keyof SelfProfileValue, label: string, sample: { defaultValue?: string; placeholder?: string }, extraProps: { type?: string; autoComplete?: string } = {}) => (
    <Field label={label}>{v ? <Input value={v[k]} onChange={(e) => onChange?.({ ...v, [k]: e.target.value })} placeholder={sample.placeholder} {...extraProps} /> : <Input {...sample} />}</Field>
  )
  return (
    <SettingsPage group="Fiók" title="Saját profil" save={save} aside={<>
      <Card tone="dark">
        <Meta dark>Szerepeid</Meta>
        {roles.map(([n, r]) => (
          <div key={n} className="mt-2 flex items-center justify-between gap-2 text-ui-body"><MarqueeText>{n}</MarqueeText><Pill size="sm" tone="onDark">{r}</Pill></div>
        ))}
      </Card>
      {devices && (
        <Card pad="sm">
          <div className="px-2 pb-1 pt-1"><CardTitle>Aktív eszközök</CardTitle><Meta className="mt-0.5 text-ui-label">7 napig maradsz belépve egy eszközön</Meta></div>
          {devices.length === 0 && <Meta className="px-2 py-2 text-ui-label">Betöltés…</Meta>}
          {devices.map((d) => (
            <ListRow key={d.id} leading={<IconCircle tone="cell" size="sm" icon={d.mobile ? Smartphone : Monitor} />} title={d.device} meta={d.current ? `ez az eszköz · ${d.meta}` : d.meta}
              trailing={d.current ? undefined : <Button variant="cell" size="sm" onClick={onRevoke ? () => onRevoke(d.id) : undefined}>Kijelentkeztet</Button>} />
          ))}
          {devices.filter((d) => !d.current).length > 1 && <div className="px-2 pb-1 pt-2"><Button variant="ghost" size="sm" onClick={onRevokeOthers}>Kijelentkezés mindenhol máshol</Button></div>}
        </Card>
      )}
      {!v && <>
        <Card><CardTitle>Nyelv</CardTitle><Segmented tone="cell" options={['Magyar', 'English', 'Deutsch']} active={0} className="mt-3" /><Meta className="mt-2">A dashboard nyelve — csak neked.</Meta></Card>
      </>}
    </>}>
      <SettingsGroup icon={UserRound} title="Személyes adatok">
        <div className="mb-3 mt-2 flex items-center gap-3">
          <Avatar size="lg" src={avatar} name={v?.name} />
          <Button variant="cell" size="sm" loading={photoBusy} onClick={onPhoto}>{avatar ? 'Fotó cseréje' : 'Fotó feltöltése'}</Button>
          {onRemovePhoto && avatar && <Button variant="ghost" size="sm" className="text-ui-bad" disabled={photoBusy} onClick={onRemovePhoto}>Fotó eltávolítása</Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field('name', 'Név', { defaultValue: 'Vasadi Dávid' }, { autoComplete: 'name' })}
          <Field label="E-mail" hint="ezzel lépsz be"><Input {...(v ? { value: email, readOnly: true } : { defaultValue: email })} /></Field>
          {field('phone', 'Telefon', { defaultValue: '+36 30 123 4567' }, { type: 'tel', autoComplete: 'tel' })}
          {v && birthdayPicker ? <Field label="Születésnap">{birthdayPicker}</Field> : field('birthday', 'Születésnap', { defaultValue: '1994. 06. 21.' })}
          {field('emergency', 'Vészhelyzeti kontakt', { placeholder: 'Név · telefon' })}
          {field('address', 'Cím', { placeholder: 'Irányítószám, város, utca' }, { autoComplete: 'street-address' })}
        </div>
      </SettingsGroup>
      <SettingsGroup icon={ShieldCheck} title="Belépés">
        {login ?? <>
          <FieldRow label="Belépés módja" hint="jelszó nincs — minden belépésnél kódot küldünk"><span className="text-ui-body text-ui-text">E-mailes kód</span></FieldRow>
          <FieldRow label="Google"><StatusPill status="ok">Összekötve</StatusPill></FieldRow>
          <FieldRow label="Munkamenet" hint="7 napig él ezen az eszközön"><Button variant="cell" size="sm">Kijelentkezés</Button></FieldRow>
        </>}
      </SettingsGroup>
      {extra}
    </SettingsPage>
  )
}

/** Egy esemény az Értesítések-lapon: App és E-mail oszlop (null = ott nincs ilyen; `onChange` nélkül csak minta). */
export type NotifRow = { key: string; title: string; desc: string; pro?: boolean; app: { on: boolean; onChange?: (on: boolean) => void } | null; mail: { on: boolean; onChange?: (on: boolean) => void } | null }
const SAMPLE_NOTIF: NotifRow[] = ([
  ['Új foglalás és lemondás', 'az üzletben — az appban minden csapattagnak', true, true],
  ['Napi összefoglaló', 'reggeli + esti összefoglaló egy levélben', null, true, true],
  ['Beosztás változás', 'ha a műszakod létrejön, módosul vagy törlődik', true, true],
] as [string, string, boolean | null, boolean | null, boolean?][]).map(([title, desc, app, mail, pro]) => ({ key: title, title, desc, pro, app: app === null ? null : { on: app }, mail: mail === null ? null : { on: mail } }))

/** 16.18: Értesítések — a SAJÁT értesítéseid (nem a vendégeké): eseményenként App és E-mail kapcsoló; mellette a telefonos
 *  értesítés ezen az eszközön és a próba-értesítés. Élőben `rows`, `push` (állapot-pill, szöveg, gomb), `onTest`
 *  (`testBusy`), `guestLink` (a Vendég e-mailek linkje), `save={false}`; nélkülük a minta. */
export function NotificationsSettings({ rows = SAMPLE_NOTIF, push, onTest, testBusy = false, guestLink, save = true }: {
  rows?: NotifRow[]; push?: { status: React.ReactNode; text: string; action?: React.ReactNode }; onTest?: () => void; testBusy?: boolean; guestLink?: React.ReactNode; save?: boolean
}) {
  const cell = (c: NotifRow['app'], label: string) => c === null ? <span className="text-ui-muted">—</span>
    : c.onChange ? <span className="inline-flex"><Switch checked={c.on} onChange={c.onChange} ariaLabel={label} /></span> : <DesignSwitch defaultOn={c.on} />
  return (
    <SettingsPage group="Fiók" title="Értesítések" save={save} aside={<>
      <Card tone="dark">
        <Meta dark>Telefonos értesítés</Meta>
        <div className="mt-2">{push?.status ?? <StatusPill status="ok">Bekapcsolva ezen az eszközön</StatusPill>}</div>
        <Meta dark className="mt-3">{push?.text ?? 'Az app telepítése után minden foglalásról push-értesítést kapsz.'}</Meta>
        {push?.action && <div className="mt-3">{push.action}</div>}
      </Card>
      <Card className="flex flex-col"><CardTitle>Kipróbálod?</CardTitle><Meta className="mt-2">Küldünk egy próba-értesítést erre az eszközre.</Meta><Button variant="cell" size="sm" icon={Bell} loading={testBusy} onClick={onTest} className="mt-auto self-start">Teszt értesítés</Button></Card>
    </>}>
      <div className="px-6 pt-4 max-lg:px-0">
        <Table minWidth={460}>
          <thead><tr><Th>Esemény</Th><Th className="w-20 text-center">App</Th><Th className="w-20 text-center">E-mail</Th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <Td className="whitespace-normal"><span className="flex items-center gap-2 text-ui-text">{r.title}{r.pro && <Pill size="sm" tone="yellow">Pro</Pill>}</span><span className="block text-ui-label text-ui-muted">{r.desc}</span></Td>
                <Td className="text-center">{cell(r.app, `${r.title}: app`)}</Td>
                <Td className="text-center">{cell(r.mail, `${r.title}: e-mail`)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <Meta className="mt-3">{guestLink ?? 'A vendégeknek menő levelek a Vendég e-mailek alatt állíthatók (16.6).'}</Meta>
      </div>
    </SettingsPage>
  )
}

const CAL_STEPS: Record<'Google' | 'Apple' | 'Outlook', string[]> = {
  Google: ['Nyisd meg a Google Naptárt a gépen', 'Más naptárak + › URL-ről', 'Illeszd be a fenti linket › Naptár hozzáadása'],
  Apple: ['iPhone: Beállítások › Naptár › Fiókok › Fiók hozzáadása › Egyéb', 'Feliratkozott naptár hozzáadása', 'Illeszd be a fenti linket › Tovább › Mentés'],
  Outlook: ['Outlook a weben: Naptár › Naptár hozzáadása', 'Feliratkozás az internetről', 'Illeszd be a fenti linket › Importálás'],
}
const CAL_TABS = ['Google', 'Apple', 'Outlook'] as const

/** 16.15.2: API & integrációk — foglalások a saját naptárban (feliratkozási link, platformonként lépések), Zapier / Make
 *  webhook (próba-küldéssel), mérés a foglalóoldalon (GA4, Meta Pixel); mellette az állapotuk és az adat-import.
 *  Élőben `ical` (link + másolás), `platform` + `onPlatform`, `webhook`, `tracking`, `onImport` + `sampleHref`, `extra`
 *  (további csoportok), `save={false}`; nélkülük a minta. */
export function IntegrationsPage({ ical, platform = 0, onPlatform, webhook, tracking, onImport, sampleHref, extra, save = true, qr }: {
  ical?: { url: string; onCopy: () => void }; platform?: number; onPlatform?: (i: number) => void
  webhook?: { value: string; onChange: (v: string) => void; error?: string; onTest: () => void; testBusy?: boolean }
  tracking?: { ga4: string; onGa4: (v: string) => void; pixel: string; onPixel: (v: string) => void }
  onImport?: () => void; sampleHref?: string; extra?: React.ReactNode; save?: boolean
  /** a foglalóoldal QR-kódja (élőben a `BusinessQrLauncher`; a mintán a sor) */
  qr?: React.ReactNode
}) {
  const live = !!ical
  const status: [string, boolean][] = live
    ? [['Naptár-feliratkozás', true], ['Zapier / Make', !!webhook?.value.trim()], ['Google Analytics 4', !!tracking?.ga4.trim()], ['Meta Pixel', !!tracking?.pixel.trim()]]
    : [['Naptár-feliratkozás', true], ['Zapier / Make', true], ['Google Analytics 4', true], ['Meta Pixel', false], ['Import', false]]
  const tab = CAL_TABS[platform] ?? 'Google'
  return (
    <SettingsPage group="Kapcsolatok" title="API & integrációk" save={save} aside={<>
      <Card tone="dark">
        <Meta dark>Bekötve</Meta><div className="mt-1 text-ui-num font-light leading-none">{status.filter(([, on]) => on).length} / {status.length}</div>
        <div className="mt-4 space-y-1.5">
          {status.map(([t, on]) => (
            <div key={t} className="flex items-center justify-between text-ui-meta"><span className="text-white/80">{t}</span>{on ? <IconCircle tone="yellow" size="xs" icon={Check} /> : <span className="text-white/40">—</span>}</div>
          ))}
        </div>
      </Card>
      {qr ?? <QrLaunchCard />}
      <Card>
        <CardTitle>Adatok importálása</CardTitle>
        <Meta className="mt-1 leading-relaxed">Vendégek és jövőbeli foglalások egy másik rendszerből — CSV vagy Excel, az oszlopokat mi párosítjuk.</Meta>
        {onImport
          ? <button type="button" onClick={onImport} className="mt-3 block w-full rounded-ui-inner ui-press"><UploadBox className="h-[110px] w-full">Fájl kiválasztása</UploadBox></button>
          : <UploadBox className="mt-3 h-[110px] w-full">CSV vagy Excel ide húzva</UploadBox>}
        <Button variant="cell" size="sm" className="mt-3 w-full" icon={Download} href={sampleHref} download={!!sampleHref}>Minta-fájl letöltése</Button>
      </Card>
    </>}>
      <SettingsGroup icon={CalendarDays} title="Foglalások a saját naptáradban">
        <Meta className="mt-1">Feliratkozási link — a naptárad magától frissül, ha új foglalás jön.</Meta>
        <div className="mt-2 flex items-center gap-1.5"><Input {...(ical ? { value: ical.url, readOnly: true } : { defaultValue: 'webcal://booking.davelopment.hu/ics/fb-7k2q9xp.ics' })} className="min-w-0 flex-1" /><IconButton icon={Link2} label="Link másolása" variant="yellow" onClick={ical?.onCopy} /></div>
        <Segmented tone="cell" size="sm" className="mt-3" options={CAL_TABS} active={platform} onSelect={onPlatform} />
        <div className="mt-2 space-y-1">
          {CAL_STEPS[tab].map((t, i) => (
            <ListRow key={t} filled leading={<IconCircle tone="dark" size="sm">{i + 1}</IconCircle>} title={t} />
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup icon={Link2} title="Automatizálás — Zapier / Make">
        <Field label="Webhook URL" hint="Minden eseményről küldünk rá egy üzenetet: foglalás (új, módosított, lemondott), új vendég, kiállított számla, eladott és beváltott utalvány, új értékelés. A Zapier / Make-ben te döntöd el, mi legyen vele." error={webhook?.error} className="mt-1">
          {webhook ? <Input type="url" inputMode="url" value={webhook.value} onChange={(e) => webhook.onChange(e.target.value)} placeholder="https://hooks.zapier.com/… vagy https://hook.eu1.make.com/…" /> : <Input defaultValue="https://hook.eu1.make.com/a8f3…" />}
        </Field>
        <FieldRow label="Próba-küldés" hint="egy minta-foglalást küld a webhookra"><Button variant="cell" size="sm" icon={Send} loading={webhook?.testBusy} disabled={!!webhook && !webhook.value.trim()} onClick={webhook?.onTest}>Küldés</Button></FieldRow>
      </SettingsGroup>
      <SettingsGroup icon={BarChart3} title="Mérés a foglalóoldalon">
        <FieldRow label="Google Analytics 4" hint="mérési azonosító">{tracking ? <Input size="sm" value={tracking.ga4} onChange={(e) => tracking.onGa4(e.target.value)} placeholder="G-XXXXXXXXXX" className="w-[220px] max-w-full" /> : <Input size="sm" defaultValue="G-8XK2L4PQ1M" className="w-[220px] max-w-full" />}</FieldRow>
        <FieldRow label="Meta (Facebook) Pixel" hint="hirdetésekhez — a sütifelület kéri a hozzájárulást">{tracking ? <Input size="sm" value={tracking.pixel} onChange={(e) => tracking.onPixel(e.target.value)} placeholder="Pixel ID" className="w-[220px] max-w-full" /> : <Input size="sm" placeholder="Pixel ID" className="w-[220px] max-w-full" />}</FieldRow>
      </SettingsGroup>
      {extra}
    </SettingsPage>
  )
}

/** Egy terem az Asztalok & termek lapon. `onOnline` nélkül csak minta. */
export type TablesRoomRow = { key: string; name: string; detail: string; online: boolean; onOnline?: (on: boolean) => void }
const SAMPLE_ROOMS: TablesRoomRow[] = [
  { key: '1', name: 'Belső terem', detail: '6 asztal · 28 fő · egész évben', online: true },
  { key: '2', name: 'Terasz', detail: '3 asztal · 12 fő · Máj. 1. – Szept. 30.', online: true },
  { key: '3', name: 'Különterem', detail: '5 asztal · 18 fő · csak telefonon', online: false },
]
const PCTS = [100, 80, 60]

/** 16.22: Asztalok & termek (étterem) — a termek (asztal-szám, férőhely, szezon) és hogy online foglalhatók-e; a
 *  kapacitás: mennyit adunk ki online (a többi a betérőké); az összevonás asztalonként, az Asztalok oldalon. Mellette a
 *  férőhely összesen és a terem-rajz linkje. Élőben `rooms`, `total`, `pct` + `onPct`, `tablesHref`, `save={false}`. */
export function TablesRoomsPage({ rooms = SAMPLE_ROOMS, total = { seats: 58, meta: '14 asztal · 3 terem · ma online 46 fő' }, pct = 80, onPct, tablesHref, save = true }: {
  rooms?: TablesRoomRow[]; total?: { seats: number; meta: string }; pct?: number; onPct?: (pct: number) => void; tablesHref?: string; save?: boolean
}) {
  const opts = PCTS.includes(pct) ? PCTS : [...PCTS, pct].sort((a, b) => b - a)
  return (
    <SettingsPage group="Üzlet" title="Asztalok & termek" save={save} aside={<>
      <Card tone="dark"><Meta dark>Férőhely összesen</Meta><div className="mt-1 text-ui-num font-light leading-none">{total.seats} fő</div><Meta dark className="mt-2">{total.meta}</Meta></Card>
      <Card><CardTitle>Terem-rajz</CardTitle><Meta className="mt-1 leading-relaxed">Az asztalok helye, formája és összevonása az Asztalok oldalon szerkeszthető.</Meta><Button className="mt-3 w-full" icon={ArrowUpRight} href={tablesHref}>Asztalok megnyitása</Button></Card>
    </>}>
      <SettingsGroup icon={Building2} title="Termek">
        {rooms.map((r) => (
          <FieldRow key={r.key} label={r.name} hint={r.detail}><span className="flex items-center gap-2"><Meta className="text-ui-label">online</Meta>{r.onOnline ? <Switch checked={r.online} onChange={r.onOnline} ariaLabel={`${r.name}: online foglalható`} /> : <DesignSwitch defaultOn={r.online} />}</span></FieldRow>
        ))}
        {!rooms.length && <Meta className="py-3">Még nincs terem — az Asztalok oldalon adhatsz hozzá.</Meta>}
        <Button variant="cell" size="sm" icon={Plus} className="mt-2" href={tablesHref}>Új terem</Button>
      </SettingsGroup>
      <SettingsGroup icon={Users} title="Kapacitás">
        <FieldRow label="Online kiadható" hint="a többit a beesőknek tartjuk"><Segmented tone="cell" size="sm" options={opts.map((p) => (p === 100 ? 'Mind' : `${p}%`))} active={opts.indexOf(pct)} onSelect={onPct ? (i) => onPct(opts[i]) : undefined} /></FieldRow>
        <FieldRow label="Asztalok összevonása" hint="asztalonként állítod, melyik melyikkel vonható össze"><Button variant="cell" size="sm" icon={ArrowUpRight} href={tablesHref}>Asztalok</Button></FieldRow>
      </SettingsGroup>
    </SettingsPage>
  )
}

/** A foglalási szabályok értéke (étterem). `maxPax` null = amekkora társaságot az asztalok kiszolgálnak. */
export type RestaurantRulesValue = { minPax: number; maxPax: number | null; turnMinutes: number }
const TURNS = [30, 60, 90, 120, 150, 180]

/** 16.21: Foglalási szabályok (étterem) — létszám (legkisebb, legnagyobb online — felette a vendég üzenetet küld) és
 *  asztal-idő; az összevonás asztalonként az Asztalok oldalon. Élőben `value` + `onChange`, `tablesMax` (az asztalok
 *  szerinti maximum, a legnagyobb üres értékéhez), `tablesHref`, `save={false}`. */
export function RestaurantRulesPage({ value, onChange, tablesMax, tablesHref, save = true }: {
  value?: RestaurantRulesValue; onChange?: (v: RestaurantRulesValue) => void; tablesMax?: number; tablesHref?: string; save?: boolean
}) {
  const v = value
  const set = (p: Partial<RestaurantRulesValue>) => v && onChange?.({ ...v, ...p })
  const turns = v && !TURNS.includes(v.turnMinutes) ? [...TURNS, v.turnMinutes].sort((a, b) => a - b) : TURNS
  const turnLabel = (m: number) => (m < 60 ? `${m} perc` : m % 60 === 30 ? `${Math.floor(m / 60)},5 óra` : m % 60 ? `${Math.floor(m / 60)} ó ${m % 60} p` : `${m / 60} óra`)
  return (
    <SettingsPage group="Üzlet" title="Foglalási szabályok" save={save}>
      <SettingsGroup icon={Users} title="Létszám">
        <FieldRow label="Legkisebb asztal-foglalás">{v
          ? <span className="flex items-center gap-1.5"><Input size="sm" type="number" inputMode="numeric" min={1} value={v.minPax} onChange={(e) => set({ minPax: Math.max(1, Number(e.target.value) || 1) })} hug className="text-right" aria-label="Legkisebb létszám" /><Meta>fő</Meta></span>
          : <Input size="sm" defaultValue="1 fő" className="w-[160px]" />}</FieldRow>
        <FieldRow label="Legnagyobb online foglalás" hint={v ? `Felette a vendég üzenetet küld, nem foglal${tablesMax ? ` · üresen: ${tablesMax} fő (az asztalok szerint)` : ''}` : 'Felette a vendég üzenetet küld, nem foglal'}>{v
          ? <span className="flex items-center gap-1.5"><Input size="sm" type="number" inputMode="numeric" min={v.minPax} value={v.maxPax ?? ''} placeholder={tablesMax ? String(tablesMax) : ''} onChange={(e) => set({ maxPax: e.target.value ? Math.max(1, Number(e.target.value)) : null })} hug className="text-right" aria-label="Legnagyobb online létszám" /><Meta>fő</Meta></span>
          : <Input size="sm" defaultValue="8 fő" className="w-[160px]" />}</FieldRow>
      </SettingsGroup>
      <SettingsGroup icon={Clock} title="Foglalási idő">
        {/* sok opciós váltó: a felirat alatt, teljes szélességben (nem jobbra tolva) */}
        <FieldRow stacked label="Maximum foglalási idő" hint={v ? 'egy foglalás legfeljebb ennyi ideig tartja az asztalt' : undefined}>{v
          ? <Segmented full tone="cell" size="sm" options={turns.map(turnLabel)} active={turns.indexOf(v.turnMinutes)} onSelect={(i) => set({ turnMinutes: turns[i] })} />
          : <Input size="sm" defaultValue="2 óra" className="w-[160px]" />}</FieldRow>
        <FieldRow label="Asztalok összevonása" hint="Nagy társaságnál két asztal egybe — asztalonként állítod">{tablesHref || !v ? <Button variant="cell" size="sm" icon={ArrowUpRight} href={tablesHref}>Asztalok</Button> : null}</FieldRow>
      </SettingsGroup>
    </SettingsPage>
  )
}

/** Az Audit-napló sorai (design 16.19): időpont, ki (avatar, név, e-mail), mi történt (pill), a tárgy és a változások
 *  emberi nyelven (`lib/auditText`: „Állapot: Megerősítve → Leültetve”). */
export type AuditTableRow = {
  key: string; time: string; actor: { name: string; email?: string | null; img?: string | null }
  event: string; tone: 'ok' | 'bad' | 'warn' | 'pending' | 'neutral'; title: string; lines: { label: string; from?: string; to?: string; text?: string }[]
}
export function AuditTable({ rows }: { rows: AuditTableRow[] }) {
  const line = (l: AuditTableRow['lines'][number], i: number) => (
    <span key={i} className="mt-0.5 block text-ui-label text-ui-muted">
      {l.label}: {l.text != null ? <span className="text-ui-text">{l.text}</span> : <><span className="line-through">{l.from}</span> → <span className="text-ui-text">{l.to}</span></>}
    </span>
  )
  return (
    <>
    {/* mobil (sm alatt): lista — avatar, a név és mi történt, jobbra az időpont; alatta a részlet */}
    <div className="sm:hidden">
      {rows.map((r) => (
        <div key={r.key} className="border-t border-dashed border-ui-divider py-3 first:border-t-0">
          <div className="flex items-start gap-3">
            <Avatar size="sm" src={r.actor.img} name={r.actor.name} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2"><MarqueeText className="flex-1 text-ui-body text-ui-text">{r.actor.name}</MarqueeText><span className="shrink-0 text-ui-label text-ui-muted">{r.time}</span></span>
              <span className="mt-1 block"><StatusPill status={r.tone}>{r.event}</StatusPill></span>
              {r.title && <span className="mt-1.5 block text-ui-meta text-ui-text">{r.title}</span>}
              {r.lines.map(line)}
            </span>
          </div>
        </div>
      ))}
    </div>
    <div className="max-sm:hidden">
    <Table minWidth={680}>
      <thead><tr><Th>Mikor</Th><Th>Ki</Th><Th>Mi történt</Th><Th>Részlet</Th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <Tr key={r.key}>
            <Td className="whitespace-nowrap text-ui-muted">{r.time}</Td>
            <Td>
              <span className="flex items-center gap-2.5">
                <Avatar size="sm" src={r.actor.img} name={r.actor.name} />
                <span className="min-w-0"><MarqueeText>{r.actor.name}</MarqueeText>{r.actor.email && r.actor.email !== r.actor.name && <MarqueeText className="text-ui-label text-ui-muted">{r.actor.email}</MarqueeText>}</span>
              </span>
            </Td>
            <Td><StatusPill status={r.tone}>{r.event}</StatusPill></Td>
            <Td className="whitespace-normal">
              <span className="block">{r.title}</span>
              {r.lines.map(line)}
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
    </div>
    </>
  )
}

/** A QR-kód sora (Foglalóoldal-szerkesztő › Link & QR, Integrációk): ikon, cím, egy mondat, „Megnyitás” — a kezelő
 *  felugró ablakban nyílik (`BusinessQrLauncher`). */
export function QrLaunchRow({ onOpen, className = '' }: { onOpen?: () => void; className?: string }) {
  return (
    <ListRow filled className={className} leading={<IconCircle tone="dark" size="md" icon={QrCode} />} title="QR-kód a foglalóoldalhoz"
      meta="Letöltés PNG-ben, nyomtatható A5-ös lap logóval, nyitvatartással"
      trailing={<Button variant="cell" size="sm" onClick={onOpen}>Megnyitás</Button>} />
  )
}

/** A QR-kód kártyája a jobb oszlopban (Integrációk): ikon, cím, egy mondat, „QR-kód megnyitása” — a kezelő felugró
 *  ablakban (`BusinessQrLauncher variant="card"`). */
export function QrLaunchCard({ onOpen, className = '' }: { onOpen?: () => void; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        <IconCircle tone="dark" size="md" icon={QrCode} />
        <div className="min-w-0"><CardTitle>QR-kód a foglalóoldalhoz</CardTitle><Meta className="mt-1 leading-relaxed">Pultra, kirakatba, névjegyre — PNG letöltés vagy nyomtatható A5-ös lap logóval, nyitvatartással.</Meta></div>
      </div>
      <Button variant="yellow" size="sm" className="mt-3 w-full" icon={QrCode} onClick={onOpen}>QR-kód megnyitása</Button>
    </Card>
  )
}

/* ── Előfizetés: a próbaidő vége (design 16.5.1) ─────────────────────────────────────────────────────── */

/** Ki fizet: ettől függ, mi kötelező a számlán (adószám: egyéni vállalkozó és cég; cégjegyzékszám: cég). */
export type PayerKind = 'person' | 'sole' | 'company'
export type BillingDetailsValue = { kind: PayerKind; name: string; tax: string; reg: string; email: string; zip: string; city: string; street: string }
const SAMPLE_BILLING: BillingDetailsValue = { kind: 'company', name: 'Fodrászat Budapest Kft.', tax: '12345678-1-42', reg: '01-09-123456', email: 'szamla@fodraszat.hu', zip: '1061', city: 'Budapest', street: 'Andrássy út 12.' }

/**
 * 16.5.1 — Számlázási adatok (popup az Előfizetés lapon; a próbaidő vége előtt kötelező). Fent: ki fizet (magánszemély /
 * egyéni vállalkozó / cég) — ettől függ, mi kötelező. Az adószám mellett rögtön látszik, mit jelent az adózásra (a 9.
 * jegy: 1 = alanyi adómentes, 2 = ÁFA-köteles) — ugyanez kerül a vendég-számláidra is (16.7). Alul egy mondat: hová
 * kerülnek. Élőben `value` + `onChange`, `vat` (a kiszámolt felirat), `errors`; nélkülük a minta.
 */
export function BillingDetailsForm({ value = SAMPLE_BILLING, onChange, vat = 'Alanyi adómentes (AAM)', errors = {}, address, className = '' }: {
  value?: BillingDetailsValue; onChange?: (v: BillingDetailsValue) => void
  /** az adószámból kiolvasott adózás (null: még nincs / nem olvasható) */
  vat?: string | null
  errors?: Partial<Record<keyof BillingDetailsValue, string>>
  /** a cím-kereső (élőben az autocomplete) */
  address?: React.ReactNode; className?: string
}) {
  const v = value
  const set = onChange ? (p: Partial<BillingDetailsValue>) => onChange({ ...v, ...p }) : undefined
  const kinds: PayerKind[] = ['person', 'sole', 'company']
  const inp = (k: keyof BillingDetailsValue, label: string, hint?: string, ph?: string) => (
    <Field label={label} hint={errors[k] ?? hint} error={errors[k]}>
      <Input value={set ? String(v[k]) : undefined} defaultValue={set ? undefined : String(v[k])} onChange={set ? (e) => set({ [k]: e.target.value }) : undefined} placeholder={ph} />
    </Field>
  )
  return (
    <div className={`space-y-3 ${className}`}>
      <Segmented full size="sm" tone="cell" options={['Magánszemély', 'Egyéni vállalkozó', 'Cég']} active={kinds.indexOf(v.kind)} onSelect={set ? (i) => set({ kind: kinds[i] }) : undefined} />
      {inp('name', v.kind === 'company' ? 'Cégnév' : 'Teljes név', 'ez a név szerepel a számlán')}
      {v.kind !== 'person' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            {inp('tax', 'Adószám', undefined, '12345678-1-42')}
            {vat && <Pill tone="cell" size="sm" className="mt-1.5">{vat}</Pill>}
          </div>
          {v.kind === 'company' && inp('reg', 'Cégjegyzékszám', undefined, '01-09-123456')}
        </div>
      )}
      {inp('email', 'Számlázási e-mail', 'ide érkeznek a számlák')}
      <Field label="Számlázási cím" hint={errors.street ?? 'keress rá, vagy írd be kézzel'} error={errors.street}>
        {address}
        <div className="mt-2 grid grid-cols-[88px_1fr] gap-2 sm:grid-cols-[88px_1fr_1.6fr]">
          <Input defaultValue={v.zip} aria-label="Irányítószám" /><Input defaultValue={v.city} aria-label="Település" /><Input defaultValue={v.street} aria-label="Utca, házszám" className="col-span-2 sm:col-span-1" />
        </div>
      </Field>
      <Note>Ezek kerülnek a davelopment számláira. Az adószámból tudjuk azt is, milyen ÁFÁ-val mennek a vendégeidnek kiállított számlák (Fizetés & számlázás).</Note>
    </div>
  )
}

/** A próbaidő teendői — egy lépés. */
export type TrialStep = { key: string; label: string; hint?: string; done: boolean; action?: { label: string; onClick?: () => void; href?: string } }
const SAMPLE_TRIAL_STEPS: TrialStep[] = [
  { key: 'plan', label: 'Csomag', hint: 'Pro · 9 800 Ft / hó', done: true },
  { key: 'billing', label: 'Számlázási adatok', hint: 'név, adószám, cím — ez kerül a számlára', done: false, action: { label: 'Megadom' } },
  { key: 'card', label: 'Fizetési mód', hint: 'kártya a Stripe-nál — csak a próbaidő után terhelünk', done: false, action: { label: 'Kártya' } },
]

/**
 * 16.5.1 — „Mielőtt lejár a próbaidő”: az Előfizetés lap tetején (a sötét kártya alatt), amíg van hiányzó lépés. Lépésenként
 * kész / teendő (gombbal), alul a lényeg egy mondatban: mi történik a próbaidő végén, ha kész, és ha nem.
 */
export function TrialChecklist({ daysLeft = 3, endLabel = 'Nov. 16.', steps = SAMPLE_TRIAL_STEPS, className = '' }: { daysLeft?: number; endLabel?: string; steps?: TrialStep[]; className?: string }) {
  const left = steps.filter((s) => !s.done).length
  return (
    <Card tone="white" pad="lg" className={`max-lg:px-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Mielőtt lejár a próbaidő</CardTitle>
        <StatusPill status={left ? (daysLeft <= 3 ? 'bad' : 'pending') : 'ok'}>{left ? `még ${daysLeft} nap · ${left} teendő` : 'Minden kész'}</StatusPill>
      </div>
      <div className="mt-3">
        {steps.map((s, i) => (
          <ListRow key={s.key}
            leading={s.done ? <IconCircle tone="ok" icon={Check} /> : <IconCircle tone="cell">{i + 1}</IconCircle>}
            title={s.label} meta={s.hint}
            trailing={s.done ? <StatusPill status="ok">Kész</StatusPill> : s.action && <Button variant="dark" size="sm" onClick={s.action.onClick} href={s.action.href}>{s.action.label}</Button>} />
        ))}
      </div>
      <Meta className="mt-3">{left
        ? `${endLabel} után, ha nincs meg minden, a fiók zárolódik: az adataid megmaradnak, de a foglalóoldal nem fogad új foglalást, amíg nem aktiválod.`
        : `${endLabel}-án a próbaidő magától előfizetésbe vált — nincs több teendőd.`}</Meta>
    </Card>
  )
}

/**
 * 16.5.1 — a próbaidő lejárt (vagy az előfizetés megszűnt / szünetel): a dashboard zárolva, de nem ijesztő — mi történt,
 * mi marad meg, mi áll most (a foglalóoldal), és egy gomb oda, ahol rendbe teheti (Előfizetés). Nincs bezárás.
 */
export function LockedAccountCard({ status = 'past_due', paid = false, href, className = '' }: { status?: 'past_due' | 'canceled' | 'paused'; /** fizetős fiók (nem próbaidő) — a past_due itt sikertelen fizetést jelent */ paid?: boolean; href?: string; className?: string }) {
  const t = paid && status === 'past_due' ? { title: 'Nem sikerült a fizetés', text: 'Frissítsd a kártyád, és minden azonnal folytatódik.', btn: 'Kártya frissítése' } : {
    past_due: { title: 'Lejárt a próbaidőd', text: 'Add meg a számlázási adatokat és a kártyát, és minden azonnal folytatódik.', btn: 'Előfizetés aktiválása' },
    canceled: { title: 'Az előfizetésed megszűnt', text: 'Újraindíthatod bármikor — a beállításaid és a vendégeid megvannak.', btn: 'Újraindítás' },
    paused: { title: 'Az előfizetésed szünetel', text: 'Folytasd, amikor szeretnéd — onnan megy tovább, ahol abbahagytad.', btn: 'Folytatás' },
  }[status]
  return (
    <Card tone="white" pad="lg" className={`w-full max-w-[440px] text-center ${className}`}>
      <IconCircle icon={Lock} tone="bad" size="lg" className="mx-auto" />
      <div className="mt-4 text-ui-sub font-light text-ui-text">{t.title}</div>
      <p className="mx-auto mt-2 max-w-[340px] text-ui-body leading-relaxed text-ui-muted">{t.text}</p>
      <div className="mt-4 text-left">
        <FieldRow label="Az adataid" hint="foglalások, vendégek, beállítások"><StatusPill status="ok">Megmaradnak</StatusPill></FieldRow>
        <FieldRow label="A foglalóoldalad" hint="a vendégek ezt látják: „most nem foglalható”"><StatusPill status="bad">Nem fogad foglalást</StatusPill></FieldRow>
        <FieldRow label="A meglévő foglalások" hint="a vendégek emlékeztetőt továbbra is kapnak"><StatusPill status="ok">Érvényesek</StatusPill></FieldRow>
      </div>
      <Button href={href} size="lg" className="mt-5 w-full">{t.btn}</Button>
      <Meta className="mt-3">A Beállítások ilyenkor is elérhetők — ott törölheted is a fiókot.</Meta>
    </Card>
  )
}

/* ── 16.25: Fiók / üzlet törlése — a Veszélyzóna (szalon és étterem egyformán) ──────────────────────── */

/** A törlés lapja: mi törlődik (pontokba szedve), mi marad meg, egy piros gomb. `last`: ez az utolsó üzlet — ilyenkor a
 *  teljes fiók megszűnik (a lap címe és a szövege is ezt mondja). Élőben `onDelete` (a megerősítő ablakot nyitja). */
export function DeleteBusinessPage({ kind = 'salon', name = 'Anna Fodrászat', last = false, onDelete }: { kind?: 'salon' | 'restaurant'; name?: string; last?: boolean; onDelete?: () => void }) {
  const what = kind === 'salon' ? ['a foglalások és a vendégek', 'a szolgáltatások és a munkatársak', 'a beosztás és a nyitvatartás', 'a foglalóoldal'] : ['a foglalások és a vendégek', 'a termek és az asztalok', 'a beosztás és a nyitvatartás', 'a foglalóoldal']
  const label = last ? 'Fiók törlése' : kind === 'salon' ? 'Szalon törlése' : 'Étterem törlése'
  return (
    <SettingsPage group="Veszélyzóna" title={label} save={false}>
      <div className="px-6 pb-6 pt-5 max-lg:px-0">
        <div className="flex items-start gap-4 rounded-ui-inner bg-ui-bad-bg p-4">
          <IconCircle tone="white" size="lg" icon={Trash2} className="text-ui-bad" />
          <span className="min-w-0">
            <span className="block text-ui-row text-ui-text">{last ? `${name} és a teljes fiókod` : name}</span>
            <Meta className="mt-1 leading-relaxed">{last ? 'Ez az utolsó üzleted — vele együtt a fiókod is megszűnik, és nem tudsz többé belépni.' : 'Csak ez az üzlet törlődik — a fiókod és a többi üzleted megmarad.'} A törlés végleges, nem vonható vissza.</Meta>
          </span>
        </div>
        <div className="mt-5 text-ui-meta font-medium text-ui-muted">Ami törlődik</div>
        <div className="mt-2 space-y-1.5">{what.map((t) => <div key={t} className="flex items-center gap-2.5 text-ui-body text-ui-text"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ui-bad-dot" />{t}</div>)}</div>
        <Meta className="mt-4 leading-relaxed">Előtte érdemes letölteni, ami kell: a vendéglistát (Vendégek › Export) és a foglalásokat (Foglalások › Letöltés). A kiállított számlák a számlázódban megmaradnak.</Meta>
        <Button variant="bad" icon={Trash2} className="mt-6 w-full sm:w-auto" onClick={onDelete}>{label}</Button>
      </div>
    </SettingsPage>
  )
}

/** A megerősítés (a közös popupban): mi történik, és a végleges gomb csak akkor nyomható, ha beírta az üzlet nevét.
 *  Élőben `value` + `onValue`, `busy`, `onConfirm`, `onCancel`. */
export function DeleteBusinessConfirm({ kind = 'salon', name = 'Anna Fodrászat', last = false, value = '', onValue, busy = false, onConfirm, onCancel }: {
  kind?: 'salon' | 'restaurant'; name?: string; last?: boolean; value?: string; onValue?: (v: string) => void; busy?: boolean; onConfirm?: () => void; onCancel?: () => void
}) {
  const ok = value.trim() === name.trim()
  return (
    <Modal size="sm" title={last ? 'Fiók törlése' : kind === 'salon' ? 'Szalon törlése' : 'Étterem törlése'} subtitle="Végleges — nem vonható vissza" onClose={onCancel}
      footer={<><Button variant="cell" onClick={onCancel} disabled={busy}>Mégse</Button><Button variant="bad" icon={Trash2} loading={busy} disabled={!!onValue && !ok} onClick={onConfirm}>Végleges törlés</Button></>}>
      <Meta className="leading-relaxed">{last ? `${name} és minden adata törlődik, és mivel ez az utolsó üzleted, a fiókod is megszűnik.` : `${name} és minden adata törlődik (foglalások, vendégek, beállítások). A fiókod és a többi üzleted megmarad.`}</Meta>
      <Meta className="mb-1.5 mt-4">A megerősítéshez írd be: <span className="text-ui-text">{name}</span></Meta>
      <Field label="Az üzlet neve">
        <Input {...(onValue ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValue(e.target.value) } : { defaultValue: value })} placeholder={name} autoComplete="off" autoFocus={!!onValue} />
      </Field>
    </Modal>
  )
}
