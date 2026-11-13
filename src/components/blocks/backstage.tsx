import Link from 'next/link'
import { ArrowUpRight, Building2, Check, CircleAlert, Clock, CreditCard, Gift, LogIn, Mail, MessageSquare, MoreHorizontal, Pencil, Phone, Power, Radio, Receipt, Scissors, Send, Trash2, UserPlus, UtensilsCrossed } from 'lucide-react'
import { Avatar, Button, Card, CardTitle, Field, FieldRow, IconButton, IconCircle, Input, ListRow, Menu, MenuItem, Meta, Modal, Note, OptionCard, Pagination, Panel, Pill, SearchField, Segmented, Select, StatusPill, Table, Td, Textarea, Th, Tr, MarqueeText, type Status } from '@/components/ui-kit'
import { ChipToolbar } from './toolbar'
import { MiniBar, ShareRow } from './charts'
import { MailDarkLine } from './backstage-chart'
import { StandBars } from './stats'
import { MockSwitch } from './MockSwitch'
import { AuditTable, type AuditTableRow } from './settings'

/* Backstage (üzemeltetői admin, csak Dave) — a design „Backstage” fülének darabjai (/design?m=backstage) ÉS az élő
 * /backstage oldalak ugyanezek (komponens = design). Hook nélküli, adatvezérelt blokkok: props nélkül a mintaadat, élőben a
 * valódi adat és a műveletek (callback / slot). Fiók-központú: egy tulaj = egy előfizetés = több üzlet. */

const nf = (n: number) => n.toLocaleString('hu-HU')
const ft = (n: number) => `${nf(n)} Ft`
const rowCls = (open: boolean) => (open ? undefined : '[&>td]:bg-white [&:hover>td]:bg-white/60')

/* ── Állapotok ─────────────────────────────────────────────────────────────── */

export type BsStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'
/** Az előfizetés állapota — a fiók-listában, a profilon és a kockázatnál ugyanígy. */
export const BS_STATUS: Record<BsStatus, { label: string; tone: Status }> = {
  active: { label: 'Fizető', tone: 'ok' },
  trialing: { label: 'Próba', tone: 'pending' },
  past_due: { label: 'Lejárt fizetés', tone: 'bad' },
  paused: { label: 'Szüneteltetve', tone: 'warn' },
  canceled: { label: 'Lemondott', tone: 'neutral' },
}
export type BsTier = 'starter' | 'pro' | 'egyedi'
export const BS_TIER: Record<BsTier, string> = { starter: 'Starter', pro: 'Pro', egyedi: 'Egyedi' }

export function BsStatusPill({ status, trialLeft }: { status: BsStatus | null; trialLeft?: number | null }) {
  if (!status) return <StatusPill status="neutral">Nincs előfizetés</StatusPill>
  const s = BS_STATUS[status]
  return <StatusPill status={s.tone}>{s.label}{status === 'trialing' && trialLeft != null && trialLeft >= 0 ? ` · még ${trialLeft} nap` : ''}</StatusPill>
}

/** Üzlet-összetétel ikonnal (szalon / étterem darab). */
export function BsPlaceMix({ salons, restaurants }: { salons: number; restaurants: number }) {
  if (!salons && !restaurants) return <span className="text-ui-muted">Még nincs üzlet</span>
  return (
    <span className="flex items-center gap-2.5">
      {salons > 0 && <span className="flex items-center gap-1"><Scissors className="h-3.5 w-3.5 text-ui-muted" />{salons}</span>}
      {restaurants > 0 && <span className="flex items-center gap-1"><UtensilsCrossed className="h-3.5 w-3.5 text-ui-muted" />{restaurants}</span>}
    </span>
  )
}

const kindIcon = (k: 'salon' | 'restaurant') => (k === 'restaurant' ? UtensilsCrossed : Scissors)

/** Mobilon a táblázat helyett lista (skill: ios-safari-mobile — a táblázat ne tolja szélesebbre az oldalt): soronként
 *  ikon / avatar, cím, alatta a részlet, jobbra az állapot; koppintva megnyit (`onClick`) vagy elvisz (`href`). */
export type MobileRow = { key: string; leading?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; trailing?: React.ReactNode; open?: boolean; onClick?: () => void; href?: string }
export function MobileRows({ rows, className = '' }: { rows: MobileRow[]; className?: string }) {
  return (
    <div className={`space-y-1 lg:hidden ${className}`}>
      {rows.map((r) => {
        const row = <ListRow filled open={r.open} leading={r.leading} title={r.title} meta={r.meta} trailing={r.trailing} />
        if (r.href) return <Link key={r.key} href={r.href} className="block">{row}</Link>
        if (r.onClick) return <button key={r.key} type="button" onClick={r.onClick} className="block w-full text-left">{row}</button>
        return <div key={r.key}>{row}</div>
      })}
    </div>
  )
}

/** Lista-eszköztár: desktopon a kereső + szűrő-chipek; mobilon csak a kereső (a chipek a fejléc szűrő-ikonjára nyíló
 *  ablakban vannak, mint a dashboardon — `davelopment:open-backstage-filter`). */
function BsToolbar({ search, chips, active = 0, onChip, query, onQuery }: { search: string; chips: [string, number][]; active?: number; onChip?: (i: number) => void; query?: string; onQuery?: (q: string) => void }) {
  return (
    <>
      <div className="max-lg:hidden"><ChipToolbar search={search} chips={chips} active={active} onChip={onChip} query={query} onQuery={onQuery} /></div>
      <div className="mb-[5px] lg:hidden"><SearchField className="w-full" value={query} onChange={onQuery}>{search}</SearchField></div>
    </>
  )
}

/* ── Mintaadat ─────────────────────────────────────────────────────────────── */

export type BsAccount = {
  key: string; name: string; business: string; email: string; img?: string | null; phone?: string | null
  salons: number; restaurants: number; tier: BsTier | null; fee: number; annual?: boolean
  bookings30: number; status: BsStatus | null; trialLeft?: number | null; since: string
  /** a próba vége / az időszak vége (dátum-szöveg) */
  periodEnd?: string | null; note?: string | null
}
export const SAMPLE_ACCOUNTS: BsAccount[] = [
  { key: 'a', name: 'Kovács Anna', business: 'Anna Fodrászat', email: 'anna@annafodraszat.hu', img: '/landing/funkciok/csapat/avatar/viktoria.webp', salons: 2, restaurants: 0, tier: 'pro', fee: 15_400, bookings30: 412, status: 'active', since: 'Aug. 14.', periodEnd: 'Dec. 3.' },
  { key: 'b', name: 'Tóth Gábor', business: 'Bistro Andrássy', email: 'gabor@bistroandrassy.hu', salons: 0, restaurants: 1, tier: 'pro', fee: 23_800, bookings30: 286, status: 'active', since: 'Aug. 22.', periodEnd: 'Nov. 22.' },
  { key: 'c', name: 'Nagy Eszter', business: 'Kék Köröm', email: 'eszter@kekkorom.hu', img: '/landing/funkciok/csapat/avatar/szabina.webp', phone: '+36 30 412 7788', salons: 1, restaurants: 0, tier: 'starter', fee: 5_900, bookings30: 38, status: 'trialing', trialLeft: 4, since: 'Okt. 19.', periodEnd: 'Nov. 17.', note: 'Okt. 28-án telefonon segítettem a nyitvatartásban.' },
  { key: 'd', name: 'Szabó Márk', business: 'Barber Bros', email: 'mark@barberbros.hu', img: '/landing/funkciok/csapat/avatar/csaba.webp', salons: 1, restaurants: 0, tier: 'pro', fee: 13_600, annual: true, bookings30: 194, status: 'active', since: 'Szept. 2.' },
  { key: 'e', name: 'Varga Petra', business: 'Petra Kozmetika', email: 'petra@petrakozmetika.hu', salons: 1, restaurants: 0, tier: 'starter', fee: 5_900, bookings30: 12, status: 'past_due', since: 'Szept. 9.' },
  { key: 'f', name: 'Horváth Bence', business: 'Pizzeria Napoli', email: 'bence@napoli.hu', salons: 0, restaurants: 1, tier: 'starter', fee: 19_900, bookings30: 0, status: 'trialing', trialLeft: 11, since: 'Nov. 2.' },
  { key: 'g', name: 'Molnár Judit', business: 'Judit Masszázs', email: 'judit@juditmasszazs.hu', salons: 1, restaurants: 0, tier: 'starter', fee: 5_900, bookings30: 0, status: 'canceled', since: 'Júl. 30.' },
  { key: 'h', name: 'Farkas Dóra', business: 'Dóra Pilates', email: 'dora@dorapilates.hu', salons: 0, restaurants: 0, tier: null, fee: 0, bookings30: 0, status: 'trialing', trialLeft: 27, since: 'Nov. 12.' },
]

/** A platform számai — a fejléc csíkja, a nagy számok és a sötét bevétel-kártya (minta). */
export const SAMPLE_PLATFORM = {
  mrr: 342_600, arr: 4_111_200, arpa: 11_050, ltv: 184_000,
  paying: 31, trial: 12, risk: 5, accounts: 48, places: 57, salons: 41, restaurants: 16,
  conversion: 64, churn: 4, activePlaces: 89, bookings: 18_420, monthBookings: 2_316,
}

/* ── Áttekintő ─────────────────────────────────────────────────────────────── */

/** Sötét bevétel-kártya (oldalanként az egy sötét kártya): havi visszatérő bevétel, éves vetítés, alatta három szám. */
export function MrrCard({ mrr = SAMPLE_PLATFORM.mrr, arr = SAMPLE_PLATFORM.arr, paying = SAMPLE_PLATFORM.paying, conversion = SAMPLE_PLATFORM.conversion, arpa = SAMPLE_PLATFORM.arpa, delta = '+12% az előző hónaphoz', href, className = '' }: { mrr?: number; arr?: number; paying?: number; conversion?: number; arpa?: number; delta?: string | null; href?: string; className?: string }) {
  return (
    <Card tone="dark" pad="lg" className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between"><Meta dark>Havi visszatérő bevétel</Meta><IconButton icon={ArrowUpRight} label="Bevétel" variant="onDark" href={href} /></div>
      <div className="mt-2 text-ui-page font-light leading-none">{nf(mrr)}<span className="ml-1.5 text-ui-title text-ui-yellow">Ft</span></div>
      <Meta dark className="mt-2">{ft(arr)} / év vetítve{delta ? ` · ${delta}` : ''}</Meta>
      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
        {([[String(paying), 'fizető fiók'], [`${conversion}%`, 'próbából fizető'], [`${nf(Math.round(arpa / 100) / 10)} e`, 'átlag / fiók']] as const).map(([v, l], i) => (
          <span key={l}><span className={`block text-ui-sub font-light leading-none ${i === 2 ? 'text-ui-yellow' : ''}`}>{v}</span><span className="mt-1 block text-ui-label text-white/55">{l}</span></span>
        ))}
      </div>
    </Card>
  )
}

export type BsTodo = { key?: string; name: string; meta: string; action: string; href?: string }
/** Teendő-sorok az Áttekintő „Figyelj rá” akkordeonjában: ki, mi a gond, és a gyors lépés (élőben link). */
export function BsTodoRows({ rows, more }: { rows: BsTodo[]; more?: { label: string; href: string } }) {
  return (
    <div className="space-y-1">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="min-w-0 flex-1"><MarqueeText className="text-ui-meta text-ui-text">{r.name}</MarqueeText><span className="block text-ui-label text-ui-muted">{r.meta}</span></span>
            <Pill tone="dark" size="sm">{r.action}</Pill>
          </>
        )
        const cls = 'flex items-center gap-2 rounded-ui-control bg-white/80 px-2.5 py-2'
        return r.href ? <Link key={r.key ?? r.name} href={r.href} className={`${cls} transition-colors hover:bg-white`}>{inner}</Link> : <div key={r.key ?? r.name} className={cls}>{inner}</div>
      })}
      {more && <Link href={more.href} className="block px-2.5 py-1.5 text-ui-label text-ui-muted hover:text-ui-text">{more.label}</Link>}
    </div>
  )
}

