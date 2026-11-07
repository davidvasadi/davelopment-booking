import { Banknote, Check, CreditCard, Download, Gift, Landmark, Link2, Mail, MoreHorizontal, Plus, TicketCheck, Wallet, X, ArrowUpRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button, Card, CardTitle, Field, FieldRow, IconButton, IconCircle, Input, ListRow, Meta, Note, OptionCard, Pagination, Panel, Pill, RowCheck, StatusPill, Table, Td, Textarea, Th, Tr, type Status, MarqueeText } from '@/components/ui-kit'
import { MockSwitch as DesignSwitch } from './MockSwitch'
import { Switch } from '@/components/ui/toggle-switch'
import { VCODE, VoucherCard, type VoucherBiz } from './money'

/* Utalványok (design 12.1–12.9) — az élő oldal (VouchersView) és a /design ugyanezeket rendereli: props nélkül
   mintaadattal, élőben a valós adattal és kezelőkkel. Hook nincs benne, így a szerveres design oldal is használhatja. */

/** Fizetési mód: rövid név + ikon (a táblázatban, a részletben, a szűrőben). */
export const PAY: Record<string, { short: string; icon: LucideIcon }> = {
  online: { short: 'Kártya · online', icon: CreditCard },
  payment_link: { short: 'Kártya · link', icon: Link2 },
  pos_card: { short: 'Kártya · helyben', icon: CreditCard },
  cash: { short: 'Készpénz', icon: Banknote },
  transfer: { short: 'Átutalás', icon: Landmark },
  other: { short: 'Egyéb', icon: Wallet },
}
export type VoucherStatus = 'pending' | 'active' | 'redeemed' | 'expired' | 'refunded'
export const V_STATUS: Record<VoucherStatus, { label: string; pill: Status }> = {
  pending: { label: 'Függőben', pill: 'pending' }, active: { label: 'Aktív', pill: 'ok' }, redeemed: { label: 'Beváltva', pill: 'neutral' },
  expired: { label: 'Lejárt', pill: 'bad' }, refunded: { label: 'Visszatérítve', pill: 'bad' },
}

export const PayCell = ({ pay }: { pay: string }) => {
  const p = PAY[pay] ?? PAY.other
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><IconCircle tone="glass" size="sm" icon={p.icon} />{p.short}</span>
}

/* ── 12.1: a lista ── */

export type VoucherTableRow = { key: string; code: string | null; type: string; buyer: string; by: string; amount: string; pay: string; expires: string; status: VoucherStatus }
const SAMPLE_ROWS: VoucherTableRow[] = [
  { key: 'p', code: null, buyer: 'Szabó Petra', by: 'fizetési link · Nov. 9. 18:00-ig', type: 'Ajándék 30', amount: '30 000', pay: 'payment_link', expires: '—', status: 'pending' },
  { key: 'a', code: '7K2Q-M9XP', buyer: 'Kovács Anna', by: 'Kiállította: Szabina', type: 'Ajándék 20', amount: '20 000', pay: 'online', expires: '2027. Márc. 31.', status: 'active' },
  { key: 'b', code: '3M9X-T4BV', buyer: 'Tóth Bence', by: 'Kiállította: Dávid', type: 'Ajándék 10', amount: '10 000', pay: 'cash', expires: '2027. Jan. 15.', status: 'redeemed' },
  { key: 'c', code: '9P4L-K2WD', buyer: 'Gál Zsófia', by: 'foglalóoldalon', type: 'Ajándék 30', amount: '30 000', pay: 'transfer', expires: '2026. Okt. 1.', status: 'expired' },
  { key: 'd', code: '5H7R-Q2NC', buyer: 'Varga Lilla', by: 'Kiállította: Szabina', type: 'Balayage-utalvány', amount: '48 000', pay: 'pos_card', expires: '2027. Máj. 2.', status: 'refunded' },
]

/** 12.1: a táblázat — a kód alatt a típus, a vásárló alatt ki állította ki, az összeg előtt a fizetés ikonja; a függő sorban a
 *  link másolása. A megnyitott sor sárga, a kijelölt fehér. */
