'use client'

import { useState } from 'react'
import { X, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock, FileText, MessageSquare, Minus, MoreHorizontal, Pencil, Phone, Plus, Sparkles, Upload, UserRound, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MockSwitch as DesignSwitch } from './MockSwitch'
import { Legend, smooth, tipStyle } from './charts'
import { Switch } from '@/components/ui/toggle-switch'
import { UploadTile, type UploadState } from './upload'
import { detectPlatform, socialIconDataUri, SOCIAL_LABELS } from '@/lib/socialLinks'
import { Avatar, Button, Card, Checkbox, Field, IconButton, IconCircle, Modal, UploadBox, Input, ListRow, Meta, NavItem, OptionCard, Panel, Note, Pagination, Pill, SegmentBar, Segmented, StatusPill, Table, Td, Textarea, Th, Tr, RowCheck, type Status, MarqueeText } from '@/components/ui-kit'

/* Csapat-kártyák (design 10.x, 16.4) — az élő Munkatársak oldal (TeamView) és a /design ugyanezeket rendereli:
   props nélkül mintaadattal, élőben a valós adattal és kezelőkkel. */

const AV = '/landing/funkciok/csapat/avatar'

/** Előnézet: mit lát / kap a vendég — sötét kártya kis címkével, alatta az idézet (nem figyelmeztetés, nem súgó). */
export function GuestSees({ label = 'A vendég így látja', children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card tone="dark" inner pad="sm" className={className}>
      <Meta dark className="text-ui-label">{label}</Meta>
      <div className="mt-1 text-ui-body leading-relaxed">{children}</div>
    </Card>
  )
}

/* ── 16.4: meghívás ── */

export type InviteValue = { email: string; name: string; roleId: string; profile: string }
export type InviteRole = { id: string; label: string; desc: string }
export type InviteProfile = { id: string; title: string; desc: string }
const SAMPLE_INVITE: InviteValue = { email: 'nora.kiss@gmail.com', name: 'Kiss Nóra', roleId: 'rec', profile: 'none' }
const SAMPLE_ROLES: InviteRole[] = [{ id: 'rec', label: 'Recepció', desc: 'Foglalás, vendégek' }, { id: 'pro', label: 'Szakember', desc: 'Saját naptár' }, { id: 'lead', label: 'Vezető', desc: 'Majdnem minden' }]
const SAMPLE_PROFILES: InviteProfile[] = [{ id: 'new', title: 'Új profil létrehozása', desc: 'foglalható lesz, a Naptárban megjelenik' }, { id: 'none', title: 'Nem foglalható', desc: 'csak a rendszert kezeli (pl. recepció)' }, { id: 'bence', title: 'Meglévő: Kis Bence', desc: 'összeköti a fiókot a profillal' }]

/** 16.4: munkatárs meghívása — e-mail, név, szerep, munkatárs-profil (szalon), amit a meghívott kap.
 *  `stacked`: egy hasábban (keskeny helyre, pl. landing). Élőben: `value` / `onChange`, `roles`, `profiles`, `preview`. */
export function InviteModal({ stacked = false, value = SAMPLE_INVITE, onChange, roles = SAMPLE_ROLES, profiles = SAMPLE_PROFILES, preview = '„Dávid meghívott a Fodrászat Budapest csapatába (Recepció). A meghívó 7 napig érvényes.”', submitLabel = 'Meghívó küldése', onSubmit, onCancel, busy = false, className = '' }: {
  stacked?: boolean
  value?: InviteValue
  onChange?: (v: InviteValue) => void
  roles?: InviteRole[]
  /** üres: nincs profil-választás (étterem — nem foglalható senki) */
  profiles?: InviteProfile[]
  preview?: React.ReactNode
  submitLabel?: string
  onSubmit?: () => void
  onCancel?: () => void
  busy?: boolean
  className?: string
}) {
  const live = !!onChange
  const set = (p: Partial<InviteValue>) => onChange?.({ ...value, ...p })
  const pick = (on: boolean, card: React.ReactNode, act: () => void, key: string) => live
    ? <button key={key} type="button" aria-pressed={on} onClick={act} className="block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{card}</button>
    : <div key={key}>{card}</div>
  return (
    <Panel pad="lg" size={stacked ? 'md' : 'xl'} className={`mx-auto ${stacked ? '' : 'lg:w-[min(1040px,calc(100vw-4rem))]'} ${className}`}>
      <div className="flex items-center justify-between"><span className="text-ui-sub font-light text-ui-text">Munkatárs meghívása</span><IconButton icon={X} label="Bezárás" variant="cell" size="sm" onClick={onCancel} /></div>
      <div className={`grid gap-x-6 ${stacked ? '' : 'lg:grid-cols-2'}`}>
        <div>
          <Field label="E-mail" className="mt-4"><Input type="email" value={value.email} readOnly={!live} onChange={(e) => set({ email: e.target.value })} placeholder="nev@email.hu" /></Field>
          <Field label="Név" className="mt-4"><Input value={value.name} readOnly={!live} onChange={(e) => set({ name: e.target.value })} placeholder="Kiss Nóra" /></Field>
          <div className="mt-4 text-ui-meta text-ui-muted">Szerep</div>
          <div className={`mt-1.5 grid gap-1.5 ${stacked ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-3'}`}>
            {roles.map((r) => pick(value.roleId === r.id, <OptionCard title={r.label} selected={value.roleId === r.id} className="block">{r.desc}</OptionCard>, () => set({ roleId: r.id }), r.id))}
          </div>
        </div>
        <div>
          {profiles.length > 0 && <>
            <div className="mt-4 text-ui-meta text-ui-muted">Munkatárs-profil</div>
            <div className="mt-1.5 space-y-1">
              {profiles.map((p) => pick(value.profile === p.id, <OptionCard radio title={p.title} selected={value.profile === p.id}>{p.desc}</OptionCard>, () => set({ profile: p.id }), p.id))}
            </div>
          </>}
          {preview && <GuestSees label={`${value.name || 'A meghívott'} ezt kapja`} className="mt-4">{preview}</GuestSees>}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 max-lg:[&>*]:min-w-0 max-lg:[&>*]:flex-1">
        <Button variant="cell" onClick={onCancel}>Mégse</Button>
        <Button variant="dark" onClick={onSubmit} loading={busy}>{submitLabel}</Button>
      </div>
    </Panel>
  )
}

/* ── 10.1: a lista ── */

export type StaffTableRow = { key: string; name: string; img: string | null; position: string; email: string; join: string; hours: string; over: number | null; tone?: 'ok' | 'bad'; role: string; status: Status; statusLabel: string; owner: boolean; muted?: boolean; review?: boolean }
const SAMPLE_ROWS: StaffTableRow[] = [
  { key: 'dave', name: 'Dávid', img: `${AV}/dave.webp`, position: 'Tulajdonos', email: 'hello@davelopment.hu', join: '2023. Jan. 2.', hours: '39 / 40', over: null, tone: 'ok', role: 'Tulajdonos', status: 'ok', statusLabel: 'Aktív', owner: true },
  { key: 'viktoria', name: 'Viktória', img: `${AV}/viktoria.webp`, position: 'Stylist', email: 'viktoria@davelopment.hu', join: '2024. Márc. 4.', hours: '32 / 40', over: null, tone: 'ok', role: 'Szakember', status: 'ok', statusLabel: 'Aktív', owner: false },
  { key: 'csaba', name: 'Csaba', img: `${AV}/csaba.webp`, position: 'Barber', email: 'csaba@davelopment.hu', join: '2024. Aug. 19.', hours: '52 / 40', over: 12, tone: 'bad', role: 'Szakember', status: 'ok', statusLabel: 'Aktív', owner: false },
  { key: 'szabina', name: 'Szabina', img: `${AV}/szabina.webp`, position: 'Recepció', email: 'szabina@davelopment.hu', join: '2025. Jún. 1.', hours: '16 / 20', over: null, tone: 'ok', role: 'Recepció', status: 'pending', statusLabel: 'Meghívott', owner: false },
  { key: 'bence', name: 'Kis Bence', img: null, position: 'Stylist', email: '—', join: '2025. Febr. 10.', hours: '— / 30', over: null, role: 'Szakember', status: 'neutral', statusLabel: 'Felfüggesztett', owner: false, muted: true },
]