/** Legutóbbi előfizetők: avatar, üzlet + tulaj, állapot. Élőben a sor a fiókra visz (`hrefOf`). */
export function RecentAccountsCard({ rows = SAMPLE_ACCOUNTS.slice().reverse().slice(0, 5), allHref, hrefOf, className = '' }: { rows?: BsAccount[]; allHref?: string; hrefOf?: (key: string) => string; className?: string }) {
  return (
    <Card pad="sm" className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between px-2 pt-2"><span className="text-ui-title text-ui-text">Legutóbbi előfizetők</span><IconButton icon={ArrowUpRight} label="Összes előfizető" href={allHref} /></div>
      <div className="mt-2">
        {rows.length === 0 && <Meta className="px-3 py-6">Még nincs regisztrált fiók.</Meta>}
        {rows.map((a) => {
          const row = <ListRow leading={<Avatar size="sm" src={a.img} name={a.name} />} title={<MarqueeText>{a.business}</MarqueeText>} meta={`${a.name} · ${a.since}`} trailing={<BsStatusPill status={a.status} trialLeft={a.trialLeft} />} />
          return hrefOf ? <Link key={a.key} href={hrefOf(a.key)} className="block rounded-ui-inner transition-colors hover:bg-white/60">{row}</Link> : <div key={a.key}>{row}</div>
        })}
      </div>
    </Card>
  )
}

/** Regisztrációs tölcsér: regisztrált → üzletet hozott létre → első foglalás → fizető. */
export function FunnelCard({ steps = [['Regisztrált', 48], ['Üzletet hozott létre', 44], ['Volt már foglalása', 35], ['Fizető lett', 31]], className = '' }: { steps?: [string, number][]; className?: string }) {
  const top = Math.max(1, steps[0]?.[1] ?? 1)
  return (
    <Card className={className}>
      <CardTitle>Regisztrációs tölcsér</CardTitle>
      <Meta className="mt-1">Az összes fiók, hol tart az indulásban</Meta>
      <div className="mt-3 space-y-2.5">
        {steps.map(([name, n], i) => <ShareRow key={name} name={name} value={`${nf(n)} · ${Math.round((n / top) * 100)}%`} pct={Math.round((n / top) * 100)} hi={i === steps.length - 1} />)}
      </div>
    </Card>
  )
}

/* ── Előfizetők ────────────────────────────────────────────────────────────── */

export function AccountToolbar({ active = 0, chips = [['Mind', 48], ['Fizető', 31], ['Próba', 12], ['Lejárt', 2], ['Lemondott', 3]], query, onQuery, onChip }: { active?: number; chips?: [string, number][]; query?: string; onQuery?: (q: string) => void; onChip?: (i: number) => void }) {
  return <BsToolbar search="Név, e-mail, üzlet…" active={active} chips={chips} query={query} onQuery={onQuery} onChip={onChip} />
}

export type Paging = { page: number; pages: number; label: string; onPage?: (p: number) => void }
const SAMPLE_PAGING: Paging = { page: 1, pages: 5, label: '1–8 / 48' }

/** Előfizetők listája — a fehér táblázat-minta: fiók, üzletek, csomag, havi díj, foglalás (30 nap), állapot, mióta.
 *  A megnyitott sor sárga, mellette az adatlap. */