export function VoucherTable({ more, rows = SAMPLE_ROWS, openKey = 'a', selected = [], onOpen, onToggle, onToggleAll, onCopyLink, page = 1, pages = 13, label = '1–5 / 64', onPage, empty, fill = false, th, className = '' }: { /** görgetésre töltés a görgetett tábla végén (LoadMoreSentinel) */ more?: React.ReactNode;
  rows?: VoucherTableRow[]
  openKey?: string | null
  selected?: string[]
  onOpen?: (key: string) => void
  onToggle?: (key: string) => void
  onToggleAll?: () => void
  onCopyLink?: (key: string) => void
  page?: number
  pages?: number
  label?: string
  onPage?: (p: number) => void
  empty?: React.ReactNode
  /** a befoglaló magasságát tölti ki (élőben a mellette lévő részlet magassága): a sorok benne görgetnek */
  fill?: boolean
  /** rendezés az oszlopcímre kattintva (`lib/tableSort` `th`) */
  th?: (key: string) => { sort: 'asc' | 'desc' | null; onSort: () => void }
  className?: string
}) {
  const selectable = rows.filter((r) => r.status !== 'pending')
  const all = selectable.length > 0 && selectable.every((r) => selected.includes(r.key))
  return (
    <Card pad="sm" className={`flex flex-col overflow-x-auto ${fill ? 'h-full' : ''} ${className}`}>
      {rows.length === 0 && empty ? empty : (
        <Table minWidth={560} className={fill ? 'min-h-0 flex-1 overflow-y-auto' : undefined}>
          <thead><tr><Th className="w-8 pr-0"><RowCheck checked={all} onToggle={onToggleAll} label="Mind kijelölése" /></Th>{([['code', 'Kód · típus'], ['buyer', 'Vásárló'], ['amount', 'Összeg'], ['expires', 'Lejár'], ['status', 'Állapot']] as const).map(([k, h]) => <Th key={k} {...th?.(k)}>{h}</Th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const on = r.key === openKey || selected.includes(r.key)
              return (
                // mint a Munkatársak listája: fehér kártya-sorok, a megnyitott és a kijelölt sárga, hoverre halványodik
                <Tr key={r.key} onClick={onOpen ? () => onOpen(r.key) : undefined} className={on ? '[&>td]:bg-ui-yellow [&:hover>td]:bg-ui-yellow/80' : '[&>td]:bg-white [&:hover>td]:bg-white/60'}>
                  <Td className="w-8 pr-0">{r.status === 'pending' ? <span className="block h-6 w-6" /> : <RowCheck checked={selected.includes(r.key)} onToggle={onToggle ? () => onToggle(r.key) : undefined} />}</Td>
                  <Td><span className="block font-mono text-ui-meta">{r.code ?? 'Fizetésre vár'}</span><span className="block text-ui-label text-ui-muted">{r.type}</span></Td>
                  <Td><span className="block">{r.buyer}</span><span className="block text-ui-label text-ui-muted">{r.by}</span></Td>
                  <Td><span className="flex items-center gap-2"><span title={(PAY[r.pay] ?? PAY.other).short}><IconCircle tone={on ? 'white' : 'cell'} size="sm" icon={(PAY[r.pay] ?? PAY.other).icon} /></span>{r.amount} Ft</span></Td>
                  <Td>{r.expires}</Td>
                  <Td>{r.status === 'pending'
                    ? <span className="flex items-center gap-1"><StatusPill status={V_STATUS[r.status].pill}>{V_STATUS[r.status].label}</StatusPill><span onClick={(e) => e.stopPropagation()}><IconButton icon={Link2} label="Link másolása" variant="ghost" size="sm" onClick={onCopyLink ? () => onCopyLink(r.key) : undefined} /></span></span>
                    : <StatusPill status={V_STATUS[r.status].pill}>{V_STATUS[r.status].label}</StatusPill>}</Td>
                </Tr>
              )
            })}
            {more && <Tr><Td colSpan={10} className="p-0">{more}</Td></Tr>}
          </tbody>
        </Table>
      )}
      {/* kitöltő módban mindig ott a lapozó a kártya alján (egy oldalnál is), így nincs üres légrés a sorok alatt */}
      {(pages > 1 || fill) && <Pagination page={page} pages={pages} label={label} onPage={onPage} className="mt-auto px-2 pt-3" />}
    </Card>
  )
}

