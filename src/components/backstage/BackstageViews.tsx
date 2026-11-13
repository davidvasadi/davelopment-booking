'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowUpRight, Building2, Check, Gift, LogIn, Mail, MoreHorizontal, Pencil, Receipt, Search, Send, Trash2, Users, Wallet, CalendarDays } from 'lucide-react'
import { Button, Card, Checkbox, EmptyState, Field, IconButton, Kpi, Meta, Modal, Note, PageHead, Pill, SearchField, Select, Textarea } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { Switch } from '@/components/ui/toggle-switch'
import { SaveBar, SettingsGroup, SettingsPage, type AuditTableRow } from '@/components/blocks/settings'
import {
  AccountActionsMenu, AccountBookingsCard, AccountPanel, AccountPlacesCard, AccountTable, AccountToolbar, AuditCard, BroadcastEditor, BroadcastHistory,
  BROADCAST_TARGETS, BS_RISK, BS_STATUS, BS_TIER, BsStatusPill, DeleteAccountModal, FactsCard, HELP_TEMPLATES, HelpMessageModal, MessagePanel, MessageTable,
  PlacePanel, PlaceTable, PriceRow, PricingAside, PRICING_ROWS, RISK_ORDER, RiskTable, StatusModal, TierModal,
  type BsAccount, type BsBookingRow, type BsBroadcastRow, type BsMessage, type BsPlace, type BsPlaceLite, type BsRisk, type BsStatus, type BsTier, type Paging, type PricingKey,
} from '@/components/blocks/backstage'
import { bookingWhen } from '@/lib/backstageView'

/* Az élő /backstage oldalak kliens-részei: állapot (szűrő, keresés, megnyitott sor), műveletek (fetch az admin API-kra)
 * és a felugró ablakok — a megjelenés teljesen a blocks/backstage blokkjaié (komponens = design). */

const PAGE = 10

function useDesktop() {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const upd = () => setDesktop(mq.matches)
    upd()
    mq.addEventListener('change', upd)
    return () => mq.removeEventListener('change', upd)
  }, [])
  return desktop
}

function paginate<T>(rows: T[], page: number, set: (p: number) => void): { slice: T[]; paging: Paging } {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const p = Math.min(page, pages)
  const from = (p - 1) * PAGE
  return { slice: rows.slice(from, from + PAGE), paging: { page: p, pages, label: rows.length ? `${from + 1}–${Math.min(rows.length, from + PAGE)} / ${rows.length}` : '0', onPage: set } }
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) throw new Error(String(res.status))
  return res
}

/** Belépés a tulaj nevében — új lapon (a meglévő session-as végpont). */
export function impersonate(userId: string) {
  const f = document.createElement('form')
  f.method = 'POST'; f.action = '/api/backstage/session-as'; f.target = '_blank'
  const i = document.createElement('input')
  i.type = 'hidden'; i.name = 'userId'; i.value = userId
  f.appendChild(i); document.body.appendChild(f); f.submit(); f.remove()
}

const placeApi = (key: string) => {
  const [kind, id] = key.split(':')
  return `/api/backstage/${kind === 'restaurant' ? 'restaurants' : 'salons'}/${id}`
}

/** Mobilon a lista szűrője a fejlécben (DashboardNav: `davelopment:open-backstage-filter`) — felugró ablak a chipekkel,
 *  alul „Mutasd · N” (ugyanaz a forma, mint az Utalványok szűrője). */
function FilterSheet({ chips, active, onChip, count, unit, label = 'Állapot' }: { chips: [string, number][]; active: number; onChip: (i: number) => void; count: number; unit: string; label?: string }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const f = () => setOpen(true)
    window.addEventListener('davelopment:open-backstage-filter', f)
    return () => window.removeEventListener('davelopment:open-backstage-filter', f)
  }, [])
  return (
    <PopupModal open={open} onClose={() => setOpen(false)} panel={
      <Modal title="Szűrés" onClose={() => setOpen(false)} footer={<Button className="w-full" onClick={() => setOpen(false)}>Mutasd · {count} {unit}</Button>}>
        <Meta className="mb-1.5">{label}</Meta>
        <div className="flex flex-wrap gap-1.5">
          {chips.map(([l, n], i) => <button key={l} type="button" onClick={() => onChip(i)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={i === active ? 'dark' : 'cell'}>{l} <span className={i === active ? 'text-white/50' : 'text-ui-muted'}>{n}</span></Pill></button>)}
        </div>
        {active !== 0 && <Button variant="ghost" size="sm" className="mt-3" onClick={() => onChip(0)}>Alaphelyzet</Button>}
      </Modal>
    } />
  )
}

/* ── Közös ablakok és kapcsolók ── */

