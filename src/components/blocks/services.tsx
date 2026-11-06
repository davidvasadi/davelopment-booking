import { AV } from './assets'
import { ArrowUpRight, Check, Clock, GripVertical, Minus, Plus, X } from 'lucide-react'
import { UploadTile, type UploadState } from './upload'
import { Avatar, Button, Card, CardTitle, Field, FieldRow, IconButton, Input, ListRow, Meta, Panel, Pill, SearchField, Select, StatusPill, Textarea, UploadBox, IconCircle } from '@/components/ui-kit'
import { Switch } from '@/components/ui/toggle-switch'
import { MockSwitch as DesignSwitch } from './MockSwitch'
import { smooth } from './charts'
import { BookingSummary } from '@/components/shared/BookingSummary'
import { motion } from 'framer-motion'

/* Szolgáltatások — a /design 8.1–8.5, az élő Szolgáltatások oldal és a landing is ezeket mutatja. Props nélkül
 * a mintaadattal; élőben az adatokkal és a kezelőkkel. */

const thousands = (n: number) => Math.round(n).toLocaleString('hu-HU')
/** „48 000 Ft” / „120 €” */
export const priceLabel = (price: number, currency = 'HUF') => (currency === 'EUR' ? `${thousands(price)} €` : `${thousands(price)} Ft`)

/** Egy munkatárs a kártyán / a „Ki végzi?” választóban. */
export type ServiceStaff = { id: string; name: string; img?: string | null; disabled?: boolean; title?: string }
/** Egy szolgáltatás a rácsban: kép, név, ár, idő, kik végzik, online foglalható-e. */
export type ServiceCardData = { id: string; name: string; img?: string | null; price: number; currency?: string; duration: number; staff: ServiceStaff[]; online: boolean }

const S = (img: string, name: string): ServiceStaff => ({ id: img, name, img: `${AV}/${img}.webp` })
const SAMPLE_CARDS: ServiceCardData[] = [
  { id: 'b', name: 'Balayage + vágás', price: 48000, duration: 150, staff: [S('viktoria', 'Viktória')], online: true, img: '/design/szolgaltatas-balayage.webp' },
  { id: 'f', name: 'Férfi hajvágás', price: 6500, duration: 30, staff: [S('csaba', 'Csaba'), S('dave', 'Dávid')], online: true, img: '/design/szolgaltatas-ferfi.webp' },
  { id: 'g', name: 'Géllakk', price: 8500, duration: 60, staff: [S('szabina', 'Szabina')], online: false, img: '/design/szolgaltatas-gellakk.webp' },
  { id: 'a', name: 'Átmenetes vágás + szakáll', price: 9900, duration: 60, staff: [S('csaba', 'Csaba')], online: true, img: null },
]

/** 8.1: a kategória-szűrő (legördülő, darabszámmal — sok kategóriánál is elfér) és a kereső. Élőben `cats`, `active`,
 *  `onPick`, `query`, `onQuery`. */