/* ── 12.1 jobb oszlop / 12.8 lap: a kijelölt utalvány ── */

export type VoucherDetailVM = {
  amount: string; code: string; to: string | null; expires: string; status: VoucherStatus; bg: 'dark' | 'yellow' | 'photo'; photo: string | null
  rows: [string, React.ReactNode][]
}
const SAMPLE_DETAIL: VoucherDetailVM = {
  amount: '20 000 Ft', code: VCODE, to: 'Lili', expires: '2027. Márc. 31.', status: 'active', bg: 'dark', photo: null,
  rows: [['Típus', 'Ajándék 20'], ['Vásárló', 'Kovács Anna'], ['Megajándékozott', 'Kovács Lili'], ['Fizetés', <PayCell key="p" pay="online" />], ['Kiállította', 'Szabina · Szept. 2.'], ['Lejár', '2027. Márc. 31.']],
}

/** Az utalvány maga, adatai, Beváltás, PDF, és a ⋯ alatt az állapot módosítása és törlés (élőben `menu`: a lenyíló). */
export function VoucherDetail({ v = SAMPLE_DETAIL, restaurant = false, biz, onRedeem, pdfHref, onMenu, menu, extra, className = '' }: {
  v?: VoucherDetailVM
  restaurant?: boolean
  biz?: VoucherBiz
  onRedeem?: () => void
  pdfHref?: string | null
  onMenu?: () => void
  /** a ⋯ alatt nyíló menü (élőben) */
  menu?: React.ReactNode
  /** a részletek alatt (pl. számla, üzenet) */
  extra?: React.ReactNode
  className?: string
}) {
  const live = !!onMenu
  return (
    <div className={className}>
      <VoucherCard to={v.to ?? undefined} amount={v.amount} code={v.code} expires={v.expires} bg={v.bg} photo={v.photo} restaurant={restaurant} biz={biz} />
      <Card className="mt-[5px]">
        <div className="flex items-center justify-between"><CardTitle>Részletek</CardTitle><StatusPill status={V_STATUS[v.status].pill}>{V_STATUS[v.status].label}</StatusPill></div>
        <div className="mt-2">
          {v.rows.map(([k, val]) => <FieldRow key={k} label={k}><MarqueeText className="text-right text-ui-body text-ui-text">{val}</MarqueeText></FieldRow>)}
        </div>
        {extra}
        <div className="relative mt-3 flex gap-1.5">
          <Button className="flex-1" icon={TicketCheck} onClick={onRedeem} disabled={live && (!onRedeem || v.status !== 'active')}>Beváltás</Button>
          <IconButton icon={Download} label="PDF letöltése" variant="cell" href={pdfHref ?? undefined} download disabled={live && !pdfHref} />
          <IconButton icon={MoreHorizontal} label="Állapot módosítása, törlés" variant="cell" onClick={onMenu} />
          {menu}
        </div>
      </Card>
    </div>
  )
}

/* ── 12.8: mobil lista ── */

export function VoucherMobileList({ rows = SAMPLE_ROWS, openKey = 'a', onOpen, className = '' }: { rows?: VoucherTableRow[]; openKey?: string | null; onOpen?: (key: string) => void; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      {rows.map((r) => {
        const row = <ListRow filled open={r.key === openKey} title={r.buyer} meta={`${r.code ?? 'Fizetésre vár'} · ${r.type}`} trailing={<span className="flex flex-col items-end gap-1"><span className="text-ui-body text-ui-text">{r.amount} Ft</span><StatusPill status={V_STATUS[r.status].pill}>{V_STATUS[r.status].label}</StatusPill></span>} />
        return onOpen ? <button key={r.key} type="button" onClick={() => onOpen(r.key)} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button> : <div key={r.key}>{row}</div>
      })}
    </div>
  )
}