/** Segítő üzenet a tulaj csengőjébe (egyedi körüzenet egy fióknak). */
export function HelpDialog({ open, onClose, ownerId, subtitle, kind: kindIn = 0 }: { open: boolean; onClose: () => void; ownerId: string; subtitle: string; kind?: 0 | 1 }) {
  const [kind, setKind] = useState<0 | 1>(kindIn)
  const [title, setTitle] = useState<string>(HELP_TEMPLATES[kindIn][0])
  const [body, setBody] = useState<string>(HELP_TEMPLATES[kindIn][1])
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setKind(kindIn); setTitle(HELP_TEMPLATES[kindIn][0]); setBody(HELP_TEMPLATES[kindIn][1]) } }, [open, kindIn])
  const pick = (k: 0 | 1) => { setKind(k); setTitle(HELP_TEMPLATES[k][0]); setBody(HELP_TEMPLATES[k][1]) }
  const send = async () => {
    setBusy(true)
    try {
      await call('/api/backstage/broadcast', 'POST', { title, body, target: 'custom', ownerIds: [ownerId] })
      toast.success('Elküldve — a csengőjében látja')
      onClose()
    } catch { toast.error('Nem sikerült elküldeni.') } finally { setBusy(false) }
  }
  return <PopupModal open={open} onClose={onClose} panel={<HelpMessageModal kind={kind} onKind={pick} title={title} onTitle={setTitle} body={body} onBody={setBody} subtitle={subtitle} onSend={send} onClose={onClose} busy={busy} />} />
}

/** Látható a vendégeknek — az üzlet be/ki kapcsolása (azonnal ment). */
export function PlaceSwitch({ placeKey, active }: { placeKey: string; active: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(active)
  useEffect(() => setOn(active), [active])
  const set = async (next: boolean) => {
    setOn(next)
    try { await call(`${placeApi(placeKey)}/toggle`, 'POST', { is_active: next }); toast.success(next ? 'Az üzlet látható' : 'Az üzlet kikapcsolva'); router.refresh() }
    catch { setOn(!next); toast.error('Nem sikerült menteni.') }
  }
  return <Switch checked={on} onChange={set} size="sm" ariaLabel="Látható a vendégeknek" />
}

/** Belső megjegyzés — mentés gombbal (fiók: az előfizetésre; üzlet: az üzletre). */
function NotesField({ initial, save, disabled = false, className = 'mt-3' }: { initial: string; save: (v: string) => Promise<void>; disabled?: boolean; className?: string }) {
  const [v, setV] = useState(initial)
  const [busy, setBusy] = useState(false)
  useEffect(() => setV(initial), [initial])
  const dirty = v !== initial
  const go = async () => { setBusy(true); try { await save(v); toast.success('Megjegyzés mentve') } catch { toast.error('Nem sikerült menteni.') } finally { setBusy(false) } }
  return (
    <Field label="Belső megjegyzés" className={className}>
      <Textarea rows={2} value={v} disabled={disabled} placeholder={disabled ? 'Előfizetés nélkül nem menthető.' : 'Csak te látod.'} onChange={(e) => setV(e.target.value)} />
      {dirty && <div className="mt-1.5 flex justify-end gap-1.5"><Button size="sm" variant="cell" onClick={() => setV(initial)}>Elvetés</Button><Button size="sm" icon={Check} loading={busy} onClick={go}>Mentés</Button></div>}
    </Field>
  )
}

type TierPlace = { key: string; name: string; tier: BsTier; customFee: number | null }

/** Csomag és havidíj — üzletenként (a csomag az üzleté; a fiók díja ebből számolódik a szerveren). */
export function TierDialog({ open, onClose, places, initialKey, subtitle }: { open: boolean; onClose: () => void; places: TierPlace[]; initialKey?: string; subtitle: string }) {
  const router = useRouter()
  const [key, setKey] = useState(initialKey ?? places[0]?.key ?? '')
  const cur = places.find((p) => p.key === key) ?? places[0]
  const [tier, setTier] = useState<BsTier>(cur?.tier ?? 'starter')
  const [fee, setFee] = useState(cur?.customFee != null ? String(cur.customFee) : '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setKey(initialKey ?? places[0]?.key ?? '') }, [open, initialKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const p = places.find((x) => x.key === key); if (p) { setTier(p.tier); setFee(p.customFee != null ? String(p.customFee) : '') } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!cur) return
    setBusy(true)
    try {
      await call(`${placeApi(cur.key)}/toggle`, 'POST', { tier, custom_monthly_fee_huf: tier === 'egyedi' && fee.trim() ? Number(fee) : null })
      toast.success('Csomag mentve'); onClose(); router.refresh()
    } catch { toast.error('Nem sikerült menteni a csomagot.') } finally { setBusy(false) }
  }
  return <PopupModal open={open} onClose={onClose} panel={<TierModal tier={tier} onTier={setTier} fee={fee} onFee={setFee} places={places.map((p) => ({ key: p.key, name: p.name }))} place={key} onPlace={setKey} subtitle={subtitle} onSave={save} onClose={onClose} busy={busy} />} />
}

/** Előfizetés állapota — kézi átállítás (próbánál a vége is). */
function StatusDialog({ open, onClose, ownerId, status, trialEnd, subtitle }: { open: boolean; onClose: () => void; ownerId: string; status: BsStatus | null; trialEnd: string | null; subtitle: string }) {
  const router = useRouter()
  const [v, setV] = useState<BsStatus>(status ?? 'active')
  const [end, setEnd] = useState(trialEnd ?? '')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setV(status ?? 'active'); setEnd(trialEnd ?? '') } }, [open, status, trialEnd])
  const save = async () => {
    setBusy(true)
    try {
      const body: Record<string, unknown> = { status: v }
      if (v === 'active') body.plan = 'paid'
      if (v === 'trialing') { body.plan = 'trial'; if (end) body.trial_ends_at = new Date(`${end}T23:59:00`).toISOString() }
      await call(`/api/backstage/accounts/${ownerId}`, 'PATCH', body)
      toast.success('Előfizetés frissítve'); onClose(); router.refresh()
    } catch { toast.error('A művelet nem sikerült.') } finally { setBusy(false) }
  }
  return <PopupModal open={open} onClose={onClose} panel={<StatusModal value={v} onSelect={setV} trialEnd={end} onTrialEnd={setEnd} subtitle={subtitle} onSave={save} onClose={onClose} busy={busy} />} />
}

