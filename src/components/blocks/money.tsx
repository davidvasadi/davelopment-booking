import { SHEET_ROW } from './assets'
import { QrSvg } from './qr'
import QRCode from 'qrcode'
import { vtxt } from '@/lib/voucherText'
import { vatFromTaxNumber } from '@/lib/vatFromTaxNumber'
import { DarkLineChart } from './charts'
import { BIZ_LOGO, PoweredBy } from './brand'
import type { VoucherDesign } from '@/lib/voucherDesign'
import { MockSwitch as DesignSwitch } from './MockSwitch'
import { BulkDock, GuestSees, StaffBulkBar } from './team'
import { SaveBar, SettingsGroup, SettingsPage } from './settings'
import { Switch } from '@/components/ui/toggle-switch'
import { ArrowUpRight, QrCode, Banknote, CalendarDays, Check, CreditCard, Download, ExternalLink, FileText, Gift, HandCoins, Landmark, Link2, Mail, Plus, Receipt, Send, Wallet, Copy, X } from 'lucide-react'
import { Button, Card, CardTitle, FieldRow, IconButton, IconCircle, Input, ListRow, Meta, Modal, OptionCard, Pill, Note, SearchField, RowCheck, Segmented, Select, StatusPill, Table, Td, Th, Tr, MarqueeText } from '@/components/ui-kit'

/* Az élő rendszer három része a design kit nyelvén (a /design 16.7.1, 16.7.2, 16.11 és 7.5 ezeket mutatja,
 * a landing is innen veszi): Kiállított számlák (IssuedInvoicesTable), a számla popupja, a foglalóoldal QR-kódja
 * (BusinessQrCard) és az Export (új funkció — javaslat). Csak megjelenítés, minta-adattal. */

type Inv = { no: string; item: string; who: string; email: string; date: string; sum: string; st: 'issued' | 'failed' | 'skipped' | 'register'; pay: string }
const INVOICES: Inv[] = [
  { no: 'FB-2026-0413', item: 'Szolgáltatás · Balayage + vágás (végszámla)', who: 'Juhász és Társa Bt.', email: 'hanna.juhasz@gmail.com', date: '2026. Nov. 6.', sum: '18 900 Ft', st: 'issued', pay: 'Bankkártya · helyszínen' },
  { no: 'FB-2026-0412', item: 'Előleg · Balayage + vágás', who: 'Juhász Hanna', email: 'hanna.juhasz@gmail.com', date: '2026. Nov. 6.', sum: '10 000 Ft', st: 'issued', pay: 'Online kártya' },
  { no: '—', item: 'Szolgáltatás · Átmenetes vágás', who: 'Papp Máté', email: 'mate.papp@gmail.com', date: '2026. Nov. 6.', sum: '8 900 Ft', st: 'register', pay: 'Készpénz · helyszínen' },
  { no: 'FB-2026-0411', item: 'Ajándékutalvány · 20 000 Ft', who: 'Kovács Anna', email: 'anna.kovacs@gmail.com', date: '2026. Nov. 2.', sum: '20 000 Ft', st: 'issued', pay: 'Fizetési link' },
  { no: '—', item: 'Előleg · Festés', who: 'Varga Lilla', email: 'lilla.varga@freemail.hu', date: '2026. Okt. 30.', sum: '5 000 Ft', st: 'failed', pay: 'Online kártya' },
  { no: '—', item: 'Szolgáltatás · Géllakk', who: 'Nagy Dóra', email: 'dora.nagy@gmail.com', date: '2026. Okt. 27.', sum: '6 000 Ft', st: 'skipped', pay: 'Átutalás' },
]
const ST = { issued: { s: 'ok', l: 'Kiállítva' }, failed: { s: 'bad', l: 'Sikertelen' }, skipped: { s: 'neutral', l: 'Nem kért' }, storno: { s: 'neutral', l: 'Sztornózva' }, register: { s: 'neutral', l: 'Pénztárgépen' }, manual: { s: 'pending', l: 'Kézzel kell kiállítani' } } as const

export type IssuedInvoiceRow = { key: string; no: string; item: string; who: string; email?: string | null; date: string; sum: string
  /** issued: a számlázóból kiállítva · failed: a kiállítás nem sikerült · skipped: nem kért számlát · storno · register: pénztárgépen adott nyugtát, nálunk csak rögzítve */
  st: 'issued' | 'failed' | 'skipped' | 'storno' | 'register' | 'manual'
  /** hogyan fizettek (Online kártya / Fizetési link / Készpénz · helyszínen …) */
  pay?: string | null
  /** ki állította ki (szakemberenkénti számlázásnál a szakember) — ha van, saját oszlop */
  issuer?: string | null
  /** sztornózottnál a sztornó számla száma */ storno?: string | null }
const SAMPLE_ROWS: IssuedInvoiceRow[] = INVOICES.map((r) => ({ key: r.no + r.who, no: r.no, item: r.item, who: r.who, email: r.email, date: r.date, sum: r.sum, st: r.st, pay: r.pay }))

/** Kiállított számlák (16.7.1): kereső, típus- és állapot-szűrő (a sikertelenek száma zárójelben), táblázat, PDF-letöltés;
 *  sorra kattintva a számla (16.7.2). Élőben az adatok, a szűrők és a lapozó a hívótól; nélkülük a minta. */