/* ── 12.7: beváltás ── */

/** Kamera-kép keretezéssel (élőben `camera`: a valódi QR-olvasó), alatta kézi kód. */
export function VoucherScan({ camera, code = '', onCode, onSearch, busy = false }: { camera?: React.ReactNode; code?: string; onCode?: (v: string) => void; onSearch?: () => void; busy?: boolean }) {
  return (
    <>
      {camera ?? (
        <div className="relative flex h-[220px] items-center justify-center overflow-hidden rounded-ui-inner bg-ui-dark">
          <span className="h-[140px] w-[140px] rounded-ui-inner border-2 border-dashed border-ui-yellow" />
          <span className="absolute bottom-3 text-ui-meta text-white/60">Tartsd a QR-kódot a keretbe</span>
        </div>
      )}
      <div className="mt-4 flex items-end gap-1.5">
        <Field label="Vagy kézzel" className="min-w-0 flex-1"><Input placeholder="XXXX-XXXX" className="font-mono uppercase" value={code} readOnly={!onCode} onChange={(e) => onCode?.(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === 'Enter') onSearch?.() }} /></Field>
        <Button variant="cell" onClick={onSearch} loading={busy}>Keresés</Button>
      </div>
    </>
  )
}

/** A megtalált utalvány: állapot, kód, kártya, adatok és Beváltom — lejárt / beváltott kódnál piros jelzés, gomb nélkül. */
export function VoucherFound({ status = 'active', code = VCODE, amount = '20 000 Ft', bg = 'yellow', photo = null, rows = [['Típus', 'Ajándék 20'], ['Megajándékozott', 'Kovács Lili'], ['Lejár', '2027. Márc. 31.']], note, onRedeem, busy = false, restaurant = false, biz, bare = false }: {
  status?: VoucherStatus; code?: string; amount?: string; bg?: 'dark' | 'yellow' | 'photo'; photo?: string | null; rows?: [string, string][]; note?: string
  onRedeem?: () => void; busy?: boolean; restaurant?: boolean; biz?: VoucherBiz
  /** egy ablakon belül: saját keret nélkül (különben kártya a kártyában) */
  bare?: boolean
}) {
  const ok = status === 'active'
  const Wrap = bare ? 'div' : Panel
  return (
    <Wrap>
      <div className="flex items-center justify-between"><StatusPill status={ok ? 'ok' : 'bad'}>{ok ? 'Érvényes' : status === 'redeemed' ? 'Már beváltva' : V_STATUS[status].label}</StatusPill><Meta className="font-mono">{code}</Meta></div>
      {ok ? <>
        <div className="mt-3"><VoucherCard small amount={amount} bg={bg} photo={photo} restaurant={restaurant} biz={biz} /></div>
        <div className="mt-3">{rows.map(([k, v]) => <FieldRow key={k} label={k}><span className="text-ui-body text-ui-text">{v}</span></FieldRow>)}</div>
        <Button className="mt-3 w-full" icon={Check} onClick={onRedeem} loading={busy}>Beváltom</Button>
      </> : note && <Meta className="mt-2">{note}</Meta>}
    </Wrap>
  )
}

/* ── 12.3: típusok ── */

export type VoucherTypeRow = { id: string; name: string; amount: string; meta: string; active: boolean }
const SAMPLE_TYPES: VoucherTypeRow[] = [['Ajándék 10', '10 000 Ft', '12 eladva', true], ['Ajándék 20', '20 000 Ft', '31 eladva', true], ['Ajándék 30', '30 000 Ft', '15 eladva', true], ['Balayage-utalvány', '48 000 Ft', 'inaktív', false]].map(([n, v, m, a], i) => ({ id: String(i), name: n as string, amount: v as string, meta: m as string, active: a as boolean }))