/* ── Előfizetők ── */

const ACC_FILTERS: [string, BsStatus | null][] = [['Mind', null], ['Fizető', 'active'], ['Próba', 'trialing'], ['Lejárt', 'past_due'], ['Lemondott', 'canceled']]

export function AccountsView({ accounts, places, initialStatus }: { accounts: BsAccount[]; places: Record<string, BsPlaceLite[]>; initialStatus?: string }) {
  const desktop = useDesktop()
  const [chip, setChip] = useState(Math.max(0, ACC_FILTERS.findIndex(([, s]) => s === initialStatus)))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openKey, setOpenKey] = useState<string | null>(accounts[0]?.key ?? null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const st = ACC_FILTERS[chip][1]
    return accounts.filter((a) => (!st || a.status === st) && (!q || `${a.business} ${a.name} ${a.email}`.toLowerCase().includes(q)))
  }, [accounts, chip, query])
  const { slice, paging } = paginate(filtered, page, setPage)
  const sel = accounts.find((a) => a.key === openKey) ?? null
  const chips = ACC_FILTERS.map(([l, s]) => [l, s ? accounts.filter((a) => a.status === s).length : accounts.length] as [string, number])
  const open = (k: string) => { setOpenKey(k); if (!desktop) setMobileOpen(true) }
  const panel = (bare: boolean) => sel && (
    <AccountPanel a={sel} bare={bare} places={places[sel.key] ?? []} openHref={`/backstage/accounts/${sel.key}`} menu={<></>}
      actions={<><Button icon={LogIn} onClick={() => impersonate(sel.key)}>Belépés a nevében</Button><Button variant="cell" icon={Send} onClick={() => setHelp(true)}>Segítő üzenet</Button></>} />
  )
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AccountTable rows={slice} openKey={desktop ? openKey : null} onOpen={open} paging={paging}
          toolbar={<AccountToolbar active={chip} chips={chips} query={query} onQuery={(q) => { setQuery(q); setPage(1) }} onChip={(i) => { setChip(i); setPage(1) }} />}
          empty={<EmptyState icon={query || chip ? Search : Users} title={query || chip ? 'Nincs ilyen fiók' : 'Még nincs előfizető'} action={query || chip ? <Button variant="cell" onClick={() => { setQuery(''); setChip(0) }}>Szűrő törlése</Button> : undefined}>{query || chip ? 'Próbálj más nevet, e-mailt vagy állapotot.' : 'Az első regisztráció után itt jelenik meg.'}</EmptyState>} />
        {desktop && panel(false)}
      </div>
      {!desktop && <PopupModal open={mobileOpen && !!sel} onClose={() => setMobileOpen(false)} title={sel?.business ?? ''}>{panel(true)}</PopupModal>}
      {sel && <HelpDialog open={help} onClose={() => setHelp(false)} ownerId={sel.key} subtitle={`${sel.name} · ${sel.email}`} kind={sel.status === 'past_due' ? 1 : 0} />}
      <FilterSheet chips={chips} active={chip} onChip={(i) => { setChip(i); setPage(1) }} count={filtered.length} unit="fiók" />
    </>
  )
}