/** 10.1: a munkatársak táblázata — pipával kijelölt sor fehér, a megnyitott sárga, a felfüggesztett halvány; alul lapozó,
 *  kijelölésnél a sötét tömeges-művelet sáv (`bulk`). `actions`: a sor végi ⋯ (élőben menü). */
export function StaffTable({ more, rows = SAMPLE_ROWS, openKey = 'viktoria', selected = ['csaba', 'szabina'], onOpen, onToggle, onToggleAll, actions, page = 1, pages = 2, label = '1–5 / 6 munkatárs', onPage, bulk, empty, th, className = '' }: { /** görgetésre töltés a lapozó előtt (LoadMoreSentinel) */ more?: React.ReactNode;
  rows?: StaffTableRow[]
  openKey?: string | null
  selected?: string[]
  onOpen?: (key: string) => void
  onToggle?: (key: string) => void
  onToggleAll?: () => void
  actions?: (row: StaffTableRow) => React.ReactNode
  page?: number
  pages?: number
  label?: string
  onPage?: (p: number) => void
  bulk?: React.ReactNode
  empty?: React.ReactNode
  /** rendezés az oszlopcímre kattintva (`lib/tableSort` `th`) */
  th?: (key: string) => { sort: 'asc' | 'desc' | null; onSort: () => void }
  className?: string
}) {
  const sample = !onOpen
  const showBulk = sample || (bulk && selected.length > 0)
  const selectable = rows.filter((r) => !r.owner)
  const all = selectable.length > 0 && selectable.every((r) => selected.includes(r.key))
  return (
    <div className={`relative min-w-0 ${className}`}>
    <Card pad="sm" className={`overflow-x-auto ${showBulk ? 'pb-20' : ''}`}>
      {rows.length === 0 && empty ? empty : (
        <Table minWidth={860}>
          <thead><Tr><Th className="w-10"><RowCheck checked={all} onToggle={onToggleAll} label="Mind kijelölése" /></Th>{([['name', 'Név'], ['position', 'Pozíció'], [null, 'Elérhetőség'], ['login', 'Belépés'], ['hours', 'Heti óra'], ['role', 'Szerep'], ['status', 'Állapot'], [null, '']] as const).map(([k, h], i) => <Th key={i} {...(k ? th?.(k) : undefined)}>{h}</Th>)}</Tr></thead>
          <tbody>
            {rows.map((r) => {
              // fehér kártya-sorok; a kijelölt sárga, a megnyitott sárga; hoverre halványodik; a felfüggesztett halvány
              const on = r.key === openKey || selected.includes(r.key)
              // a felfüggesztett sor halvány — de csak a cellák tartalma, a sor végi menü (⋯) nem (különben átlátszó lenne)
              return (
                <Tr key={r.key} onClick={onOpen ? () => onOpen(r.key) : undefined} className={`${on ? '[&>td]:bg-ui-yellow [&:hover>td]:bg-ui-yellow/80' : '[&>td]:bg-white [&:hover>td]:bg-white/60'} ${r.muted && !on ? '[&>td:not(:last-child)>*]:opacity-55' : ''}`}>
                  <Td>{r.owner ? <span className="block h-6 w-6" /> : <RowCheck checked={selected.includes(r.key)} onToggle={onToggle ? () => onToggle(r.key) : undefined} />}</Td>
                  <Td><span className="flex items-center gap-2.5"><Avatar src={r.img} name={r.name} /><span className={r.muted ? 'line-through' : ''}>{r.name}</span>{r.owner && <Pill tone="dark" size="sm">Tulajdonos</Pill>}{r.review && <StatusPill status="warn">Nézd át</StatusPill>}</span></Td>
                  <Td>{r.position || <span className="text-ui-muted">—</span>}</Td>
                  <Td><Meta>{r.email || '—'}</Meta></Td>
                  <Td>{r.join}</Td>
                  {/* heti óra: az egészséges határ (48 ó) fölött piros, alatta zöld; a szerződéshez képesti többlet zárójelben */}
                  <Td><span className={r.tone === 'bad' ? 'text-ui-bad' : r.tone === 'ok' ? 'text-ui-ok' : ''}>{r.hours}{r.over ? ` (+${r.over})` : ''}</span></Td>
                  <Td>{r.role}</Td>
                  <Td><StatusPill status={r.status}>{r.statusLabel}</StatusPill></Td>
                  <Td>{actions ? actions(r) : <IconButton icon={MoreHorizontal} size="sm" variant="ghost" label="Műveletek" />}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      )}
      {more}
      {(sample || pages > 1) && <Pagination page={page} pages={pages} label={label} onPage={onPage} className="mt-3 px-2" />}
    </Card>
    {showBulk && <BulkDock>{bulk ?? <StaffBulkBar />}</BulkDock>}
    </div>
  )
}

export type BulkAction = { label: string; onClick?: () => void; danger?: boolean }
/** A kijelöltek sötét sávja (10.1): darabszám, műveletek, a kijelölés törlése. */
export function StaffBulkBar({ count = 2, actions = [{ label: 'Szerep módosítása' }, { label: 'Meghívó újraküldése' }, { label: 'Export' }, { label: 'Felfüggesztés', danger: true }], onClear }: { count?: number; actions?: BulkAction[]; onClear?: () => void }) {
  return (
    <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-ui-dark p-1.5 pl-4 text-ui-body text-white shadow-ui-float">
      <span className="mr-2 whitespace-nowrap"><span className="text-ui-yellow">{count}</span> kijelölve</span>
      {actions.map((a) => a.danger
        ? <Button key={a.label} variant="onDark" size="sm" className="text-ui-bad-bg" onClick={a.onClick}>{a.label}</Button>
        : <Button key={a.label} variant="ghostDark" size="sm" onClick={a.onClick}>{a.label}</Button>)}
      <IconButton icon={X} label="Kijelölés törlése" size="sm" variant="ghostDark" onClick={onClear} />
    </div>
  )
}

/** A tömeges-művelet sáv helye egy lista alatt — minden listán így: kijelöléskor rugósan („genie”) beúszik alulról, a
 *  lista végén ül, de görgetéskor mindig a képernyő alján marad (ragadós), mobilon az alsó menü fölött. A lista alá kerül
 *  (nem a görgethető kártyába), a lista alján `pb-20` hely kell. */
export function BulkDock({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`pointer-events-none sticky bottom-4 z-30 -mt-16 flex justify-center px-4 max-lg:bottom-24 ${className}`}>
      <div className="ui-dock-in pointer-events-auto max-w-full">{children}</div>
    </div>
  )
}

/* ── 10.2: a munkatárs nézete ── */

export type StaffCardRow = { key: string; name: string; position: string; img: string | null; util: number | null; utilLabel: string }
const SAMPLE_CARDS: StaffCardRow[] = [
  { key: 'viktoria', name: 'Viktória', position: 'Stylist', img: `${AV}/viktoria.webp`, util: 92, utilLabel: '92% foglalt a héten' },
  { key: 'csaba', name: 'Csaba', position: 'Barber', img: `${AV}/csaba.webp`, util: 78, utilLabel: '78% foglalt a héten' },
  { key: 'szabina', name: 'Szabina', position: 'Recepció', img: `${AV}/szabina.webp`, util: 64, utilLabel: '64% foglalt a héten' },
  { key: 'dave', name: 'Dávid', position: 'Tulajdonos', img: `${AV}/dave.webp`, util: 71, utilLabel: '71% foglalt a héten' },
]

/** 10.2 bal oszlop: munkatárs-kártyák a heti kihasználtsággal, alul lapozó. */
export function StaffListCard({ rows = SAMPLE_CARDS, openKey = 'viktoria', total = '6 fő', onOpen, page = 1, pages = 2, label = '1–4 / 6', onPage, className = '' }: {
  rows?: StaffCardRow[]
  openKey?: string | null
  total?: string
  onOpen?: (key: string) => void
  page?: number
  pages?: number
  label?: string
  onPage?: (p: number) => void
  className?: string
}) {
  return (
    <Card pad="xs" className={`flex flex-col ${className}`}>
      <div className="flex items-baseline justify-between px-3 pb-1 pt-2"><span className="text-ui-row text-ui-text">Munkatársak</span><span className="text-ui-meta text-ui-muted">{total}</span></div>
      <div className="space-y-1">
        {rows.map((p) => {
          const body = (
            <>
              <div className="flex items-center gap-2.5">
                <Avatar size="md" src={p.img} name={p.name} />
                <span className="min-w-0 flex-1"><MarqueeText className="text-ui-body text-ui-text">{p.name}</MarqueeText><MarqueeText className="text-ui-label text-ui-muted">{p.position || '—'}</MarqueeText></span>
                <IconCircle icon={ArrowUpRight} tone="cell" size="md" />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-ui-label text-ui-muted"><span>{p.utilLabel}</span></div>
              <div className="mt-1 flex h-[6px] gap-0.5 overflow-hidden rounded-full"><span className="rounded-full bg-ui-ok-dot" style={{ width: `${p.util ?? 0}%` }} /><span className="flex-1 rounded-full ui-hatch-cell" /></div>
            </>
          )
          const cls = `block w-full rounded-ui-inner p-3 text-left ${p.key === openKey ? 'bg-white' : ''}`
          return onOpen
            ? <button key={p.key} type="button" onClick={() => onOpen(p.key)} className={`${cls} outline-none transition-colors hover:bg-white/60 focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{body}</button>
            : <div key={p.key} className={cls}>{body}</div>
        })}
      </div>
      {pages > 1 && <Pagination page={page} pages={pages} label={label} onPage={onPage} className="mt-auto px-1 pt-3" />}
    </Card>
  )
}

/** 10.2 közép: a munkatárs nagy fotója (kép nélkül a monogram). */
export function StaffPhoto({ src = `${AV}/viktoria.webp`, name = 'Viktória', className = '' }: { src?: string | null; name?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-ui-card bg-white ${className}`} style={{ aspectRatio: '0.85' }}>
      {src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={src} alt="" className="h-full w-full object-cover object-top" />
        : <Avatar name={name} className="h-full w-full rounded-none text-ui-num" />}
    </div>
  )
}

export type AccordionSection = { title: string; content?: React.ReactNode }
/** A munkatárs lenyíló részei: alapadatok, szolgáltatások, munkaidő, bér és borravaló, dokumentumok. Élőben `open` /
 *  `onToggle`: a megnyitott rész tartalma a címe alatt. */
export function StaffAccordion({ sections = ['Alapadatok', 'Szolgáltatások', 'Munkaidő', 'Bér és borravaló', 'Dokumentumok'].map((title) => ({ title })), open = null, onToggle, className = '' }: { sections?: AccordionSection[]; open?: string | null; onToggle?: (title: string) => void; className?: string }) {
  return (
    <Card pad="xs" className={className}>
      {sections.map((s, i) => {
        const on = open === s.title
        const head = <>{s.title}<ChevronDown className={`h-4 w-4 text-ui-muted transition-transform ${on ? 'rotate-180' : ''}`} /></>
        const cls = `flex w-full items-center justify-between px-2.5 py-3 text-left text-ui-body text-ui-text ${i ? 'border-t border-dashed border-ui-divider' : ''}`
        return (
          <div key={s.title}>
            {onToggle ? <button type="button" aria-expanded={on} onClick={() => onToggle(s.title)} className={`${cls} rounded-ui-inner outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20`}>{head}</button> : <div className={cls}>{head}</div>}
            {on && s.content && <div className="px-2.5 pb-3">{s.content}</div>}
          </div>
        )
      })}
    </Card>
  )
}

/** Kulcs–érték sor a lenyíló részekben. */
export function InfoRow({ k, v }: { k: string; v: React.ReactNode }) {
  // hosszú érték (pl. e-mail) a keskeny oszlopban bárhol törhet — nem lóg ki
  return <div className="flex items-start justify-between gap-3 py-1 text-ui-meta"><span className="shrink-0 text-ui-muted">{k}</span><span className="min-w-0 text-right text-ui-text [overflow-wrap:anywhere]">{v}</span></div>
}

/** Ledolgozott órák e hónapban (sárga kártya): a hónap napról napra gyűlő órái (sötét vonal, a mai napig), szaggatottal
 *  az előző hónap ugyanígy — látszik, hol tart az előző hónaphoz képest. */
export function StaffHoursCard({ hours = 142, prev = 154, trend = [0, 8, 16, 24, 32, 32, 32, 40, 48, 56, 64, 72, 72, 72, 80, 88, 96, 104, 112, 112, 112, 120, 128, 136, 142], trendPrev = [0, 8, 16, 24, 32, 40, 40, 40, 48, 56, 64, 72, 80, 80, 80, 88, 96, 104, 112, 120, 120, 120, 128, 136, 144, 152, 154, 154, 154, 154], className = '' }: { hours?: number; prev?: number; trend?: number[]; trendPrev?: number[]; className?: string }) {
  const diff = hours - prev
  const t = trend.length > 1 ? trend : [trend[0] ?? 0, trend[0] ?? 0]
  // közös tengely: a hónap napjai (a hosszabbik görbe szerint); az e havi görbe a mai napig tart
  const days = Math.max(t.length, trendPrev.length, 2)
  const hi = Math.max(1, ...t, ...trendPrev)
  const w = (n: number) => (160 * (n - 1)) / (days - 1)
  return (
    <div className={`flex flex-col justify-between rounded-ui-card bg-ui-yellow p-4 text-ui-dark ${className}`}>
      <div className="text-ui-body">Ledolgozott órák — e hó</div>
      <svg viewBox="0 0 160 40" preserveAspectRatio="none" className="my-2 h-10 w-full overflow-visible">
        {trendPrev.length > 1 && <path d={smooth(trendPrev, w(trendPrev.length), 40, 0, hi * 1.05)} fill="none" stroke="var(--ui-dark)" strokeOpacity=".35" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
        <path d={smooth(t, w(t.length), 40, 0, hi * 1.05)} fill="none" stroke="var(--ui-dark)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div>
        <div className="flex items-baseline gap-2"><span className="text-ui-num font-light leading-none">{hours}<span className="text-ui-row"> ó</span></span>{diff !== 0 && <span className={`text-ui-meta ${diff < 0 ? 'text-ui-bad' : 'text-ui-ok'}`}>{diff > 0 ? '+' : '−'}{Math.abs(diff)} ó</span>}</div>
        <div className="mt-1 text-ui-label text-ui-dark/65">Előző hónap: {prev} ó</div>
      </div>
    </div>
  )
}

export type StaffChart = { title: string; me: number[]; avg: number[]; months: string[]; sel: number; name: string; unit: string; year: string }
const SAMPLE_CHART: StaffChart = {
  title: 'Foglalások havonta', name: 'Viktória', unit: 'foglalás', year: '2026', sel: 7,
  me: [52, 61, 66, 64, 72, 78, 74, 82, 80, 86], avg: [58, 62, 60, 66, 64, 70, 68, 71, 69, 72],
  months: ['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.'],
}
const SAMPLE_SEGMENTS = [{ label: 'Foglalás', value: '86', weight: 34, tone: 'yellow' as const }, { label: 'Bevétel', value: '1,1 M', weight: 30, tone: 'dark' as const }, { label: 'Borravaló', value: '48 e', weight: 20, tone: 'hatch' as const }, { label: 'Elmaradt', value: '2', weight: 16, tone: 'grey' as const }]
/** a tengely felső értéke: kerek szám a legnagyobb fölött */
const niceMax = (v: number) => { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)); const n = [1, 2, 2.5, 4, 5, 10].find((k) => k * p >= v) ?? 10; return n * p }

/** A munkatárs fő kártyája (`avatar`, `half`: mobil — avatar a név mellett, a grafikon az utolsó 6 hónapra): név, pozíció,
 *  Üzenet / Hívás / Szerkesztés, szolgáltatásai, bemutatkozás, a csík (havi számok) és a havi grafikon (vs. csapat-átlag). */
export function StaffSummary({ avatar = false, half = false, name = 'Viktória', img = `${AV}/viktoria.webp`, sub = 'Stylist · 2024 óta', services = ['Női hajvágás', 'Balayage', 'Festés'], bio = '10 éve vág, a balayage és a természetes színek specialistája. Kedd és Szombat kivételével minden nap a szalonban.', segments = SAMPLE_SEGMENTS, chart = SAMPLE_CHART, phone, email, onEdit, className = '' }: {
  avatar?: boolean
  half?: boolean
  name?: string
  img?: string | null
  sub?: string
  services?: string[]
  bio?: string
  segments?: React.ComponentProps<typeof SegmentBar>['segments']
  chart?: StaffChart
  phone?: string | null
  email?: string | null
  onEdit?: () => void
  className?: string
}) {
  const live = phone !== undefined || email !== undefined || !!onEdit
  // `half` (mobil): csak az utolsó 6 hónap — így minden hónap neve kifér, a pontok jobban elválnak
  // élő grafikon: a hónapra mutatva / koppintva az a hónap látszik a buborékban; mobilon 6 hó ↔ Év váltó
  const [hover, setHover] = useState<number | null>(null)
  const [year, setYear] = useState(false)
  const from = half && !year ? Math.max(0, chart.me.length - 6) : 0
  const me = chart.me.slice(from), avg = chart.avg.slice(from), months = chart.months.slice(from)
  const sel = hover != null && hover < me.length ? hover : Math.max(0, Math.min(me.length - 1, chart.sel - from))
  const pick = (e: React.PointerEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (Math.max(2, me.length) - 1))) }
  const top = chart === SAMPLE_CHART ? 100 : niceMax(Math.max(...me, ...avg, 1))
  const n = Math.max(2, me.length)
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100)
  const y = (v: number) => 100 - (v / top) * 100
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((k) => Math.round(top * k))
  const line = (d: number[]) => smooth(d.length > 1 ? d : [d[0] ?? 0, d[0] ?? 0], 100, 100, 0, top)
  const msgHref = email ? `mailto:${email}` : phone ? `sms:${phone.replace(/\s/g, '')}` : undefined
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* `avatar`: mobilon a név mellett (desktopon a nagy fotó külön oszlopban van) */}
        <div className="flex min-w-0 items-center gap-3">
          {avatar && <Avatar size="lg" src={img} name={name} />}
          <div className="min-w-0">
            <MarqueeText className="text-ui-num font-light leading-none text-ui-text">{name}</MarqueeText>
            <div className="mt-1 text-ui-body text-ui-muted">{sub}</div>
          </div>
        </div>
        <span className="flex gap-1.5">
          <IconButton icon={MessageSquare} label="Üzenet" href={msgHref} disabled={live && !msgHref} />
          <IconButton icon={Phone} label="Hívás" href={phone ? `tel:${phone.replace(/\s/g, '')}` : undefined} disabled={live && !phone} />
          {(!live || onEdit) && <Button variant="dark" icon={Pencil} onClick={onEdit}>Szerkesztés</Button>}
        </span>
      </div>
      {services.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{services.map((t) => <Pill key={t} tone="cell">{t}</Pill>)}</div>}
      {bio && <p className="mt-3 max-w-[460px] whitespace-pre-line text-ui-body leading-relaxed text-ui-muted">{bio}</p>}
      <SegmentBar size="md" className="mt-5" segments={segments} />

      {/* grafikon — minden elem ugyanabban a %-os koordináta-rendszerben, kitölti a kártya alját */}
      <div className="mt-5 flex min-h-[260px] flex-1 flex-col rounded-ui-inner bg-white/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-ui-row text-ui-text">{chart.title}</span>
          <span className="flex items-center gap-3">
            <Legend items={[['bg-ui-yellow', chart.name], ['bg-ui-dark', 'Csapat-átlag']]} />
            {half ? <Segmented tone="cell" size="sm" options={['6 hó', 'Év']} active={year ? 1 : 0} onSelect={(i) => { setYear(i === 1); setHover(null) }} /> : <Pill tone="white">{chart.year}</Pill>}
          </span>
        </div>
        <div className="mt-4 flex flex-1 gap-2">
          {/* y-tengely: ugyanazokon a %-okon, mint a rácsvonalak */}
          <div className="relative mb-8 w-7 shrink-0">
            {ticks.map((v) => <span key={v} className="absolute right-0 -translate-y-1/2 text-ui-label text-ui-muted" style={{ top: `${y(v)}%` }}>{v}</span>)}
          </div>
          {/* a két szélén hely a kiemelt hónap sávjának és feliratának — nem lóg ki a kártyából */}
          <div className="flex flex-1 flex-col px-8">
            <div className="relative flex-1 cursor-crosshair touch-pan-y" onPointerMove={pick} onPointerDown={pick} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null) }}>
              {/* kiemelt hónap oszlop-sáv */}
              <span className="absolute inset-y-0 w-14 -translate-x-1/2 rounded-full bg-white transition-[left] duration-200" style={{ left: `${x(sel)}%` }} />
              {ticks.map((v) => <span key={v} className="absolute -inset-x-8 border-t border-ui-divider" style={{ top: `${y(v)}%` }} />)}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                <path d={line(avg)} fill="none" stroke="var(--ui-dark)" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
                <path d={line(me)} fill="none" stroke="var(--ui-yellow)" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="absolute transition-all duration-200 border-l border-dashed border-ui-dark/50" style={{ left: `${x(sel)}%`, top: `${y(me[sel] ?? 0)}%`, bottom: 0 }} />
              <span className="absolute transition-all duration-200 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-ui-dark bg-ui-yellow" style={{ left: `${x(sel)}%`, top: `${y(me[sel] ?? 0)}%` }} />
              <span className="absolute whitespace-nowrap transition-[top,left] duration-200" style={tipStyle(x(sel), y(me[sel] ?? 0), 12)}>
                <Pill tone="dark" size="sm"><span className="h-1.5 w-1.5 rounded-full bg-ui-yellow" />{me[sel] ?? 0} {chart.unit} <span className="text-white/50">· átlag {avg[sel] ?? 0}</span></Pill>
              </span>
            </div>
            <div className="relative mt-2 h-6">
              {months.map((m, i) => (
                <button key={m} type="button" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} className="absolute -translate-x-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20" style={{ left: `${x(i)}%` }}><Pill tone={i === sel ? 'white' : 'ghost'} size="sm">{m}</Pill></button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

/* ── 10.4: szerkesztés ── */

export const STAFF_TOPICS: [string, LucideIcon][] = [['Alapadatok', UserRound], ['Munkaidő', Clock], ['Foglalás', CalendarDays], ['Bér és borravaló', Wallet], ['Bemutatkozás', Sparkles], ['Dokumentumok', FileText]]

/** 10.4 bal oszlop: fotó cseréje, név, pozíció, a témák listája, alul a felfüggesztés. */
export function StaffEditNav({ img = `${AV}/viktoria.webp`, name = 'Viktória', position = 'Stylist', topics = STAFF_TOPICS, topic = 'Alapadatok', onTopic, onPhoto, upload = null, social = [], suspend = 'Munkatárs felfüggesztése', onSuspend, className = '' }: {
  img?: string | null
  name?: string
  position?: string
  topics?: [string, LucideIcon][]
  topic?: string
  onTopic?: (t: string) => void
  onPhoto?: (file: File) => void
  /** a fotó feltöltése folyamatban (21.6.2) */
  upload?: UploadState | null
  /** a közösségi linkjei — a felismert oldalak ikonjai a témák alatt */
  social?: string[]
  /** a felfüggesztés gomb felirata (felfüggesztettnél „Visszaállítás”); null: nincs gomb */
  suspend?: string | null
  onSuspend?: () => void
  className?: string
}) {
  return (
    <Card className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        {upload && !upload.error
          ? <UploadTile src={upload.src} pct={upload.pct} proc={upload.proc} className="h-28 w-28 rounded-ui-card" />
          : img
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={img} alt="" className="h-28 w-28 rounded-ui-card object-cover object-top" />
          : <Avatar name={name} className="h-28 w-28 rounded-ui-card text-ui-num" />}
        {onPhoto
          ? <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-full ring-4 ring-ui-cell" aria-label="Fotó feltöltése" title="Fotó feltöltése">
              <input type="file" accept="image/*" className="sr-only" disabled={!!upload && !upload.error} onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} />
              <IconCircle icon={Upload} tone="dark" size="md" />
            </label>
          : <IconButton icon={Upload} label="Fotó feltöltése" variant="dark" size="sm" className="absolute -bottom-2 -right-2 ring-4 ring-ui-cell" />}
      </div>
      <div className="mt-4 text-center text-ui-title text-ui-text">{name}</div>
      <div className="text-ui-meta text-ui-muted">{position || '—'}</div>
      <div className="mt-4 w-full space-y-1">
        {topics.map(([t, Icon]) => onTopic
          ? <button key={t} type="button" onClick={() => onTopic(t)} className="block w-full rounded-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><NavItem icon={Icon} active={t === topic}>{t}</NavItem></button>
          : <NavItem key={t} icon={Icon} active={t === topic}>{t}</NavItem>)}
      </div>
      {upload?.error && <Note warn className="mt-3 w-full">{upload.error}</Note>}
      {social.filter((l) => l.trim()).length > 0 && (
        <div className="mt-5 w-full">
          <Meta className="mb-1.5 px-1 text-ui-label">Közösségi oldalai</Meta>
          <div className="flex flex-wrap gap-1 px-1">{social.filter((l) => l.trim()).map((l) => <SocialIcon key={l} url={l} href small />)}</div>
        </div>
      )}
      {suspend && <div className="mt-auto w-full pt-4"><Button variant="bad" className="w-full" onClick={onSuspend}>{suspend}</Button></div>}
    </Card>
  )
}

export type StaffDay = { on: boolean; start: string; end: string }
export type StaffEditValue = {
  name: string; position: string; phone: string; email: string; birthday: string; joinDate: string
  taxId: string; taxNumber: string; address: string
  bookable: boolean; buffer: number | null; minLead: number | null; serviceIds: string[]
  payType: 'daily' | 'hourly'; payRate: string; weeklyTarget: number | null; tipEligible: boolean
  /** éves szabadság-keret (nap); nincs megadva: null */
  annualLeave?: number | null
  bio: string; socialLinks: string[]
  /** null: a heti munkaidő még töltődik / nincs (étterem, tulaj) */
  hours: { custom: boolean; days: StaffDay[] } | null
  documents: { label: string; url: string | null; fileId: number | null }[]
}
export type StaffEditOptions = {
  restaurant?: boolean
  positions?: string[]
  services?: { id: string; name: string }[]
  /** a bér látható / szerkeszthető */
  salary?: boolean
  /** a fiók-szintű tulaj-sor: nincs foglalás, bér, munkaidő, dokumentum */
  account?: boolean
  breaks?: string | null
  dateInput?: (value: string, set: (v: string) => void) => React.ReactNode
  bioTop?: React.ReactNode
  onDocAdd?: (file: File) => void
  /** a dokumentum feltöltése folyamatban (21.6.2) */
  docUpload?: UploadState | null
}
const SAMPLE_EDIT: StaffEditValue = {
  name: 'Kovács Viktória', position: 'Stylist', phone: '+36 30 412 7781', email: 'viktoria@davelopment.hu', birthday: '1994-05-12', joinDate: '2024-03-04',
  taxId: '123-456-789', taxNumber: '', address: 'Budapest, Bartók B. út 22.',
  bookable: true, buffer: 10, minLead: 2, serviceIds: ['a', 'b', 'c'], payType: 'hourly', payRate: '2 400', weeklyTarget: 40, tipEligible: true,
  bio: '10 éve vág, a balayage és a természetes színek specialistája.', socialLinks: ['https://instagram.com/viktoria.hair'],
  hours: { custom: true, days: [['09:00', '17:00'], ['09:00', '17:00'], null, ['12:00', '20:00'], ['09:00', '17:00'], ['09:00', '14:00'], null].map((d) => ({ on: !!d, start: d?.[0] ?? '09:00', end: d?.[1] ?? '17:00' })) },
  documents: [{ label: 'Munkaszerződés', url: null, fileId: null }, { label: 'Egészségügyi kiskönyv', url: null, fileId: null }],
}
const SAMPLE_SERVICES = [{ id: 'a', name: 'Női hajvágás' }, { id: 'b', name: 'Balayage' }, { id: 'c', name: 'Festés' }, { id: 'd', name: 'Géllakk' }]
const DAYS = ['Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat', 'Vasárnap']
/** a téma → a mutatott kártyák */
export const TOPIC_CARDS: Record<string, string[]> = { 'Alapadatok': ['Alapadatok', 'Adó és cím'], 'Munkaidő': ['Munkaidő'], 'Foglalás': ['Foglalás'], 'Bér és borravaló': ['Bér és borravaló'], 'Bemutatkozás': ['Bemutatkozás'], 'Dokumentumok': ['Dokumentumok'] }
const thousands = (s: string) => { const n = Number(s.replace(/\D/g, '')); return n ? n.toLocaleString('hu-HU') : '' }
const huDate = (v: string) => { const [y, m, d] = v.split('-').map(Number); return y && m && d ? `${y}. ${['Jan.', 'Febr.', 'Márc.', 'Ápr.', 'Máj.', 'Jún.', 'Júl.', 'Aug.', 'Szept.', 'Okt.', 'Nov.', 'Dec.'][m - 1]} ${d}.` : v }

/** A közösségi link oldalának ikonja (a címből felismerve); üres címnél csíkos hely. */
export function SocialIcon({ url, href = false, small = false }: { url: string; href?: boolean; /** kisebb (a szerkesztő bal oszlopában) */ small?: boolean }) {
  const size = small ? 'h-7 w-7' : 'h-9 w-9'
  if (!url.trim()) return <span className={`ui-hatch-cell ${size} shrink-0 rounded-full`} />
  const p = detectPlatform(url)
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={socialIconDataUri(p)} alt={SOCIAL_LABELS[p]} title={SOCIAL_LABELS[p]} className={`${size} shrink-0 rounded-full`} />
  return href ? <a href={url.includes('://') ? url : `https://${url}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{img}</a> : img
}

/** Egy szerkesztő-rész kerete: önálló fehér kártya, vagy (`bare`) a nagy ablakon belül keret nélkül. Modul-szinten
 *  (a render-en belül definiált komponens minden billentyűnél újraépülne, és a mező elvesztené a fókuszt). */
function Box({ bare, wide, children }: { bare: boolean; wide: boolean; children: React.ReactNode }) {
  return bare ? <section className={wide ? 'xl:col-span-2' : ''}>{children}</section> : <Card tone="white" className={wide ? 'xl:col-span-2' : ''}>{children}</Card>
}

/** −/+ léptető (perc, óra) — `null`: az üzlet alapbeállítása. */
function Stepper({ value, step, max, unit, label, onChange }: { value: number | null; step: number; max: number; unit: string; label: string; onChange?: (v: number | null) => void }) {
  return (
    <span className="flex items-center gap-1">
      <IconButton icon={Minus} label={`${label} csökkentése`} variant="cell" size="sm" disabled={!!onChange && value == null} onClick={onChange && (() => onChange(value == null || value - step < 0 ? null : value - step))} />
      <span className="min-w-[64px] text-center text-ui-body text-ui-text">{value == null ? 'Alap' : `${value} ${unit}`}</span>
      <IconButton icon={Plus} label={`${label} növelése`} variant="cell" size="sm" disabled={!!onChange && value != null && value >= max} onClick={onChange && (() => onChange(Math.min(max, (value ?? 0) + step)))} />
    </span>
  )
}

/** A munkatárs szerkesztő részei (10.4): alapadatok, adó és cím, foglalás, bér és borravaló, munkaidő, bemutatkozás,
 *  dokumentumok. `only`: csak ezek a kártyák; `stacked`: egy hasábban (mobil). Élőben `value` / `onChange` + `options`. */
export function StaffEditSections({ only = ['Alapadatok', 'Foglalás', 'Bér és borravaló', 'Adó és cím', 'Munkaidő'], stacked = false, bare = false, value = SAMPLE_EDIT, onChange, options = {} }: { only?: string[]; stacked?: boolean; /** egy nagy ablakon belül: a részek kártya nélkül, hasábokban */ bare?: boolean; value?: StaffEditValue; onChange?: (v: StaffEditValue) => void; options?: StaffEditOptions }) {
  const live = !!onChange
  const v = value
  const set = (p: Partial<StaffEditValue>) => onChange?.({ ...v, ...p })
  const o = { services: live ? [] : SAMPLE_SERVICES, positions: [], salary: !live, ...options }
  const rest = !!o.restaurant
  const show = (t: string) => only.includes(t) && !(o.account && ['Foglalás', 'Bér és borravaló', 'Munkaidő', 'Dokumentumok'].includes(t)) && !(rest && t === 'Foglalás') && !(rest && t === 'Munkaidő') && !(t === 'Bér és borravaló' && !o.salary)
  const text = (k: keyof StaffEditValue, placeholder?: string, type = 'text') => (
    <Input size="sm" type={type} value={String(v[k] ?? '')} readOnly={!live} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value } as Partial<StaffEditValue>)} className="w-[220px] max-w-full" />
  )
  const date = (k: 'birthday' | 'joinDate') => live && o.dateInput
    ? <span className="w-[220px] max-w-full">{o.dateInput(v[k], (d) => set({ [k]: d } as Partial<StaffEditValue>))}</span>
    : <Input size="sm" value={v[k] ? huDate(v[k]) : ''} readOnly className="w-[220px] max-w-full" />
  const sw = (on: boolean, act: (on: boolean) => void, label: string) => live ? <Switch checked={on} onChange={act} ariaLabel={label} /> : <DesignSwitch defaultOn={on} />
  const card = (title: string, Icon: LucideIcon, rows: [string, React.ReactNode, boolean?][], extra?: React.ReactNode, wide = false) => (
    <Box key={title} bare={bare} wide={wide && !stacked}>
      <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><Icon className="h-4 w-4" /> {title}</div>
      {rows.map(([k, el, full], i) => (
        <div key={k} className={`flex min-h-[50px] flex-wrap items-center justify-between gap-2 py-1.5 ${i ? 'border-t border-dashed border-ui-divider' : ''}`}>
          <span className="text-ui-body text-ui-muted">{k}</span>
          {full ? <span className="flex w-full flex-wrap gap-1 pb-1">{el}</span> : el}
        </div>
      ))}
      {extra}
    </Box>
  )
  const rate = Number(v.payRate.replace(/\D/g, '')) || 0
  const week = v.weeklyTarget ?? 0
  const monthly = Math.round((v.payType === 'hourly' ? week : week / 8) * 4.3 * rate / 100) * 100
  const calc = rate && week
    ? `Havi becslés: ${v.payType === 'hourly' ? `${week} ó` : `${(week / 8).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} nap`} × 4,3 hét × ${rate.toLocaleString('hu-HU')} Ft ≈ ${monthly.toLocaleString('hu-HU')} Ft`
    : null

  const cards: React.ReactNode[] = []
  if (show('Alapadatok')) cards.push(card('Alapadatok', UserRound, [
    ['Név', text('name')],
    ...(o.account && rest ? [] : [['Pozíció', live
      ? <span className="w-[220px] max-w-full"><Input size="sm" list="team-positions" value={v.position} onChange={(e) => set({ position: e.target.value })} placeholder="Stylist, Pincér…" /><datalist id="team-positions">{o.positions?.map((p) => <option key={p} value={p} />)}</datalist></span>
      : text('position')] as [string, React.ReactNode]]),
    ['Telefon', text('phone', '+36 …', 'tel')],
    ['E-mail', text('email', 'nev@email.hu', 'email')],
    ['Születésnap', date('birthday')],
    ['Belépés', date('joinDate')],
  ]))
  if (show('Foglalás')) cards.push(card('Foglalás', CalendarDays, [
    ['Online foglalható', sw(v.bookable, (on) => set({ bookable: on }), 'Online foglalható')],
    ['Szünet két vendég közt', <Stepper key="b" value={v.buffer} step={5} max={240} unit="perc" label="Szünet" onChange={live ? (n) => set({ buffer: n }) : undefined} />],
    ['Legkorábban előre', <Stepper key="l" value={v.minLead} step={1} max={720} unit="óra" label="Előre foglalás" onChange={live ? (n) => set({ minLead: n }) : undefined} />],
    ['Szolgáltatások', o.services.length ? o.services.map((s) => {
      const on = v.serviceIds.includes(s.id)
      const pill = <Pill tone={on ? 'dark' : 'cell'}>{on && <Check className="h-3 w-3" strokeWidth={2.5} />}{s.name}</Pill>
      return live ? <button key={s.id} type="button" aria-pressed={on} onClick={() => set({ serviceIds: on ? v.serviceIds.filter((x) => x !== s.id) : [...v.serviceIds, s.id] })} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">{pill}</button> : <span key={s.id}>{pill}</span>
    }) : <Meta>Még nincs szolgáltatás.</Meta>, true],
  ], live && v.serviceIds.length === 0 && v.bookable ? <Note warn className="mt-2">Szolgáltatás nélkül online egyikre sem foglalható.</Note> : undefined))
  if (show('Bér és borravaló')) cards.push(card('Bér és borravaló', Wallet, [
    ...(rest ? [['Bér típusa', <Segmented key="t" options={['Napi', 'Órabér']} active={v.payType === 'hourly' ? 1 : 0} tone="cell" size="sm" onSelect={live ? (i) => set({ payType: i ? 'hourly' : 'daily' }) : undefined} />] as [string, React.ReactNode]] : []),
    [v.payType === 'hourly' ? 'Órabér' : 'Napidíj', <span key="r" className="flex items-center gap-2"><Input size="sm" inputMode="numeric" value={live ? thousands(v.payRate) : v.payRate} readOnly={!live} onChange={(e) => set({ payRate: e.target.value.replace(/\D/g, '') })} placeholder="0" hug className="text-right" /><span className="text-ui-body text-ui-muted">Ft</span></span>],
    ['Heti óra', <Stepper key="h" value={v.weeklyTarget} step={1} max={80} unit="óra" label="Heti óra" onChange={live ? (n) => set({ weeklyTarget: n }) : undefined} />],
    // az éves szabadság-keret — a Naptár szabadság-ablaka ebből mutatja, mennyi marad
    ['Éves szabadság', <Stepper key="al" value={v.annualLeave ?? null} step={1} max={60} unit="nap" label="Éves szabadság" onChange={live ? (n) => set({ annualLeave: n }) : undefined} />],
    ...(rest || !live ? [['Borravaló-jogosult', sw(v.tipEligible, (on) => set({ tipEligible: on }), 'Borravaló-jogosult')] as [string, React.ReactNode]] : []),
  ], calc ? <Note strong className="mt-2">{calc}</Note> : undefined))
  if (show('Adó és cím')) cards.push(card('Adó és cím', FileText, [['TAJ-szám', text('taxId', '000-000-000')], ['Adószám', text('taxNumber', '—')], ['Lakcím', text('address')]]))
  if (show('Munkaidő')) cards.push(
    <Box key="Munkaidő" bare={bare} wide={!stacked}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><Clock className="h-4 w-4" /> Munkaidő</div>
        {v.hours && <span className="flex items-center gap-2 text-ui-meta text-ui-muted">A szalon nyitvatartását követi {sw(!v.hours.custom, (on) => set({ hours: { ...v.hours!, custom: !on } }), 'A szalon nyitvatartását követi')}</span>}
      </div>
      <div className="mt-1 text-ui-meta text-ui-muted">Egy hely: ebből látják a vendégek, mikor foglalhatnak hozzá, és ebből készül a Naptárban a beosztása.</div>
      {!v.hours ? <Meta className="mt-3">Betöltés…</Meta> : live && !v.hours.custom ? (
        // az üzlet nyitvatartását követi: nincs mit egyedileg állítani — a napok nem jelennek meg
        <Note className="mt-3">A szalon nyitvatartása szerint dolgozik. Egyedi munkaidőhöz kapcsold ki fent a „A szalon nyitvatartását követi” kapcsolót.</Note>
      ) : (
        <div className={`mt-3 grid gap-x-6 ${stacked ? '' : 'sm:grid-cols-2'} ${v.hours.custom ? '' : 'opacity-55'}`}>
          {v.hours.days.map((d, i) => {
            const dis = live && !v.hours!.custom
            const setDay = (p: Partial<StaffDay>) => set({ hours: { ...v.hours!, days: v.hours!.days.map((x, j) => (j === i ? { ...x, ...p } : x)) } })
            return (
              <div key={DAYS[i]} className={`flex min-h-[60px] ${stacked ? 'flex-wrap' : ''} items-center justify-between gap-3 border-t border-dashed border-ui-divider py-3 ${i < 2 && !stacked ? 'sm:border-t-0' : ''} ${i === 0 ? 'border-t-0' : ''}`}>
                <span className={`w-20 shrink-0 text-ui-body ${d.on ? 'text-ui-text' : 'text-ui-muted'}`}>{DAYS[i]}</span>
                {d.on ? (
                  // mobilon (egy hasábban) az idők külön sorba kerülnek — különben a sor kilóg a lapból
                  <span className={`flex flex-1 flex-wrap items-center gap-2 ${stacked ? 'order-last basis-full' : ''}`}>
                    {live
                      ? <span className="flex items-center gap-1"><Input size="sm" type="time" value={d.start} disabled={dis} onChange={(e) => setDay({ start: e.target.value })} className="w-[92px] px-2" /><span className="text-ui-muted">–</span><Input size="sm" type="time" value={d.end} disabled={dis} onChange={(e) => setDay({ end: e.target.value })} className="w-[92px] px-2" /></span>
                      : <Input size="sm" value={`${d.start} – ${d.end}`} readOnly className="w-[130px]" />}
                    {(live ? o.breaks : i !== 5 ? (i === 3 ? '16:00–16:30' : '12:30–13:00') : null) && <Pill tone="hatchCell" size="sm">szünet {live ? o.breaks : i === 3 ? '16:00–16:30' : '12:30–13:00'}</Pill>}
                  </span>
                ) : <span className="flex-1 text-ui-meta text-ui-muted">Szabadnap</span>}
                {live ? <Switch checked={d.on} disabled={dis} onChange={(on) => setDay({ on })} ariaLabel={`${DAYS[i]} munkanap`} /> : <DesignSwitch defaultOn={d.on} />}
              </div>
            )
          })}
        </div>
      )}
      <Meta className="mt-3 leading-relaxed">
        Eltérés egy-egy napra (szabadság, beteg, egyedi idő)? Azt a <span className="text-ui-text">Naptárban</span> veszed fel — ott a foglalhatóság is magától igazodik.
      </Meta>
    </Box>,
  )
  if (show('Bemutatkozás')) cards.push(
    <Box key="Bemutatkozás" bare={bare} wide={!stacked}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><Sparkles className="h-4 w-4" /> Bemutatkozás</span>{o.bioTop}</div>
      <Textarea value={v.bio} readOnly={!live} onChange={(e) => set({ bio: e.target.value })} placeholder={rest ? 'Rövid belső megjegyzés' : 'Pár mondat a vendégeknek — a foglalóoldalon a neve alatt jelenik meg.'} className="min-h-[140px]" />
      {!rest && !o.account && (
        <div className="mt-3">
          <div className="text-ui-meta text-ui-muted">Közösségi linkek</div>
          {v.socialLinks.map((l, i) => (
            <div key={i} className="mt-1.5 flex items-center gap-1.5">
              {/* a beírt címből felismert oldal ikonja (Instagram, Facebook, TikTok…) */}
              <SocialIcon url={l} />
              <Input size="sm" type="url" value={l} readOnly={!live} placeholder="https://instagram.com/…" onChange={(e) => set({ socialLinks: v.socialLinks.map((x, j) => (j === i ? e.target.value : x)) })} />
              {live && <IconButton icon={X} label="Link törlése" variant="cell" size="sm" onClick={() => set({ socialLinks: v.socialLinks.filter((_, j) => j !== i) })} />}
            </div>
          ))}
          {live && v.socialLinks.length < 5 && <Button variant="cell" size="sm" icon={Plus} className="mt-1.5" onClick={() => set({ socialLinks: [...v.socialLinks, ''] })}>Link</Button>}
        </div>
      )}
    </Box>,
  )
  if (show('Dokumentumok')) cards.push(
    <Box key="Dokumentumok" bare={bare} wide={!stacked}>
      <div className="mb-1 flex items-center gap-2 text-ui-meta font-medium text-ui-muted"><FileText className="h-4 w-4" /> Dokumentumok</div>
      <Meta className="mb-3 leading-relaxed">A munkatárs papírjai egy helyen: munkaszerződés, bizonyítványok és végzettséget igazoló iratok, egészségügyi alkalmassági, személyes okmányok másolata. Fotóként is jó (telefonnal lefényképezve) — a képre kattintva letölthető.</Meta>
      {/* képrács, mint a foglalóoldal galériája (21.6.2): a végén a feltöltés, feltöltés közben a töltődő kép */}
      <div className={`grid gap-3 ${stacked ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 2xl:grid-cols-4'}`}>
        {v.documents.map((d, i) => (
          <div key={i} className="min-w-0">
            <div className="relative">
              {d.url
                // eslint-disable-next-line @next/next/no-img-element
                ? <a href={d.url} download title="Letöltés" className="block aspect-square overflow-hidden rounded-ui-control bg-ui-cell"><img src={d.url} alt={d.label} className="h-full w-full object-cover" /></a>
                : <span className="ui-hatch flex aspect-square items-center justify-center rounded-ui-control text-ui-muted"><FileText className="h-5 w-5" /></span>}
              {live && <IconButton icon={X} label="Törlés" variant="glass" size="sm" className="absolute right-1.5 top-1.5" onClick={() => set({ documents: v.documents.filter((_, j) => j !== i) })} />}
            </div>
            <Input size="sm" value={d.label} readOnly={!live} placeholder="Megnevezés" onChange={(e) => set({ documents: v.documents.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} className="mt-1.5" />
          </div>
        ))}
        {o.docUpload && <UploadTile src={o.docUpload.src} pct={o.docUpload.pct} proc={o.docUpload.proc} error={!!o.docUpload.error} />}
        {o.onDocAdd
          ? <label className="block cursor-pointer"><input type="file" accept="image/*" className="sr-only" disabled={!!o.docUpload && !o.docUpload.error} onChange={(e) => { const f = e.target.files?.[0]; if (f) o.onDocAdd!(f); e.target.value = '' }} /><UploadBox className="aspect-square">Feltöltés</UploadBox></label>
          : !live && <UploadBox className="aspect-square">Feltöltés</UploadBox>}
      </div>
      {o.docUpload?.error && <Note warn className="mt-3">{o.docUpload.error}</Note>}
    </Box>,
  )
  return <div className={`grid ${bare ? 'gap-x-10 gap-y-8' : 'gap-[5px]'} ${stacked ? '' : 'xl:grid-cols-2'}`}>{cards}</div>
}

/* ── 10.1: export (a Vendégek 7.6 ablakának mintájára) ── */

/** Az export mezői — `salon` / `restaurant`: csak ott; `pay`: csak bér-joggal. */
export const TEAM_EXPORT_FIELDS: { key: string; label: string; only?: 'salon' | 'restaurant'; pay?: boolean }[] = [
  { key: 'name', label: 'Név' }, { key: 'position', label: 'Pozíció' }, { key: 'role', label: 'Szerep' }, { key: 'status', label: 'Állapot' },
  { key: 'email', label: 'E-mail' }, { key: 'phone', label: 'Telefon' }, { key: 'join', label: 'Belépés' }, { key: 'birthday', label: 'Születésnap' },
  { key: 'weekly', label: 'Heti óra (szerződés)' }, { key: 'week', label: 'Órák — e hét' }, { key: 'month', label: 'Órák — e hó' }, { key: 'prev', label: 'Órák — előző hó' },
  { key: 'days', label: 'Ledolgozott nap' }, { key: 'leave', label: 'Szabadság / beteg' },
  { key: 'bookings', label: 'Foglalás — e hó', only: 'salon' }, { key: 'revenue', label: 'Bevétel — e hó', only: 'salon' },
  { key: 'tips', label: 'Borravaló — e hó', only: 'restaurant' }, { key: 'pay', label: 'Bér (napidíj / órabér)', pay: true },
  { key: 'tax', label: 'TAJ-szám, adószám, lakcím', pay: true },
]
export const TEAM_EXPORT_DEFAULT = ['name', 'position', 'role', 'status', 'email', 'phone', 'join', 'month']

/** Export-ablak (10.1 — a többi oldal Export-jával azonos): kiket (mind / a kijelöltek), mely mezőkkel, a sorok száma a gombon. */
export function StaffExportModal({ fields = TEAM_EXPORT_DEFAULT, onFields, scope = 'all', onScope, counts = { all: 6, selected: 2 }, restaurant = false, pay = true, onDownload, onClose, className = '' }: {
  fields?: string[]
  onFields?: (f: string[]) => void
  scope?: 'all' | 'selected'
  onScope?: (s: 'all' | 'selected') => void
  counts?: { all: number; selected: number }
  restaurant?: boolean
  pay?: boolean
  onDownload?: () => void
  onClose?: () => void
  className?: string
}) {
  const live = !!onFields
  const card = (k: 'all' | 'selected', title: string, sub: string) => {
    const c = <OptionCard icon={k === 'all' ? UserRound : Check} title={title} selected={scope === k}>{sub}</OptionCard>
    return live && onScope ? <button key={k} type="button" disabled={k === 'selected' && !counts.selected} onClick={() => onScope(k)} className="block rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:opacity-50">{c}</button> : <div key={k}>{c}</div>
  }
  const list = TEAM_EXPORT_FIELDS.filter((f) => (!f.only || f.only === (restaurant ? 'restaurant' : 'salon')) && (!f.pay || pay))
  const rows = scope === 'selected' ? counts.selected : counts.all
  return (
    <Modal size="sm" title="Export" subtitle="CSV — Excelben, Google Táblázatban megnyitható" onClose={onClose} className={className}>
      <Meta>Kiket</Meta>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">{card('all', 'Mindenki', `${counts.all} munkatárs`)}{card('selected', 'Kijelöltek', counts.selected ? `${counts.selected} munkatárs` : 'nincs kijelölés')}</div>
      <Meta className="mt-3">Mezők</Meta>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-2">
        {list.map((f) => live
          ? <Checkbox key={f.key} label={f.label} checked={fields.includes(f.key)} onChange={() => onFields!(fields.includes(f.key) ? fields.filter((x) => x !== f.key) : [...fields, f.key])} />
          : <Checkbox key={f.key} label={f.label} defaultChecked={fields.includes(f.key)} />)}
      </div>
      <Note tip className="mt-3">A havi számok a mai napig tartanak; a felfüggesztettek is benne vannak, az állapotuk jelölve.</Note>
      <Button className="mt-4 w-full" icon={FileText} onClick={onDownload} disabled={live && (!fields.length || !rows)}>CSV letöltése · {rows} sor</Button>
    </Modal>
  )
}

/* ── 10.5 / 10.6: mobil lista ── */

export type MobileStaffRow = { key: string; name: string; img: string | null; meta: string; status?: 'pending' | 'neutral'; trailing?: React.ReactNode }
const SAMPLE_MOBILE: MobileStaffRow[] = [
  { key: 'viktoria', name: 'Viktória', img: `${AV}/viktoria.webp`, meta: 'Stylist · 92% foglalt a héten' },
  { key: 'csaba', name: 'Csaba', img: `${AV}/csaba.webp`, meta: 'Barber · 78% foglalt a héten' },
  { key: 'dave', name: 'Dávid', img: `${AV}/dave.webp`, meta: 'Tulajdonos · 88% foglalt a héten' },
  { key: 'szabina', name: 'Szabina', img: `${AV}/szabina.webp`, meta: 'Recepció', status: 'pending' },
  { key: 'bence', name: 'Kis Bence', img: null, meta: 'Stylist', status: 'neutral' },
]
/** Mobil lista (10.5): avatar, pozíció + heti foglaltság, a meghívott és a felfüggesztett jelölve; koppintásra a nézete. */
export function MobileStaffList({ rows = SAMPLE_MOBILE, onOpen, className = '' }: { rows?: MobileStaffRow[]; onOpen?: (key: string) => void; className?: string }) {
  return (
    <Card pad="xs" className={className}>
      {rows.map((r) => {
        // a felfüggesztett munkatárs neve áthúzva
        const row = <ListRow leading={<Avatar size="sm" src={r.img} name={r.name} />} title={r.status === 'neutral' ? <span className="line-through">{r.name}</span> : r.name} meta={r.meta}
          trailing={r.trailing ?? (r.status ? <StatusPill status={r.status}>{r.status === 'pending' ? 'Meghívott' : 'Felfüggesztett'}</StatusPill> : <IconCircle icon={ArrowUpRight} tone="cell" size="md" />)} />
        // a gomb viszi a sorok közti szaggatott vonalat (a ListRow benne mindig első, ezért vonal nélküli)
        return onOpen ? <button key={r.key} type="button" onClick={() => onOpen(r.key)} className="block w-full border-t border-dashed border-ui-divider text-left outline-none first:border-t-0 focus-visible:ring-2 focus-visible:ring-ui-dark/20">{row}</button> : <div key={r.key} className="border-t border-dashed border-ui-divider first:border-t-0">{row}</div>
      })}
    </Card>
  )
}

/** 10.6: étterem — a sor végén a borravaló-jogosultság. */
export function TipPill({ on }: { on: boolean }) {
  return on ? <Pill tone="yellow" size="sm">borravaló-jogosult</Pill> : <Pill tone="cell" size="sm">nem jogosult</Pill>
}