/** A típusok listája (a megnyitott sárga, az inaktív halvány), fent az Új típus. */
export function VoucherTypeList({ types = SAMPLE_TYPES, openId = '1', onOpen, onNew, bare = false, className = '' }: { types?: VoucherTypeRow[]; openId?: string | null; onOpen?: (id: string) => void; onNew?: () => void; bare?: boolean; className?: string }) {
  const list = (
    <div className="space-y-1">
      {types.length === 0 && <Meta className="px-3 py-4">Még nincs típus.</Meta>}
      {types.map((t) => {
        const row = <ListRow filled open={t.id === openId} className={t.active ? '' : 'opacity-55'} leading={<Gift className="h-4 w-4 shrink-0 text-ui-muted" />} title={t.name} meta={t.meta} trailing={<Pill tone={t.id === openId ? 'white' : 'cell'} size="sm">{t.amount}</Pill>} />
        return onOpen ? <button key={t.id} type="button" onClick={() => onOpen(t.id)} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button> : <div key={t.id}>{row}</div>
      })}
    </div>
  )
  if (bare) return list
  return (
    <Card pad="sm" className={className}>
      <div className="flex items-center justify-between px-3 pb-2 pt-1"><CardTitle>Utalvány-típusok</CardTitle><Button variant="yellow" size="sm" icon={Plus} onClick={onNew}>Új típus</Button></div>
      {list}
    </Card>
  )
}

export type VoucherTypeValue = { name: string; amount: string; description: string; active: boolean; image: string | null }
const SAMPLE_TYPE: VoucherTypeValue = { name: 'Ajándék 20', amount: '20 000', description: 'Bármely szolgáltatásra beváltható, 6 hónapig érvényes.', active: true, image: null }