export type OrphanSub = { id: string; plan: string | null; status: string; breakdown: string | null; created: string }
/** Gazdátlan előfizetés (törölt fiók után maradt) — figyelmeztetés, és egy ablakban az állapotuk állítható. */
export function OrphanCard({ subs }: { subs: OrphanSub[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const set = async (id: string, status: string) => {
    try { await call(`/api/backstage/subscriptions/${id}`, 'PATCH', { status }); toast.success('Állapot mentve'); router.refresh() } catch { toast.error('Nem sikerült menteni.') }
  }
  return (
    <Card className="flex flex-col">
      <div className="text-ui-title text-ui-text">Gazdátlan előfizetés</div>
      <Note warn className="mt-3">{subs.length} előfizetésnek nincs tulajdonosa (a fiókot törölték, az előfizetés maradt).</Note>
      <div className="mt-auto pt-4"><Button variant="cell" icon={ArrowUpRight} onClick={() => setOpen(true)}>Megnézem</Button></div>
      <PopupModal open={open} onClose={() => setOpen(false)} title="Gazdátlan előfizetések">
        <div className="space-y-1.5">
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-ui-inner bg-ui-cell px-3 py-2.5">
              <span className="min-w-0 flex-1"><span className="block text-ui-body text-ui-text">#{s.id} · {s.breakdown || (s.plan === 'paid' ? 'Fizető' : 'Próba')}</span><Meta>{s.created}</Meta></span>
              <Select size="sm" defaultValue={s.status} onChange={(e) => void set(s.id, e.target.value)} className="w-[160px]">{(Object.keys(BS_STATUS) as BsStatus[]).map((k) => <option key={k} value={k}>{BS_STATUS[k].label}</option>)}</Select>
            </div>
          ))}
        </div>
      </PopupModal>
    </Card>
  )
}

/* ── Előfizető-profil ── */

export type ProfilePlace = BsPlace & { customFee: number | null }
export type ProfileVM = {
  a: BsAccount; hasSub: boolean; trialEndYmd: string | null; notes: string
  facts: { account: [string, string][]; sub: [string, string][] | null; invoice: { number: string; url: string | null } | null; referral: [string, string][] }
  places: ProfilePlace[]; bookings: BsBookingRow[]; audit: AuditTableRow[]
  kpis: { fee: string; places: string; placesLabel: string; bookings: string }
}

export function AccountProfileView({ vm }: { vm: ProfileVM }) {
  const router = useRouter()
  const { a } = vm
  const [menu, setMenu] = useState(false)
  const [dlg, setDlg] = useState<null | 'help' | 'status' | 'tier' | 'delete'>(null)
  const [tierKey, setTierKey] = useState<string | undefined>(undefined)
  const [del, setDel] = useState('')
  const [busy, setBusy] = useState(false)
  const allOn = vm.places.some((p) => p.active)
  const close = () => setDlg(null)
  const sub = `${a.name} · ${a.email}`
  const toggleAll = async () => {
    setMenu(false)
    try { await call(`/api/backstage/accounts/${a.key}`, 'PATCH', { is_active: !allOn }); toast.success(allOn ? 'Minden üzlet kikapcsolva' : 'Minden üzlet bekapcsolva'); router.refresh() } catch { toast.error('A művelet nem sikerült.') }
  }
  const remove = async () => {
    setBusy(true)
    try { await call(`/api/backstage/accounts/${a.key}`, 'DELETE'); toast.success('Fiók törölve'); router.push('/backstage/accounts') } catch { toast.error('A törlés nem sikerült.'); setBusy(false) }
  }
  const saveNotes = async (notes: string) => { await call(`/api/backstage/accounts/${a.key}`, 'PATCH', { notes }); router.refresh() }
  const tierPlaces: TierPlace[] = vm.places.map((p) => ({ key: p.key, name: p.name, tier: p.tier, customFee: p.customFee }))
  const statusLabel = a.status ? BS_STATUS[a.status].label : 'Nincs'
  const planLabel = a.tier ? BS_TIER[a.tier] : '—'
  return (
    <div className="p-4 lg:p-0">
      <PageHead back={['Előfizetők', a.business]} onBack={() => router.push('/backstage/accounts')} />
      <PageHead className="-mt-2" title={<>{a.business}<BsStatusPill status={a.status} trialLeft={a.trialLeft} /></>} sub={`${a.name} · ${a.since} óta`}
        actions={<>
          <Button icon={LogIn} onClick={() => impersonate(a.key)}>Belépés a nevében</Button>
          <Button variant="glass" icon={Mail} onClick={() => setDlg('help')}>Segítő üzenet</Button>
          <span className="relative">
            <IconButton icon={MoreHorizontal} label="Továbbiak" onClick={() => setMenu((v) => !v)} aria-expanded={menu} />
            {menu && <>
              <span className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
              <div className="absolute right-0 top-full z-50 mt-2">
                <AccountActionsMenu status={statusLabel} plan={planLabel} allOn={allOn}
                  onImpersonate={() => { setMenu(false); impersonate(a.key) }} onHelp={() => { setMenu(false); setDlg('help') }}
                  onStatus={() => { setMenu(false); setDlg(vm.hasSub ? 'status' : null); if (!vm.hasSub) toast.error('Ennek a fióknak nincs előfizetése.') }}
                  onTier={() => { setMenu(false); setTierKey(undefined); if (vm.places.length) setDlg('tier'); else toast.error('Ennek a fióknak még nincs üzlete.') }}
                  onToggleAll={toggleAll} onDelete={() => { setMenu(false); setDel(''); setDlg('delete') }} />
              </div>
            </>}
          </span>
        </>}
        kpis={<><Kpi icon={Wallet} value={vm.kpis.fee} label="Ft / hó" /><Kpi icon={Building2} value={vm.kpis.places} label={vm.kpis.placesLabel} /><Kpi icon={CalendarDays} value={vm.kpis.bookings} label="Foglalás · 30 nap" /></>} />
      <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-[5px]">
          <FactsCard title="Fiók" rows={vm.facts.account} />
          {vm.facts.sub
            ? <FactsCard title="Előfizetés" extra={<IconButton icon={Pencil} label="Előfizetés állapota" variant="ghost" size="sm" onClick={() => setDlg('status')} />} rows={[...vm.facts.sub, ['Állapot', <BsStatusPill key="s" status={a.status} trialLeft={a.trialLeft} />]]} />
            : <FactsCard title="Előfizetés" rows={[]}><Meta className="py-3">Ehhez a fiókhoz nem tartozik előfizetés.</Meta></FactsCard>}
          <FactsCard title="Utolsó számla" rows={vm.facts.invoice ? [['Számlaszám', vm.facts.invoice.number], ['Kiállító', 'Számlázz.hu']] : []}
            extra={vm.facts.invoice?.url ? <Button size="sm" variant="cell" icon={Receipt} href={vm.facts.invoice.url}>Megnyitás</Button> : undefined}>
            {!vm.facts.invoice && <Meta className="py-3">Még nincs kiállított számla.</Meta>}
          </FactsCard>
          <FactsCard title="Ajánlás" rows={vm.facts.referral} />
        </div>
        <div className="flex min-w-0 flex-col gap-[5px]">
          <AccountPlacesCard rows={vm.places} hrefOf={(p) => `/${p.slug}`} toggle={(p) => <PlaceSwitch placeKey={p.key} active={p.active} />}
            tierOf={(p) => <button type="button" onClick={() => { setTierKey(p.key); setDlg('tier') }} className="inline-flex items-center gap-1.5 hover:underline">{BS_TIER[p.tier]}<Pencil className="h-3.5 w-3.5 text-ui-muted" /></button>} />
          <AccountBookingsCard rows={vm.bookings} />
          <Card><div className="text-ui-title text-ui-text">Belső megjegyzés</div><NotesField initial={vm.notes} save={saveNotes} disabled={!vm.hasSub} /></Card>
          <AuditCard rows={vm.audit} />
        </div>
      </div>
      <HelpDialog open={dlg === 'help'} onClose={close} ownerId={a.key} subtitle={sub} kind={a.status === 'past_due' ? 1 : 0} />
      <StatusDialog open={dlg === 'status'} onClose={close} ownerId={a.key} status={a.status} trialEnd={vm.trialEndYmd} subtitle={`${a.business} · ${a.name}`} />
      {vm.places.length > 0 && <TierDialog open={dlg === 'tier'} onClose={close} places={tierPlaces} initialKey={tierKey} subtitle={`${a.business} · ${vm.kpis.placesLabel}`} />}
      <PopupModal open={dlg === 'delete'} onClose={close} panel={<DeleteAccountModal subtitle={sub} email={a.email} places={vm.places.length} value={del} onValue={setDel} onDelete={remove} onClose={close} busy={busy} />} />
    </div>
  )
}