export type InvoiceSortKey = 'no' | 'item' | 'who' | 'date' | 'sum' | 'st' | 'pay'
export function IssuedInvoices({ rows = 6, data, compact = false, query, onQuery, type = 'all', onType, status = 'all', onStatus, failed = 1, openKey = SAMPLE_ROWS[0]?.key, onOpen, pdfHref, message, pagination, th, selected, onToggle, onToggleAll, onDownloadSelected, downloading = false, mobileTools, onStornoSelected, className = '' }: {
  /** a minta sorainak száma (landing / design); élőben `data` */
  rows?: number; data?: IssuedInvoiceRow[]; compact?: boolean
  query?: string; onQuery?: (q: string) => void
  type?: string; onType?: (t: string) => void; status?: string; onStatus?: (s: string) => void; failed?: number
  openKey?: string | null; onOpen?: (key: string) => void
  /** a kiállított számla PDF-je letöltésre */
  pdfHref?: (key: string) => string | null
  /** betöltés / hiba / üres állapot szövege a táblázat helyén */
  message?: React.ReactNode
  pagination?: React.ReactNode
  /** rendezés: az oszlopcím kattintásra rendez (`lib/tableSort` `th`) */
  th?: (key: InvoiceSortKey) => { sort: 'asc' | 'desc' | null; onSort: () => void }
  /** kijelölés (a letölthető, kiállított számlák) és a kijelöltek letöltése egy ZIP-ben */
  selected?: string[]; onToggle?: (key: string) => void; onToggleAll?: () => void; onDownloadSelected?: () => void; downloading?: boolean
  /** a kijelöltek sztornózása a számlázóban (a hívó megerősítést kér) */
  onStornoSelected?: () => void
  /** mobil (teljes oldal): a kereső és a szűrők csak a fejléc ikonjaira jelennek meg */
  mobileTools?: { search: boolean; filters: boolean; onCloseSearch?: () => void }
  className?: string
}) {
  const list = data ?? SAMPLE_ROWS.slice(0, rows)
  const byIssuer = !compact && list.some((r) => r.issuer)
  const sel = selected ?? []
  const selectable = list.filter((r) => r.st === 'issued')
  const allOn = selectable.length > 0 && selectable.every((r) => sel.includes(r.key))
  const h = (k: InvoiceSortKey, label: string) => <Th key={k} {...(th?.(k) ?? {})}>{label}</Th>
  return (
    <Card tone="white" pad="lg" className={`max-lg:px-0 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Számlák és fizetések</CardTitle>
        <span className={`flex flex-wrap gap-1.5 ${mobileTools ? 'max-lg:hidden' : ''}`}>
          <SearchField className="w-[190px]" value={query} onChange={onQuery}>Vevő, számlaszám…</SearchField>
          {!compact && <Select toolbar size="sm" value={onType ? type : undefined} defaultValue={onType ? undefined : type} onChange={onType ? (e) => onType(e.target.value) : undefined} className="w-[150px]"><option value="all">Minden típus</option><option value="deposit">Előleg</option><option value="voucher">Ajándékutalvány</option><option value="service">Szolgáltatás</option></Select>}
          {!compact && <Select toolbar size="sm" value={onStatus ? status : undefined} defaultValue={onStatus ? undefined : status} onChange={onStatus ? (e) => onStatus(e.target.value) : undefined} className="w-[170px]"><option value="all">Minden állapot</option><option value="issued">Kiállítva</option><option value="failed">Sikertelen{failed ? ` (${failed})` : ''}</option><option value="skipped">Nem kért</option><option value="register">Pénztárgépen</option><option value="manual">Kézzel kell kiállítani</option><option value="storno">Sztornózva</option></Select>}
        </span>
      </div>
      {/* mobil: a fejléc ikonjaira — kereső (teljes szélességben), szűrők (típus, állapot) */}
      {/* a többi oldal mobil keresőjével egyezően: mező + mellette az X (törli és bezárja) */}
      {mobileTools?.search && (
        <div className="ui-pop-in mt-3 flex items-center gap-1.5 lg:hidden">
          <SearchField autoFocus className="min-w-0 flex-1" value={query} onChange={onQuery}>Vevő, számlaszám…</SearchField>
          {mobileTools.onCloseSearch && <IconButton icon={X} label="Keresés bezárása" variant="glass" onClick={mobileTools.onCloseSearch} />}
        </div>
      )}
      {mobileTools?.filters && <div className="ui-pop-in mt-3 flex flex-wrap gap-1.5 lg:hidden">{!compact && <Select toolbar size="sm" value={onType ? type : undefined} defaultValue={onType ? undefined : type} onChange={onType ? (e) => onType(e.target.value) : undefined} className="w-[150px]"><option value="all">Minden típus</option><option value="deposit">Előleg</option><option value="voucher">Ajándékutalvány</option><option value="service">Szolgáltatás</option></Select>}
          {!compact && <Select toolbar size="sm" value={onStatus ? status : undefined} defaultValue={onStatus ? undefined : status} onChange={onStatus ? (e) => onStatus(e.target.value) : undefined} className="w-[170px]"><option value="all">Minden állapot</option><option value="issued">Kiállítva</option><option value="failed">Sikertelen{failed ? ` (${failed})` : ''}</option><option value="skipped">Nem kért</option><option value="register">Pénztárgépen</option><option value="manual">Kézzel kell kiállítani</option><option value="storno">Sztornózva</option></Select>}</div>}
      <Meta className="mt-2">Minden vendég-fizetés és a bizonylata: előleg, ajándékutalvány és a helyszíni fizetés. Ami a számlázódból ment, letölthető; a pénztárgépes és a „nem kért” sor csak rögzítés.</Meta>
      {message ? <Meta className="py-10 text-center">{message}</Meta> : (
        <>
        {/* mobil (teljes oldal): lista — számlaszám + állapot, a vevő és a dátum, a tétel, jobbra az összeg */}
        {mobileTools && (
          <div className="mt-3 lg:hidden">
            {list.map((r) => (
              <button key={r.key} type="button" onClick={onOpen ? () => onOpen(r.key) : undefined} className={`block w-full border-t border-dashed border-ui-divider py-3 text-left outline-none first:border-t-0 ${r.key === openKey ? 'bg-ui-yellow/30' : ''}`}>
                <span className="flex items-center justify-between gap-2"><span className="text-ui-body font-medium text-ui-text">{r.no}</span><StatusPill status={ST[r.st].s}>{ST[r.st].l}</StatusPill></span>
                <span className="mt-1 flex items-baseline justify-between gap-2"><MarqueeText className="flex-1 text-ui-meta text-ui-text">{r.who}</MarqueeText><span className="shrink-0 text-ui-body text-ui-text">{r.sum}</span></span>
                <MarqueeText className="mt-0.5 text-ui-label text-ui-muted">{`${r.date} · ${r.item}`}</MarqueeText>
              </button>
            ))}
          </div>
        )}
        <div className={`overflow-x-auto ${mobileTools ? 'max-lg:hidden' : ''}`}>
          <Table className="mt-3" minWidth={compact ? 0 : 860}>
            <thead><Tr>{onToggle && <Th className="w-10"><RowCheck checked={allOn} onToggle={onToggleAll} label="Az összes kijelölése" /></Th>}{h('no', 'Számlaszám')}{!compact && h('item', 'Tétel')}{h('who', 'Vevő')}{!compact && h('date', 'Dátum')}{h('sum', 'Összeg')}{byIssuer && <Th>Kiállító</Th>}{!compact && h('pay', 'Fizetés')}{h('st', 'Bizonylat')}<Th /></Tr></thead>
            <tbody>
              {list.map((r) => {
                const href = r.st === 'issued' ? pdfHref?.(r.key) ?? null : null
                return (
                  <Tr key={r.key} state={r.key === openKey ? 'open' : sel.includes(r.key) ? 'selected' : undefined} onClick={onOpen ? () => onOpen(r.key) : undefined}>
                    {onToggle && <Td>{r.st === 'issued' && <RowCheck checked={sel.includes(r.key)} onToggle={() => onToggle(r.key)} />}</Td>}
                    <Td className="font-medium">{r.no}{r.storno && <Meta className="text-ui-label font-normal">sztornó: {r.storno}</Meta>}</Td>{!compact && <Td>{r.item}</Td>}<Td>{r.who}</Td>{!compact && <Td><Meta>{r.date}</Meta></Td>}<Td>{r.sum}</Td>{byIssuer && <Td>{r.issuer ?? '—'}</Td>}{!compact && <Td><Meta>{r.pay ?? '—'}</Meta></Td>}
                    <Td><StatusPill status={ST[r.st].s}>{ST[r.st].l}</StatusPill></Td>
                    <Td>{r.st === 'issued' && (href ? <span onClick={(e) => e.stopPropagation()}><IconButton icon={Download} label="PDF letöltése" variant="ghost" size="sm" href={href} download /></span> : !onOpen && <IconButton icon={Download} label="PDF letöltése" variant="ghost" size="sm" />)}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </div>
        </>
      )}
      {pagination}
      {/* kijelöléskor a közös sötét sáv alul (mint minden listán): a kijelöltek letöltése egy ZIP-ben */}
      {sel.length > 0 && onToggle && (
        <BulkDock className="mt-4">
          <StaffBulkBar count={sel.length} actions={[{ label: downloading ? 'Letöltés…' : 'Letöltés (ZIP)', onClick: onDownloadSelected }, ...(onStornoSelected ? [{ label: 'Sztornó', danger: true, onClick: onStornoSelected }] : [])]} onClear={() => { for (const k of sel) onToggle(k) }} />
        </BulkDock>
      )}
    </Card>
  )
}

/** Egy számla megnyitva (16.7.2): balra az adatok és a gombok, jobbra a PDF-előnézet (a számlázó fiókból). Élőben `row`,
 *  `pdf` (az előnézet eleme), `download` / `openHref`, `onClose`; nélkülük a minta. */
export function InvoiceModal({ failed = false, row, pdf, download, openHref, onStorno, onClose }: { failed?: boolean; row?: IssuedInvoiceRow; pdf?: React.ReactNode; download?: string | null; openHref?: string | null; /** a számla sztornózása (megerősítés után) */ onStorno?: () => void; onClose?: () => void }) {
  const r = row ?? (failed ? SAMPLE_ROWS.find((x) => x.st === 'failed')! : SAMPLE_ROWS[0])
  const isFailed = r.st === 'failed'
  return (
    <Modal size="lg" title={r.st === 'issued' ? r.no : 'Számla'} subtitle={r.item} onClose={onClose} className="sm:w-[min(880px,calc(100vw-32px))]">
      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div>
          <FieldRow label="Számlaszám"><span className="text-ui-body font-medium text-ui-text">{r.no}</span></FieldRow>
          <FieldRow label="Tétel"><span className="text-ui-body text-ui-text">{r.item}</span></FieldRow>
          <FieldRow label="Vevő"><span className="text-ui-body text-ui-text">{r.who}</span></FieldRow>
          {r.email && <FieldRow label="E-mail"><MarqueeText className="text-ui-body text-ui-text">{r.email}</MarqueeText></FieldRow>}
          <FieldRow label="Dátum"><span className="text-ui-body text-ui-text">{r.date}</span></FieldRow>
          <FieldRow label="Összeg"><span className="text-ui-body font-medium text-ui-text">{r.sum}</span></FieldRow>
          {r.pay && <FieldRow label="Fizetés"><span className="text-ui-body text-ui-text">{r.pay}</span></FieldRow>}
          <FieldRow label="Bizonylat"><StatusPill status={ST[r.st].s}>{ST[r.st].l}</StatusPill></FieldRow>
          {r.storno && <FieldRow label="Sztornó számla"><span className="text-ui-body text-ui-text">{r.storno}</span></FieldRow>}
          {isFailed ? <Note warn className="mt-2">A kiállítás nem sikerült — állítsd ki kézzel a számlázó fiókodban.</Note>
            : r.st === 'skipped' ? <Note className="mt-2">A vendég nem kért számlát — a fizetést rögzítettük, bizonylat nálunk nem készült.</Note>
            : r.st === 'manual' ? <Note warn className="mt-2">Előleges foglalás: a végszámlát (a teljes összegről, az előlegszámlára hivatkozva) állítsd ki a számlázódban.</Note>
            : r.st === 'register' ? <Note className="mt-2">A nyugtát a pénztárgépen adták — nálunk csak az összeg és a fizetési mód van rögzítve.</Note>
            : <div className="mt-3 flex gap-1.5"><Button variant="cell" size="sm" icon={Download} href={download ?? undefined} download={!!download}>Letöltés</Button><Button variant="cell" size="sm" icon={ExternalLink} href={openHref ?? undefined}>Új lapon</Button>{onStorno && r.st === 'issued' && <Button variant="bad" size="sm" onClick={onStorno}>Sztornó</Button>}</div>}
        </div>
        <Card tone="cell" inner className="flex min-h-[420px] items-center justify-center overflow-hidden">
          {r.st !== 'issued' ? <Meta>Ehhez a tételhez nincs PDF.</Meta> : pdf ?? (
            <Card tone="white" inner className="w-full max-w-[380px] p-6">
              <div className="flex items-start justify-between"><span className="text-ui-title text-ui-text">SZÁMLA</span><Meta>{r.no}</Meta></div>
              <Meta className="mt-4 text-ui-label">Eladó</Meta><div className="text-ui-meta text-ui-text">Fodrászat Budapest Kft. · 12345678-2-42</div>
              <Meta className="mt-2 text-ui-label">Vevő</Meta><div className="text-ui-meta text-ui-text">{r.who}</div>
              <div className="mt-4 flex justify-between border-y border-dashed border-ui-divider py-2 text-ui-meta text-ui-text"><span>{r.item}</span><span>{r.sum}</span></div>
              <div className="mt-2 flex justify-between text-ui-body font-medium text-ui-text"><span>Fizetendő</span><span>0 Ft · kártyával fizetve</span></div>
              <Meta className="mt-6 text-ui-label">Számlázz.hu · elektronikus számla</Meta>
            </Card>
          )}
        </Card>
      </div>
    </Modal>
  )
}

/* ── Előleg, fizetés, utalvány (a /design 16.1, 16.7, 16.14, 12.x) ─────────────────────────── */


/** Előleg-beállítás értéke (élőben a hub tartja, a mentés a közös sávon). `amount`: Ft (fix / fő után) vagy % (az ár %-a). */
export type DepositValue = {
  enabled: boolean; type: 'fixed' | 'percent' | 'per_pax'; amount: number | null; refundHours: number
  /** mely foglalásoknál: mindig / X Ft feletti szolgáltatásnál (szalon) / X fő felett (étterem) / kiemelt napokon */
  when: 'always' | 'min_price' | 'min_pax' | 'special_days'; minPriceHuf: number | null; minPax: number | null
  /** kiemelt napok: a hét napjai (0 = vasárnap) és konkrét dátumok ('YYYY-MM-DD') */
  weekdays: number[]; dates: string[]
}
/** Egy előfeltétel állapota: kész / hiányzik (gombbal a beállításához) / nem kötelező / ellenőrzés alatt. */
export type DepositPrereq = { state: 'ok' | 'missing' | 'optional' | 'loading'; okLabel?: string; href?: string; action?: string }
const REFUND_H = [12, 24, 48, 72]
/** a hét napjai hétfőtől — [felirat, getDay() szám] */
const WEEK: [string, number][] = [['H', 1], ['K', 2], ['Sze', 3], ['Cs', 4], ['P', 5], ['Szo', 6], ['V', 0]]
const MON = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const dayLabel = (d: string) => { const x = new Date(`${d}T12:00:00`); return `${x.getFullYear() !== new Date().getFullYear() ? `${x.getFullYear()}. ` : ''}${MON[x.getMonth()]} ${x.getDate()}.` }

/** 16.1: az Előleg beállítás-lap — mikor kérjünk, lemondás, előfeltételek, amit a vendég lát, alul a mentés-sáv.
 *  Élőben `value` + `onChange` (szalon: fix vagy az ár %-a, étterem: fix vagy fő után), `prereqs` (feltételek, Stripe,
 *  számlázó), `datePicker` (a kiemelt dátum hozzáadása — élőben a közös dátumválasztó), `save={false}` (a hub közös
 *  mentés-sávja); nélkülük a minta. */
export function DepositSettingsCard({ className = '', value, onChange, restaurant = false, prereqs, datePicker, save = true, manualApproval = false, rulesHref }: {
  /** kézi jóváhagyás van beállítva — mellette nem kérhető előleg (fizetett foglalást nem hagyunk függőben) */
  manualApproval?: boolean; rulesHref?: string
  className?: string; value?: DepositValue; onChange?: (v: DepositValue) => void; restaurant?: boolean
  prereqs?: { terms: DepositPrereq; stripe: DepositPrereq; invoicing: DepositPrereq }; datePicker?: React.ReactNode; save?: boolean
}) {
  const v = value
  const set = (p: Partial<DepositValue>) => v && onChange?.({ ...v, ...p })
  const types = restaurant ? (['fixed', 'per_pax'] as const) : (['fixed', 'percent'] as const)
  const unit = v?.type === 'percent' ? '%' : v?.type === 'per_pax' ? 'Ft / fő' : 'Ft'
  const hours = v ? (REFUND_H.includes(v.refundHours) ? REFUND_H : [...REFUND_H, v.refundHours].sort((a, b) => a - b)) : REFUND_H
  const ex = !v || !v.amount ? null
    : v.type === 'percent' ? `Egy 12 000 Ft-os szolgáltatáshoz ${Math.round((12000 * v.amount) / 100).toLocaleString('hu-HU')} Ft előleg szükséges`
    : v.type === 'per_pax' ? (() => { const n = v.when === 'min_pax' ? Math.max(4, (v.minPax ?? 0) + 1) : 4; return `A foglaláshoz ${(v.amount * n).toLocaleString('hu-HU')} Ft előleg szükséges (${n} fő × ${v.amount.toLocaleString('hu-HU')} Ft)` })()
    : `A foglaláshoz ${v.amount.toLocaleString('hu-HU')} Ft előleg szükséges`
  const pre = (p: DepositPrereq) => p.state === 'loading' ? <StatusPill status="neutral">Ellenőrzés…</StatusPill>
    : p.state === 'ok' ? <StatusPill status="ok">{p.okLabel ?? 'Kész'}</StatusPill>
    : p.action ? <Button variant="cell" size="sm" href={p.href}>{p.action}</Button>
    : <StatusPill status={p.state === 'missing' ? 'pending' : 'neutral'}>{p.state === 'missing' ? 'Hiányzik' : 'Nincs'}</StatusPill>
  const whens = ['always', restaurant ? 'min_pax' : 'min_price', 'special_days'] as const
  const whenRows: [string, React.ReactNode][] = !v ? [] : [
    ['Mely foglalásoknál', <Segmented key="w" tone="cell" size="sm" options={['Mindig', restaurant ? 'Létszám felett' : 'Ár felett', 'Kiemelt napokon']} active={Math.max(0, whens.indexOf(v.when as never))} onSelect={(i) => set({ when: whens[i] })} />],
    ...(v.when === 'min_pax' ? [['Ha a társaság nagyobb, mint', <span key="p" className="flex items-center gap-1.5"><Input size="sm" type="number" inputMode="numeric" min={1} value={v.minPax ?? ''} onChange={(e) => set({ minPax: e.target.value ? Math.max(1, Number(e.target.value)) : null })} hug className="text-right" aria-label="Létszám" /><Meta>fő</Meta></span>]] as [string, React.ReactNode][] : []),
    ...(v.when === 'min_price' ? [['Ha a szolgáltatás ára több, mint', <span key="p" className="flex items-center gap-1.5"><Input size="sm" type="number" inputMode="numeric" min={0} step={1000} value={v.minPriceHuf ?? ''} onChange={(e) => set({ minPriceHuf: e.target.value ? Number(e.target.value) : null })} hug className="text-right" aria-label="Ár" /><Meta>Ft</Meta></span>]] as [string, React.ReactNode][] : []),
    ...(v.when === 'special_days' ? [
      ['A hét napjain', <span key="d" className="flex flex-wrap gap-1">{WEEK.map(([l, n]) => (
        <button key={n} type="button" className="rounded-full ui-press" aria-pressed={v.weekdays.includes(n)} onClick={() => set({ weekdays: v.weekdays.includes(n) ? v.weekdays.filter((x) => x !== n) : [...v.weekdays, n] })}><Pill tone={v.weekdays.includes(n) ? 'dark' : 'cell'}>{l}</Pill></button>
      ))}</span>],
      ['És ezeken a dátumokon', <span key="t" className="flex flex-wrap items-center justify-end gap-1">
        {[...v.dates].sort().map((d) => (
          <button key={d} type="button" className="rounded-full ui-press" aria-label={`${dayLabel(d)} törlése`} onClick={() => set({ dates: v.dates.filter((x) => x !== d) })}><Pill tone="dark">{dayLabel(d)} ×</Pill></button>
        ))}
        {datePicker}
      </span>],
    ] as [string, React.ReactNode][] : []),
  ]
  const rowCls = (i: number) => `flex min-h-[52px] flex-wrap items-center justify-between gap-3 py-2 ${i ? 'border-t border-dashed border-ui-divider' : ''}`
  const sections: { icon: typeof HandCoins; title: string; rows: [string, React.ReactNode][] }[] = v ? [
    { icon: HandCoins, title: 'Mikor kérjünk előleget', rows: [
      ['Előleg kérése', <Switch key="s" checked={v.enabled} onChange={(on) => set({ enabled: on })} disabled={manualApproval && !v.enabled} ariaLabel="Előleg kérése" />],
      ...(v.enabled ? [
        ...whenRows,
        ['Összeg', <Segmented key="t" tone="cell" size="sm" options={restaurant ? ['Fix összeg', 'Fő után'] : ['Fix összeg', 'Az ár %-a']} active={Math.max(0, types.indexOf(v.type as never))} onSelect={(i) => set({ type: types[i], amount: null })} />],
        ['Mértéke', <span key="a" className="flex items-center gap-1.5"><Input size="sm" type="number" inputMode="numeric" min={v.type === 'percent' ? 1 : 0} max={v.type === 'percent' ? 100 : undefined} step={v.type === 'percent' ? 1 : 500} value={v.amount ?? ''} onChange={(e) => set({ amount: e.target.value ? (v.type === 'percent' ? Math.min(100, Number(e.target.value)) : Number(e.target.value)) : null })} hug className="text-right" aria-label="Előleg mértéke" /><Meta>{unit}</Meta></span>],
      ] as [string, React.ReactNode][] : []),
    ] },
    ...(v.enabled ? [{ icon: CalendarDays, title: 'Lemondás', rows: [
      ['Ingyenes lemondás', <Segmented key="r" tone="cell" size="sm" options={hours.map((h) => `${h} óra`)} active={hours.indexOf(v.refundHours)} onSelect={(i) => set({ refundHours: hours[i] })} />],
      ['Később lemondva', <span key="l" className="text-ui-body font-medium text-ui-text">Az előleg nálad marad</span>],
    ] as [string, React.ReactNode][] }] : []),
  ] : [
    { icon: HandCoins, title: 'Mikor kérjünk előleget', rows: [
      ['Előleg kérése', <DesignSwitch key="s" />],
      ['Mely foglalásoknál', <span key="w" className="flex flex-wrap gap-1">{['Mindig', '5 fő felett', 'Kiemelt napokon'].map((c, j) => <Pill tone={j === 1 ? 'dark' : 'cell'} key={c}>{c}</Pill>)}</span>],
      ['Összeg', <span key="t" className="flex flex-wrap gap-1">{['Fix összeg', 'Az ár %-a'].map((c, j) => <Pill tone={j === 0 ? 'dark' : 'cell'} key={c}>{c}</Pill>)}</span>],
      ['Mértéke', <span key="a" className="text-ui-body font-medium text-ui-text">5 000 Ft / fő</span>],
    ] },
    { icon: CalendarDays, title: 'Lemondás', rows: [
      ['Ingyenes lemondás', <span key="r" className="text-ui-body font-medium text-ui-text">24 órával előtte</span>],
      ['Később lemondva', <span key="l" className="text-ui-body font-medium text-ui-text">Az előleg nálad marad</span>],
    ] },
  ]
  const p = prereqs ?? { terms: { state: 'ok', okLabel: 'Kitöltve' }, stripe: { state: 'ok', okLabel: 'Bekötve' }, invoicing: { state: 'optional', action: 'Beállítom' } }
  return (
    <div className={`relative overflow-hidden rounded-ui-card bg-white ${className}`}>
      <div className="flex items-start justify-between px-6 pb-1 pt-6 max-lg:px-0">
        <div>
          <div className="text-ui-label text-ui-muted">Pénzügy</div>
          <div className="mt-0.5 text-ui-sub font-light text-ui-text">Előleg</div>
        </div>
        {!v || v.enabled ? <StatusPill status="ok">Bekapcsolva</StatusPill> : <StatusPill status="bad">Kikapcsolva</StatusPill>}
      </div>
      {manualApproval && (
        <div className="px-6 pt-4 max-lg:px-0">
          <Note warn>Kézi jóváhagyás mellett nem kérhető előleg — a már kifizetett foglalást elutasításkor vissza kellene utalni. Ha előleget kérnél, kapcsold be az automatikus megerősítést.{rulesHref && <> <a href={rulesHref} className="underline">Foglalási szabályok</a></>}</Note>
        </div>
      )}
      {sections.map((sec) => (
        <div key={sec.title} className="px-6 pt-5 max-lg:px-0">
          <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><sec.icon className="h-4 w-4" /> {sec.title}</div>
          {sec.rows.map(([k, node], i) => (
            <div key={k} className={rowCls(i)}>
              <span className="text-ui-body text-ui-muted">{k}</span>
              {node}
            </div>
          ))}
        </div>
      ))}
      <div className="px-6 pt-5 max-lg:px-0">
        <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><Check className="h-4 w-4" /> Előfeltételek</div>
        <FieldRow label="Foglalási feltételek" hint="ebben rögzíted a visszatérítés szabályait">{pre(p.terms)}</FieldRow>
        <FieldRow label="Online fizetés (Stripe)" hint="ide érkezik a vendég előlege">{pre(p.stripe)}</FieldRow>
        <FieldRow label="Számlázó" hint="automatikus számla — nem kötelező">{pre(p.invoicing)}</FieldRow>
      </div>
      {(!v || (v.enabled && ex)) && (
        <GuestSees className={`mx-6 mt-4 ${save ? 'mb-20' : 'mb-6'}`}>{v ? `„${ex}. ${v.refundHours} órával előtte még ingyen lemondhatod.”` : '„A foglaláshoz 20 000 Ft előleg szükséges (4 fő × 5 000 Ft). 24 órával előtte még ingyen lemondhatod.”'}</GuestSees>
      )}
      {v && !(v.enabled && ex) && <div className={save ? 'h-20' : 'h-6'} />}
      {save && <SaveBar label="2 módosítás" />}
    </div>
  )
}

const CONN = {
  stripe: { n: 'Stripe', d: 'Online kártyás fizetés: előleg és utalvány. A pénz közvetlenül a te fiókodba érkezik.', st: 'Összekötve', ok: true, btn: 'Kezelés' },
  szamlazz: { n: 'Számlázz.hu', d: 'Minden online fizetésről magától számla készül és a vendég e-mailben kapja. A számlák tartalmáért (áfakulcs, utalványok kezelése) a vállalkozás felel.', st: 'Nincs összekötve', ok: false, btn: 'Összekötés' },
  billingo: { n: 'Billingo', d: 'Minden online fizetésről magától számla készül és a vendég e-mailben kapja. A számlák tartalmáért (áfakulcs, utalványok kezelése) a vállalkozás felel.', st: 'Nincs összekötve', ok: false, btn: 'Összekötés' },
} as const
/** A szolgáltatók saját ikonja (public/brands — a hivatalos favicon / jel, helyben) */
const CONN_LOGO: Record<keyof typeof CONN, { src: string; pad?: boolean }> = {
  stripe: { src: '/brands/stripe.svg' },
  szamlazz: { src: '/brands/szamlazz.svg', pad: true },
  billingo: { src: '/brands/billingo.png' },
}

/** 16.7: egy kapcsolat kártyája (Stripe / számlázó) — állapot, mit csinál, egy gomb. Élőben `name` / `desc` / `status`
 *  / `btn` (+ `note`, pl. félbemaradt összekötés); nélkülük a `kind` mintája. */
export function ConnectionCard({ kind = 'stripe', name, desc, status, btn, note, className = '' }: {
  kind?: keyof typeof CONN; name?: string; desc?: string
  status?: { tone: 'ok' | 'pending' | 'bad' | 'neutral'; label: string }
  btn?: { label: string; onClick?: () => void; busy?: boolean; primary?: boolean } | null
  note?: React.ReactNode; className?: string
}) {
  const c = CONN[kind]
  const n = name ?? c.n
  const st = status ?? { tone: c.ok ? 'ok' : 'pending', label: c.st }
  const b = btn === undefined ? { label: c.btn, primary: !c.ok } : btn
  return (
    <Card tone="white" className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CONN_LOGO[kind].src} alt="" className={`h-9 w-9 shrink-0 rounded-full object-contain ${CONN_LOGO[kind].pad ? 'bg-ui-cell p-1.5' : ''}`} />
          <span className="text-ui-title text-ui-text">{n}</span>
        </span>
        <StatusPill status={st.tone}>{st.label}</StatusPill>
      </div>
      <p className="mt-3 text-ui-meta leading-relaxed text-ui-muted">{desc ?? c.d}</p>
      {note}
      {b && <Button variant={b.primary ? 'dark' : 'cell'} className="mt-auto w-full" onClick={b.onClick} loading={b.busy}>{b.label}</Button>}
    </Card>
  )
}

/** 16.7: számlázási adatok — cég, adószám, cím, automatikus számla, számlázó, mikor készül. Élőben `rows` ([címke,
 *  érték-elem]) és `title`; nélkülük a minta. */
export function BillingDataCard({ title = 'Számlázási adatok', rows, footer, className = '' }: { title?: string; rows?: [string, React.ReactNode][]; footer?: React.ReactNode; className?: string }) {
  if (rows) return (
    <div className={`rounded-ui-card bg-white p-6 ${className}`}>
      <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><FileText className="h-4 w-4" />{title}</div>
      {rows.map(([k, v]) => <div key={k} className={SHEET_ROW}><span className="text-ui-body text-ui-muted">{k}</span>{v}</div>)}
      {footer}
    </div>
  )
  return (
    <div className={`rounded-ui-card bg-white p-6 ${className}`}>
      <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><FileText className="h-4 w-4" />{title}</div>
      {[['Cégnév', 'Fodrászat Budapest Kft.'], ['Adószám', '12345678-2-42'], ['Cím', '1061 Budapest, Andrássy út 12.'], ['Automatikus számla', 'switch'], ['Számlázó', 'seg:Számlázz.hu|Billingo'], ['Mikor készül', 'seg:Fizetéskor|Időpont után'], ['ÁFA', '27%'], ['Másolat ide', 'szamla@fodraszat.hu']].map(([k, v]) => (
        <div key={k} className={SHEET_ROW}>
          <span className="text-ui-body text-ui-muted">{k}</span>
          {v === 'switch' ? <DesignSwitch /> : v.startsWith('seg:') ? <Segmented options={v.slice(4).split('|')} active={0} tone="cell" size="sm" /> : <Input size="sm" defaultValue={v as string} className="w-[220px] max-w-full" />}
        </div>
      ))}
    </div>
  )
}

/** Az Ajándékutalvány-lap összesítője (`/api/gift-vouchers/summary`). */
export type VoucherSummary = {
  yearTotal: number; yearCount: number; redeemedPct: number
  months: { label: string; now: number; prev: number }[]
  expiring: { code: string; who: string; amount: number; expires: string }[]
  types: { count: number; amounts: number[]; sold: number }
}
const SAMPLE_VOUCHERS: VoucherSummary = {
  yearTotal: 800000, yearCount: 64, redeemedPct: 48,
  months: [['Jún.', 40, 35], ['Júl.', 52, 38], ['Aug.', 48, 44], ['Szept.', 61, 40], ['Okt.', 70, 52], ['Nov.', 96, 66]].map(([label, n, p]) => ({ label: label as string, now: (n as number) * 1000, prev: (p as number) * 1000 })),
  expiring: [['3M9X-T4BV', 'Tóth Bence', 15000, '2026-11-12'], ['9P4L-K2WD', 'Gál Zsófia', 30000, '2026-11-20'], ['7K2Q-M9XP', 'Kovács Anna', 20000, '2026-11-28']].map(([code, who, amount, expires]) => ({ code: code as string, who: who as string, amount: amount as number, expires: expires as string })),
  types: { count: 4, amounts: [10000, 20000, 30000, 48000], sold: 64 },
}
const MONTH_ABBR = ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.']
const kFt = (n: number) => (n >= 1000 ? `${Math.round(n / 1000).toLocaleString('hu-HU')} e Ft` : `${n.toLocaleString('hu-HU')} Ft`)

/** 16.14: az idei utalvány-eladás (sötét kártya) — havi görbe, szaggatottal a tavalyi. Élőben `data` (betöltés közben null). */
export function VoucherSalesCard({ className = '', data = SAMPLE_VOUCHERS }: { className?: string; data?: VoucherSummary | null }) {
  const now = data?.months.map((m) => Math.round(m.now / 1000)) ?? []
  const prev = data?.months.map((m) => Math.round(m.prev / 1000)) ?? []
  const all = [...now, ...prev]
  const lo = all.length ? Math.max(0, Math.min(...all) - 10) : 0
  const hi = all.length ? Math.max(...all, lo + 10) + 10 : 100
  return (
    <Card tone="dark" className={className}>
      <Meta dark>Idén eladva</Meta><div className="mt-1 text-ui-num font-light leading-none">{data ? kFt(data.yearTotal) : '…'}</div>
      {data && now.length > 0 && <DarkLineChart now={now} prev={prev} sel={now.length - 1} min={lo} max={hi} h={70} label={kFt(data.months[now.length - 1].now)} ticks={data.months.map((m) => m.label)} selTick={now.length - 1} />}
      {data && <Meta dark className="mt-3">{data.yearCount} utalvány{data.yearCount ? ` · ${data.redeemedPct}% már beváltva` : ''}</Meta>}
    </Card>
  )
}

/** 16.14: a 30 napon belül lejáró aktív utalványok. */
export function VoucherExpiringCard({ data = SAMPLE_VOUCHERS }: { data?: VoucherSummary | null }) {
  const day = (iso: string) => { const x = new Date(iso); return `${MONTH_ABBR[x.getMonth()]} ${x.getDate()}.` }
  return (
    <Card pad="sm">
      <div className="px-2 pb-1 pt-1"><CardTitle>30 napon belül lejár</CardTitle></div>
      {data?.expiring.map((v) => (
        <ListRow key={v.code} title={<span className="font-mono">{v.code}</span>} meta={`${v.who ? `${v.who} · ` : ''}${v.amount.toLocaleString('hu-HU')} Ft`} trailing={<StatusPill status="pending">{day(v.expires)}</StatusPill>} />
      ))}
      {data && !data.expiring.length && <Meta className="px-2 py-3">Nincs lejáró utalvány.</Meta>}
    </Card>
  )
}

/** Az Ajándékutalvány-beállítás értéke (élőben a hub tartja, a mentés a közös sávon). */
export type VoucherSettingsValue = { enabled: boolean; validityMonths: number; minAmountHuf: number; maxAmountHuf: number; allowCompany: boolean }
const VALIDITY = [6, 12, 24]

/** 16.14: Beállítások › Ajándékutalvány — árusítás, típusok (a kezelésük az Utalványok menüben), érvényesség, összeghatár,
 *  számlázás; mellette az idei eladás és a lejárók. Élőben `value` + `onChange`, `summary`, `typesHref`, `invoicing`
 *  (be van-e kötve számlázó; null = ellenőrzés), `invoicingHref`, `save={false}`; nélkülük a minta. */
export function VoucherSettings({ value, onChange, summary = SAMPLE_VOUCHERS, typesHref, invoicing = true, invoicingHref, save = true }: {
  value?: VoucherSettingsValue; onChange?: (v: VoucherSettingsValue) => void; summary?: VoucherSummary | null; typesHref?: string
  invoicing?: boolean | null; invoicingHref?: string; save?: boolean
}) {
  const v = value
  const set = (p: Partial<VoucherSettingsValue>) => v && onChange?.({ ...v, ...p })
  const on = v ? v.enabled : true
  const months = v && !VALIDITY.includes(v.validityMonths) ? [...VALIDITY, v.validityMonths].sort((a, b) => a - b) : VALIDITY
  const t = summary?.types
  const outOfRange = v && t ? t.amounts.filter((a) => a < v.minAmountHuf || (v.maxAmountHuf > 0 && a > v.maxAmountHuf)).length : 0
  const rangeBad = !!v && v.minAmountHuf > 0 && v.maxAmountHuf > 0 && v.minAmountHuf > v.maxAmountHuf
  const num = (val: number, key: 'minAmountHuf' | 'maxAmountHuf', w: string) => v
    ? <Input size="sm" type="number" inputMode="numeric" min={0} step={1000} value={val} onChange={(e) => set({ [key]: Number(e.target.value) || 0 })} hug className="text-right" aria-label={key === 'minAmountHuf' ? 'Minimum összeg' : 'Maximum összeg'} />
    : <Input size="sm" defaultValue={`${val.toLocaleString('hu-HU')} Ft`} className={w} />
  return (
    <SettingsPage group="Pénzügy" title="Ajándékutalvány" save={save} status={on ? <StatusPill status="ok">Bekapcsolva</StatusPill> : <StatusPill status="bad">Kikapcsolva</StatusPill>} aside={<>
      <VoucherSalesCard data={summary} />
      <VoucherExpiringCard data={summary} />
    </>}>
      <SettingsGroup icon={Gift} title="Típusok">
        <FieldRow label="Árusítás" hint="a foglalóoldalon vásárolhatók, helyben kiállíthatók">{v ? <Switch checked={v.enabled} onChange={(x) => set({ enabled: x })} ariaLabel="Ajándékutalvány árusítása" /> : <DesignSwitch />}</FieldRow>
        <FieldRow label={t ? `${t.count} típus · ${t.sold} eladva` : 'Típusok'} hint={t ? (t.count ? t.amounts.map((a) => a.toLocaleString('hu-HU')).join(' · ') + ' Ft' : 'amíg nincs aktív típus, nem lehet vásárolni') : undefined}>
          <Button variant="cell" size="sm" icon={ArrowUpRight} href={typesHref}>Típusok kezelése</Button>
        </FieldRow>
      </SettingsGroup>
      <SettingsGroup icon={CalendarDays} title="Szabályok">
        <FieldRow label="Érvényesség"><Segmented tone="cell" size="sm" options={months.map((m) => `${m} hó`)} active={v ? months.indexOf(v.validityMonths) : 1} onSelect={v ? (i) => set({ validityMonths: months[i] }) : undefined} /></FieldRow>
        <FieldRow label="Összeghatár" hint={rangeBad ? 'a minimum nagyobb, mint a maximum' : outOfRange ? `${outOfRange} típus összege kívül esik rajta` : 'a típusok összege ezen belül lehet'}>
          <span className="flex items-center gap-1.5">{num(v ? v.minAmountHuf : 5000, 'minAmountHuf', 'w-[110px]')}<Meta>–</Meta>{num(v ? v.maxAmountHuf : 100000, 'maxAmountHuf', 'w-[120px]')}{v && <Meta>Ft</Meta>}</span>
        </FieldRow>
      </SettingsGroup>
      <SettingsGroup icon={Wallet} title="Számlázás">
        <FieldRow label="„Cégként vásárolok” a foglalóoldalon" hint="adószámos számla — csak bekötött számlázóval">{v ? <Switch checked={v.allowCompany} onChange={(x) => set({ allowCompany: x })} ariaLabel="Cégként vásárolok" /> : <DesignSwitch />}</FieldRow>
        {invoicing === false ? (
          <FieldRow label="Automatikus számla" hint="nincs bekötve számlázó"><Button variant="cell" size="sm" href={invoicingHref}>Beállítom</Button></FieldRow>
        ) : (
          <>
            <FieldRow label="Online / fizetési link" hint="minden sikeres kártyás fizetés után">{invoicing === null ? <StatusPill status="neutral">Ellenőrzés…</StatusPill> : <StatusPill status="ok">Automatikus</StatusPill>}</FieldRow>
            <FieldRow label="Helyszíni kiállítás" hint="kiállításkor választható"><StatusPill status="neutral">Választható</StatusPill></FieldRow>
          </>
        )}
      </SettingsGroup>
    </SettingsPage>
  )
}

export const VCODE = '7K2Q-M9XP'
const VBG = {
  dark: 'bg-ui-dark text-white', yellow: 'bg-ui-yellow text-ui-dark', photo: 'bg-ui-dark text-white',
  // prémium hátterek (a végleges még nincs eldöntve — design 18.x „Utalvány”): lágy meleg színátmenet · mélysötét arany
  // csillogással · krém finom vonalmintával · hideg színátmenet; mindegyiken finom szemcse (papír-hatás)
  mesh: 'text-ui-dark', ink: 'text-white', linen: 'text-ui-dark', aurora: 'text-white',
  sage: 'text-white', terracotta: 'text-white', midnight: 'text-white', blush: 'text-ui-dark',
} as const
/** a világos hátterek (rajtuk sötét a szöveg) */
const VLIGHT = new Set(['yellow', 'mesh', 'linen', 'blush'])
/** a prémium hátterek képe (CSS) — e-mailben ugyanez PNG-ként kerül a levélbe */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
const VBG_STYLE: Partial<Record<keyof typeof VBG, string>> = {
  mesh: `${GRAIN}, radial-gradient(at 12% 18%, #FFE7A8 0, transparent 55%), radial-gradient(at 88% 12%, #F8C9B5 0, transparent 50%), radial-gradient(at 70% 92%, #FFD85F 0, transparent 55%), radial-gradient(at 18% 88%, #F3E3D3 0, transparent 50%), #FBEFD9`, // ui-allow: a kártya háttere maga a minta
  ink: `${GRAIN}, radial-gradient(120% 80% at 100% 0%, rgba(255,216,95,.28) 0, transparent 55%), radial-gradient(90% 70% at 0% 100%, rgba(255,255,255,.08) 0, transparent 60%), linear-gradient(160deg, #2B2A28 0%, #121212 100%)`, // ui-allow
  linen: `${GRAIN}, repeating-linear-gradient(135deg, rgba(56,56,56,.045) 0 1px, transparent 1px 7px), linear-gradient(160deg, #F7F1E6 0%, #EFE6D6 100%)`, // ui-allow
  aurora: `${GRAIN}, radial-gradient(at 15% 20%, #6C8BFF 0, transparent 50%), radial-gradient(at 85% 25%, #B07BFF 0, transparent 45%), radial-gradient(at 60% 95%, #3FC1B0 0, transparent 50%), #1E2140`, // ui-allow
  sage: `${GRAIN}, radial-gradient(110% 80% at 100% 0%, rgba(232,226,200,.22) 0, transparent 55%), linear-gradient(160deg, #6E8A72 0%, #3F5646 100%)`, // ui-allow
  terracotta: `${GRAIN}, radial-gradient(110% 80% at 0% 0%, rgba(255,214,170,.35) 0, transparent 55%), linear-gradient(160deg, #C46A4A 0%, #8E3F2C 100%)`, // ui-allow
  midnight: `${GRAIN}, radial-gradient(120% 80% at 100% 0%, rgba(240,232,214,.18) 0, transparent 50%), linear-gradient(160deg, #2A2A2C 0%, #0B0B0D 100%)`, // ui-allow
  blush: `${GRAIN}, radial-gradient(at 85% 15%, #FFD9C9 0, transparent 50%), radial-gradient(at 10% 90%, #F6C7D3 0, transparent 55%), #FBEDEA`, // ui-allow
}

/** A mozijegy sárga szelvényén a QR színe: a kártya színének legsötétebb, tömör árnyalata (átmenet nélkül, hogy
 *  jól olvasható legyen); világos kártyánál a szöveg sötétje. */
const VQR_INK: Partial<Record<keyof typeof VBG, string>> = {
  midnight: '#0B0B0D', sage: '#3F5646', terracotta: '#8E3F2C', ink: '#121212', aurora: '#1E2140', // ui-allow: a színek tömör sötét vége
}

/** Az utalvány szövegei a vásárló nyelvén (a jegyet külföldi is kaphatja) — a többi szöveg a vezérlőpulton magyar. */

/** Beolvasható minta-QR (a mintakódhoz, a /design-ban) — átlátszó hátterű SVG data-URL, mint a valódi (lib/voucherQr). */
const sampleQrCache = new Map<string, string>()
function sampleQr(code: string) {
  const hit = sampleQrCache.get(code)
  if (hit) return hit
  const q = QRCode.create(`https://booking.davelopment.hu/fodraszat-budapest/voucher/${code}`, { errorCorrectionLevel: 'M' })
  const n = q.modules.size
  let r = ''
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(y, x)) r += `<rect x='${x}' y='${y}' width='1' height='1'/>`
  const url = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='-2 -2 ${n + 4} ${n + 4}' shape-rendering='crispEdges'>${r}</svg>`)}`
  sampleQrCache.set(code, url)
  return url
}

/** Egy utalvány-szín kitöltése (a foglalóoldal típus-választóján, ha a típusnak nincs képe) — a szülő `relative`. */
export function VoucherFill({ color }: { color: keyof typeof VBG }) {
  return <span className={`absolute inset-0 ${VBG[color]}`}>{VBG_STYLE[color] && <span className="absolute inset-0" style={{ background: VBG_STYLE[color] }} />}</span> // ui-allow: a kitöltés maga a minta
}

/** Egy utalvány-szín kis köre (a sablon-választóhoz) — ugyanaz a háttér, mint a kártyán. */
export function VoucherSwatch({ color, on = false }: { color: keyof typeof VBG; on?: boolean }) {
  return <span className={`relative block h-9 w-9 overflow-hidden rounded-full ${VBG[color]} ${on ? 'ring-2 ring-ui-dark ring-offset-2 ring-offset-ui-cell' : ''}`}>{VBG_STYLE[color] && <span className="absolute inset-0" style={{ background: VBG_STYLE[color] }} />}</span> // ui-allow: a kör maga a minta
}

/** Az utalvány maga — kétoldalú. Előlap: az üzlet logója (a mintában a davelopment booking ikonja), érték, kód, lejárat; a háttér a típusból jön (sötét / sárga / a
 *  szalon fotója). Hátoldal: a beolvasható QR-kód (a valódi generateVoucherQrDataUrl kimenete), a kód és hogy hol
 *  váltható be. Egy helyen — a lista, a popupok és a típus-választó is ezt mutatja. */
export type VoucherBiz = { name: string; logo?: string | null; /** az ikon (kicsi helyekre) — a sablon `brand`-je dönt (design 24.2) */ icon?: string | null; addr?: string | null }
/** Élőben: `biz` (az üzlet neve, logója, címe), `expires` (felirat), `photo` (a típus képe — `bg="photo"`-nál a háttér). */
export function VoucherCard({ design, ...p }: VoucherCardProps & {
  /** a típus sablonja (lib/voucherDesign): egyoldalas jegy a választott formában és színben; kép esetén a kép a háttér.
   *  Kicsiben (lista, választó) a forma helyett csak a szín / kép látszik — az apró jegy olvashatatlan lenne. */
  design?: VoucherDesign | null
}) {
  if (!design) return <VoucherCardBase {...p} />
  const bg = p.photo ? 'photo' : design.color
  // az üzlet képe a jegyen (design 24.2): ikon (alap) / logó / nincs — ha a választott hiányzik, a másik; a kép a saját alakjában
  if (p.biz) {
    const b = design.brand ?? 'icon'
    const logo = b === 'none' ? null : b === 'logo' ? p.biz.logo ?? p.biz.icon ?? null : p.biz.icon ?? p.biz.logo ?? null
    p = { ...p, biz: { ...p.biz, logo } }
  }
  const ink = design.text && design.text !== 'auto' ? design.text : undefined
  return p.small ? <VoucherCardBase {...p} bg={bg} ink={ink} /> : <VoucherCardBase {...p} bg={bg} ink={ink} side="single" layout={design.layout} />
}

type VoucherCardProps = Parameters<typeof VoucherCardBase>[0]
function VoucherCardBase({ amount = '20 000 Ft', code = VCODE, to, bg = 'dark', side = 'front', layout = 'corner', qr, small = false, selected = false, restaurant = false, biz: bizIn, expires = '2027. Márc. 31.', photo, ink, lang, message }: { amount?: string; code?: string; to?: string; bg?: keyof typeof VBG; side?: 'front' | 'back' | 'single'; /** egyoldalas elrendezés: QR jobb felül · szelvényes · QR-sáv alul · ajándékkártya-arány */ layout?: 'corner' | 'stub' | 'band' | 'card' | 'vertical' | 'postcard' | 'cinema' | 'tag' | 'wristband'; qr?: string; small?: boolean; selected?: boolean; restaurant?: boolean; biz?: VoucherBiz; expires?: string; photo?: string | null
  /** a szöveg színe (a sablon választása) — üresen a háttérhez igazodik */
  ink?: 'light' | 'dark'
  /** a jegy szövegeinek nyelve (a vásárlóé) — alapból magyar */
  lang?: string | null
  /** a vásárló üzenete (a képeslapon) — nélküle nincs üzenet-sor */
  message?: string | null }) {
  const L = vtxt(lang)
  const sample = restaurant ? { name: 'Bistro Andrássy', addr: '1061 Budapest, Andrássy út 34. · +36 1 765 4321' } : { name: 'Fodrászat Budapest', addr: '1061 Budapest, Andrássy út 12. · +36 1 234 5678' }
  const biz = { ...sample, logo: BIZ_LOGO, ...(bizIn ?? {}), where: restaurant ? L.rest : L.salon }
  const light = ink ? ink === 'dark' : VLIGHT.has(bg)
  // a háttér osztálya a saját szövegszíne nélkül, ha a sablon felülírja
  const bgClass = ink ? `${VBG[bg].split(' ').filter((c) => !c.startsWith('text-')).join(' ')} ${ink === 'dark' ? 'text-ui-dark' : 'text-white'}` : VBG[bg]
  const soft = light ? 'text-ui-dark/55' : 'text-white/55'
  return (
    <div className={`relative flex flex-col overflow-hidden ${side === 'single' && layout === 'stub' ? '' : 'rounded-ui-card'} ${side === 'single' && layout === 'vertical' ? 'mx-auto w-full max-w-[340px]' : ''} ${side === 'single' && layout === 'tag' ? 'mx-auto w-full max-w-[280px] [clip-path:polygon(18%_0,82%_0,100%_12%,100%_100%,0_100%,0_12%)]' : ''} ${side === 'single' && layout === 'wristband' ? '!min-h-0 !rounded-ui-control' : ''} ${small ? 'p-4' : 'min-h-[236px] p-5'} ${bgClass} ${selected ? 'ring-2 ring-ui-dark ring-offset-2 ring-offset-white' : ''}`}>
      {bg === 'photo' && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo || '/videos/szalon-foglalas-hatter-poster.jpg'} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-ui-dark/45" />
        </>
      )}
      {VBG_STYLE[bg] && <span className="pointer-events-none absolute inset-0" style={{ background: VBG_STYLE[bg] }} />} {/* ui-allow: a prémium háttér maga a minta */}
      {(bg === 'dark' || bg === 'yellow') && <span className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border-[18px] ${bg === 'yellow' ? 'border-white/30' : 'border-ui-yellow/25'}`} />}
      <div className={`relative flex flex-1 flex-col ${side === 'back' ? 'justify-center' : ''}`}>
        {side === 'single' && layout !== 'corner' ? (
          <SingleLayout L={L} message={message} layout={layout} bg={bg} photo={bg === 'photo' ? photo : null} biz={biz} to={to} amount={amount} code={code} expires={expires} qr={qr} soft={soft} light={light} />
        ) : side === 'single' ? (
          // egyoldalas (e-mailben, nyomtatáshoz): balra az üzlet, a címzett, az összeg, a kód, a lejárat és hogy hol váltható
          // be; a jobb felső sarokban a beváltó QR-kód — egy kártyán minden
          <>
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  {biz.logo && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={biz.logo} alt="" className="h-8 w-auto shrink-0 object-contain" /></>}
                  <span className="text-ui-meta leading-tight">{biz.name}</span>
                </div>
                <div className={`mt-4 text-ui-label ${soft}`}>{to ? `${L.gift} · ${L.forTo(to)}` : L.gift}</div>
                <div className={`font-light leading-none text-ui-num ${light ? '' : 'text-ui-yellow'}`}>{amount}</div>
              </div>
              <span className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-ui-inner bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr ? <img src={qr} alt={`QR-kód: ${code}`} className="h-full w-full" /> : code === VCODE ? <QrSvg url={`https://booking.davelopment.hu/voucher/${code}`} className="h-full w-full" /> : <QrCode className="h-1/2 w-1/2 text-ui-muted" strokeWidth={1.5} aria-hidden />}
              </span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-4">
              <div><div className={`text-ui-label ${soft}`}>{L.code}</div><div className="font-mono text-ui-row">{code}</div></div>
              <div className="text-right"><div className={`text-ui-label ${soft}`}>{L.expires}</div><div className="text-ui-body">{expires}</div></div>
            </div>
            <div className={`mt-3 text-ui-label leading-relaxed ${soft}`}>{L.show(biz.where)}</div>
            <PoweredBy label={L.system} dark={!light} className="mt-4" />
          </>
        ) : side === 'front' ? (
          <>
            <div className="flex items-center gap-2.5">
              {/* az üzlet beállított logója — a példa kedvéért a davelopment booking ikonja */}
              {biz.logo && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={biz.logo} alt="" className={`w-auto shrink-0 object-contain ${small ? 'h-8' : 'h-10'}`} /></>}
              <span className={`leading-tight ${small ? 'text-ui-meta' : 'text-ui-body'}`}>{biz.name}</span>
            </div>
            <div className={`${small ? 'mt-4 text-ui-label' : 'mt-6 text-ui-body'} ${soft}`}>{to ? `${L.gift} · ${L.forTo(to)}` : L.gift}</div>
            <div className={`font-light leading-none ${small ? 'text-ui-sub' : 'text-ui-page'} ${light ? '' : 'text-ui-yellow'}`}>{amount}</div>
            {!small && (
              <div className="mt-auto flex items-end justify-between pt-6">
                <div><div className={`text-ui-label ${soft}`}>{L.code}</div><div className="font-mono text-ui-row">{code}</div></div>
                <div className="text-right"><div className={`text-ui-label ${soft}`}>{L.expires}</div><div className="text-ui-body">{expires}</div></div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-4">
            <span className="flex h-[124px] w-[124px] shrink-0 items-center justify-center rounded-ui-inner bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {qr ? <img src={qr} alt={`QR-kód: ${code}`} className="h-full w-full" /> : <QrSvg url={`https://booking.davelopment.hu/voucher/${code}`} className="h-full w-full" />}
            </span>
            <div className="min-w-0">
              <div className={`text-ui-label ${soft}`}>{L.code}</div>
              <div className="font-mono text-ui-row">{code}</div>
              <div className={`mt-3 text-ui-meta leading-relaxed ${soft}`}>{L.show(biz.where)}</div>
              {biz.addr && <div className={`mt-2 text-ui-label ${soft}`}>{biz.addr}</div>}
              <PoweredBy label={L.system} dark={!light} className="mt-3" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Az egyoldalas utalvány további elrendezései (a VoucherCard `layout`-ja): szelvényes (jobbra letéphető sáv a QR-ral),
 *  QR-sáv alul (fehér sáv a kártya alján), ajándékkártya-arány (1,6:1, a QR kicsiben jobb alul). */
function SingleLayout({ L, message, layout, bg, photo, biz, to, amount, code, expires, qr, soft, light }: { L: ReturnType<typeof vtxt>; message?: string | null; layout: 'stub' | 'band' | 'card' | 'vertical' | 'postcard' | 'cinema' | 'tag' | 'wristband'; bg: keyof typeof VBG; photo?: string | null; biz: VoucherBiz & { where: string }; to?: string; amount: string; code: string; expires: string; qr?: string; soft: string; light: boolean }) {
  const head = (
    <div className="flex items-center gap-2.5">
      {biz.logo && <>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={biz.logo} alt="" className="h-8 w-auto shrink-0 object-contain" /></>}
      <span className="text-ui-meta leading-tight">{biz.name}</span>
    </div>
  )
  const title = <div className={`text-ui-label ${soft}`}>{to ? `${L.gift} · ${L.forTo(to)}` : L.gift}</div>
  const big = <div className={`font-light leading-none text-ui-num ${light ? '' : 'text-ui-yellow'}`}>{amount}</div>
  // eslint-disable-next-line @next/next/no-img-element
  // a QR közvetlenül a háttéren, fehér doboz nélkül: a QR-kép (átlátszó hátterű PNG — lib/voucherQr) maszk, és alatta a
  // szín látszik át: világos háttéren sötét, sötéten / képen fehér; a mozijegy sárga szelvényén a kártya saját színe.
  // A mintakódnál (design) ugyanez egy beolvasható minta-QR-ral.
  const src = qr ?? (code === VCODE ? sampleQr(code) : null)
  const qrImg = (size: string, tint: 'auto' | 'card' = 'auto') => {
    if (!src) return <span className={`flex shrink-0 items-center justify-center ${size}`}><QrCode className="h-1/2 w-1/2 opacity-50" strokeWidth={1.5} aria-hidden /></span>
    const fill = tint === 'card' ? (VQR_INK[bg] ?? 'var(--ui-dark)') : light ? 'var(--ui-dark)' : '#fff' // ui-allow: a QR színe (maszkon át)
    return <span role="img" aria-label={`QR-kód: ${code}`} className={`block shrink-0 ${size}`} style={{ background: fill, WebkitMaskImage: `url("${src}")`, maskImage: `url("${src}")`, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }} /> // ui-allow: a QR maga a maszk
  }
  if (layout === 'stub') {
    // belépőjegy: a jobb szélen letéphető szelvény — a vágásvonal a kártya teljes magasságában, a két végén félkör bevágás
    const line = light ? 'border-ui-dark/25' : 'border-white/30'
    return (
      <div className="-my-5 flex flex-1 items-stretch">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-5 py-5 pr-5">
          {head}
          <div>{title}{big}</div>
          <div className={`text-ui-label leading-relaxed ${soft}`}>
            <div>{L.expires}: {expires}</div>
            <div>{L.redeem(biz.where)}</div>
            <PoweredBy label={L.system} dark={!light} className="mt-2" />
          </div>
        </div>
        <div className={`relative flex w-[150px] shrink-0 flex-col items-center justify-center gap-2.5 border-l-2 border-dashed py-5 pl-5 ${line}`}>
          <span className="absolute -left-[10px] -top-[9px] h-[18px] w-[18px] rounded-full bg-white" />
          <span className="absolute -bottom-[9px] -left-[10px] h-[18px] w-[18px] rounded-full bg-white" />
          {qrImg('h-[100px] w-[100px]')}
          <span className="font-mono text-ui-meta">{code}</span>
        </div>
      </div>
    )
  }
  if (layout === 'vertical') {
    // álló koncertjegy: fent a jegy, alul vízszintes tépővonal két oldalsó bevágással, alatta a szelvény a QR-ral
    const line = light ? 'border-ui-dark/25' : 'border-white/30'
    return (
      <div className="-mx-5 -my-5 flex flex-1 flex-col">
        <div className="flex flex-col gap-6 p-6">
          {head}
          <div>{title}<div className={`mt-1 font-light leading-none text-ui-page ${light ? '' : 'text-ui-yellow'}`}>{amount}</div></div>
          <div className={`text-ui-label ${soft}`}>{L.expires}: {expires}</div>
        </div>
        <div className={`relative mx-0 border-t-2 border-dashed ${line}`}>
          <span className="absolute -left-[9px] -top-[10px] h-[18px] w-[18px] rounded-full bg-white" />
          <span className="absolute -right-[9px] -top-[10px] h-[18px] w-[18px] rounded-full bg-white" />
        </div>
        <div className="flex items-center gap-4 p-6">
          {qrImg('h-[96px] w-[96px]')}
          <div className="min-w-0"><div className={`text-ui-label ${soft}`}>{L.code}</div><div className="font-mono text-ui-row">{code}</div><div className={`mt-1 text-ui-label leading-relaxed ${soft}`}>{L.redeem(biz.where)}</div></div>
        </div>
      </div>
    )
  }
  if (layout === 'postcard') return (
    // képeslap: bal fele fotó, jobb fele a „hátoldal” — vonalakra írt címzett és üzenet, a bélyeg helyén a QR
    <div className="-m-5 grid flex-1 grid-cols-2">
      {/* a „képoldal”: a típus képe; kép nélkül a kártya színén nagyban az üzlet logója */}
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt="" className="h-full min-h-[240px] w-full object-cover" />
        : <div className="flex min-h-[240px] items-center justify-center">{biz.logo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={biz.logo} alt={biz.name} className="h-24 w-auto rounded-ui-card" />
          : <span className="text-ui-display font-light">{biz.name.slice(0, 1)}</span>}</div>}
      <div className={`relative flex flex-col gap-3 border-l p-5 ${light ? 'border-ui-dark/15' : 'border-white/20'}`}>
        <div className="flex items-start justify-between gap-3">
          {head}
          {qrImg('h-[78px] w-[78px]')}
        </div>
        <div className={`font-light leading-none text-ui-num ${light ? '' : 'text-ui-yellow'}`}>{amount}</div>
        {[`${L.to}: ${to ?? '—'}`, ...(message ? [`„${message}”`] : []), `${L.code}: ${code} · ${L.expires.toLowerCase()}: ${expires}`].map((t) => (
          <div key={t} className={`border-b pb-1 text-ui-meta italic ${light ? 'border-ui-dark/20' : 'border-white/25'}`}>{t}</div>
        ))}
      </div>
    </div>
  )
  if (layout === 'cinema') return (
    // kétszínű mozijegy: bal tömb a kártya színe, jobb tömb arany; köztük perforált határ, jobbra elforgatott sorszám és QR
    <div className="-m-5 flex flex-1 items-stretch">
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">{head}<div>{title}{big}</div><div className={`text-ui-label ${soft}`}>{L.expires}: {expires} · {L.redeemShort(biz.where)}</div></div>
      <div className="relative flex w-[170px] shrink-0 items-center gap-3 border-l-[3px] border-dotted border-white bg-ui-yellow p-4 text-ui-dark">
        <span className="font-mono text-ui-meta tracking-widest [writing-mode:vertical-rl] rotate-180">{code}</span>
        {qrImg('h-[96px] w-[96px]', 'card')}
      </div>
    </div>
  )
  if (layout === 'tag') return (
    // függő címke: levágott felső sarkok, lyuk zsinórral, keskeny és hosszúkás, a QR alul
    <div className="flex flex-1 flex-col items-center gap-4 pt-2 text-center">
      <span className="relative h-5 w-5 rounded-full bg-white ring-4 ring-black/10">
        <svg viewBox="0 0 40 40" className="pointer-events-none absolute -left-[10px] -top-[30px] h-10 w-10 text-ui-dark/50" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 30 C 6 20, 6 6, 20 2 C 34 6, 34 20, 20 30" /></svg>
      </span>
      {head}
      <div>{title}{big}</div>
      {qrImg('h-[110px] w-[110px]')}
      <div className={`font-mono text-ui-meta ${soft}`}>{code}</div>
      <div className={`text-ui-label ${soft}`}>{L.expires}: {expires}</div>
    </div>
  )
  if (layout === 'wristband') return (
    // karszalag: széles, alacsony csík — a háttérben ismétlődő minta az üzlet nevével, középen az összeg, a végén a QR
    <div className="-m-5 relative flex h-[132px] items-center gap-5 overflow-hidden px-6">
      <span className={`pointer-events-none absolute inset-0 select-none overflow-hidden whitespace-nowrap text-ui-meta uppercase leading-6 tracking-widest ${light ? 'text-ui-dark/[0.07]' : 'text-white/[0.08]'}`}>{Array.from({ length: 6 }, (_, i) => <span key={i} className="block">{Array.from({ length: 8 }, () => `${biz.name} · `).join('')}</span>)}</span>
      <div className="relative shrink-0">{head}</div>
      <div className="relative min-w-0 flex-1 text-center">{title}<div className={`font-light leading-none text-ui-num ${light ? '' : 'text-ui-yellow'}`}>{amount}</div><div className={`mt-1 font-mono text-ui-label ${soft}`}>{code} · lejár: {expires}</div></div>
      <div className="relative">{qrImg('h-[96px] w-[96px]')}</div>
    </div>
  )
  if (layout === 'band') return (
    // felül a szín / a fotó és az összeg, alul fehér sáv a QR-ral, a kóddal és a beváltással (a QR nem takarja a képet)
    <div className="flex flex-col">
      {head}
      <div className="mt-8">{title}</div>
      {big}
      <div className="-mx-5 -mb-5 mt-6 flex items-center gap-4 bg-white p-4 text-ui-text">
        {qrImg('h-[88px] w-[88px]')}
        <div className="min-w-0">
          <div className="text-ui-label text-ui-muted">{L.code}</div>
          <div className="font-mono text-ui-row">{code}</div>
          <div className="mt-1 text-ui-label text-ui-muted">{L.expires}: {expires} · {L.show(biz.where)}</div>
        </div>
      </div>
    </div>
  )
  return (
    // ajándékkártya: bankkártya-arány, fent az üzlet, lent balra az összeg, jobbra kicsiben a QR
    <div className="flex aspect-[1.6/1] flex-col">
      {head}
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0">{title}{big}<div className={`mt-1.5 font-mono text-ui-label ${soft}`}>{code}</div></div>
        {qrImg('h-[64px] w-[64px]')}
      </div>
    </div>
  )
}

/* ── Fizetés a helyszínen (a /design 6.7.1 és 16.7) — szalon ────────────────────────────── */

/** Egy tétel a lezáráskor: a foglalás szolgáltatása, hozzáadott termék / szolgáltatás, vagy levonás (előleg, utalvány). */
export type CheckoutLine = { key: string; name: string; meta?: string; amount: number; kind: 'service' | 'product' | 'deposit' | 'voucher' }
/** Hogyan ad bizonylatot az üzlet: pénztárgépen (nálunk csak rögzítés) vagy a bekötött számlázóból. */
export type ReceiptMode = 'register' | 'invoice'
export const PAY_METHODS = [
  { key: 'cash', label: 'Készpénz', icon: Banknote },
  { key: 'card', label: 'Bankkártya', icon: CreditCard },
  { key: 'transfer', label: 'Átutalás', icon: Landmark },
  /** online, Stripe-on át: QR-kód a pultnál vagy e-mailben küldött link — fizetés után magától lezárul */
  { key: 'link', label: 'Fizetési link', icon: Link2 },
] as const
export type PayMethod = (typeof PAY_METHODS)[number]['key']

const ft = (n: number) => `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('hu-HU')} Ft`
const SAMPLE_CHECKOUT: CheckoutLine[] = [
  { key: 's', name: 'Balayage + vágás', meta: 'Viktória · 150 perc', amount: 42000, kind: 'service' },
  { key: 'p', name: 'Hajpakolás (termék)', meta: '1 db', amount: 6900, kind: 'product' },
  { key: 'd', name: 'Előleg', meta: 'Kártyával fizetve · előlegszámla FB-2026-0412', amount: -10000, kind: 'deposit' },
  { key: 'v', name: 'Ajándékutalvány', meta: '7K2Q-M9XP · maradt 0 Ft', amount: -20000, kind: 'voucher' },
]

/**
 * 6.7.1: Fizetés és lezárás (szalon) — a megnyitott foglalás „Fizetés” gombjára, a vendég távozásakor. Balra a tételek
 * (a foglalás szolgáltatása az árával — átírható —, „+ Tétel”: termék vagy még egy szolgáltatás), alatta a levonások
 * (a már kifizetett előleg az előlegszámla számával, a beváltott utalvány); a fizetési mód. Jobbra a végösszeg és a
 * bizonylat: pénztárgépes üzletnél csak egy mondat (a nyugtát ott adod, itt csak rögzítjük), számlázós üzletnél a
 * „Számla” kapcsoló, magánszemély / cég, a vevő adatai — a számla a bekötött számlázóból megy, az előleget levonja.
 * Lezárás nélkül is befejezhető („Fizetés nélkül zárom”). Étteremnél nincs: ott a POS / pénztárgép számláz.
 */
export function CheckoutModal({ title = 'Fizetés és lezárás', subtitle = 'Juhász Hanna · ma 13:30–16:00', lines = SAMPLE_CHECKOUT, method = 'card', onMethod, mode = 'invoice', invoice = true, onInvoice, buyer = 'company', onBuyer, buyerFields, payLink = 'https://pay.davelopment.hu/p/7K2QM9', stripe = true, onCopyLink, onSendLink, onAddLine, onLineAmount, onLineName, methods, onSkip, onSubmit, onClose, busy = false, stack = false, offHref = '#' }: {
  /** élőben: a tétel összege / (hozzáadott tételnél) neve átírható */
  onLineAmount?: (key: string, amount: number) => void; onLineName?: (key: string, name: string) => void
  /** a beállításban engedélyezett fizetési módok (nélküle mind) */
  methods?: PayMethod[]
  /** a beállítás (Fizetés a helyszínen) — „nem kérek ilyet” kiút az ablak aljáról; null: nincs */
  offHref?: string | null
  /** a fizetési link (QR és másolás); csak bekötött Stripe-pal választható */
  payLink?: string | null; stripe?: boolean; onCopyLink?: () => void; onSendLink?: () => void
  /** egy hasábban (a design telefon-kerete) */
  stack?: boolean
  title?: string; subtitle?: string; lines?: CheckoutLine[]
  method?: PayMethod; onMethod?: (m: PayMethod) => void
  mode?: ReceiptMode; invoice?: boolean; onInvoice?: (on: boolean) => void
  buyer?: 'person' | 'company'; onBuyer?: (b: 'person' | 'company') => void
  /** a vevő adatai (élőben a mezők); nélküle a minta */
  buyerFields?: React.ReactNode
  onAddLine?: () => void; onSkip?: () => void; onSubmit?: () => void; onClose?: () => void; busy?: boolean
}) {
  const items = lines.filter((l) => l.kind === 'service' || l.kind === 'product')
  const deducts = lines.filter((l) => l.kind === 'deposit' || l.kind === 'voucher')
  const total = items.reduce((n, l) => n + l.amount, 0)
  const due = Math.max(0, total + deducts.reduce((n, l) => n + l.amount, 0))
  const withInvoice = mode === 'invoice' && invoice
  const sample = buyerFields === undefined
  const isLink = method === 'link' && due > 0
  const footer = <>
        <Button variant="cell" onClick={onSkip} className={stack ? 'w-full' : 'max-sm:w-full'}>Fizetés nélkül zárom</Button>
        <Button variant="dark" icon={isLink ? Send : Check} onClick={isLink ? onSendLink : onSubmit} loading={busy} className={stack ? 'order-first w-full' : 'max-sm:order-first max-sm:w-full'}>{isLink ? `Link küldése · ${ft(due)}` : withInvoice ? `Lezárás és számla · ${ft(due)}` : `Lezárás · ${ft(due)}`}</Button>
  </>
  const body = (
      <div className={stack ? 'grid gap-5' : 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]'}>
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-ui-meta font-medium text-ui-muted">Tételek</span>
            <Button variant="cell" size="sm" icon={Plus} onClick={onAddLine}>Tétel</Button>
          </div>
          {items.map((l) => (
            <ListRow key={l.key} className="px-0"
              title={onLineName && l.kind === 'product' ? <Input size="sm" value={l.name} onChange={(e) => onLineName(l.key, e.target.value)} placeholder="Tétel neve" aria-label="Tétel neve" className="max-w-[220px]" /> : l.name} meta={l.meta}
              trailing={<span className="flex items-center gap-1.5">{onLineAmount
                ? <Input size="sm" inputMode="numeric" value={l.amount ? l.amount.toLocaleString('hu-HU') : ''} onChange={(e) => onLineAmount(l.key, Number(e.target.value.replace(/\D/g, '')) || 0)} placeholder="0" aria-label={`${l.name} ára`} hug className="text-right" />
                : <Input size="sm" defaultValue={l.amount.toLocaleString('hu-HU')} aria-label={`${l.name} ára`} hug className="text-right" />}<Meta>Ft</Meta></span>} />
          ))}
          {deducts.length > 0 && <>
            <div className="mb-1 mt-4 text-ui-meta font-medium text-ui-muted">Levonás</div>
            {deducts.map((l) => (
              <ListRow key={l.key} className="px-0" leading={<IconCircle tone="cell" icon={l.kind === 'deposit' ? HandCoins : Gift} />} title={l.name} meta={l.meta}
                trailing={<span className="text-ui-body font-medium text-ui-ok">{ft(l.amount)}</span>} />
            ))}
          </>}
          <div className="mb-1.5 mt-4 text-ui-meta font-medium text-ui-muted">Fizetési mód{due === 0 && ' — nincs mit fizetni'}</div>
          <div className={stack ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-2 gap-1.5 sm:grid-cols-4'}>
            {PAY_METHODS.filter((m) => !methods || methods.includes(m.key)).map((m) => {
              const off = due === 0 || (m.key === 'link' && !stripe)
              return (
                <button key={m.key} type="button" className="rounded-ui-inner text-left ui-press" aria-pressed={method === m.key} onClick={onMethod ? () => onMethod(m.key) : undefined} disabled={off}>
                  <OptionCard stacked icon={m.icon} title={m.label} selected={!off && method === m.key} className={off ? 'opacity-50' : ''} />
                </button>
              )
            })}
          </div>
          {offHref && <Meta className="mt-4 text-ui-label">Nem kezelsz itt fizetést? <a href={offHref} className="underline">Kikapcsolhatod</a> — akkor a foglalás egy gombbal zárul.</Meta>}
          {isLink && (
            <Card tone="cell" pad="md" className="mt-1.5 flex items-center gap-4">
              {payLink && <span className="shrink-0 rounded-ui-inner bg-white p-2"><QrSvg url={payLink} className="h-28 w-28" /></span>}
              <div className="min-w-0">
                <div className="text-ui-body text-ui-text">A vendég a telefonján fizet</div>
                <Meta className="mt-0.5">Beolvassa a QR-kódot a pultnál, vagy e-mailben kapja a linket. Kártya, Apple Pay, Google Pay — amint fizetett, a foglalás magától lezárul.</Meta>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button variant="glass" size="sm" icon={Copy} onClick={onCopyLink}>Másolás</Button>
                  <Button variant="glass" size="sm" icon={Mail} onClick={onSendLink}>E-mailben</Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-[5px]">
          <Card tone="dark" pad="md">
            <div className="space-y-1 text-ui-meta text-white/70">
              <div className="flex justify-between"><span>Összesen</span><span className="text-white">{ft(total)}</span></div>
              {deducts.map((l) => <div key={l.key} className="flex justify-between"><span>{l.name}</span><span className="text-white">{ft(l.amount)}</span></div>)}
            </div>
            <div className="mt-4 text-ui-label text-white/55">Fizetendő</div>
            <div className="text-ui-num font-light text-white">{ft(due)}</div>
          </Card>
          <Card tone="cell" pad="md">
            {/* számlázós üzletnél a kapcsoló a cím mellett jobbra — egy sor, kisebb kártya */}
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><FileText className="h-4 w-4" />{mode === 'invoice' ? 'Számla' : 'Bizonylat'}</span>
              {mode === 'invoice' && (onInvoice ? <Switch checked={invoice} onChange={onInvoice} ariaLabel="Kér számlát a vendég?" /> : <DesignSwitch defaultOn={invoice} />)}
            </div>
            {mode === 'invoice' && <Meta className="mt-1 text-ui-label">{invoice ? 'Kér számlát — a lezáráskor e-mailben megkapja' : 'Nem kér számlát — csak a fizetést rögzítjük'}</Meta>}
            {mode === 'register' && isLink ? (
              <Note icon={Receipt} className="mt-2">Online fizetés: a bizonylatot a bekötött számlázó állítja ki — ha nincs, egyeztesd a könyvelőddel, mit adj róla.</Note>
            ) : mode === 'register' ? (
              <Note icon={Receipt} className="mt-2">A nyugtát a pénztárgépen adod — itt csak rögzítjük, mennyit és hogyan fizettek (napi zárás, statisztika).{deducts.length > 0 && <> <strong>A pénztárgépen a teljes összeget üsd be</strong> — a foglaló és az ajándékutalvány csak fizetési mód (befizetéskor áfa nélkül ment, az ÁFA most keletkezik).</>}</Note>
            ) : <>
              {invoice && <>
                <Segmented full size="sm" tone="glass" options={['Magánszemély', 'Cég']} active={buyer === 'company' ? 1 : 0} onSelect={onBuyer ? (i) => onBuyer(i ? 'company' : 'person') : undefined} className="mt-2" />
                <div className="mt-2 space-y-1.5">
                  {sample ? <>
                    <Input size="sm" defaultValue={buyer === 'company' ? 'Juhász és Társa Bt.' : 'Juhász Hanna'} aria-label="Név" />
                    {buyer === 'company' && <Input size="sm" defaultValue="28746512-2-13" aria-label="Adószám" />}
                    <Input size="sm" defaultValue="2040 Budaörs, Szabadság út 14." aria-label="Cím" />
                    <Input size="sm" defaultValue="hanna.juhasz@gmail.com" aria-label="E-mail" />
                  </> : buyerFields}
                </div>
                {deducts.length > 0 && <Meta className="mt-2 text-ui-label">A számla a teljes összegről szól, áfával — a foglaló és az ajándékutalvány rajta fizetési módként szerepel (befizetéskor áfa nélkül ment).</Meta>}
              </>}
            </>}
          </Card>
        </div>
      </div>
  )
  // telefon-keretben (a design mobil-lapja): a lap maga a keret — nincs második panel, nincs X (lehúzással zárható)
  if (stack) return (
    <div>
      <div className="text-ui-sub font-light text-ui-text">{title}</div>
      {subtitle && <Meta className="mt-0.5">{subtitle}</Meta>}
      <div className="mt-4">{body}</div>
      <div className="mt-5 flex flex-col gap-2">{footer}</div>
    </div>
  )
  return (
    <Modal size="lg" title={title} subtitle={subtitle} onClose={onClose} footer={footer}>
      {body}
    </Modal>
  )
}

/**
 * 16.7: Fizetés a helyszínen (szalon) — kérjük-e a fizetést a foglalás lezárásakor, és hogyan ad bizonylatot az üzlet:
 * pénztárgépen (nálunk csak rögzítés: összeg + mód) vagy a bekötött számlázóból (számla a lezáráskor). A fizetési
 * módok, és hogy a számla alapból menjen-e vagy csak kérésre. Élőben `value` + `onChange`; nélküle a minta.
 */
export type OnSiteValue = { enabled: boolean; mode: ReceiptMode; methods: PayMethod[]; invoiceDefault: 'always' | 'ask' }

/**
 * 16.7: Fizetés & számlázás — ugyanaz a lap-felépítés, mint a többi beállítás (Ajándékutalvány, Hírlevél): balra a
 * csoportok, jobbra a kapcsolatok (Stripe, számlázó). Csoportok: (1) Számla — az eladó adatai a számlázó fiókból
 * (Billingo: lekérve, Számlázz.hu: a számlát maga a fiókod adataival állítja ki — itt nincs mit kitölteni), az ÁFA
 * (AAM / 27% — a Billingóból jön, ha ott meg van adva), másolat e-mailben, mikor megy magától számla. (2) Fizetés a
 * helyszínen — fő kapcsoló a sorban; kikapcsolva egy mondat, bekapcsolva a bizonylat módja, a fizetési módok és a
 * számla alapértéke. Élőben az értékek és a kezelők; nélkülük a minta.
 */
/** Szakemberenkénti számlázásnál egy csapattag állapota (16.7). */
export type StaffBillingRow = { key: string; name: string; invoicing: boolean; stripe: boolean; vat?: string | null }
const SAMPLE_STAFF_BILLING: StaffBillingRow[] = [
  { key: 'v', name: 'Viktória', invoicing: true, stripe: true, vat: 'Alanyi adómentes (AAM)' },
  { key: 'd', name: 'Dávid', invoicing: true, stripe: false, vat: 'ÁFA-köteles · 27%' },
  { key: 'c', name: 'Csaba', invoicing: false, stripe: false, vat: null },
]

export function PaymentsSettingsPage({ issuer = 'business', onIssuer, staff = SAMPLE_STAFF_BILLING, voucherIssuer = 'Fodrászat Budapest', provider = 'billingo', keyOk = true, taxNumber = '12345678-1-42', billingHref, copyTo = 'szamla@fodraszat.hu', onSite, onOnSite, aside, save = true }: {
  /** ki számláz: az üzlet (alkalmazottak) vagy szakemberenként (vállalkozók — mindenkinek saját számlázó, adószám, Stripe) */
  issuer?: 'business' | 'staff'; onIssuer?: (v: 'business' | 'staff') => void
  /** szakemberenkénti számlázásnál a csapat állapota */
  staff?: StaffBillingRow[]
  /** az ajándékutalvány kiállítója szakemberenkénti számlázásnál (nem köthető senkihez) */
  voucherIssuer?: string
  provider?: 'szamlazz' | 'billingo' | 'none'
  /** a kulcs működik-e (mentéskor egy próbahívással) */
  keyOk?: boolean
  /** az Előfizetés › Számlázási adatok adószáma — ebből az ÁFA (a 9. jegy), itt csak kiírjuk */
  taxNumber?: string | null; billingHref?: string
  copyTo?: string
  onSite?: OnSiteValue; onOnSite?: (v: OnSiteValue) => void
  aside?: React.ReactNode; save?: boolean
}) {
  const v: OnSiteValue = onSite ?? { enabled: true, mode: 'invoice', methods: ['cash', 'card', 'link'], invoiceDefault: 'ask' }
  const set = (p: Partial<OnSiteValue>) => onOnSite?.({ ...v, ...p })
  const hasInv = provider !== 'none'
  const sw = (on: boolean, fn: ((x: boolean) => void) | undefined, label: string) => fn ? <Switch checked={on} onChange={fn} ariaLabel={label} /> : <DesignSwitch defaultOn={on} />
  return (
    <SettingsPage group="Pénzügy" title="Fizetés & számlázás" save={save}
      status={hasInv ? <StatusPill status="ok">Számlázó bekötve</StatusPill> : <StatusPill status="pending">Nincs számlázó</StatusPill>}
      aside={aside}>
      <SettingsGroup icon={FileText} title="Számla">
        <FieldRow label="Ki számláz?" hint={issuer === 'business' ? 'az üzlet — a csapat alkalmazott' : 'mindenki a saját nevére — a csapat vállalkozó'}>
          <Segmented tone="cell" size="sm" options={['Az üzlet', 'Szakemberenként']} active={issuer === 'staff' ? 1 : 0} onSelect={onIssuer ? (i) => onIssuer(i ? 'staff' : 'business') : undefined} />
        </FieldRow>
        {issuer === 'staff' ? <>
          {/* szakemberenként: a számlát és a pénzt is az kapja, aki a munkát végezte — mindenki a saját profiljában köti be */}
          {staff.map((m) => (
            <FieldRow key={m.key} label={m.name} hint={m.vat ?? 'nincs adószám'}>
              <span className="flex flex-wrap justify-end gap-1">
                <StatusPill status={m.invoicing ? 'ok' : 'pending'}>{m.invoicing ? 'Számlázó' : 'Nincs számlázó'}</StatusPill>
                <StatusPill status={m.stripe ? 'ok' : 'bad'}>{m.stripe ? 'Stripe' : 'Nincs online fizetés'}</StatusPill>
              </span>
            </FieldRow>
          ))}
          <FieldRow label="Ajándékutalványt kiállítja" hint="nem köthető szakemberhez — egy valaki adja ki"><span className="text-ui-body text-ui-text">{voucherIssuer}</span></FieldRow>
          <Note className="mt-2">Mindenki a saját profiljában köti be a számlázóját és a Stripe-ot (Csapat › a munkatárs › Saját számlázás). Akinél nincs Stripe, ott nincs előleg és fizetési link — csak helyszíni fizetés.</Note>
        </> : <>
        {/* egyszerűen: melyik számlázó, a kulcs működik-e — a számla a számlázó fiókod adataival készül, minden más ott van */}
        <FieldRow label="Számlázó" hint={provider === 'none' ? 'nincs bekötve' : 'a számla a fiókod adataival készül'}>
          {provider === 'none' ? <StatusPill status="pending">Nincs</StatusPill> : <span className="flex items-center gap-1.5"><span className="text-ui-body text-ui-text">{provider === 'billingo' ? 'Billingo' : 'Számlázz.hu'}</span><StatusPill status={keyOk ? 'ok' : 'bad'}>{keyOk ? 'Működik' : 'Hibás kulcs'}</StatusPill></span>}
        </FieldRow>
        {(() => {
          const vatInfo = vatFromTaxNumber(taxNumber)
          return (
            <FieldRow label="ÁFA" hint={vatInfo ? `az adószámodból (${taxNumber}) — Előfizetés › Számlázási adatok` : 'add meg az adószámod az Előfizetés › Számlázási adatoknál'}>
              {vatInfo ? <span className="text-ui-body text-ui-text">{vatInfo.label}</span> : <Button variant="cell" size="sm" href={billingHref}>Megadom</Button>}
            </FieldRow>
          )
        })()}
        </>}
        <FieldRow label="Magától megy számla" hint="minden sikeres online fizetés után"><span className="text-ui-body text-ui-text">Előleg · Utalvány · Fizetési link</span></FieldRow>
        <FieldRow label="Másolat ide"><span className="text-ui-body text-ui-text">{copyTo}</span></FieldRow>
      </SettingsGroup>
      <SettingsGroup icon={Wallet} title="Fizetés a helyszínen">
        <FieldRow label="Fizetés a lezáráskor" hint={v.enabled ? 'a foglalás a „Fizetés” gombbal zárul' : 'kikapcsolva — a foglalás egy gombbal zárul, a bevétel az árlistából becsülve'}>
          {sw(v.enabled, onOnSite ? (on) => set({ enabled: on }) : undefined, 'Fizetés a lezáráskor')}
        </FieldRow>
        {v.enabled && <>
          <FieldRow label="Bizonylat" hint={v.mode === 'register' ? 'nálunk csak rögzítés' : 'a lezáráskor, a számlázódból'}>
            <Segmented tone="cell" size="sm" options={['Pénztárgép', 'Számlázó']} active={v.mode === 'invoice' ? 1 : 0} onSelect={onOnSite ? (i) => set({ mode: i && hasInv ? 'invoice' : 'register' }) : undefined} />
          </FieldRow>
          <FieldRow label="Fizetési módok">
            <span className="flex flex-wrap justify-end gap-1">{PAY_METHODS.map((m) => (
              <button key={m.key} type="button" className="rounded-full ui-press" aria-pressed={v.methods.includes(m.key)} onClick={!onOnSite ? undefined : () => set({ methods: v.methods.includes(m.key) ? v.methods.filter((x) => x !== m.key) : [...v.methods, m.key] })}>
                <Pill tone={v.methods.includes(m.key) ? 'dark' : 'cell'}>{m.label}</Pill>
              </button>
            ))}</span>
          </FieldRow>
          {v.mode === 'invoice' && (
            <FieldRow label="Számla" hint="a lezárás ablakában átállítható">
              <Segmented tone="cell" size="sm" options={['Mindig', 'Ha kéri']} active={v.invoiceDefault === 'always' ? 0 : 1} onSelect={onOnSite ? (i) => set({ invoiceDefault: i ? 'ask' : 'always' }) : undefined} />
            </FieldRow>
          )}
          {v.mode === 'register' && <Note className="mt-2">Egy fizetésről egy bizonylat: ha pénztárgépen adsz nyugtát, ugyanarról ne menjen számla is.</Note>}
        </>}
      </SettingsGroup>
    </SettingsPage>
  )
}

/**
 * 10.4 / 16.17 — Saját számlázás (vállalkozó szakember, ha az üzletben „Szakemberenként” számláznak): a saját
 * számlázója (Számlázz.hu / Billingo + kulcs), az adószáma (belőle az ÁFA), és a saját Stripe-fiókja — az előleg és a
 * fizetési link pénze ide érkezik, a számla az ő nevére megy. Stripe nélkül nála nincs online fizetés. Élőben a kezelők;
 * nélkülük a minta.
 */
export function StaffBillingCard({ name = 'Viktória', provider = 'szamlazz', keyOk = true, taxNumber = '87654321-1-41', stripe = 'none', onProvider, onConnectStripe, onManageInvoicing, keyField, taxField, className = '' }: {
  name?: string; provider?: 'szamlazz' | 'billingo' | 'none'; keyOk?: boolean; taxNumber?: string | null
  /** a Stripe-fiók állapota: nincs / félbemaradt / kész */
  stripe?: 'none' | 'pending' | 'ok'
  onProvider?: (p: 'szamlazz' | 'billingo') => void; onConnectStripe?: () => void; onManageInvoicing?: () => void
  /** élőben a kulcs és az adószám mezője */
  keyField?: React.ReactNode; taxField?: React.ReactNode; className?: string
}) {
  const vat = vatFromTaxNumber(taxNumber)
  const kind = provider === 'billingo' ? 'billingo' : 'szamlazz'
  return (
    <div className={`flex flex-col gap-[5px] ${className}`}>
      {/* felül ugyanaz a két kapcsolat-kártya, mint üzlet szinten (16.7) — csak a szakember saját fiókjai */}
      <div className="grid gap-[5px] sm:grid-cols-2">
        <ConnectionCard kind="stripe" desc={`${name} saját Stripe-fiókja: az előleg és a fizetési link pénze ide érkezik.`}
          status={stripe === 'ok' ? { tone: 'ok', label: 'Összekötve' } : stripe === 'pending' ? { tone: 'pending', label: 'Félbemaradt' } : { tone: 'bad', label: 'Nincs összekötve' }}
          btn={{ label: stripe === 'ok' ? 'Kezelés' : stripe === 'pending' ? 'Folytatom' : 'Összekötés', primary: stripe !== 'ok', onClick: onConnectStripe }} />
        <ConnectionCard kind={kind} desc={`A számlák ${name} nevére mennek, a saját számlázó fiókjából.`}
          status={provider === 'none' ? { tone: 'bad', label: 'Nincs összekötve' } : keyOk ? { tone: 'ok', label: 'Összekötve' } : { tone: 'bad', label: 'Hibás kulcs' }}
          btn={{ label: provider === 'none' ? 'Összekötés' : 'Kezelés', primary: provider === 'none', onClick: onManageInvoicing }} />
      </div>
      <Card tone="white" pad="lg" className="max-lg:px-0">
        <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><FileText className="h-4 w-4" />Saját számlázás</div>
        <FieldRow label="Számlázó">
          <Segmented tone="cell" size="sm" options={['Számlázz.hu', 'Billingo']} active={provider === 'billingo' ? 1 : 0} onSelect={onProvider ? (i) => onProvider(i ? 'billingo' : 'szamlazz') : undefined} />
        </FieldRow>
        {keyField && <FieldRow label={provider === 'billingo' ? 'API-kulcs' : 'Agent-kulcs'} hint="a számlázó fiókodban találod">{keyField}</FieldRow>}
        <FieldRow label="Adószám" hint={vat ? vat.label : 'a 9. jegye mutatja az adózást'}>
          {taxField ?? <span className="text-ui-body text-ui-text">{taxNumber || '—'}</span>}
        </FieldRow>
        {stripe !== 'ok' && <Note className="mt-2">Amíg nincs Stripe, {name} foglalásainál nincs előleg és fizetési link — csak helyszíni fizetés.</Note>}
      </Card>
    </div>
  )
}