export function AccountTable({ rows = SAMPLE_ACCOUNTS, openKey = 'c', onOpen, toolbar, empty, paging = SAMPLE_PAGING, className = '' }: { rows?: BsAccount[]; openKey?: string | null; onOpen?: (key: string) => void; toolbar?: React.ReactNode; empty?: React.ReactNode; paging?: Paging | null; className?: string }) {
  return (
    <Card pad="sm" className={`flex flex-col ${className}`}>
      {toolbar ?? <AccountToolbar />}
      {rows.length === 0 && empty ? empty : (
        <><MobileRows rows={rows.map((a) => ({ key: a.key, open: a.key === openKey, onClick: onOpen ? () => onOpen(a.key) : undefined, leading: <Avatar size="sm" src={a.img} name={a.name} />, title: <MarqueeText>{a.business}</MarqueeText>, meta: `${a.name}${a.fee && a.status !== 'canceled' ? ` · ${ft(a.fee)}` : ''} · ${a.bookings30} foglalás / 30 nap`, trailing: <BsStatusPill status={a.status} trialLeft={a.trialLeft} /> }))} />
        <div className="max-lg:hidden"><Table minWidth={760}>
          <thead><tr><Th>Fiók</Th><Th>Üzletek</Th><Th>Csomag</Th><Th>Havi díj</Th><Th>Foglalás · 30 nap</Th><Th>Állapot</Th><Th>Mióta</Th></tr></thead>
          <tbody>
            {rows.map((a) => {
              const open = a.key === openKey
              return (
                <Tr key={a.key} state={open ? 'open' : a.status === 'canceled' ? 'muted' : 'default'} onClick={onOpen ? () => onOpen(a.key) : undefined} className={rowCls(open)}>
                  <Td><span className="flex items-center gap-2.5"><Avatar size="sm" src={a.img} name={a.name} /><span className="min-w-0 max-w-[240px]"><MarqueeText>{a.business}</MarqueeText><span className="block truncate text-ui-label text-ui-muted">{a.name}</span></span></span></Td>
                  <Td><BsPlaceMix salons={a.salons} restaurants={a.restaurants} /></Td>
                  <Td>{a.tier ? BS_TIER[a.tier] : <span className="text-ui-muted">—</span>}{a.annual && <span className="text-ui-muted"> · éves</span>}</Td>
                  <Td>{a.status === 'canceled' || !a.fee ? <span className="text-ui-muted">—</span> : ft(a.fee)}</Td>
                  <Td>{a.bookings30 ? nf(a.bookings30) : <span className="text-ui-muted">0</span>}</Td>
                  <Td><BsStatusPill status={a.status} trialLeft={a.trialLeft} /></Td>
                  <Td className="text-ui-muted">{a.since}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table></div></>
      )}
      {paging && paging.pages > 1 && <Pagination page={paging.page} pages={paging.pages} label={paging.label} onPage={paging.onPage} className="mt-2" />}
    </Card>
  )
}

export type BsPlaceLite = { key: string; kind: 'salon' | 'restaurant'; name: string; meta: string; href?: string }

/** A megnyitott fiók adatlapja a lista mellett: elérhetőség, három szám, előfizetés, üzletei, jegyzet és a fő lépések.
 *  Élőben: `openHref` (a profil), `places`, `actions` (a gombok helye), `menu` (a ⋯ helye). */
export function AccountPanel({ a = SAMPLE_ACCOUNTS[2], places, openHref, actions, menu, bare = false, className = '' }: { a?: BsAccount; places?: BsPlaceLite[]; openHref?: string; actions?: React.ReactNode; menu?: React.ReactNode; bare?: boolean; className?: string }) {
  const list = places ?? [{ key: 's', kind: 'salon' as const, name: a.business, meta: 'Budapest · 38 foglalás / 30 nap' }]
  const Box = bare ? 'div' : Panel
  return (
    <Box className={className}>
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-3"><Avatar src={a.img} name={a.name} /><span className="min-w-0"><CardTitle><MarqueeText>{a.business}</MarqueeText></CardTitle><Meta>{a.name}</Meta></span></span>
        <span className="flex gap-1"><IconButton icon={ArrowUpRight} label="Fiók megnyitása" variant="ghost" size="sm" href={openHref} />{menu ?? <IconButton icon={MoreHorizontal} label="Továbbiak" variant="ghost" size="sm" />}</span>
      </div>
      <div className="mt-2"><BsStatusPill status={a.status} trialLeft={a.trialLeft} /></div>
      <div className="mt-4 space-y-1.5 text-ui-body text-ui-text">
        <a href={`mailto:${a.email}`} className="flex items-center gap-2 break-all hover:underline"><Mail className="h-4 w-4 shrink-0 text-ui-muted" />{a.email}</a>
        {a.phone && <a href={`tel:${a.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4 shrink-0 text-ui-muted" />{a.phone}</a>}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
        {([[a.fee ? nf(a.fee) : '—', 'Ft / hó'], [String(a.salons + a.restaurants), 'üzlet'], [nf(a.bookings30), 'foglalás · 30 nap']] as const).map(([v, l]) => (
          <Card key={l} tone="cell" inner pad="sm"><MarqueeText className="text-ui-title font-light text-ui-text">{v}</MarqueeText><Meta className="text-ui-label">{l}</Meta></Card>
        ))}
      </div>
      {a.status && (
        <Card tone="dark" inner pad="sm" className="mt-1.5">
          <Meta dark className="text-ui-label">Előfizetés</Meta>
          <div className="mt-0.5 text-ui-body">{a.tier ? BS_TIER[a.tier] : 'Csomag nélkül'} · {a.annual ? 'éves' : 'havi'}{a.fee ? ` · ${ft(a.fee)} / hó` : ''}</div>
          {a.periodEnd && <Meta dark className="mt-0.5">{a.status === 'trialing' ? `Próba vége: ${a.periodEnd}` : `Időszak vége: ${a.periodEnd}`}</Meta>}
        </Card>
      )}
      <div className="mt-4"><Meta className="mb-1 text-ui-label">Üzletek</Meta>
        {list.length === 0 && <Meta>Még nincs üzlete.</Meta>}
        {list.map((p) => <ListRow key={p.key} filled leading={<IconCircle tone="cell" size="sm" icon={kindIcon(p.kind)} />} title={<MarqueeText>{p.name}</MarqueeText>} meta={p.meta} trailing={<IconButton icon={ArrowUpRight} label="Nyilvános oldal" variant="ghost" size="sm" href={p.href} />} className="[&+&]:mt-1" />)}
      </div>
      {a.note && <Note strong className="mt-3">Belső: {a.note}</Note>}
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {actions ?? <><Button icon={LogIn}>Belépés a nevében</Button><Button variant="cell" icon={Send}>Segítő üzenet</Button></>}
      </div>
    </Box>
  )
}

/* ── Előfizető-profil ──────────────────────────────────────────────────────── */

/** Egy adat-kártya sorokkal (a Beállítások sor-mintája) — a profil bal oszlopa ebből áll. */
export function FactsCard({ title, rows, extra, children, className = '' }: { title: string; rows: [string, React.ReactNode][]; extra?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-2"><CardTitle>{title}</CardTitle>{extra}</div>
      <div className="mt-1">{rows.map(([l, v]) => <FieldRow key={l} label={l}><span className="text-right text-ui-body text-ui-text">{v}</span></FieldRow>)}</div>
      {children}
    </Card>
  )
}

/** A profil bal oszlopa mintaadattal: fiók-adatok, előfizetés, utolsó számla, ajánlás. */
export function AccountFacts({ a = SAMPLE_ACCOUNTS[0], className = '' }: { a?: BsAccount; className?: string }) {
  return (
    <div className={`flex flex-col gap-[5px] ${className}`}>
      <FactsCard title="Fiók" rows={[['E-mail', a.email], ['Telefon', '+36 30 412 7788'], ['Regisztrált', `2026. ${a.since}`], ['Utolsó belépés', 'Ma, 9:41']]} />
      <FactsCard title="Előfizetés" extra={<IconButton icon={Pencil} label="Előfizetés állapota" variant="ghost" size="sm" />}
        rows={[['Csomag', `${a.tier ? BS_TIER[a.tier] : '—'} · 2 szalon, 3 munkatárs`], ['Számlázás', a.annual ? 'Éves (−20%)' : 'Havi'], ['Havi díj', ft(a.fee)], ['Időszak vége', 'Dec. 3.'], ['Állapot', <BsStatusPill key="s" status={a.status} />]]} />
      <FactsCard title="Utolsó számla" extra={<Button size="sm" variant="cell" icon={Receipt}>Megnyitás</Button>} rows={[['Számlaszám', 'DAV-2026-0412'], ['Kiállító', 'Számlázz.hu']]} />
      <FactsCard title="Ajánlás" rows={[['Őt ajánlotta', '—'], ['Ő ajánlotta', 'Barber Bros · előfizetett'], ['Ingyen hónap', '+1 hónap · Okt. 2.']]} />
    </div>
  )
}

export type BsPlace = { key: string; name: string; kind: 'salon' | 'restaurant'; city: string; owner: string; ownerKey?: string; tier: BsTier; month: number; total: number; since: string; active: boolean; status: BsStatus | null; slug?: string }
export const SAMPLE_PLACES: BsPlace[] = [
  { key: 'p1', name: 'Anna Fodrászat · Andrássy út', kind: 'salon', city: 'Budapest', owner: 'Kovács Anna', tier: 'pro', month: 268, total: 2_140, since: 'Aug. 14.', active: true, status: 'active' },
  { key: 'p2', name: 'Anna Fodrászat · Allee', kind: 'salon', city: 'Budapest', owner: 'Kovács Anna', tier: 'pro', month: 144, total: 610, since: 'Okt. 1.', active: true, status: 'active' },
  { key: 'p3', name: 'Bistro Andrássy', kind: 'restaurant', city: 'Budapest', owner: 'Tóth Gábor', tier: 'pro', month: 286, total: 1_904, since: 'Aug. 22.', active: true, status: 'active' },
  { key: 'p4', name: 'Kék Köröm', kind: 'salon', city: 'Debrecen', owner: 'Nagy Eszter', tier: 'starter', month: 38, total: 38, since: 'Okt. 19.', active: true, status: 'trialing', slug: 'kek-korom' },
  { key: 'p5', name: 'Barber Bros', kind: 'salon', city: 'Debrecen', owner: 'Szabó Márk', tier: 'pro', month: 194, total: 1_022, since: 'Szept. 2.', active: true, status: 'active' },
  { key: 'p6', name: 'Petra Kozmetika', kind: 'salon', city: 'Szeged', owner: 'Varga Petra', tier: 'starter', month: 12, total: 96, since: 'Szept. 9.', active: true, status: 'past_due' },
  { key: 'p7', name: 'Pizzeria Napoli', kind: 'restaurant', city: 'Győr', owner: 'Horváth Bence', tier: 'starter', month: 0, total: 0, since: 'Nov. 2.', active: true, status: 'trialing' },
  { key: 'p8', name: 'Judit Masszázs', kind: 'salon', city: 'Pécs', owner: 'Molnár Judit', tier: 'starter', month: 0, total: 41, since: 'Júl. 30.', active: false, status: 'canceled' },
]

/** A fiók üzletei (profil jobb oszlop): név, város, csomag, foglalás (30 nap / összes), látható-e, nyilvános oldal.
 *  Élőben `toggle` (a kapcsoló helye), `hrefOf` (a nyilvános oldal), `tierOf` (a csomag gombja). */
export function AccountPlacesCard({ rows = SAMPLE_PLACES.slice(0, 2), toggle, hrefOf, tierOf, className = '' }: { rows?: BsPlace[]; toggle?: (p: BsPlace) => React.ReactNode; hrefOf?: (p: BsPlace) => string; tierOf?: (p: BsPlace) => React.ReactNode; className?: string }) {
  return (
    <Card pad="sm" className={className}>
      <div className="flex items-center justify-between px-2 pt-2"><CardTitle>Üzletek</CardTitle><Pill tone="cell" size="sm">{rows.length}</Pill></div>
      {rows.length === 0 ? <Meta className="px-2 py-6">Ehhez a fiókhoz még nem tartozik üzlet.</Meta> : (
        <><MobileRows className="mt-2" rows={rows.map((p) => ({ key: p.key, leading: <IconCircle tone="cell" size="sm" icon={kindIcon(p.kind)} />, title: <MarqueeText>{p.name}</MarqueeText>, meta: <>{tierOf ? tierOf(p) : BS_TIER[p.tier]} · {nf(p.month)} / {nf(p.total)} foglalás</>, trailing: toggle ? toggle(p) : <MockSwitch defaultOn={p.active} /> }))} />
        <div className="max-lg:hidden"><Table minWidth={600} className="mt-2">
          <thead><tr><Th>Üzlet</Th><Th>Város</Th><Th>Csomag</Th><Th>Foglalás · 30 nap / össz.</Th><Th>Látható</Th><Th /></tr></thead>
          <tbody>{rows.map((p) => (
            <Tr key={p.key} className="[&>td]:bg-white">
              <Td><span className="flex items-center gap-2.5"><IconCircle tone="cell" size="sm" icon={kindIcon(p.kind)} /><span className="max-w-[220px]"><MarqueeText>{p.name}</MarqueeText></span></span></Td>
              <Td className="text-ui-muted">{p.city || '—'}</Td>
              <Td>{tierOf ? tierOf(p) : BS_TIER[p.tier]}</Td>
              <Td>{nf(p.month)} <span className="text-ui-muted">/ {nf(p.total)}</span></Td>
              <Td>{toggle ? toggle(p) : <MockSwitch defaultOn={p.active} />}</Td>
              <Td><IconButton icon={ArrowUpRight} label="Nyilvános oldal" variant="ghost" size="sm" href={hrefOf?.(p)} /></Td>
            </Tr>
          ))}</tbody>
        </Table></div></>
      )}
    </Card>
  )
}

export type BsBookingRow = { key: string; guest: string; what: string; where: string; when: string; status: Status; label: string }
const SAMPLE_BOOKINGS: BsBookingRow[] = ([
  ['Gál Zsófia', 'Balayage', 'Andrássy út', 'Ma, 14:00', 'confirmed', 'Megerősített'],
  ['Tóth Bence', 'Férfi vágás', 'Allee', 'Ma, 11:30', 'ok', 'Megjelent'],
  ['Kiss Réka', 'Festés + vágás', 'Andrássy út', 'Tegnap, 17:00', 'ok', 'Megjelent'],
  ['Lakatos Ádám', 'Szakállvágás', 'Allee', 'Tegnap, 9:00', 'bad', 'Nem jött'],
  ['Balogh Nóra', 'Hajvágás', 'Andrássy út', 'Nov. 15., 10:00', 'pending', 'Jóváhagyásra vár'],
] as const).map(([guest, what, where, when, status, label], i) => ({ key: String(i), guest, what, where, when, status, label }))

/** A fiók legutóbbi foglalásai (mind az üzleteiben): ki, mit, hol, mikor, állapot. */
export function AccountBookingsCard({ rows = SAMPLE_BOOKINGS, className = '' }: { rows?: BsBookingRow[]; className?: string }) {
  return (
    <Card pad="sm" className={className}>
      <div className="px-2 pt-2"><CardTitle>Legutóbbi foglalások</CardTitle></div>
      {rows.length === 0 ? <Meta className="px-2 py-6">Még nincs foglalás egyik üzletében sem.</Meta> : (
        <><MobileRows className="mt-2" rows={rows.map((r) => ({ key: r.key, title: r.guest, meta: `${r.what} · ${r.where} · ${r.when}`, trailing: <StatusPill status={r.status}>{r.label}</StatusPill> }))} />
        <div className="max-lg:hidden"><Table minWidth={560} className="mt-2">
          <thead><tr><Th>Vendég</Th><Th>Mit</Th><Th>Hol</Th><Th>Mikor</Th><Th>Állapot</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.key} className="[&>td]:bg-white"><Td>{r.guest}</Td><Td className="text-ui-muted">{r.what}</Td><Td className="text-ui-muted">{r.where}</Td><Td>{r.when}</Td><Td><StatusPill status={r.status}>{r.label}</StatusPill></Td></Tr>
          ))}</tbody>
        </Table></div></>
      )}
    </Card>
  )
}

/** A fiók műveletei (a profil ⋯ gombja): belépés, segítő üzenet, állapot, csomag, üzletek ki/be, törlés. */
export function AccountActionsMenu({ status = 'Fizető', plan = 'Pro', allOn = true, onImpersonate, onHelp, onStatus, onTier, onToggleAll, onDelete, className = '' }: {
  status?: string; plan?: string; allOn?: boolean
  onImpersonate?: () => void; onHelp?: () => void; onStatus?: () => void; onTier?: () => void; onToggleAll?: () => void; onDelete?: () => void; className?: string
}) {
  return (
    <Menu label="Fiók" className={`w-[280px] ${className}`}>
      <MenuItem icon={LogIn} onClick={onImpersonate}>Belépés a nevében</MenuItem>
      <MenuItem icon={Send} onClick={onHelp}>Segítő üzenet</MenuItem>
      <div className="mx-3 my-1 border-t border-dashed border-ui-divider" />
      <MenuItem icon={CreditCard} onClick={onStatus} trailing={<Pill tone="cell" size="sm">{status}</Pill>}>Előfizetés állapota</MenuItem>
      <MenuItem icon={Pencil} onClick={onTier} trailing={<Pill tone="cell" size="sm">{plan}</Pill>}>Csomag és havidíj</MenuItem>
      <MenuItem icon={Power} onClick={onToggleAll}>{allOn ? 'Minden üzlet kikapcsolása' : 'Minden üzlet bekapcsolása'}</MenuItem>
      <div className="mx-3 my-1 border-t border-dashed border-ui-divider" />
      <MenuItem icon={Trash2} danger onClick={onDelete}>Fiók törlése</MenuItem>
    </Menu>
  )
}

const STATUS_HINT: Record<BsStatus, string> = {
  active: 'Fizető — minden funkció elérhető.',
  trialing: 'Próbaidő — a vége dátummal állítható.',
  paused: 'Szüneteltetve — a foglalóoldal pihen, az adatok megmaradnak.',
  past_due: 'Lejárt fizetés — a tulaj figyelmeztetést lát.',
  canceled: 'Lemondva — az időszak végén zárol.',
}

/** Előfizetés állapota — kézi átállítás (pl. átutalással fizetett, vagy próbaidő-hosszabbítás). */
export function StatusModal({ value = 'trialing', onSelect, trialEnd = '2026-11-17', onTrialEnd, subtitle = 'Kék Köröm · Nagy Eszter', onSave, onClose, busy = false, className = '' }: {
  value?: BsStatus; onSelect?: (s: BsStatus) => void; trialEnd?: string; onTrialEnd?: (v: string) => void
  subtitle?: string; onSave?: () => void; onClose?: () => void; busy?: boolean; className?: string
}) {
  return (
    <Modal size="sm" title="Előfizetés állapota" subtitle={subtitle} onClose={onClose} className={className}
      footer={<><Button variant="cell" onClick={onClose}>Mégse</Button><Button icon={Check} onClick={onSave} loading={busy}>Mentés</Button></>}>
      <div className="space-y-1.5">
        {(Object.keys(BS_STATUS) as BsStatus[]).map((k) => {
          const card = <OptionCard radio selected={k === value} title={BS_STATUS[k].label}><Meta className={k === value ? 'text-white/60' : ''}>{STATUS_HINT[k]}</Meta></OptionCard>
          return onSelect ? <button key={k} type="button" onClick={() => onSelect(k)} className="block w-full text-left">{card}</button> : <div key={k}>{card}</div>
        })}
      </div>
      {value === 'trialing' && <Field label="Próba vége" className="mt-4"><Input type="date" value={onTrialEnd ? trialEnd : undefined} defaultValue={onTrialEnd ? undefined : trialEnd} onChange={onTrialEnd ? (e) => onTrialEnd(e.target.value) : undefined} /></Field>}
      <Meta className="mt-3">A változás bekerül a naplóba a te neveddel.</Meta>
    </Modal>
  )
}

/** Csomag és havidíj — üzletenként (a csomag az üzleté): Starter / Pro / Egyedi; Egyedinél kézi havidíj. */
export function TierModal({ tier = 'egyedi', onTier, fee = '24000', onFee, places, place, onPlace, subtitle = 'Anna Fodrászat · 2 szalon, 3 munkatárs', onSave, onClose, busy = false, className = '' }: {
  tier?: BsTier; onTier?: (t: BsTier) => void; fee?: string; onFee?: (v: string) => void
  places?: { key: string; name: string }[]; place?: string; onPlace?: (key: string) => void
  subtitle?: string; onSave?: () => void; onClose?: () => void; busy?: boolean; className?: string
}) {
  const keys: BsTier[] = ['starter', 'pro', 'egyedi']
  return (
    <Modal size="sm" title="Csomag és havidíj" subtitle={subtitle} onClose={onClose} className={className}
      footer={<><Button variant="cell" onClick={onClose}>Mégse</Button><Button icon={Check} onClick={onSave} loading={busy}>Mentés</Button></>}>
      {places && places.length > 1 && <Field label="Üzlet" className="mb-4"><Select value={place} onChange={(e) => onPlace?.(e.target.value)}>{places.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select></Field>}
      <Segmented full options={keys.map((k) => BS_TIER[k])} active={keys.indexOf(tier)} onSelect={onTier ? (i) => onTier(keys[i]) : undefined} />
      {tier === 'egyedi' && <Field label="Egyedi havidíj (Ft)" className="mt-4" hint="Üresen hagyva a Pro ára számít."><Input inputMode="numeric" value={onFee ? fee : undefined} defaultValue={onFee ? undefined : fee} onChange={onFee ? (e) => onFee(e.target.value.replace(/\D/g, '')) : undefined} /></Field>}
      <Note className="mt-4">A már fizető fiók a mostani időszak végéig a régi áron marad, a következő terheléstől fizeti az újat.</Note>
    </Modal>
  )
}

export const HELP_TEMPLATES = [
  ['Elakadtál valahol?', 'Láttuk, hogy hamarosan lejár a próbaidőszakod, de még nem sokat foglaltál — ha bármi nem világos a beállításban, szívesen segítünk, csak válaszolj erre az üzenetre.'],
  ['Gond volt a fizetéssel?', 'Úgy tűnik, a legutóbbi terhelés nem sikerült — ez leggyakrabban egyszerű kártya-probléma, nem szándékos lemondás. Ha segítségre van szükséged a rendezéshez, szólj nyugodtan.'],
] as const

/** Segítő üzenet — kész szöveggel a helyzethez (elakadt a próbában / nem ment a fizetés); a tulaj csengőjébe megy. */
export function HelpMessageModal({ kind = 0, onKind, title, onTitle, body, onBody, subtitle = 'Nagy Eszter · eszter@kekkorom.hu', onSend, onClose, busy = false, className = '' }: {
  kind?: 0 | 1; onKind?: (k: 0 | 1) => void; title?: string; onTitle?: (v: string) => void; body?: string; onBody?: (v: string) => void
  subtitle?: string; onSend?: () => void; onClose?: () => void; busy?: boolean; className?: string
}) {
  const live = !!onTitle
  return (
    <Modal size="md" title="Segítő üzenet" subtitle={subtitle} onClose={onClose} className={className}
      footer={<><Button variant="cell" onClick={onClose}>Mégse</Button><Button icon={Send} onClick={onSend} loading={busy} disabled={live && (!title?.trim() || !body?.trim())}>Küldés</Button></>}>
      <Segmented full options={['Elakadt a próbában', 'Nem ment a fizetés']} active={kind} onSelect={onKind ? (i) => onKind(i as 0 | 1) : undefined} />
      <Field label="Cím" className="mt-4"><Input value={live ? title : undefined} defaultValue={live ? undefined : HELP_TEMPLATES[kind][0]} onChange={live ? (e) => onTitle?.(e.target.value) : undefined} /></Field>
      <Field label="Üzenet" className="mt-3"><Textarea rows={4} value={live ? body : undefined} defaultValue={live ? undefined : HELP_TEMPLATES[kind][1]} onChange={live ? (e) => onBody?.(e.target.value) : undefined} /></Field>
      <Meta className="mt-3">A tulaj csengőjébe érkezik (és push-értesítésként, ha bekapcsolta). A Körüzenet oldalon visszavonható.</Meta>
    </Modal>
  )
}

/** Fiók törlése — a tulaj, az előfizetés és minden üzlete; a fiók e-mail címét kell beírni. */
export function DeleteAccountModal({ subtitle = 'Molnár Judit · judit@juditmasszazs.hu', email = 'judit@juditmasszazs.hu', places = 1, value, onValue, onDelete, onClose, busy = false, className = '' }: {
  subtitle?: string; email?: string; places?: number; value?: string; onValue?: (v: string) => void; onDelete?: () => void; onClose?: () => void; busy?: boolean; className?: string
}) {
  const ok = !onValue || value?.trim().toLowerCase() === email.toLowerCase()
  return (
    <Modal size="sm" title="Fiók törlése" subtitle={subtitle} onClose={onClose} className={className}
      footer={<><Button variant="cell" onClick={onClose}>Mégse</Button><Button variant="danger" icon={Trash2} onClick={onDelete} loading={busy} disabled={!ok}>Végleges törlés</Button></>}>
      <Note warn>Törlődik a fiók, az előfizetése{places ? ` és ${places} üzlete a foglalásokkal és a vendégekkel együtt` : ''}. Nem vonható vissza.</Note>
      <Field label="Írd be a fiók e-mail címét" className="mt-4"><Input placeholder={email} value={onValue ? value : undefined} onChange={onValue ? (e) => onValue(e.target.value) : undefined} /></Field>
    </Modal>
  )
}

/* ── Bevétel ───────────────────────────────────────────────────────────────── */

/** MRR-görbe a Statisztika „Bevétel alakulása” kártyájához (ugyanaz a kártya) — minta. */
export const SAMPLE_MRR = {
  total: 342_600, delta: 12,
  now: [96_000, 118_000, 151_000, 187_000, 214_000, 262_000, 305_000, 342_600],
  prev: [] as number[],
  ticks: ['Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.'],
  points: ['Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.'],
  parts: [],
}

/** Miből jön a bevétel: üzlettípus és csomag szerint (`[név, érték-szöveg, %]`). */
export function RevenueMixCard({ kinds = [['Szalon · 41 üzlet', '214 e', 62], ['Étterem · 16 üzlet', '128 e', 38]], tiers = [['Starter · 14 fiók', '98 e', 29], ['Pro · 16 fiók', '220 e', 64], ['Egyedi · 1 fiók', '24 e', 7]], className = '' }: { kinds?: [string, string, number][]; tiers?: [string, string, number][]; className?: string }) {
  const top = (rows: [string, string, number][]) => rows.reduce((b, r, i) => (r[2] > rows[b][2] ? i : b), 0)
  return (
    <Card className={className}>
      <CardTitle>Miből jön</CardTitle>
      <Meta className="mt-1">A havi bevétel üzlettípus és csomag szerint</Meta>
      <div className="mt-3 space-y-2.5">
        {kinds.map(([n, v, p], i) => <ShareRow key={n} lead={i === 0 ? <Scissors className="h-4 w-4 text-ui-muted" /> : <UtensilsCrossed className="h-4 w-4 text-ui-muted" />} name={n} value={v} pct={p} hi={i === top(kinds)} />)}
      </div>
      <div className="mt-4 space-y-2.5 border-t border-dashed border-ui-divider pt-4">
        {tiers.map(([n, v, p], i) => <ShareRow key={n} name={n} value={v} pct={p} hi={i === top(tiers)} />)}
      </div>
    </Card>
  )
}

/** Havonta: bevétel és új fizető — a legutóbbi hónap felül. */
export function MonthlyTable({ rows = [['November', 342_600, 4], ['Október', 305_000, 6], ['Szeptember', 262_000, 7], ['Augusztus', 214_000, 5], ['Július', 187_000, 4]], className = '' }: { rows?: [string, number, number][]; className?: string }) {
  return (
    <Card pad="sm" className={className}>
      <div className="px-2 pt-2"><CardTitle>Havonta</CardTitle></div>
      {rows.length === 0 ? <Meta className="px-2 py-6">Még nincs havi adat.</Meta> : (
        <Table minWidth={280} className="mt-2">
          <thead><tr><Th>Hónap</Th><Th>Havi bevétel</Th><Th>Új fizető</Th></tr></thead>
          <tbody>{rows.map(([m, v, n]) => <Tr key={m} className="[&>td]:bg-white"><Td>{m}</Td><Td>{ft(v)}</Td><Td>{n ? `+${n}` : <span className="text-ui-muted">0</span>}</Td></Tr>)}</tbody>
        </Table>
      )}
    </Card>
  )
}

/** Kohorsz: a regisztráció hónapja szerint hány fiók van még aktív — sávval (`[hónap, fiók, még aktív]`). */
export function CohortTable({ rows = [['Július', 9, 7], ['Augusztus', 12, 10], ['Szeptember', 11, 9], ['Október', 10, 9], ['November', 6, 6]], className = '' }: { rows?: [string, number, number][]; className?: string }) {
  return (
    <Card pad="sm" className={className}>
      <div className="px-2 pt-2"><CardTitle>Kohorsz — ki maradt meg</CardTitle><Meta className="mt-1">A regisztráció hónapja szerint</Meta></div>
      {rows.length === 0 ? <Meta className="px-2 py-6">Még nincs elég fiók a kohorsz-elemzéshez.</Meta> : (
        <Table minWidth={280} className="mt-2">
          <thead><tr><Th>Kohorsz</Th><Th>Megmaradt</Th><Th className="w-[45%]">Arány</Th></tr></thead>
          <tbody>{rows.map(([m, n, k]) => {
            const pct = n ? Math.round((k / n) * 100) : 0
            return (
              <Tr key={m} className="[&>td]:bg-white"><Td>{m}</Td><Td>{k} <span className="text-ui-muted">/ {n}</span></Td>
                <Td><span className="flex items-center gap-2"><MiniBar pct={pct} className="flex-1" /><span className="w-10 text-right">{pct}%</span></span></Td>
              </Tr>
            )
          })}</tbody>
        </Table>
      )}
    </Card>
  )
}

export type BsMailFailure = { key: string; type: string; to: string; error: string; when: string }
/** Sikertelen e-mailek (30 nap): hány levélből hány nem ment ki, és a legutóbbiak — milyen levél, kinek, miért
 *  (a Resend hibája magyarul). Hogy semmi ne bukjon el csendben. */
export function EmailHealthCard({ total = 6214, failed = 2, rate = 99.6, failures = [{ key: '1', type: 'Foglalás-visszaigazolás', to: 'zsofi@gmial.com', error: 'Érvénytelen címzett e-mail cím', when: 'Ma, 9:12' }, { key: '2', type: 'Belépési kód', to: 'info@petrakozmetika.hu', error: 'Visszapattant — a címzett postafiókja nem fogadta', when: 'Tegnap, 18:05' }], loadFailed = false, className = '' }: { total?: number; failed?: number; rate?: number; failures?: BsMailFailure[]; loadFailed?: boolean; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span><CardTitle>Sikertelen e-mailek</CardTitle><Meta className="mt-1">{loadFailed ? 'Az elmúlt 30 nap' : failed ? `30 nap · ${nf(total)} levélből ${nf(failed)} nem ment ki` : `30 nap · mind a ${nf(total)} levél kiment`}</Meta></span>
        {!loadFailed && <StatusPill status={rate >= 98 ? 'ok' : rate >= 95 ? 'warn' : 'bad'}>{String(rate).replace('.', ',')}% sikeres</StatusPill>}
      </div>
      <div className="mt-3">
        {loadFailed ? <Note warn>Az adat most nem érhető el — frissítsd az oldalt.</Note>
          : failures.length === 0 ? <Meta className="py-4">Nincs sikertelen küldés az elmúlt 30 napban.</Meta>
            : failures.map((f) => <ListRow key={f.key} leading={<IconCircle tone="cell" size="sm" icon={CircleAlert} />} title={`${f.type} → ${f.to}`} meta={f.error} trailing={<Meta className="shrink-0">{f.when}</Meta>} />)}
      </div>
    </Card>
  )
}

const SAMPLE_MAIL_NOW = [180, 210, 195, 240, 260, 120, 90, 205, 230, 215, 250, 270, 130, 95, 210, 240, 220, 255, 280, 140, 100, 215, 245, 230, 260, 290, 150, 110, 225, 250]
const SAMPLE_MAIL_PREV = [160, 190, 180, 210, 230, 110, 80, 185, 205, 200, 220, 240, 120, 85, 190, 215, 205, 230, 250, 125, 90, 195, 220, 210, 235, 260, 135, 100, 200, 225]
const SAMPLE_MAIL_POINTS = SAMPLE_MAIL_NOW.map((_, i) => (i < 17 ? `Okt. ${15 + i}.` : `Nov. ${i - 16}.`))

/** Kimenő e-mailek (széles kártya): mennyi ment ki (e hónap / 30 nap / összesen), a sötét napi grafikon az elmúlt 30
 *  napról (halványan az előző 30), alul mi lett velük (kézbesítve, megnyitva, visszapattant) és típusonként (`[típus, db]`). */
export function EmailVolumeCard({ month = 4_120, last30 = 6_214, all = 38_400, delivered = 6_102, opened = 3_640, bounced = 18, daily = SAMPLE_MAIL_NOW, prevDaily = SAMPLE_MAIL_PREV, points = SAMPLE_MAIL_POINTS, byType = [['Emlékeztető', 2_410], ['Foglalás-visszaigazolás', 1_880], ['Új foglalás (a tulajnak)', 1_140], ['Hírlevél', 520], ['Értékelés-kérés', 190], ['Egyéb', 74]], className = '' }: {
  month?: number; last30?: number; all?: number; delivered?: number; opened?: number; bounced?: number; daily?: number[]; prevDaily?: number[]; points?: string[]; byType?: [string, number][]; className?: string
}) {
  const pct = (n: number) => (last30 ? Math.round((n / last30) * 100) : 0)
  const top = byType[0]?.[1] ?? 0
  const ticks = [0, 7, 14, 21, daily.length - 1].filter((i, k, a) => i >= 0 && a.indexOf(i) === k).map((i) => points[i] ?? '')
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span><CardTitle>Kimenő e-mailek</CardTitle><Meta className="mt-1">Minden levél, amit a rendszer küldött — naponta, az elmúlt 30 napban</Meta></span>
        <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto">
          {([[nf(month), 'ebben a hónapban'], [nf(last30), 'elmúlt 30 nap'], [nf(all), 'összesen']] as const).map(([v, l]) => <Card key={l} tone="cell" inner pad="sm" className="min-w-0 sm:min-w-[110px]"><MarqueeText className="text-ui-title font-light text-ui-text">{v}</MarqueeText><Meta className="text-ui-label">{l}</Meta></Card>)}
        </div>
      </div>
      <MailDarkLine className="mt-5" now={daily} prev={prevDaily} ticks={ticks} points={points} />
      <div className="mt-6 grid gap-6 border-t border-dashed border-ui-divider pt-4 sm:grid-cols-2">
        <div className="space-y-2.5">
          <Meta className="text-ui-label">Mi lett velük · 30 nap</Meta>
          <ShareRow name="Kézbesítve" value={`${pct(delivered)}%`} pct={pct(delivered)} hi />
          <ShareRow name="Megnyitva" value={`${pct(opened)}%`} pct={pct(opened)} />
          <ShareRow name="Visszapattant" value={nf(bounced)} pct={pct(bounced)} />
        </div>
        <div className="space-y-2.5">
          <Meta className="text-ui-label">Típusonként · 30 nap</Meta>
          {byType.length === 0 ? <Meta>Az elmúlt 30 napban nem ment ki levél.</Meta> : byType.slice(0, 6).map(([n, v], i) => <ShareRow key={n} name={n} value={nf(v)} pct={top ? Math.round((v / top) * 100) : 0} hi={i === 0} />)}
        </div>
      </div>
    </Card>
  )
}

/** Áttekintő: az e-mailek egy kártyán — három álló oszlop (kézbesítve / megnyitva / sikertelen, a Vendégforrás oszlopai),
 *  alatta a darabszámok (e hónap / 30 nap / összesen). ↗ a Bevétel oldal e-mail részére. */
export function MailStatusCard({ delivered = 98, opened = 59, failed = 1, month = 4_120, last30 = 6_214, all = 38_400, href, className = '' }: { delivered?: number; opened?: number; failed?: number; month?: number; last30?: number; all?: number; href?: string; className?: string }) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex items-start justify-between"><span><span className="block text-ui-title text-ui-text">E-mailek</span><span className="block text-ui-label text-ui-muted">elmúlt 30 nap</span></span><IconButton icon={ArrowUpRight} label="Kimenő e-mailek" href={href} /></div>
      <StandBars compact bars={[{ l: 'Kézbesítve', v: delivered, tone: 'dark' }, { l: 'Megnyitva', v: opened, tone: 'yellow' }, { l: 'Sikertelen', v: failed, tone: 'hatch' }]} />
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-dashed border-ui-divider pt-3 text-center">
        {([[nf(month), 'e hónap'], [nf(last30), '30 nap'], [nf(all), 'összesen']] as const).map(([v, l]) => <span key={l} className="min-w-0"><MarqueeText className="text-ui-title font-light text-ui-text">{v}</MarqueeText><span className="block text-ui-label text-ui-muted">{l}</span></span>)}
      </div>
    </Card>
  )
}

/* ── Kockázat ──────────────────────────────────────────────────────────────── */

export type BsRiskKind = 'trial' | 'pastDue' | 'dormant' | 'never' | 'off'
export const BS_RISK: Record<BsRiskKind, { label: string; tone: Status }> = {
  pastDue: { label: 'Lejárt fizetés', tone: 'bad' },
  trial: { label: 'Lejáró próba', tone: 'warn' },
  dormant: { label: 'Alvó üzlet', tone: 'warn' },
  never: { label: 'Még nem foglaltak', tone: 'neutral' },
  off: { label: 'Kikapcsolva', tone: 'neutral' },
}
export type BsRisk = { key: string; kind: BsRiskKind; name: string; owner: string; detail: string; last: string; href?: string; ownerKey?: string }
export const SAMPLE_RISKS: BsRisk[] = [
  { key: 'r1', kind: 'pastDue', name: 'Petra Kozmetika', owner: 'Varga Petra', detail: 'Nov. 9-én nem ment a terhelés · 5 900 Ft', last: '12' },
  { key: 'r2', kind: 'trial', name: 'Kék Köröm', owner: 'Nagy Eszter', detail: 'Próba vége Nov. 17. · 38 foglalás, nincs kártya', last: '38' },
  { key: 'r3', kind: 'trial', name: 'Pizzeria Napoli', owner: 'Horváth Bence', detail: 'Próba vége Nov. 24. · még nincs foglalás', last: '0' },
  { key: 'r4', kind: 'dormant', name: 'Szalon Bella', owner: 'Kiss Ilona', detail: '30 napja nincs foglalás · összesen 412', last: '0' },
  { key: 'r5', kind: 'never', name: 'Dóra Pilates', owner: 'Farkas Dóra', detail: 'Regisztrált Nov. 12. · még nincs foglalása', last: '0' },
  { key: 'r6', kind: 'off', name: 'Judit Masszázs', owner: 'Molnár Judit', detail: 'Kikapcsolva · lemondás', last: '0' },
]
export const RISK_ORDER: BsRiskKind[] = ['pastDue', 'trial', 'dormant', 'never', 'off']

/** Akikkel most foglalkozni kell — egy lista, az ok szerint szűrve; soronként a teendő (segítő üzenet / ↗).
 *  Élőben: `chips` (darabszámok), `active` / `onChip`, `query` / `onQuery`, `action` (a sor teendője). */
export function RiskTable({ rows = SAMPLE_RISKS, chips = [['Mind', 17], ['Lejárt fizetés', 2], ['Lejáró próba', 6], ['Alvó üzlet', 4], ['Még nem foglaltak', 3], ['Kikapcsolva', 2]], active = 0, onChip, query, onQuery, action, empty, className = '' }: {
  rows?: BsRisk[]; chips?: [string, number][]; active?: number; onChip?: (i: number) => void; query?: string; onQuery?: (q: string) => void
  action?: (r: BsRisk) => React.ReactNode; empty?: React.ReactNode; className?: string
}) {
  const def = (r: BsRisk) => (r.kind === 'trial' || r.kind === 'pastDue' ? <Button size="sm" variant="cell" icon={Send}>Segítő üzenet</Button> : <IconButton icon={ArrowUpRight} label="Megnyitás" variant="ghost" size="sm" href={r.href} />)
  return (
    <Card pad="sm" className={className}>
      <BsToolbar search="Fiók vagy üzlet…" active={active} chips={chips} onChip={onChip} query={query} onQuery={onQuery} />
      {rows.length === 0 && empty ? empty : (
        <><MobileRows rows={rows.map((r) => ({ key: r.key, href: r.href, title: <MarqueeText>{r.name}</MarqueeText>, meta: <><StatusPill status={BS_RISK[r.kind].tone}>{BS_RISK[r.kind].label}</StatusPill> {r.detail}</>, trailing: (action ?? def)(r) }))} />
        <div className="max-lg:hidden"><Table minWidth={820}>
          <thead><tr><Th>Fiók / üzlet</Th><Th>Mi a gond</Th><Th>Részlet</Th><Th>Foglalás · 30 nap</Th><Th /></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.key} className="[&>td]:bg-white [&:hover>td]:bg-white/60">
              <Td>{r.href ? <Link href={r.href} className="block hover:underline">{r.name}</Link> : <span className="block">{r.name}</span>}<span className="block text-ui-label text-ui-muted">{r.owner}</span></Td>
              <Td><StatusPill status={BS_RISK[r.kind].tone}>{BS_RISK[r.kind].label}</StatusPill></Td>
              <Td className="whitespace-normal text-ui-muted">{r.detail}</Td>
              <Td className="text-ui-muted">{r.last}</Td>
              <Td className="text-right">{(action ?? def)(r)}</Td>
            </Tr>
          ))}</tbody>
        </Table></div></>
      )}
    </Card>
  )
}

/* ── Üzletek ───────────────────────────────────────────────────────────────── */

export function PlaceTable({ rows = SAMPLE_PLACES, openKey = 'p4', onOpen, chips = [['Mind', 57], ['Szalon', 41], ['Étterem', 16]], active = 0, onChip, query, onQuery, paging = { page: 1, pages: 8, label: '1–8 / 57' }, empty, className = '' }: {
  rows?: BsPlace[]; openKey?: string | null; onOpen?: (key: string) => void; chips?: [string, number][]; active?: number; onChip?: (i: number) => void
  query?: string; onQuery?: (q: string) => void; paging?: Paging | null; empty?: React.ReactNode; className?: string
}) {
  return (
    <Card pad="sm" className={className}>
      <BsToolbar search="Név, város, tulaj…" chips={chips} active={active} onChip={onChip} query={query} onQuery={onQuery} />
      {rows.length === 0 && empty ? empty : (
        <><MobileRows rows={rows.map((p) => ({ key: p.key, open: p.key === openKey, onClick: onOpen ? () => onOpen(p.key) : undefined, leading: <IconCircle tone={p.key === openKey ? 'white' : 'cell'} size="sm" icon={kindIcon(p.kind)} />, title: <MarqueeText>{p.name}</MarqueeText>, meta: `${p.owner}${p.city ? ` · ${p.city}` : ''} · ${nf(p.month)} foglalás / 30 nap`, trailing: p.active ? <BsStatusPill status={p.status} /> : <StatusPill status="neutral">Kikapcsolva</StatusPill> }))} />
        <div className="max-lg:hidden"><Table minWidth={780}>
          <thead><tr><Th>Üzlet</Th><Th>Tulajdonos</Th><Th>Város</Th><Th>Csomag</Th><Th>Foglalás · 30 nap</Th><Th>Mióta</Th><Th>Állapot</Th></tr></thead>
          <tbody>{rows.map((p) => {
            const open = p.key === openKey
            return (
              <Tr key={p.key} state={open ? 'open' : p.active ? 'default' : 'muted'} onClick={onOpen ? () => onOpen(p.key) : undefined} className={rowCls(open)}>
                <Td><span className="flex items-center gap-2.5"><IconCircle tone={open ? 'white' : 'cell'} size="sm" icon={kindIcon(p.kind)} /><span className="max-w-[240px]"><MarqueeText>{p.name}</MarqueeText></span></span></Td>
                <Td>{p.owner}</Td>
                <Td className="text-ui-muted">{p.city || '—'}</Td>
                <Td>{BS_TIER[p.tier]}</Td>
                <Td>{nf(p.month)}</Td>
                <Td className="text-ui-muted">{p.since}</Td>
                <Td>{p.active ? <BsStatusPill status={p.status} /> : <StatusPill status="neutral">Kikapcsolva</StatusPill>}</Td>
              </Tr>
            )
          })}</tbody>
        </Table></div></>
      )}
      {paging && paging.pages > 1 && <Pagination page={paging.page} pages={paging.pages} label={paging.label} onPage={paging.onPage} className="mt-2" />}
    </Card>
  )
}

/** A megnyitott üzlet a lista mellett: foglalás-számok, tulaj (→ fiók), előfizetés, csomag, elérhetőség, láthatóság,
 *  legutóbbi foglalások, belső megjegyzés, belépés. Élőben a slotok: `toggle`, `tier`, `notes`, `actions`. */
export function PlacePanel({ p = SAMPLE_PLACES[3], phone = '+36 30 412 7788', email = 'hello@kekkorom.hu', ownerHref, publicHref, recent = [['Lakatos Eszter', 'Gél lakk · Ma, 15:00'], ['Pap Dorina', 'Műköröm · Tegnap, 10:30']], trialLeft = 4, toggle, tier, notes, actions, bare = false, className = '' }: {
  p?: BsPlace; phone?: string | null; email?: string | null; ownerHref?: string; publicHref?: string; recent?: [string, string][]; trialLeft?: number | null
  toggle?: React.ReactNode; tier?: React.ReactNode; notes?: React.ReactNode; actions?: React.ReactNode; bare?: boolean; className?: string
}) {
  const Box = bare ? 'div' : Panel
  return (
    <Box className={className}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0"><CardTitle><MarqueeText>{p.name}</MarqueeText></CardTitle><Meta>{p.kind === 'restaurant' ? 'Étterem' : 'Szalon'}{p.city ? ` · ${p.city}` : ''}{p.slug ? ` · /${p.slug}` : ''}</Meta></span>
        <IconButton icon={ArrowUpRight} label="Nyilvános oldal" variant="ghost" size="sm" href={publicHref} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {([[nf(p.month), 'foglalás · 30 nap'], [nf(p.total), 'foglalás összesen']] as const).map(([v, l]) => <Card key={l} tone="cell" inner pad="sm"><div className="text-ui-title font-light text-ui-text">{v}</div><Meta className="text-ui-label">{l}</Meta></Card>)}
      </div>
      <div className="mt-3">
        <FieldRow label="Tulajdonos"><span className="flex items-center gap-1.5 text-ui-body text-ui-text">{p.owner}<IconButton icon={ArrowUpRight} label="Fiók megnyitása" variant="ghost" size="sm" href={ownerHref} /></span></FieldRow>
        <FieldRow label="Előfizetés"><BsStatusPill status={p.status} trialLeft={trialLeft} /></FieldRow>
        <FieldRow label="Csomag">{tier ?? <span className="text-ui-body text-ui-text">{BS_TIER[p.tier]}</span>}</FieldRow>
        {(phone || email) && <FieldRow label="Elérhetőség"><span className="text-right text-ui-body text-ui-text">{phone}{phone && email && <br />}{email && <span className="text-ui-muted">{email}</span>}</span></FieldRow>}
        <FieldRow label="Látható a vendégeknek">{toggle ?? <MockSwitch defaultOn={p.active} />}</FieldRow>
      </div>
      <Meta className="mb-1 mt-3 text-ui-label">Legutóbbi foglalások</Meta>
      {recent.length === 0 ? <Meta>Még nincs foglalás.</Meta> : recent.map(([n, m], i) => <ListRow key={n + i} title={n} meta={m} />)}
      {notes ?? <Field label="Belső megjegyzés" className="mt-3"><Textarea rows={2} defaultValue="Debreceni ismerős, Anna ajánlotta." /></Field>}
      <div className="mt-4">{actions ?? <Button icon={LogIn} className="w-full">Belépés a nevében</Button>}</div>
    </Box>
  )
}

/* ── Aktivitás ─────────────────────────────────────────────────────────────── */

export type BsEventKind = 'register' | 'trial' | 'active' | 'pastDue' | 'canceled' | 'other'
const EVENT_ICON: Record<BsEventKind, typeof UserPlus> = { register: UserPlus, trial: Clock, active: Check, pastDue: CircleAlert, canceled: Power, other: CreditCard }
export type BsEvent = { key: string; time: string; kind: BsEventKind; title: string; meta: string; tone: Status; tag: string; href?: string }
export const SAMPLE_EVENTS: [string, BsEvent[]][] = [
  ['Ma', [
    { key: '1', time: '9:12', kind: 'register', title: 'Dóra Pilates regisztrált', meta: 'Farkas Dóra · ajánló: Anna Fodrászat', tone: 'pending', tag: 'Új üzlet' },
    { key: '2', time: '8:40', kind: 'other', title: 'Barber Bros éves csomagra váltott', meta: 'Pro · 13 600 Ft / hó', tone: 'neutral', tag: 'Előfizetés módosult' },
  ]],
  ['Tegnap', [
    { key: '3', time: '18:05', kind: 'pastDue', title: 'Petra Kozmetika — nem ment a terhelés', meta: 'Stripe: kártya elutasítva', tone: 'bad', tag: 'Lejárt fizetés' },
    { key: '4', time: '11:30', kind: 'active', title: 'Bistro Andrássy fizető lett', meta: 'Pro · 23 800 Ft / hó', tone: 'ok', tag: 'Előfizető lett' },
  ]],
  ['Nov. 10.', [
    { key: '5', time: '16:22', kind: 'canceled', title: 'Judit Masszázs lemondott', meta: '1 szalon', tone: 'neutral', tag: 'Lemondott' },
  ]],
]

/** Idővonal: regisztrációk és előfizetés-események napok szerint (90 nap). */
export function ActivityTimeline({ days = SAMPLE_EVENTS, total, className = '' }: { days?: [string, BsEvent[]][]; total?: number; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between"><CardTitle>Idővonal</CardTitle>{total != null && <Pill tone="cell" size="sm">{total}</Pill>}</div>
      {days.length === 0 && <Meta className="py-6">Nincs regisztráció vagy előfizetés-esemény az elmúlt 90 napban.</Meta>}
      <div className="mt-3 space-y-4">
        {days.map(([day, evs]) => (
          <div key={day}>
            <Meta className="mb-1 text-ui-label">{day}</Meta>
            {evs.map((e) => {
              const row = <ListRow leading={<IconCircle tone="cell" size="sm" icon={EVENT_ICON[e.kind]} />} title={<MarqueeText>{e.title}</MarqueeText>} meta={`${e.time} · ${e.meta}`} trailing={<StatusPill status={e.tone}>{e.tag}</StatusPill>} />
              return e.href ? <Link key={e.key} href={e.href} className="block rounded-ui-inner transition-colors hover:bg-white/60">{row}</Link> : <div key={e.key}>{row}</div>
            })}
          </div>
        ))}
      </div>
    </Card>
  )
}

export type BsNotice = { key: string; kind: 'message' | 'referral' | 'register' | 'alert'; title: string; meta: string; unread: boolean }
const NOTICE_ICON: Record<BsNotice['kind'], typeof Mail> = { message: MessageSquare, referral: Gift, register: UserPlus, alert: CircleAlert }
const SAMPLE_NOTICES: BsNotice[] = [
  { key: '1', kind: 'message', title: 'Új üzenet a kapcsolat-űrlapról', meta: 'Szilágyi Kata · 20 perce', unread: true },
  { key: '2', kind: 'referral', title: 'Új ajánlás: Barber Bros → Kék Köröm', meta: 'Ajánló program · 2 órája', unread: true },
  { key: '3', kind: 'register', title: 'Új regisztráció: Dóra Pilates', meta: 'Ma, 9:12', unread: false },
  { key: '4', kind: 'alert', title: 'Sikertelen terhelés: Petra Kozmetika', meta: 'Tegnap, 18:05', unread: false },
]
/** Az admin-értesítések (amit a csengő is mutat): az olvasatlan sárga. */
export function AdminNoticesCard({ rows = SAMPLE_NOTICES, className = '' }: { rows?: BsNotice[]; className?: string }) {
  const unread = rows.filter((r) => r.unread).length
  return (
    <Card pad="sm" className={className}>
      <div className="flex items-center justify-between px-2 pt-2"><CardTitle>Értesítések</CardTitle>{unread > 0 && <Pill tone="yellow" size="sm">{unread} új</Pill>}</div>
      <div className="mt-2">
        {rows.length === 0 && <Meta className="px-3 py-6">Nincs értesítés.</Meta>}
        {rows.map((r) => <ListRow key={r.key} leading={<IconCircle tone={r.unread ? 'yellow' : 'cell'} size="sm" icon={NOTICE_ICON[r.kind]} />} title={<MarqueeText>{r.title}</MarqueeText>} meta={r.meta} />)}
      </div>
    </Card>
  )
}

export const SAMPLE_AUDIT: AuditTableRow[] = [
  { key: '1', time: 'Ma, 10:02', actor: { name: 'Vasadi Dávid', email: 'hello@davelopment.hu', img: '/landing/funkciok/csapat/avatar/dave.webp' }, event: 'Előfizetés', tone: 'warn', title: 'Kék Köröm — próba meghosszabbítva', lines: [{ label: 'Próba vége', from: 'Nov. 13.', to: 'Nov. 17.' }] },
  { key: '2', time: 'Tegnap, 15:40', actor: { name: 'Vasadi Dávid', email: 'hello@davelopment.hu', img: '/landing/funkciok/csapat/avatar/dave.webp' }, event: 'Árazás', tone: 'pending', title: 'Globális árazás', lines: [{ label: 'Étterem — Pro', from: '22 900 Ft', to: '23 800 Ft' }] },
  { key: '3', time: 'Nov. 10., 9:15', actor: { name: 'Rendszer' }, event: 'Üzlet', tone: 'neutral', title: 'Judit Masszázs kikapcsolva', lines: [{ label: 'Ok', text: 'lemondás, időszak vége' }] },
]

/** Napló-kártya: az üzlet Beállítások › Napló táblázata (ugyanaz). */
export function AuditCard({ rows = SAMPLE_AUDIT, className = '' }: { rows?: AuditTableRow[]; className?: string }) {
  return (
    <Card pad="sm" className={className}>
      <div className="px-2 pt-2"><CardTitle>Napló</CardTitle></div>
      <div className="mt-2">{rows.length === 0 ? <Meta className="px-2 py-6">Még nincs naplózott módosítás.</Meta> : <AuditTable rows={rows} />}</div>
    </Card>
  )
}

/* ── Kapcsolat ─────────────────────────────────────────────────────────────── */

export type BsMessage = { key: string; name: string; email: string; phone?: string | null; message: string; when: string; answered: boolean; account?: string | null; accountHref?: string }
export const SAMPLE_MESSAGES: BsMessage[] = [
  { key: 'm1', name: 'Szilágyi Kata', email: 'kata@katasminkstudio.hu', phone: '+36 20 555 1234', message: 'Szia! Két telephelyünk van, a második is benne van a Pro-ban? Most nyitjuk a másodikat Budaörsön, és jó lenne egy helyen látni a kettőt.', when: '20 perce', answered: false },
  { key: 'm2', name: 'Kovács Anna', email: 'anna@annafodraszat.hu', message: 'Hogyan tudom a nyitvatartást karácsonyra külön beállítani?', when: 'Ma, 8:15', answered: false, account: 'Anna Fodrászat' },
  { key: 'm3', name: 'Pintér Zoltán', email: 'zoltan@pinterauto.hu', message: 'Autószervizre is jó a rendszer? Szívesen megnéznék egy bemutatót.', when: 'Tegnap', answered: true },
  { key: 'm4', name: 'Tóth Gábor', email: 'gabor@bistroandrassy.hu', message: 'A novemberi számlára kérném a cég adószámát is.', when: 'Nov. 10.', answered: true, account: 'Bistro Andrássy' },
]

export function MessageTable({ rows = SAMPLE_MESSAGES, openKey = 'm1', onOpen, chips = [['Mind', 24], ['Új', 2], ['Megválaszolva', 22]], active = 0, onChip, query, onQuery, paging = null, empty, className = '' }: {
  rows?: BsMessage[]; openKey?: string | null; onOpen?: (key: string) => void; chips?: [string, number][]; active?: number; onChip?: (i: number) => void
  query?: string; onQuery?: (q: string) => void; paging?: Paging | null; empty?: React.ReactNode; className?: string
}) {
  return (
    <Card pad="sm" className={className}>
      <BsToolbar search="Név, e-mail, szöveg…" chips={chips} active={active} onChip={onChip} query={query} onQuery={onQuery} />
      {rows.length === 0 && empty ? empty : (
        <><MobileRows rows={rows.map((m) => ({ key: m.key, open: m.key === openKey, onClick: onOpen ? () => onOpen(m.key) : undefined, title: <span className={m.answered ? '' : 'font-medium'}>{m.name}</span>, meta: <MarqueeText>{m.message}</MarqueeText>, trailing: m.answered ? <Meta>{m.when}</Meta> : <StatusPill status="pending">Új</StatusPill> }))} />
        <div className="max-lg:hidden"><Table minWidth={640}>
          <thead><tr><Th>Feladó</Th><Th>Üzenet</Th><Th>Mikor</Th><Th>Állapot</Th></tr></thead>
          <tbody>{rows.map((m) => {
            const open = m.key === openKey
            return (
              <Tr key={m.key} state={open ? 'open' : 'default'} onClick={onOpen ? () => onOpen(m.key) : undefined} className={rowCls(open)}>
                <Td><span className={`block ${m.answered ? '' : 'font-medium'}`}>{m.name}</span><span className="block text-ui-label text-ui-muted">{m.account ?? m.email}</span></Td>
                <Td className="max-w-[360px]"><MarqueeText>{m.message}</MarqueeText></Td>
                <Td className="text-ui-muted">{m.when}</Td>
                <Td>{m.answered ? <StatusPill status="neutral">Megválaszolva</StatusPill> : <StatusPill status="pending">Új</StatusPill>}</Td>
              </Tr>
            )
          })}</tbody>
        </Table></div></>
      )}
      {paging && paging.pages > 1 && <Pagination page={paging.page} pages={paging.pages} label={paging.label} onPage={paging.onPage} className="mt-2" />}
    </Card>
  )
}

/** A megnyitott üzenet: elérhetőség, a fiókja (ha ügyfél), a teljes szöveg, válasz e-mailben + megválaszolva jelölés. */
export function MessagePanel({ m = SAMPLE_MESSAGES[0], actions, bare = false, className = '' }: { m?: BsMessage; actions?: React.ReactNode; bare?: boolean; className?: string }) {
  const Box = bare ? 'div' : Panel
  return (
    <Box className={className}>
      <div className="flex items-start justify-between gap-2"><span className="min-w-0"><CardTitle><MarqueeText>{m.name}</MarqueeText></CardTitle><Meta>{m.when}</Meta></span>{m.answered ? <StatusPill status="neutral">Megválaszolva</StatusPill> : <StatusPill status="pending">Új</StatusPill>}</div>
      <div className="mt-4 space-y-1.5 text-ui-body text-ui-text">
        <a href={`mailto:${m.email}`} className="flex items-center gap-2 break-all hover:underline"><Mail className="h-4 w-4 shrink-0 text-ui-muted" />{m.email}</a>
        {m.phone && <a href={`tel:${m.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 hover:underline"><Phone className="h-4 w-4 shrink-0 text-ui-muted" />{m.phone}</a>}
        <span className="flex items-center gap-2"><Building2 className="h-4 w-4 shrink-0 text-ui-muted" />{m.account ? (m.accountHref ? <Link href={m.accountHref} className="hover:underline">{m.account}</Link> : m.account) : <span className="text-ui-muted">Még nincs fiókja</span>}</span>
      </div>
      <Card tone="cell" inner pad="sm" className="mt-4"><div className="whitespace-pre-line text-ui-body leading-relaxed text-ui-text">{m.message}</div></Card>
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {actions ?? <><Button icon={Mail}>Válasz e-mailben</Button><Button variant="cell" icon={Check}>Megválaszolva</Button></>}
      </div>
    </Box>
  )
}

/* ── Körüzenet ─────────────────────────────────────────────────────────────── */

export const BROADCAST_TARGETS = [['all', 'Mindenki', 'Minden szalon és étterem tulajdonosa'], ['paying', 'Csak fizetők', 'Aktív, fizető előfizetéssel'], ['trial', 'Csak próbaidősök', 'Most próbaidőn lévők'], ['custom', 'Egyedi kiválasztás', 'Konkrét fiókok']] as const
export type BroadcastTarget = (typeof BROADCAST_TARGETS)[number][0]

/** Körüzenet írása (a 8.2 szerkesztő-minta): balra a cím, a szöveg és a címzettek; jobbra az előnézet a csengőben és a
 *  sötét összegző, hány fiók kapja. Élőben vezérelt mezők + `picker` (egyedi kiválasztásnál a fiók-kereső). */
export function BroadcastEditor({ who = 1, onWho, counts = [48, 31, 12, 3], title, onTitle, body, onBody, picker, recipients, onSend, onCancel, armed = false, busy = false, className = '' }: {
  who?: number; onWho?: (i: number) => void; counts?: number[]; title?: string; onTitle?: (v: string) => void; body?: string; onBody?: (v: string) => void
  picker?: React.ReactNode; recipients?: number; onSend?: () => void; onCancel?: () => void; armed?: boolean; busy?: boolean; className?: string
}) {
  const live = !!onTitle
  const t = live ? title ?? '' : 'Új: ajándékutalvány saját fotóval'
  const n = recipients ?? counts[who] ?? 0
  return (
    <div className={`grid grid-cols-1 gap-[5px] lg:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0 ${className}`}>
      <Card tone="white" pad="lg">
        <CardTitle>Új körüzenet</CardTitle>
        <Field label="Cím" className="mt-4"><Input placeholder="Pl. Új funkció: ajándékutalványok" value={live ? title : undefined} defaultValue={live ? undefined : t} onChange={live ? (e) => onTitle?.(e.target.value) : undefined} /></Field>
        <Field label="Üzenet" className="mt-3"><Textarea rows={3} placeholder="Rövid, konkrét szöveg — ez jelenik meg a csengőben." value={live ? body : undefined} defaultValue={live ? undefined : 'Mostantól az utalványra a saját fotódat vagy színedet teheted — Beállítások › Utalványok.'} onChange={live ? (e) => onBody?.(e.target.value) : undefined} /></Field>
        <Meta className="mb-1.5 mt-4">Kinek</Meta>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {BROADCAST_TARGETS.map(([, label, d], i) => {
            const card = <OptionCard radio selected={i === who} title={<span className="flex items-center justify-between gap-2">{label}<span className={i === who ? 'text-white/50' : 'text-ui-muted'}>{counts[i]}</span></span>}><Meta className={i === who ? 'text-white/60' : ''}>{d}</Meta></OptionCard>
            return onWho ? <button key={label} type="button" onClick={() => onWho(i)} className="block text-left">{card}</button> : <div key={label}>{card}</div>
          })}
        </div>
        {picker}
        <div className="mt-5 flex justify-end gap-1.5">
          {armed && <Button variant="cell" onClick={onCancel}>Mégse</Button>}
          <Button variant={armed ? 'yellow' : 'dark'} icon={Send} onClick={onSend} loading={busy} disabled={live && (!t.trim() || !body?.trim() || n === 0)}>{armed ? 'Biztos? Kattints még egyszer' : `Küldés ${n} fióknak`}</Button>
        </div>
      </Card>
      <div className="flex flex-col gap-[5px]">
        <Card>
          <Meta className="text-ui-label">Így látják a csengőben</Meta>
          <Panel pad="sm" className="mt-2">
            <ListRow leading={<IconCircle tone="yellow" size="sm" icon={Radio} />} title={<MarqueeText>{t || 'A körüzenet címe'}</MarqueeText>} meta="davelopment booking · most" />
          </Panel>
        </Card>
        <Card tone="dark" className="flex-1">
          <Meta dark>Címzettek</Meta>
          <div className="mt-1 text-ui-num font-light">{n}</div>
          <Meta dark>fiók</Meta>
          <Meta dark className="mt-4 leading-relaxed">A csengőben jelenik meg (és push-értesítésként, ahol bekapcsolták). Küldés után visszavonható.</Meta>
        </Card>
      </div>
    </div>
  )
}

export type BsBroadcastRow = { key: string; date: string; title: string; target: string; delivered: number; opened: number }
const SAMPLE_BROADCASTS: BsBroadcastRow[] = [
  { key: '1', date: 'Nov. 6.', title: 'Megjött a napi összefoglaló', target: 'Mindenki', delivered: 46, opened: 31 },
  { key: '2', date: 'Okt. 21.', title: 'Karácsonyi nyitvatartás — állítsd be időben', target: 'Csak fizetők', delivered: 29, opened: 22 },
  { key: '3', date: 'Okt. 2.', title: 'Új foglalóoldal-szerkesztő', target: 'Mindenki', delivered: 41, opened: 35 },
]
export function BroadcastHistory({ rows = SAMPLE_BROADCASTS, undo, paging = null, className = '' }: { rows?: BsBroadcastRow[]; undo?: (r: BsBroadcastRow) => React.ReactNode; paging?: Paging | null; className?: string }) {
  return (
    <Card pad="sm" className={className}>
      <div className="px-2 pt-2"><CardTitle>Elküldve</CardTitle></div>
      {rows.length === 0 ? <Meta className="px-2 py-6">Még nem küldtél körüzenetet.</Meta> : (
        <><MobileRows className="mt-2" rows={rows.map((r) => ({ key: r.key, title: <MarqueeText>{r.title}</MarqueeText>, meta: `${r.date} · ${r.target} · ${r.opened} / ${r.delivered} megnyitotta`, trailing: undefined }))} />
        <div className="max-lg:hidden"><Table minWidth={640} className="mt-2">
          <thead><tr><Th>Mikor</Th><Th>Cím</Th><Th>Kinek</Th><Th>Megkapta</Th><Th>Megnyitotta</Th><Th /></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.key} className="[&>td]:bg-white"><Td className="text-ui-muted">{r.date}</Td><Td className="max-w-[320px]"><MarqueeText>{r.title}</MarqueeText></Td><Td className="text-ui-muted">{r.target}</Td><Td>{r.delivered}</Td><Td>{r.opened}{r.delivered ? <span className="text-ui-muted"> · {Math.round((r.opened / r.delivered) * 100)}%</span> : null}</Td><Td className="text-right">{undo ? undo(r) : <Button size="sm" variant="cell" icon={Trash2}>Visszavonás</Button>}</Td></Tr>
          ))}</tbody>
        </Table></div></>
      )}
      {paging && paging.pages > 1 && <Pagination page={paging.page} pages={paging.pages} label={paging.label} onPage={paging.onPage} className="mt-2" />}
    </Card>
  )
}

/* ── Ajánlások (Ajánló program +1 hónap · Keress pénzt 10%) ────────────────── */

export type BsReferral = { key: string; referrer: string; referrerHref?: string; invited: string; invitedHref?: string; code: string; date: string; state: 'registered' | 'trial' | 'subscribed'; credited?: string | null }
export const SAMPLE_REFERRALS: BsReferral[] = [
  { key: 'r1', referrer: 'Anna Fodrászat', invited: 'Barber Bros', code: 'ANNA-7K2', date: 'Szept. 1.', state: 'subscribed', credited: 'Okt. 2.' },
  { key: 'r2', referrer: 'Anna Fodrászat', invited: 'Dóra Pilates', code: 'ANNA-7K2', date: 'Nov. 12.', state: 'trial' },
  { key: 'r3', referrer: 'Bistro Andrássy', invited: 'Pizzeria Napoli', code: 'BISTRO-4QF', date: 'Nov. 2.', state: 'trial' },
  { key: 'r4', referrer: 'Barber Bros', invited: 'Kék Köröm', code: 'BARBER-2LM', date: 'Okt. 19.', state: 'subscribed', credited: null },
]
const REF_STATE: Record<BsReferral['state'], { label: string; tone: Status }> = {
  registered: { label: 'Regisztrált', tone: 'neutral' },
  trial: { label: 'Próbán', tone: 'pending' },
  subscribed: { label: 'Előfizetett', tone: 'ok' },
}

/** Ajánló program: ki kit hozott a linkjével, hol tart, és megkapta-e az ajánló a +1 hónapot (magától jár az első
 *  előfizetéskor; ha a jóváírás elakadt, itt kézzel pótolható — élőben a `credit` slot). */
export function ReferralAdminTable({ rows = SAMPLE_REFERRALS, stats = { clicks: 212, registered: 9, months: 4 }, credit, className = '' }: { rows?: BsReferral[]; stats?: { clicks: number; registered: number; months: number }; credit?: (r: BsReferral) => React.ReactNode; className?: string }) {
  const name = (t: string, href?: string) => (href ? <Link href={href} className="hover:underline">{t}</Link> : t)
  return (
    <Card pad="sm" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2">
        <CardTitle>Ajánló program — +1 hónap</CardTitle>
        <span className="flex flex-wrap gap-1.5"><Pill tone="cell" size="sm">{nf(stats.clicks)} link-megnyitás</Pill><Pill tone="cell" size="sm">{stats.registered} regisztráció</Pill><Pill tone="yellow" size="sm">{stats.months} ingyen hónap kiadva</Pill></span>
      </div>
      {rows.length === 0 ? <Meta className="px-2 py-6">Még senki nem regisztrált ajánló linkkel.</Meta> : (
        <><MobileRows className="mt-2" rows={rows.map((r) => ({ key: r.key, title: <MarqueeText>{r.referrer} → {r.invited}</MarqueeText>, meta: <>{r.date} · {r.code} · {r.state !== 'subscribed' ? 'az előfizetéskor jár' : r.credited ? `+1 hónap jóváírva ${r.credited}` : 'a jóváírás elakadt'}</>, trailing: r.state === 'subscribed' && !r.credited && credit ? credit(r) : <StatusPill status={REF_STATE[r.state].tone}>{REF_STATE[r.state].label}</StatusPill> }))} />
        <div className="max-lg:hidden"><Table minWidth={760} className="mt-2">
          <thead><tr><Th>Ajánló</Th><Th>Akit hozott</Th><Th>Kód</Th><Th>Mikor</Th><Th>Hol tart</Th><Th>Ajánló +1 hónap</Th></tr></thead>
          <tbody>{rows.map((r) => (
            <Tr key={r.key} className="[&>td]:bg-white">
              <Td>{name(r.referrer, r.referrerHref)}</Td><Td>{name(r.invited, r.invitedHref)}</Td><Td className="text-ui-muted">{r.code}</Td><Td className="text-ui-muted">{r.date}</Td>
              <Td><StatusPill status={REF_STATE[r.state].tone}>{REF_STATE[r.state].label}</StatusPill></Td>
              <Td>{r.state !== 'subscribed' ? <span className="text-ui-muted">az előfizetéskor jár</span> : r.credited ? <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-ui-ok" />Jóváírva {r.credited}</span> : credit ? credit(r) : <Button size="sm" icon={Gift}>Jóváírás most</Button>}</Td>
            </Tr>
          ))}</tbody>
        </Table></div></>
      )}
      <Meta className="mt-2 px-2 pb-1">A „Jóváírás most” csak akkor látszik, ha az automatikus jóváírás elakadt (pl. az ajánlónak még nem volt fizetős előfizetése).</Meta>
    </Card>
  )
}

/** Ajánlások fejléc-számai (minta). */
export const SAMPLE_REF_KPI = { months: 4, pendingFee: 145_000, paidFee: 89_000 }

/* ── Beállítások (globális árazás) ─────────────────────────────────────────── */

/** Az árazás összegzője: így látszik most az /arak oldalon, és mikor lép életbe a változás. */
export function PricingAside({ salonFrom = 5_900, restaurantFrom = 19_900, trialDays = 30, annualPct = 20 }: { salonFrom?: number; restaurantFrom?: number; trialDays?: number; annualPct?: number }) {
  return (
    <>
      <Card tone="dark">
        <Meta dark>Így látszik az /arak oldalon</Meta>
        <div className="mt-3 space-y-3">
          {([['Szakembereknek', salonFrom], ['Éttermeknek', restaurantFrom]] as const).map(([t, v]) => (
            <div key={t}><Meta dark className="text-ui-label">{t}</Meta><div className="text-ui-num font-light leading-none">{nf(v)}<span className="ml-1 text-ui-meta text-ui-yellow">Ft / hó-tól</span></div></div>
          ))}
        </div>
        <Meta dark className="mt-4">{trialDays} nap ingyen · éves fizetésnél −{annualPct}%</Meta>
      </Card>
      <Card>
        <CardTitle>Mikor érvényes</CardTitle>
        <Meta className="mt-2 leading-relaxed">Azonnal az /arak oldalon és az új előfizetéseken. A már fizető ügyfelek a mostani időszakuk végéig a régi áron maradnak, a megújuláskor lépnek át.</Meta>
      </Card>
    </>
  )
}

export type PricingKey = 'salon_starter_huf' | 'salon_pro_huf' | 'salon_extra_staff_huf' | 'restaurant_starter_huf' | 'restaurant_pro_huf' | 'annual_discount_pct' | 'trial_days' | 'starter_email_cap' | 'pro_email_cap' | 'egyedi_email_cap'
/** Az árazás csoportjai: [mező, címke, minta-érték, mértékegység, magyarázat]. */
export const PRICING_ROWS: { group: string; icon: typeof Scissors; rows: [PricingKey, string, string, string, string][] }[] = [
  { group: 'Szalon (szakemberek)', icon: Scissors, rows: [['salon_starter_huf', 'Starter havidíj', '5 900', 'Ft / hó', 'Egy naptár, az alapfunkciók.'], ['salon_pro_huf', 'Pro havidíj', '9 800', 'Ft / hó', 'Az első munkatárssal együtt.'], ['salon_extra_staff_huf', 'Extra munkatárs', '1 900', 'Ft / fő', 'A Pro-ban minden további munkatárs.']] },
  { group: 'Étterem', icon: UtensilsCrossed, rows: [['restaurant_starter_huf', 'Starter havidíj', '19 900', 'Ft / hó', 'Fix havidíj.'], ['restaurant_pro_huf', 'Pro havidíj', '23 800', 'Ft / hó', 'Fix havidíj.']] },
  { group: 'Kedvezmény és próba', icon: Clock, rows: [['annual_discount_pct', 'Éves kedvezmény', '20', '%', 'Éves fizetésnél ennyivel olcsóbb.'], ['trial_days', 'Próbaidő', '30', 'nap', 'Új regisztrációknál, kártya nélkül.']] },
  { group: 'Hírlevél-keret (a csomagban)', icon: Mail, rows: [['starter_email_cap', 'Starter', '500', 'e-mail / hó', ''], ['pro_email_cap', 'Pro', '5 000', 'e-mail / hó', ''], ['egyedi_email_cap', 'Egyedi', '50 000', 'e-mail / hó', '']] },
]

/** Árazás-sor: címke + magyarázat balra; jobbra a mező a sor szélén, előtte a mértékegység. */
export function PriceRow({ label, value, unit, hint, onChange }: { label: string; value: string; unit: string; hint?: string; onChange?: (v: string) => void }) {
  return (
    <FieldRow label={label} hint={hint || undefined}>
      <span className="flex items-center gap-2"><span className="text-ui-meta text-ui-muted">{unit}</span><Input hug inputMode="numeric" className="text-right" value={onChange ? value : undefined} defaultValue={onChange ? undefined : value} onChange={onChange ? (e) => onChange(e.target.value.replace(/[^\d]/g, '')) : undefined} /></span>
    </FieldRow>
  )
}