/* ── Üzletek ── */

type PlaceDetail = { phone: string | null; email: string | null; notes: string; recent: [string, string][] }

export function PlacesView({ places, initial }: { places: (BsPlace & { customFee: number | null })[]; initial?: string }) {
  const desktop = useDesktop()
  const [chip, setChip] = useState(0)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openKey, setOpenKey] = useState<string | null>(initial && places.some((p) => p.key === initial) ? initial : places[0]?.key ?? null)
  const [mobileOpen, setMobileOpen] = useState(!!initial)
  const [details, setDetails] = useState<Record<string, PlaceDetail>>({})
  const [tierOpen, setTierOpen] = useState(false)
  const kinds: (null | 'salon' | 'restaurant')[] = [null, 'salon', 'restaurant']
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return places.filter((p) => (!kinds[chip] || p.kind === kinds[chip]) && (!q || `${p.name} ${p.city} ${p.owner}`.toLowerCase().includes(q)))
  }, [places, chip, query]) // eslint-disable-line react-hooks/exhaustive-deps
  const { slice, paging } = paginate(filtered, page, setPage)
  const sel = places.find((p) => p.key === openKey) ?? null
  useEffect(() => {
    if (!sel || details[sel.key]) return
    fetch(`${placeApi(sel.key)}/detail`).then((r) => r.json()).then((d) => {
      const place = d.salon ?? {}
      const recent: [string, string][] = ((d.recentBookings ?? []) as { customer_name?: string; service?: { name?: string } | null; pax?: number; date?: string; start_time?: string }[]).slice(0, 4)
        .map((b) => [b.customer_name || '—', [b.service && typeof b.service === 'object' ? b.service.name : b.pax != null ? `${b.pax} fő` : null, bookingWhen(b.date ?? '', b.start_time ?? '')].filter(Boolean).join(' · ')])
      setDetails((m) => ({ ...m, [sel.key]: { phone: place.phone ?? null, email: place.email ?? null, notes: place.admin_notes ?? '', recent } }))
    }).catch(() => null)
  }, [sel?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  const det = sel ? details[sel.key] : undefined
  const chips: [string, number][] = [['Mind', places.length], ['Szalon', places.filter((p) => p.kind === 'salon').length], ['Étterem', places.filter((p) => p.kind === 'restaurant').length]]
  const open = (k: string) => { setOpenKey(k); if (!desktop) setMobileOpen(true) }
  const panel = (bare: boolean) => sel && (
    <PlacePanel p={sel} bare={bare} phone={det?.phone ?? null} email={det?.email ?? null} recent={det?.recent ?? []} trialLeft={null}
      ownerHref={sel.ownerKey ? `/backstage/accounts/${sel.ownerKey}` : undefined} publicHref={sel.slug ? `/${sel.slug}` : undefined}
      toggle={<PlaceSwitch placeKey={sel.key} active={sel.active} />}
      tier={<button type="button" onClick={() => setTierOpen(true)} className="inline-flex items-center gap-1.5 text-ui-body text-ui-text hover:underline">{BS_TIER[sel.tier]}{sel.tier === 'egyedi' && sel.customFee != null ? ` · ${sel.customFee.toLocaleString('hu-HU')} Ft` : ''}<Pencil className="h-3.5 w-3.5 text-ui-muted" /></button>}
      notes={<NotesField key={sel.key} initial={det?.notes ?? ''} save={async (v) => { await call(`${placeApi(sel.key)}/toggle`, 'POST', { admin_notes: v }); setDetails((m) => ({ ...m, [sel.key]: { ...(m[sel.key] as PlaceDetail), notes: v } })) }} />}
      actions={<Button icon={LogIn} className="w-full" disabled={!sel.ownerKey} onClick={() => sel.ownerKey && impersonate(sel.ownerKey)}>Belépés a nevében</Button>} />
  )
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <PlaceTable rows={slice} openKey={desktop ? openKey : null} onOpen={open} chips={chips} active={chip} onChip={(i) => { setChip(i); setPage(1) }} query={query} onQuery={(q) => { setQuery(q); setPage(1) }} paging={paging}
          empty={<EmptyState icon={Search} title="Nincs ilyen üzlet">Próbálj más nevet, várost vagy tulajt.</EmptyState>} />
        {desktop && panel(false)}
      </div>
      {!desktop && <PopupModal open={mobileOpen && !!sel} onClose={() => setMobileOpen(false)} title={sel?.name ?? ''}>{panel(true)}</PopupModal>}
      {sel && <TierDialog open={tierOpen} onClose={() => setTierOpen(false)} places={[{ key: sel.key, name: sel.name, tier: sel.tier, customFee: sel.customFee }]} initialKey={sel.key} subtitle={`${sel.name} · ${sel.owner}`} />}
      <FilterSheet label="Típus" chips={chips} active={chip} onChip={(i) => { setChip(i); setPage(1) }} count={filtered.length} unit="üzlet" />
    </>
  )
}