/** A kijelölt típus: fent az utalvány előnézete és a háttere, alatta név, összeg, leírás és hogy megvásárolható-e. */
export function VoucherTypeEditor({ value = SAMPLE_TYPE, onChange, top, background, onSave, onCancel, onDelete, busy = false, restaurant = false, biz, textOnly = false, bare = false, className = '' }: {
  value?: VoucherTypeValue
  onChange?: (v: VoucherTypeValue) => void
  /** a mezők fölött (élőben a nyelvváltó) */
  top?: React.ReactNode
  /** a háttér-választó (élőben a kép feltöltése) */
  background?: React.ReactNode
  onSave?: () => void
  onCancel?: () => void
  onDelete?: () => void
  busy?: boolean
  restaurant?: boolean
  biz?: VoucherBiz
  /** idegen nyelven csak a név és a leírás */
  textOnly?: boolean
  bare?: boolean
  className?: string
}) {
  const live = !!onChange
  const set = (p: Partial<VoucherTypeValue>) => onChange?.({ ...value, ...p })
  const amountLabel = `${(Number(value.amount.replace(/\D/g, '')) || 0).toLocaleString('hu-HU')} Ft`
  const body = (
    <>
      {top}
      <div className={`${top ? 'mt-3' : ''} space-y-4`}>
        {!textOnly && <VoucherCard amount={amountLabel} bg={value.image ? 'photo' : 'dark'} photo={value.image} restaurant={restaurant} biz={biz} />}
        {!textOnly && (background ?? (
          <div className="flex items-center justify-between gap-2 rounded-ui-control bg-ui-cell px-4 py-3" /* ui-allow: háttér-választó sor */>
            <span className="text-ui-body text-ui-muted">Háttér</span>
            <span className="flex items-center gap-1.5">
              <span title="Sötét" className="h-9 w-9 rounded-full bg-ui-dark ring-2 ring-ui-dark ring-offset-2 ring-offset-ui-cell" />
              <span title="Sárga" className="h-9 w-9 rounded-full bg-ui-yellow" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img title="A szalon fotója" src="/videos/szalon-foglalas-hatter-poster.jpg" alt="" className="h-9 w-9 rounded-full object-cover" />
              <span title="Saját kép" /* ui-allow: szaggatott „új” hely */ className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-ui-dark/30 text-ui-muted"><Plus className="h-4 w-4" /></span>
            </span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Név" className={textOnly ? 'col-span-2' : ''}><Input value={value.name} readOnly={!live} onChange={(e) => set({ name: e.target.value })} placeholder="Ajándék 20" /></Field>
          {!textOnly && <Field label="Összeg (Ft)"><Input inputMode="numeric" value={live ? (Number(value.amount.replace(/\D/g, '')) || '').toLocaleString('hu-HU') : value.amount} readOnly={!live} onChange={(e) => set({ amount: e.target.value.replace(/\D/g, '') })} placeholder="20 000" /></Field>}
        </div>
        <Field label="Leírás"><Textarea value={value.description} readOnly={!live} onChange={(e) => set({ description: e.target.value })} className="min-h-[72px]" placeholder="Mire váltható be, meddig érvényes" /></Field>
        {!textOnly && <FieldRow boxed label="Megvásárolható" hint="Kikapcsolva nem jelenik meg a foglalóoldalon.">{live ? <Switch checked={value.active} onChange={(on) => set({ active: on })} ariaLabel="Megvásárolható" /> : <DesignSwitch defaultOn={value.active} />}</FieldRow>}
      </div>
      <div className="mt-5 flex justify-end gap-1.5">
        {onDelete && <Button variant="bad" className="mr-auto" onClick={onDelete} disabled={busy}>Törlés</Button>}
        <Button variant="cell" onClick={onCancel}>Mégse</Button>
        <Button onClick={onSave} loading={busy}>Mentés</Button>
      </div>
    </>
  )
  if (bare) return <div className={`p-6 ${className}`}>{body}</div>
  return (
    <Panel className={className}>
      <div className="flex items-center justify-between"><CardTitle>{value.name || 'Új típus'}</CardTitle><IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onCancel} /></div>
      <div className="mt-4">{body}</div>
    </Panel>
  )
}

/* ── 12.5 / 12.6: új utalvány lépései ── */

export type WizType = { id: string; name: string; amount: string; image: string | null }
const SAMPLE_WIZ_TYPES: WizType[] = [['10 000 Ft', 'Ajándék 10'], ['20 000 Ft', 'Ajándék 20'], ['30 000 Ft', 'Ajándék 30'], ['48 000 Ft', 'Balayage-utalvány']].map(([a, n], i) => ({ id: String(i), name: n, amount: a, image: null }))

/** 1. Típus: az aktív típusok a saját kártya-stílusukkal, a kiválasztott körvonalas. */
export function WizTypeStep({ types = SAMPLE_WIZ_TYPES, selected = '1', onSelect, restaurant = false, biz }: { types?: WizType[]; selected?: string | null; onSelect?: (id: string) => void; restaurant?: boolean; biz?: VoucherBiz }) {
  if (!types.length) return <Note warn>Még nincs megvásárolható típus — előbb hozz létre egyet (Típusok kezelése).</Note>
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {types.map((t) => {
        const card = <><VoucherCard small amount={t.amount} bg={t.image ? 'photo' : 'dark'} photo={t.image} selected={t.id === selected} restaurant={restaurant} biz={biz} /><Meta className="mt-1.5 px-1">{t.name}</Meta></>
        return onSelect ? <button key={t.id} type="button" onClick={() => onSelect(t.id)} className="block rounded-ui-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{card}</button> : <div key={t.id}>{card}</div>
      })}
    </div>
  )
}

export type WizBuyer = { name: string; email: string; city: string; address: string; company: boolean; tax: string; toName: string; toEmail: string; message: string }
const SAMPLE_BUYER: WizBuyer = { name: 'Kovács Anna', email: 'anna.kovacs@gmail.com', city: '1061 Budapest', address: 'Andrássy út 20.', company: false, tax: '', toName: 'Kovács Lili', toEmail: '', message: 'Boldog születésnapot!' }

/** 2. Vásárló: név, e-mail, település + cím (számla), céges vásárlásnál adószám; a megajándékozott és az üzenet.
 *  `errors`: mezőnkénti hiba; `suggest`: a vendég-javaslatok (élőben) a mező alatt. */
export function WizBuyerStep({ value = SAMPLE_BUYER, onChange, errors = {}, suggest }: { value?: WizBuyer; onChange?: (v: WizBuyer, field: keyof WizBuyer) => void; errors?: Partial<Record<keyof WizBuyer, string>>; suggest?: (field: keyof WizBuyer) => React.ReactNode }) {
  const live = !!onChange
  const f = (k: keyof WizBuyer, label: string, opts: { type?: string; placeholder?: string; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint} error={errors[k]}>
      <span className="relative block">
        <Input type={opts.type} value={String(value[k])} readOnly={!live} placeholder={opts.placeholder} autoComplete="off" onChange={(e) => onChange?.({ ...value, [k]: e.target.value }, k)} />
        {suggest?.(k)}
      </span>
    </Field>
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {f('name', value.company ? 'Cégnév' : 'Név')}
        {f('email', 'E-mail', { type: 'email', hint: 'Ide megy a számla.' })}
        {f('city', 'Település', { placeholder: 'Irányítószám, város' })}
        {f('address', 'Cím', { placeholder: 'Utca, házszám' })}
      </div>
      <FieldRow boxed label="Céges vásárlás" hint="Adószámos számla — a Név mezőbe a cég neve kerül.">{live ? <Switch checked={value.company} onChange={(on) => onChange!({ ...value, company: on }, 'company')} ariaLabel="Céges vásárlás" /> : <DesignSwitch defaultOn={value.company} />}</FieldRow>
      {value.company && f('tax', 'Adószám', { placeholder: '12345678-1-42' })}
      <div className="border-t border-dashed border-ui-divider pt-4">
        <Meta className="mb-3">Megajándékozott — ha megadod, neki is elküldjük</Meta>
        <div className="grid gap-3 sm:grid-cols-2">
          {f('toName', 'Név')}
          {f('toEmail', 'E-mail', { type: 'email', placeholder: 'opcionális' })}
        </div>
        <Field label="Üzenet" className="mt-3"><Input value={value.message} readOnly={!live} onChange={(e) => onChange?.({ ...value, message: e.target.value }, 'message')} placeholder="Pl. Boldog születésnapot!" /></Field>
      </div>
    </div>
  )
}

export type PayChoice = 'cash' | 'pos_card' | 'transfer' | 'link'
const PAY_CHOICES: [PayChoice, LucideIcon, string, string?][] = [['cash', Banknote, 'Készpénz'], ['pos_card', CreditCard, 'Bankkártya (helyben)'], ['transfer', Landmark, 'Átutalás'], ['link', Link2, 'Stripe fizetési link', 'A vendég a saját eszközén fizet kártyával']]

/** 3. Fizetés: fent a Stripe és a számlázó állapota, alatta a helyi módok és a fizetési link (Stripe nélkül nem választható). */
export function WizPayStep({ stripe = true, invoicing = { ok: true, label: 'Összekötve' }, selected = 'pos_card', onSelect, settingsHref }: { stripe?: boolean; invoicing?: { ok: boolean; label: string; hint?: string } | null; selected?: PayChoice | null; onSelect?: (p: PayChoice) => void; settingsHref?: string }) {
  return (
    <>
      <FieldRow boxed label="Stripe" hint="kártyás fizetés és fizetési link"><StatusPill status={stripe ? 'ok' : 'pending'}>{stripe ? 'Összekötve' : 'Nincs összekötve'}</StatusPill></FieldRow>
      <FieldRow boxed label="Számlázó" hint={invoicing?.hint ?? 'automatikus számla fizetés után'}>{invoicing ? <StatusPill status={invoicing.ok ? 'ok' : 'pending'}>{invoicing.label}</StatusPill> : <Meta>Ellenőrzés…</Meta>}</FieldRow>
      <div className="mt-3 space-y-1">
        {PAY_CHOICES.map(([k, Icon, title, desc]) => {
          const off = k === 'link' && !stripe
          const card = <OptionCard radio icon={Icon} title={title} selected={selected === k} className={off ? 'opacity-55' : ''}>{off ? 'Előbb kösd össze a Stripe-ot' : desc}</OptionCard>
          return onSelect ? <button key={k} type="button" disabled={off} onClick={() => onSelect(k)} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-not-allowed">{card}</button> : <div key={k}>{card}</div>
        })}
      </div>
      {!stripe && <>
        <Note warn className="mt-3">Fizetési linkhez és online kártyás fizetéshez Stripe kell.</Note>
        <Button variant="cell" size="sm" className="mt-3" icon={ArrowUpRight} href={settingsHref}>Beállítások › Fizetés & számlázás</Button>
      </>}
    </>
  )
}

/** 4. Ellenőrzés: összegzés, itt kapcsolható a számla (a számlázó állapotával). */
export function WizConfirmStep({ rows = [['Utalvány', 'Ajándék 20 · 20 000 Ft'], ['Vásárló', 'Kovács Anna'], ['Megajándékozott', 'Kovács Lili'], ['Fizetés', 'Bankkártya, helyben']], invoice = true, onInvoice, invoiceHint = 'Számlázz.hu · e-mailben megy ki', invoiceDisabled = false }: { rows?: [string, React.ReactNode][]; invoice?: boolean; onInvoice?: (on: boolean) => void; invoiceHint?: string; invoiceDisabled?: boolean }) {
  return (
    <div>
      {rows.map(([k, v]) => <FieldRow key={k} label={k}><MarqueeText className="text-right text-ui-body text-ui-text">{v}</MarqueeText></FieldRow>)}
      <FieldRow label="Számla" hint={invoiceHint}>{onInvoice ? <Switch checked={invoice} disabled={invoiceDisabled} onChange={onInvoice} ariaLabel="Számla" /> : <DesignSwitch defaultOn={invoice} />}</FieldRow>
    </div>
  )
}

/** Kész: a kiállított utalvány, a számla állapota, e-mail és PDF. */
export function WizDone({ card, invoice = 'Számlázz.hu · SZ-2026-0412', sentTo, onDone }: { card?: React.ReactNode; invoice?: string | null; sentTo?: string; onDone?: () => void }) {
  return (
    <>
      <StatusPill status="ok">Utalvány kiállítva</StatusPill>
      <div className="mt-4">{card ?? <VoucherCard to="Lili" />}</div>
      {invoice && <FieldRow label="Számla" hint={invoice}><StatusPill status="ok">Kiállítva</StatusPill></FieldRow>}
      {sentTo && <Meta className="mt-2 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />E-mailben elküldve: {sentTo}</Meta>}
      <Button className="mt-4 w-full" onClick={onDone}>Kész</Button>
    </>
  )
}

/** Fizetési link kész: a link másolása, e-mail küldése, visszavonás; amíg a vendég nem fizet, várakozik. */
export function WizLink({ url = 'checkout.stripe.com/c/pay/cs_live_a1B2', name = 'Kovács Annának', onCopy, onEmail, emailSent = false, emailing = false, onCancel, cancelling = false }: { url?: string; name?: string; onCopy?: () => void; onEmail?: () => void; emailSent?: boolean; emailing?: boolean; onCancel?: () => void; cancelling?: boolean }) {
  return (
    <>
      <StatusPill status="pending">Fizetésre vár</StatusPill>
      <div className="mt-3 text-ui-title text-ui-text">Stripe fizetési link kész</div>
      <Meta className="mt-1">Küldd el {name}. Sikeres fizetés után jön létre a kód, és e-mailben megy ki az utalvány és a számla.</Meta>
      <div className="mt-4 flex items-center gap-1.5"><Input value={url} readOnly className="min-w-0 flex-1" /><IconButton icon={Link2} label="Link másolása" variant="yellow" onClick={onCopy} /></div>
      <div className="mt-4 flex gap-1.5"><Button className="flex-1" icon={emailSent ? Check : Mail} onClick={onEmail} loading={emailing} disabled={emailSent}>{emailSent ? 'Elküldve' : 'E-mailben küldöm'}</Button><Button variant="bad" onClick={onCancel} loading={cancelling}>Link visszavonása</Button></div>
    </>
  )
}