export function ServiceFilterBar({ cats = [['Mind', 12], ['Hajvágás', 4], ['Festés', 3], ['Köröm', 3], ['Férfi', 2]], active = 0, onPick, query, onQuery }: { cats?: [string, number][]; active?: number; onPick?: (i: number) => void; query?: string; onQuery?: (q: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Select toolbar aria-label="Kategória" value={onPick ? String(active) : undefined} defaultValue={onPick ? undefined : String(active)} onChange={onPick ? (e) => onPick(Number(e.target.value)) : undefined} className="w-[260px]">
        {cats.map(([t, n], i) => <option key={t} value={i}>{i === 0 ? `Minden kategória (${n})` : `${t} (${n})`}</option>)}
      </Select>
      {onQuery ? <SearchField className="w-[200px]" value={query ?? ''} onChange={onQuery}>Szolgáltatás keresése</SearchField> : <SearchField className="w-[200px]">Szolgáltatás keresése</SearchField>}
    </div>
  )
}

/** 8.1: a legnépszerűbb szolgáltatás sötét kártyája — kép, ár, a hónap foglalásai és a heti trend (sárga vonal). */
export function PopularServiceCard({ s = { id: 'n', name: 'Női hajvágás + szárítás', price: 11900, duration: 60, staff: [], online: true, img: '/design/szolgaltatas-hajvagas.webp' }, count = 86, month = 'októberben', trend = [40, 52, 47, 60, 66, 74, 86], onOpen }: { s?: ServiceCardData; count?: number; month?: string; trend?: number[]; onOpen?: () => void }) {
  const lo = Math.min(...trend), hi = Math.max(...trend)
  return (
    <Card tone="dark" className="flex flex-col">
      {/* a szolgáltatás képe (a szerkesztőben feltöltve) a kártya tetején */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {s.img ? <img src={s.img} alt="" className="mb-4 h-28 w-full rounded-ui-inner object-cover" /> : <UploadBox className="mb-4 h-28 w-full bg-white/10 text-white/55">Kép hozzáadása</UploadBox>}
      <div className="flex items-start justify-between">
        <Pill tone="yellow" size="sm">Legnépszerűbb</Pill>
        <IconButton icon={ArrowUpRight} label="Megnyitás" variant="onDark" size="sm" onClick={onOpen} />
      </div>
      <div className="mt-4 text-ui-title font-normal">{s.name}</div>
      <div className="mt-1 text-ui-num font-light leading-none">{priceLabel(s.price, s.currency)}</div>
      <div className="mt-auto flex items-end justify-between pt-6">
        <div><div className="text-ui-sub font-light leading-none">{count}</div><div className="text-ui-label text-white/50">foglalás {month}</div></div>
        {trend.length > 1 && <svg viewBox="0 0 90 30" className="h-8 w-24"><path d={smooth(trend, 90, 30, lo - (hi - lo || 1) * 0.2, hi + (hi - lo || 1) * 0.1)} fill="none" stroke="var(--ui-yellow)" strokeWidth="2" strokeLinecap="round" /></svg>}
      </div>
    </Card>
  )
}

/** 8.1: egy szolgáltatás kártyája — a kép (nélküle csíkos „Kép hozzáadása” hely), név, ár, idő (és ha van, előleg),
 *  kik végzik (avatarok), online foglalható-e. Élőben `s`, `deposit` (az előleg felirata), `onOpen`. */
export function ServiceCard({ s = SAMPLE_CARDS[0], deposit = s.id === 'b' ? 'Előleg 10 000 Ft' : null, onOpen }: { s?: ServiceCardData; deposit?: string | null; onOpen?: () => void }) {
  return (
    <Card className="flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {s.img ? <img src={s.img} alt="" className="mb-4 h-28 w-full rounded-ui-inner object-cover" /> : <UploadBox className="mb-4 h-28 w-full">Kép hozzáadása</UploadBox>}
      <div className="flex items-start justify-between gap-2">
        <span className="text-ui-row text-ui-text">{s.name}</span>
        <IconButton icon={ArrowUpRight} label="Megnyitás" size="sm" onClick={onOpen} />
      </div>
      <div className="mt-2 text-ui-num font-light leading-none text-ui-text">{priceLabel(s.price, s.currency)}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill tone="glass" size="sm"><Clock className="h-3 w-3" />{s.duration} perc</Pill>
        {deposit && <Pill tone="yellow" size="sm">{deposit}</Pill>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-5">
        <span className="flex -space-x-2">{s.staff.map((a) => <Avatar key={a.id} size="sm" src={a.img ?? null} name={a.name} className="ring-2 ring-ui-cell" />)}</span>
        <StatusPill status={s.online ? 'ok' : 'neutral'}>{s.online ? 'Online foglalható' : 'Csak helyben'}</StatusPill>
      </div>
    </Card>
  )
}

/** 8.1: az új szolgáltatás szaggatott kártyája. */
export function NewServiceCard({ onClick }: { onClick?: () => void }) {
  // a kártya maga a gomb — benne nem lehet még egy gomb, ezért a kör csak jelvény
  const inner = <><IconCircle icon={Plus} tone="glass" className="h-11 w-11" /><span className="mt-2 text-ui-body">Új szolgáltatás</span></>
  const cls = 'flex min-h-[180px] flex-col items-center justify-center rounded-ui-card border-2 border-dashed border-ui-dark/15 text-ui-muted'
  return onClick ? <button type="button" onClick={onClick} className={`${cls} w-full outline-none transition-colors hover:bg-white/40 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{inner}</button> : <div className={cls}>{inner}</div>
}

/** 8.1: a rács — sötét legnépszerűbb kártya, a szolgáltatások, végül az új szolgáltatás kártyája (minta). */
export function ServiceGrid({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-[5px] sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {children ?? <><PopularServiceCard />{SAMPLE_CARDS.map((s) => <ServiceCard key={s.id} s={s} />)}<NewServiceCard /></>}
    </div>
  )
}

/* ── 8.3: szerkesztés ── */

/** A szerkesztő értékei. */
export type ServiceFormValue = { name: string; description: string; categoryId: string; subcategoryId: string; duration: number; price: string; currency: 'HUF' | 'EUR'; staffIds: string[]; online: boolean; img: string | null }
const SAMPLE_FORM: ServiceFormValue = { name: 'Balayage + vágás', description: 'Kézzel festett, természetes átmenet, vágással és szárítással.', categoryId: 'festes', subcategoryId: '', duration: 150, price: '48 000', currency: 'HUF', staffIds: ['viktoria', 'szabina'], online: true, img: null }
const SAMPLE_STAFF: ServiceStaff[] = [S('viktoria', 'Viktória'), S('szabina', 'Szabina'), S('csaba', 'Csaba'), S('dave', 'Dávid')]
const SAMPLE_CATS: [string, string][] = [['festes', 'Festés'], ['hajvagas', 'Hajvágás']]

/** Az űrlap: kép, név, leírás, kategória, alkategória, időtartam, ár + pénznem, ki végzi, online foglalható. `stacked`:
 *  egy hasábban (mobil). Élőben `value`, `onChange`, `categories`, `staff`, `onImage` (a kép feltöltése), `upload` (feltöltés közben, 21.6.2). */
export function ServiceEditForm({ stacked = false, value, onChange, categories = SAMPLE_CATS, staff = SAMPLE_STAFF, onImage, onImageRemove, upload = null, textOnly = false, top, className = '' }: {
  stacked?: boolean
  /** idegen nyelven: csak a fordítható mezők (név, leírás) — a többi közös, magyarul állítható */
  textOnly?: boolean
  /** az űrlap fölött (élőben a nyelvváltó) */
  top?: React.ReactNode
  value?: ServiceFormValue
  onChange?: (v: ServiceFormValue) => void
  categories?: [string, string][]
  staff?: ServiceStaff[]
  onImage?: (file: File) => void
  onImageRemove?: () => void
  /** feltöltés közben (design 21.6.2): előnézet, százalék, „Kicsinyítés”, hiba */
  upload?: UploadState | null
  className?: string
}) {
  const v = value ?? SAMPLE_FORM
  const live = !!onChange
  const set = (p: Partial<ServiceFormValue>) => onChange?.({ ...v, ...p })
  const image = upload
    ? <UploadTile src={upload.src} pct={upload.pct} proc={upload.proc} error={!!upload.error} className="h-[88px] w-[88px] shrink-0 rounded-ui-inner" />
    : v.img
    // eslint-disable-next-line @next/next/no-img-element
    ? <span className="relative block h-[88px] w-[88px] shrink-0"><img src={v.img} alt="" className="h-full w-full rounded-ui-inner object-cover" />{onImageRemove && <IconButton icon={X} label="Kép törlése" variant="glass" size="sm" className="absolute -right-2 -top-2" onClick={onImageRemove} />}</span>
    : <UploadBox className="h-[88px] w-[88px] shrink-0">Kép</UploadBox>
  if (textOnly) {
    return (
      <div className={`space-y-4 ${className}`}>
        {top}
        <Field label="Név"><Input value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Leírás"><Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} className="min-h-[72px]" /></Field>
        <Meta>Az ár, az idő, a kategória, a kép és a munkatársak minden nyelven közösek — magyarul állíthatók.</Meta>
      </div>
    )
  }
  return (
    <div className={`space-y-4 ${className}`}>
      {top}
      <div className="flex gap-3">
        {onImage ? <label className="cursor-pointer">{image}<input type="file" accept="image/*" className="sr-only" disabled={!!upload && !upload.error} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = '' }} /></label> : image}
        <Field label="Név" className="min-w-0 flex-1"><Input value={live ? v.name : undefined} defaultValue={live ? undefined : v.name} onChange={live ? (e) => set({ name: e.target.value }) : undefined} /></Field>
      </div>
      <Field label="Leírás"><Textarea value={live ? v.description : undefined} defaultValue={live ? undefined : v.description} onChange={live ? (e) => set({ description: e.target.value }) : undefined} className="min-h-[72px]" /></Field>
      <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
        <Field label="Kategória">
          <Select value={live ? v.categoryId : undefined} defaultValue={live ? undefined : v.categoryId} onChange={live ? (e) => set({ categoryId: e.target.value }) : undefined}>
            <option value="">Nincs</option>{categories.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
        </Field>
        <Field label="Alkategória">
          <Select value={live ? v.subcategoryId : undefined} defaultValue={live ? undefined : v.subcategoryId} onChange={live ? (e) => set({ subcategoryId: e.target.value }) : undefined}>
            <option value="">Nincs</option>{categories.filter(([id]) => id !== v.categoryId).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </Select>
        </Field>
      </div>
      <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
        <Field label="Időtartam">
          {/* fél óránként léptet (a fél órás és a több órás szolgáltatás is beállítható) — a Létszám-léptető mintája */}
          <span className="flex h-11 items-center gap-1.5">
            <IconButton icon={Minus} label="30 perccel rövidebb" variant="cell" onClick={live ? () => set({ duration: Math.max(15, v.duration - 30) }) : undefined} disabled={live && v.duration <= 15} />
            <span className="min-w-[96px] text-center text-ui-body text-ui-text">{v.duration >= 60 ? `${Math.floor(v.duration / 60)} óra${v.duration % 60 ? ` ${v.duration % 60} perc` : ''}` : `${v.duration} perc`}</span>
            <IconButton icon={Plus} label="30 perccel hosszabb" variant="cell" onClick={live ? () => set({ duration: Math.min(720, v.duration + 30) }) : undefined} />
          </span>
        </Field>
        <Field label="Ár">
          <div className="flex gap-1.5">
            <Input value={live ? v.price : undefined} defaultValue={live ? undefined : v.price} inputMode="numeric" onChange={live ? (e) => set({ price: e.target.value }) : undefined} className="min-w-0 flex-1" />
            <Select value={live ? v.currency : undefined} defaultValue={live ? undefined : v.currency} onChange={live ? (e) => set({ currency: e.target.value as 'HUF' | 'EUR' }) : undefined} className="w-[96px]"><option value="HUF">HUF</option><option value="EUR">EUR</option></Select>
          </div>
        </Field>
      </div>
      <Field label="Ki végzi?">
        <div className="flex flex-wrap gap-1.5">
          {staff.map((p) => {
            const on = v.staffIds.includes(p.id)
            const pill = <Pill tone={on ? 'dark' : 'cell'} size="lg" className="pl-1.5"><Avatar src={p.img ?? null} name={p.name} size="sm" />{p.name}{on && <Check className="h-3.5 w-3.5" />}</Pill>
            return live
              ? <button key={p.id} type="button" disabled={p.disabled} title={p.title} onClick={() => set({ staffIds: on ? v.staffIds.filter((x) => x !== p.id) : [...v.staffIds, p.id] })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-not-allowed disabled:opacity-50">{pill}</button>
              : <span key={p.id}>{pill}</span>
          })}
        </div>
      </Field>
      <FieldRow boxed label="Online foglalható" hint="Kikapcsolva csak a dashboardon rögzíthető.">{live ? <Switch checked={v.online} onChange={(on) => set({ online: on })} ariaLabel="Online foglalható" /> : <DesignSwitch />}</FieldRow>
    </div>
  )
}

/** Jobb oszlop (szürke, mint az Új foglalás összegzése — ugyanaz a komponens): a szolgáltatás neve és kategóriája, sötét
 *  kártyán az ár és az idő, alatta kik végzik, online foglalható-e, az előleg és a hónap számai; legalul a gombok.
 *  Szerkesztés közben frissül. Élőben `value`, `staff`, `category`, `month`, `count`, `revenue`, `deposit`, `actions`. */
export function ServiceSummary({ value, staff = SAMPLE_STAFF, category = 'Festés', month = 'Októberben', count = 12, revenue = 576000, deposit = 'Előleg 10 000 Ft', actions }: { value?: ServiceFormValue; staff?: ServiceStaff[]; category?: string; month?: string; count?: number; revenue?: number; deposit?: string | null; actions?: React.ReactNode }) {
  const v = value ?? SAMPLE_FORM
  const price = Number(String(v.price).replace(/\s/g, '')) || 0
  const who = staff.filter((p) => v.staffIds.includes(p.id)).map((p) => p.name).join(', ')
  return (
    <BookingSummary
      title="Összefoglaló"
      name={v.name || 'Új szolgáltatás'}
      sub={category || undefined}
      day="Ár"
      time={priceLabel(price, v.currency)}
      until={`${v.duration} perc`}
      rows={[
        ['Ki végzi', who || '—'],
        ['Online foglalható', v.online ? 'Igen' : 'Csak helyben'],
        ...(deposit ? [['Előleg', deposit.replace(/^Előleg /, '')] as [string, string]] : []),
        [month, `${count} foglalás · ${revenue >= 1000 ? `${thousands(revenue / 1000)} e Ft` : `${thousands(revenue)} Ft`}`],
      ]}
      actions={actions ?? <><Button>Mentés</Button><Button variant="bad">Törlés</Button></>}
    />
  )
}

/* ── 8.4: kategóriák ── */

/** Egy kategória a listában: név, időtartam-felirat, hány szolgáltatás. */
export type CategoryRow = { id: string; name: string; durationLabel: string; count: number }
export type CategoryFormValue = { name: string; durationLabel: string; description: string; img: string | null }
const SAMPLE_CAT_ROWS: CategoryRow[] = ([['h', 'Hajvágás', '30–60 perc', 4], ['f', 'Festés', '90–180 perc', 3], ['k', 'Köröm', '45–60 perc', 3], ['ff', 'Férfi', '30–60 perc', 2]] as const).map(([id, name, durationLabel, count]) => ({ id, name, durationLabel, count }))

/** 8.4 bal: a kategóriák sorrendben, fogással áthúzhatók; soronként az időtartam-felirat és hány szolgáltatás tartozik
 *  bele. Élőben `rows` (a megjelenítendő sorrendben), `openId`, `onOpen`, `onCreate`, `rowProps` (az áthúzás kezelői
 *  soronként — `useSortable`), `dragging` (a húzott sor, kiemelve). */
export function CategoryList({ rows = SAMPLE_CAT_ROWS, openId = 'f', onOpen, onCreate, rowProps, dragging, bare = false, className = '' }: { rows?: CategoryRow[]; openId?: string | null; onOpen?: (id: string) => void; onCreate?: () => void; rowProps?: (id: string) => React.HTMLAttributes<HTMLDivElement>; dragging?: string | null; /** felugró ablakban: csak a sorok (a cím és az „Új kategória” az ablak fejlécében) */ bare?: boolean; className?: string }) {
  const Box = bare ? 'div' : Card
  return (
    <Box {...(bare ? {} : { pad: 'sm' as const })} className={className}>
      {!bare && (
        <div className="flex items-center justify-between px-3 pb-2 pt-1">
          <CardTitle>Kategóriák</CardTitle>
          <Button variant="yellow" size="sm" icon={Plus} onClick={onCreate}>Új kategória</Button>
        </div>
      )}
      <div className="space-y-1">
        {rows.length === 0 && <Meta className="px-3 py-3">Még nincs kategória.</Meta>}
        {rows.map((r) => {
          const open = r.id === openId
          const row = <ListRow filled open={open} leading={<GripVertical className={`h-4 w-4 shrink-0 text-ui-muted ${rowProps ? 'cursor-grab' : ''}`} />} title={r.name} meta={`${r.count} szolgáltatás`} trailing={r.durationLabel ? <Pill tone={open ? 'white' : 'cell'} size="sm"><Clock className="h-3 w-3" />{r.durationLabel}</Pill> : undefined} />
          return onOpen
            ? <motion.div key={r.id} layout transition={{ type: 'spring', stiffness: 500, damping: 40 }} role="button" tabIndex={0}
                onClick={() => onOpen(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id) }} {...(rowProps?.(r.id) as object)}
                className={`cursor-pointer rounded-ui-inner outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ui-dark/20 ${dragging === r.id ? 'relative z-10 shadow-ui-float ring-2 ring-ui-yellow' : ''}`}>{row}</motion.div>
            : <div key={r.id}>{row}</div>
        })}
      </div>
    </Box>
  )
}

/** 8.4 jobb: a kijelölt kategória adatai — borítókép (a foglalóoldalra), név, időtartam-felirat, leírás. Élőben `value`,
 *  `onChange`, `onImage`, `upload`, `onSave`, `onCancel`, `onDelete`, `busy`. */
export function CategoryEditPanel({ value, onChange, onImage, onImageRemove, upload = null, onSave, onCancel, onDelete, busy = false, textOnly = false, top, bare = false, className = '' }: { value?: CategoryFormValue; onChange?: (v: CategoryFormValue) => void; onImage?: (file: File) => void; onImageRemove?: () => void; upload?: UploadState | null; onSave?: () => void; onCancel?: () => void; onDelete?: () => void; busy?: boolean; /** idegen nyelven: a borítókép közös, nem látszik */ textOnly?: boolean; /** a mezők fölött (élőben a nyelvváltó) */ top?: React.ReactNode; /** felugró ablak oldalsávjában: keret és bezáró nélkül, a gombok egymás alatt */ bare?: boolean; className?: string }) {
  const v = value ?? { name: 'Festés', durationLabel: '90–180 perc', description: 'Teljes festés, tőfestés, melír és balayage.', img: null }
  const live = !!onChange
  const set = (p: Partial<CategoryFormValue>) => onChange?.({ ...v, ...p })
  const cover = upload
    ? <UploadTile src={upload.src} pct={upload.pct} proc={upload.proc} error={!!upload.error} className="h-[110px] rounded-ui-inner" />
    : v.img
    // eslint-disable-next-line @next/next/no-img-element
    ? <span className="relative block h-[110px]"><img src={v.img} alt="" className="h-full w-full rounded-ui-inner object-cover" />{onImageRemove && <IconButton icon={X} label="Kép törlése" variant="glass" size="sm" className="absolute right-2 top-2" onClick={onImageRemove} />}</span>
    : <UploadBox className="h-[110px]">Borítókép a foglalóoldalra</UploadBox>
  const fields = (
    <div className={`space-y-4 ${bare ? '' : 'mt-4'}`}>
      {top}
      {textOnly ? null : onImage ? <label className="block cursor-pointer">{cover}<input type="file" accept="image/*" className="sr-only" disabled={!!upload && !upload.error} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = '' }} /></label> : cover}
      <Field label="Név"><Input value={live ? v.name : undefined} defaultValue={live ? undefined : v.name} onChange={live ? (e) => set({ name: e.target.value }) : undefined} /></Field>
      <Field label="Időtartam felirat" hint="A foglalóoldalon a kategória neve mellett."><Input value={live ? v.durationLabel : undefined} defaultValue={live ? undefined : v.durationLabel} placeholder="pl. 30–60 perc" onChange={live ? (e) => set({ durationLabel: e.target.value }) : undefined} /></Field>
      <Field label="Leírás"><Textarea value={live ? v.description : undefined} defaultValue={live ? undefined : v.description} onChange={live ? (e) => set({ description: e.target.value }) : undefined} /></Field>
    </div>
  )
  if (bare) {
    return (
      <div className={`flex flex-1 flex-col px-6 pb-6 ${className}`}>
        <div className="mb-3 text-ui-body text-ui-muted">{v.name || 'Új kategória'}</div>
        {fields}
        <div className="mt-auto flex flex-col gap-2 pt-6">
          {onSave && <Button onClick={onSave} loading={busy}>Mentés</Button>}
          {onDelete && <Button variant="bad" onClick={onDelete} disabled={busy}>Törlés</Button>}
        </div>
      </div>
    )
  }
  return (
    <Panel className={className}>
      <div className="flex items-center justify-between"><CardTitle>{v.name || 'Új kategória'}</CardTitle><IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onCancel} /></div>
      {fields}
      <div className="mt-5 flex justify-end gap-1.5">
        {onDelete && <Button variant="bad" className="mr-auto" onClick={onDelete} disabled={busy}>Törlés</Button>}
        <Button variant="cell" onClick={onCancel}>Mégse</Button><Button onClick={onSave} loading={busy}>Mentés</Button>
      </div>
    </Panel>
  )
}

/* ── 8.5: mobil ── */

/** Mobil: egy szolgáltatás alacsony sorban — balra a kép (nélküle csíkos hely), a név, alatta az idő és kik végzik
 *  (előleggel), jobbra az ár. A legnépszerűbb sötét soron, „Legnépszerűbb” jelöléssel, a hónap foglalásaival és a kis
 *  trendvonallal. Élőben `s`, `popular`, `deposit`, `onOpen`. */
export function ServiceRow({ s = SAMPLE_CARDS[0], popular, deposit, onOpen }: { s?: ServiceCardData; popular?: { count: number; month: string; trend: number[] }; deposit?: string | null; onOpen?: () => void }) {
  const dark = !!popular
  const lo = popular ? Math.min(...popular.trend) : 0, hi = popular ? Math.max(...popular.trend) : 0
  const meta = [`${s.duration} perc`, s.staff.map((p) => p.name).join(', '), deposit ? 'előleg' : null].filter(Boolean).join(' · ')
  const body = (
    <Card tone={dark ? 'dark' : undefined} pad="sm" className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {s.img ? <img src={s.img} alt="" className="h-14 w-14 shrink-0 rounded-ui-inner object-cover" /> : <UploadBox className="h-14 w-14 shrink-0 px-0">{null}</UploadBox>}
      <span className="min-w-0 flex-1">
        {popular && <Pill tone="yellow" size="sm" className="mb-1">Legnépszerűbb</Pill>}
        <span className={`block truncate text-ui-row ${dark ? 'text-white' : 'text-ui-text'}`}>{s.name}</span>
        <span className={`block truncate text-ui-label ${dark ? 'text-white/55' : 'text-ui-muted'}`}>{popular ? `${popular.count} foglalás ${popular.month}` : meta}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-ui-title font-light ${dark ? 'text-white' : 'text-ui-text'}`}>{priceLabel(s.price, s.currency)}</span>
        {popular && popular.trend.length > 1 && <svg viewBox="0 0 90 30" className="h-6 w-16"><path d={smooth(popular.trend, 90, 30, lo - (hi - lo || 1) * 0.2, hi + (hi - lo || 1) * 0.1)} fill="none" stroke="var(--ui-yellow)" strokeWidth="2" strokeLinecap="round" /></svg>}
        {!popular && !s.online && <StatusPill status="neutral">Csak helyben</StatusPill>}
      </span>
    </Card>
  )
  return onOpen ? <button type="button" onClick={onOpen} className="block w-full rounded-ui-card text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{body}</button> : body
}

/** Mobil (8.5): elöl a legnépszerűbb, utána kategóriánként (szaggatott fejléc, darabszám) a szolgáltatás-sorok.
 *  Élőben `popular` és `groups` (a sorok már összerakva). */
export function MobileServiceList({ popular, groups }: { popular?: React.ReactNode; groups?: { h: string; rows: React.ReactNode[] }[] }) {
  const list = groups ?? [{ h: 'Festés', rows: [<ServiceRow key="b" s={SAMPLE_CARDS[0]} deposit="Előleg 10 000 Ft" />] }, { h: 'Férfi', rows: SAMPLE_CARDS.slice(1).map((c) => <ServiceRow key={c.id} s={c} />) }]
  return (
    <>
      {popular ?? <ServiceRow s={{ id: 'n', name: 'Női hajvágás + szárítás', price: 11900, duration: 60, staff: [], online: true, img: '/design/szolgaltatas-hajvagas.webp' }} popular={{ count: 86, month: 'októberben', trend: [40, 52, 47, 60, 66, 74, 86] }} />}
      {list.map((g) => (
        <div key={g.h} className="mt-4">
          <div className="mb-1.5 flex items-center gap-2 text-ui-label text-ui-muted">{g.h}<span className="h-px flex-1 border-t border-dashed border-ui-divider" />{g.rows.length}</div>
          <div className="space-y-[5px]">{g.rows}</div>
        </div>
      ))}
    </>
  )
}