/* ── Kockázat ── */

export function RiskView({ rows }: { rows: BsRisk[] }) {
  const [chip, setChip] = useState(0)
  const [query, setQuery] = useState('')
  const [help, setHelp] = useState<BsRisk | null>(null)
  const kinds = [null, ...RISK_ORDER]
  const filtered = rows.filter((r) => (!kinds[chip] || r.kind === kinds[chip]) && (!query.trim() || `${r.name} ${r.owner}`.toLowerCase().includes(query.trim().toLowerCase())))
  const chips: [string, number][] = [['Mind', rows.length], ...RISK_ORDER.map((k) => [BS_RISK[k].label, rows.filter((r) => r.kind === k).length] as [string, number])]
  return (
    <>
      <RiskTable rows={filtered} chips={chips} active={chip} onChip={setChip} query={query} onQuery={setQuery}
        action={(r) => (r.kind === 'trial' || r.kind === 'pastDue') && r.ownerKey ? <Button size="sm" variant="cell" icon={Send} onClick={() => setHelp(r)}>Segítő üzenet</Button> : <IconButton icon={ArrowUpRight} label="Megnyitás" variant="ghost" size="sm" href={r.href} />}
        empty={<EmptyState icon={Check} title={rows.length ? 'Nincs ilyen' : 'Minden rendben'}>{rows.length ? 'Ebben a csoportban most senki sincs.' : 'Nincs lejárt fizetés, lejáró próba vagy alvó üzlet.'}</EmptyState>} />
      {help?.ownerKey && <HelpDialog open onClose={() => setHelp(null)} ownerId={help.ownerKey} subtitle={`${help.owner} · ${help.name}`} kind={help.kind === 'pastDue' ? 1 : 0} />}
      <FilterSheet label="Mi a gond" chips={chips} active={chip} onChip={setChip} count={filtered.length} unit="tétel" />
    </>
  )
}

/* ── Kapcsolat ── */

export function MessagesView({ messages }: { messages: (BsMessage & { id: string })[] }) {
  const router = useRouter()
  const desktop = useDesktop()
  const [rows, setRows] = useState(messages)
  useEffect(() => setRows(messages), [messages])
  const [chip, setChip] = useState(0)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [openKey, setOpenKey] = useState<string | null>(messages[0]?.key ?? null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const filtered = rows.filter((m) => (chip === 0 || (chip === 1 ? !m.answered : m.answered)) && (!query.trim() || `${m.name} ${m.email} ${m.message}`.toLowerCase().includes(query.trim().toLowerCase())))
  const { slice, paging } = paginate(filtered, page, setPage)
  const sel = rows.find((m) => m.key === openKey) ?? null
  const chips: [string, number][] = [['Mind', rows.length], ['Új', rows.filter((m) => !m.answered).length], ['Megválaszolva', rows.filter((m) => m.answered).length]]
  const mark = async (m: BsMessage & { id: string }) => {
    setBusy(true)
    try {
      await call(`/api/backstage/contact/${m.id}`, 'PATCH', { status: m.answered ? 'new' : 'answered' })
      setRows((all) => all.map((x) => (x.key === m.key ? { ...x, answered: !x.answered } : x)))
      toast.success(m.answered ? 'Visszaállítva újnak' : 'Megválaszoltnak jelölve'); router.refresh()
    } catch { toast.error('A módosítás nem sikerült.') } finally { setBusy(false) }
  }
  const panel = (bare: boolean) => sel && (
    <MessagePanel m={sel} bare={bare} actions={<>
      <Button icon={Mail} href={`mailto:${sel.email}?subject=${encodeURIComponent('Re: davelopment booking')}`}>Válasz e-mailben</Button>
      <Button variant="cell" icon={Check} loading={busy} onClick={() => void mark(sel)}>{sel.answered ? 'Újnak jelölöm' : 'Megválaszolva'}</Button>
    </>} />
  )
  return (
    <>
      <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <MessageTable rows={slice} openKey={desktop ? openKey : null} onOpen={(k) => { setOpenKey(k); if (!desktop) setMobileOpen(true) }} chips={chips} active={chip} onChip={(i) => { setChip(i); setPage(1) }} query={query} onQuery={(q) => { setQuery(q); setPage(1) }} paging={paging}
          empty={<EmptyState icon={Mail} title={rows.length ? 'Nincs ilyen üzenet' : 'Még nem érkezett üzenet'}>{rows.length ? 'Próbálj más keresést vagy szűrőt.' : 'A kapcsolat-űrlap üzenetei itt jelennek meg.'}</EmptyState>} />
        {desktop && panel(false)}
      </div>
      {!desktop && <PopupModal open={mobileOpen && !!sel} onClose={() => setMobileOpen(false)} title={sel?.name ?? ''}>{panel(true)}</PopupModal>}
      <FilterSheet chips={chips} active={chip} onChip={(i) => { setChip(i); setPage(1) }} count={filtered.length} unit="üzenet" />
    </>
  )
}

/* ── Körüzenet ── */

type AccountLite = { ownerId: string; name: string; email: string; breakdown: string | null }

export function BroadcastView({ counts, history }: { counts: [number, number, number]; history: (BsBroadcastRow & { id: string })[] }) {
  const router = useRouter()
  const [who, setWho] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<AccountLite[] | null>(null)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [undoArmed, setUndoArmed] = useState<string | null>(null)
  useEffect(() => {
    if (who !== 3 || accounts) return
    fetch('/api/backstage/accounts-lite').then((r) => r.json()).then((d) => setAccounts(d.accounts ?? [])).catch(() => setAccounts([]))
  }, [who, accounts])
  useEffect(() => { setArmed(false) }, [who, title, body, picked])
  const target = BROADCAST_TARGETS[who][0]
  const send = async () => {
    if (!armed) { setArmed(true); return }
    setBusy(true)
    try {
      await call('/api/backstage/broadcast', 'POST', { title, body, target, ownerIds: target === 'custom' ? picked : undefined })
      toast.success('Körüzenet elküldve'); setTitle(''); setBody(''); setPicked([]); setArmed(false); router.refresh()
    } catch { toast.error('A küldés nem sikerült.') } finally { setBusy(false) }
  }
  const undo = async (id: string) => {
    if (undoArmed !== id) { setUndoArmed(id); return }
    try { await call(`/api/backstage/broadcast/${id}`, 'DELETE'); toast.success('Körüzenet visszavonva'); setUndoArmed(null); router.refresh() } catch { toast.error('A visszavonás nem sikerült.') }
  }
  const q = search.trim().toLowerCase()
  const list = (accounts ?? []).filter((a) => !q || `${a.name} ${a.email} ${a.breakdown ?? ''}`.toLowerCase().includes(q)).slice(0, 40)
  const picker = who === 3 && (
    <div className="mt-3 rounded-ui-inner bg-ui-cell p-3">
      <SearchField value={search} onChange={setSearch} className="w-full">Név, e-mail, üzlet…</SearchField>
      <div className="mt-2 max-h-[220px] space-y-1 overflow-y-auto" data-lenis-prevent>
        {accounts == null ? <Meta className="py-3">Betöltés…</Meta> : list.length === 0 ? <Meta className="py-3">Nincs találat.</Meta> : list.map((a) => (
          <Checkbox key={a.ownerId} checked={picked.includes(a.ownerId)} onChange={() => setPicked((p) => (p.includes(a.ownerId) ? p.filter((x) => x !== a.ownerId) : [...p, a.ownerId]))}
            label={<span className="min-w-0"><span className="block text-ui-body text-ui-text">{a.name}</span><span className="block text-ui-label text-ui-muted">{a.email}{a.breakdown ? ` · ${a.breakdown}` : ''}</span></span>} className="w-full rounded-ui-control bg-white px-3 py-2" />
        ))}
      </div>
    </div>
  )
  return (
    <>
      <BroadcastEditor who={who} onWho={setWho} counts={[...counts, picked.length]} title={title} onTitle={setTitle} body={body} onBody={setBody} picker={picker}
        recipients={who === 3 ? picked.length : counts[who]} onSend={() => void send()} onCancel={() => setArmed(false)} armed={armed} busy={busy} />
      <BroadcastHistory className="mt-[5px]" rows={history}
        undo={(r) => <Button size="sm" variant={undoArmed === (r as BsBroadcastRow & { id: string }).id ? 'danger' : 'cell'} icon={Trash2} onClick={() => void undo((r as BsBroadcastRow & { id: string }).id)}>{undoArmed === (r as BsBroadcastRow & { id: string }).id ? 'Biztos?' : 'Visszavonás'}</Button>} />
    </>
  )
}

/* ── Beállítások: globális árazás ── */

export function PricingView({ initial }: { initial: Record<PricingKey, number> }) {
  const router = useRouter()
  const start = useMemo(() => Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v ?? '')])) as Record<PricingKey, string>, [initial])
  const [v, setV] = useState(start)
  const [busy, setBusy] = useState(false)
  useEffect(() => setV(start), [start])
  const changed = (Object.keys(start) as PricingKey[]).filter((k) => v[k] !== start[k]).length
  const save = async () => {
    setBusy(true)
    try {
      await call('/api/backstage/pricing', 'POST', Object.fromEntries((Object.keys(v) as PricingKey[]).map((k) => [k, Number(v[k] || 0)])))
      toast.success('Árazás mentve'); router.refresh()
    } catch { toast.error('Nem sikerült menteni az árazást.') } finally { setBusy(false) }
  }
  const n = (k: PricingKey) => Number(v[k] || 0)
  // mobilon a Beállítások-lap felcsúszó ablakban szokott élni (ott az ad szélt) — itt nincs ablak, ezért a fehér lap
  // mobilon saját belső margót kap; az összegző kártyák desktopon mellette, mobilon alatta
  return (
    <div className="grid grid-cols-1 items-start gap-[5px] [&>*]:min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="max-lg:rounded-ui-card max-lg:bg-white max-lg:px-4 max-lg:pt-1">
        <SettingsPage group="Platform" title="Globális árazás" save={false}>
          {PRICING_ROWS.map((g) => (
            <SettingsGroup key={g.group} icon={g.icon} title={g.group}>
              {g.rows.map(([k, l, , u, h]) => <PriceRow key={k} label={l} value={v[k] ?? ''} unit={u} hint={h} onChange={(x) => setV((st) => ({ ...st, [k]: x }))} />)}
            </SettingsGroup>
          ))}
          {changed > 0 && <><div className="h-16" /><SaveBar label={`${changed} módosítás`} onSave={() => void save()} onDiscard={() => setV(start)} busy={busy} /></>}
        </SettingsPage>
      </div>
      <div className="flex flex-col gap-[5px]">
        <PricingAside salonFrom={Math.min(n('salon_starter_huf') || Infinity, n('salon_pro_huf') || Infinity) || 0} restaurantFrom={Math.min(n('restaurant_starter_huf') || Infinity, n('restaurant_pro_huf') || Infinity) || 0} trialDays={n('trial_days')} annualPct={n('annual_discount_pct')} />
      </div>
    </div>
  )
}

/* ── Ajánlások ── */

export function ReferralCreditButton({ id }: { id: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/backstage/referrals/${id}/credit`, { method: 'POST' })
      if (res.status === 409) { toast.error('Most sem sikerült — az ajánlónak még nincs fizetős előfizetése.'); return }
      if (!res.ok) throw new Error()
      toast.success('+1 hónap jóváírva'); router.refresh()
    } catch { toast.error('A jóváírás nem sikerült.') } finally { setBusy(false) }
  }
  return <Button size="sm" icon={Gift} loading={busy} onClick={() => void go()}>Jóváírás most</Button>
}
