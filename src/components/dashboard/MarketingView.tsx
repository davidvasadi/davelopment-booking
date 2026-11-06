'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { LayoutTemplate, Mail, Plus, X, Send, SlidersHorizontal, Trash2, Users } from 'lucide-react'
import { Button, Card, CardTitle, EmptyState, FIELD, Field, FieldRow, IconButton, Input, Kpi, Meta, Modal, OptionCard, PageHead, Panel, Pill, SearchField, Segmented, SegmentBar, Select } from '@/components/ui-kit'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { TimeSelect } from '@/components/ui/time-select'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ChipToolbar } from '@/components/blocks/toolbar'
import { BulkDock, StaffBulkBar } from '@/components/blocks/team'
import {
  BlockInsertGrid, BlockPalette, BlockStyle, CampaignAudience, CampaignDetails, CampaignFilter, CampaignGauge, CampaignLetter, CampaignList,
  CampaignResults, CampaignSend, OpenRateCard, RecipientTable, SubscriberFilters, SubscriberMobileList, SubscriberTable, SUB_FILTER0, subFilterCount, type SubscriberFilterValue,
  type CampaignFilterValue, type CampaignItem, type InsertKind, type LetterBiz, type LetterEdit, type RecipientPickRow, type RecipientRow, type SubscriberRowVM,
} from '@/components/blocks/marketing'
import { newBlock } from '@/components/dashboard/NewsletterBlockEditor'
import { blockName, useBlockInspector } from '@/components/dashboard/useBlockInspector'
import { blocksToHtml, emptyTextBlock, type ColumnCell, type ComposerBlock } from '@/lib/emailBlocks'
import { marketingTemplates } from '@/lib/marketingTemplates'
import { SEGMENT_LABEL, segmentsFor, usableTranslation, type CampaignTranslations, type Segment } from '@/lib/marketingSegments'
import { LOCALE_LABELS, type Locale } from '@/lib/i18n'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { MONTHS_SHORT } from '@/lib/schedule'
import type { CampaignVM, MarketingVM, SubscriberVM } from '@/lib/marketingView'

/**
 * Marketing — szalon és étterem közös oldala (design 13.1–13.8). Fülek: Kampányok (bal lista, közép a levél, jobb a
 * mérő + részletek; írás-módban a szerkesztő, a kijelölt blokk stílusa, kinek megy, küldés) és Feliratkozók.
 * Mobilon ugyanezek a darabok egymás alatt, az írás három lépésben (Levél / Címzettek / Küldés).
 */

interface Props {
  restaurant?: boolean
  businessId: string
  vm: MarketingVM
  biz: LetterBiz
  canManage?: boolean
}

/** `tr`: a többi nyelv változata (a magyar a `subject` / `blocks`) */
type Draft = { id: string | null; subject: string; blocks: ComposerBlock[]; tr: CampaignTranslations; segments: Segment[]; picked: string[]; when: number; at: string }
type OtherLocale = Exclude<Locale, 'hu'>
type SubApi = { id: string; name: string; email: string; city: string; country: string | null; consentAt: string; status: 'subscribed' | 'unsubscribed'; bookings: number; lastVisit: string | null; received: number; opened: number; lastOpen: { at: string; subject: string } | null }

const LIST_PAGE = 5
const SUB_PAGE = 10
const nf = (n: number) => n.toLocaleString('hu-HU')
const pad = (n: number) => String(n).padStart(2, '0')
const fmtD = (iso: string) => { const d = new Date(iso); return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.` }
const fmtDT = (iso: string) => { const d = new Date(iso); return `${fmtD(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}` }
const relDay = (iso: string) => {
  const d = new Date(iso); const t = new Date(); t.setHours(0, 0, 0, 0)
  const diff = Math.round((t.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
  return diff === 0 ? 'Ma' : diff === 1 ? 'Tegnap' : fmtD(iso)
}
const localInput = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)
const STATUS_KEYS: (CampaignVM['status'] | 'all')[] = ['all', 'sent', 'scheduled', 'draft']
const FILTER0: CampaignFilterValue = { status: 0, sort: 0, period: 2, from: '', to: '' }
const toSubRow = (s: SubApi | SubscriberVM): SubscriberRowVM => {
  const since = 'since' in s ? s.since : s.consentAt
  return { id: s.id, name: s.name, email: s.email, country: s.country ?? '', since: fmtD(since), bookings: s.bookings, lastVisit: s.lastVisit ? fmtD(`${s.lastVisit.slice(0, 10)}T12:00:00`) : null, opened: s.opened, received: s.received, last: s.lastOpen?.subject ?? null, lastAt: s.lastOpen ? fmtD(s.lastOpen.at) : null, unsub: 'status' in s && s.status === 'unsubscribed' }
}

export function MarketingView({ restaurant = false, businessId, vm, biz, canManage = false }: Props) {
  const router = useRouter()
  const kind = restaurant ? 'restaurant' : 'salon'
  const campaigns = vm.campaigns
  const bookLabel = restaurant ? 'Asztalt foglalok' : 'Időpontot foglalok'

  // ── fülek, lista, szűrés ──
  const [tab, setTab] = useState(0)
  // a Beállítások › Hírlevél „Feliratkozók” gombja (?tab=subscribers) a második fülre nyit
  useEffect(() => { if (new URLSearchParams(window.location.search).get('tab') === 'subscribers') setTab(1) }, [])
  const [filter, setFilter] = useState<CampaignFilterValue>(FILTER0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [listPage, setListPage] = useState(1)
  const firstSent = campaigns.find((c) => c.status === 'sent')?.id ?? campaigns[0]?.id ?? null
  const [openId, setOpenId] = useState<string | null>(firstSent)
  const [mobileOpen, setMobileOpen] = useState(false)

  const counts = useMemo(() => STATUS_KEYS.map((k) => (k === 'all' ? campaigns.length : campaigns.filter((c) => c.status === k).length)), [campaigns])
  const filtered = useMemo(() => {
    const now = Date.now()
    const from = filter.period === 0 ? now - 30 * 86_400_000 : filter.period === 1 ? new Date(new Date().getFullYear(), 0, 1).getTime() : filter.period === 3 && filter.from ? new Date(`${filter.from}T00:00:00`).getTime() : null
    const to = filter.period === 3 && filter.to ? new Date(`${filter.to}T23:59:59`).getTime() : null
    const st = STATUS_KEYS[filter.status]
    const list = campaigns.filter((c) => {
      if (st !== 'all' && c.status !== st) return false
      const t = new Date(c.scheduledAt ?? c.at).getTime()
      return (from == null || t >= from) && (to == null || t <= to)
    })
    const rate = (c: CampaignVM) => (c.stats ? c.stats.opened / Math.max(1, c.recipients) : -1)
    if (filter.sort === 1) list.sort((a, b) => rate(b) - rate(a))
    else if (filter.sort === 2) list.sort((a, b) => (b.stats?.booked ?? -1) - (a.stats?.booked ?? -1))
    return list
  }, [campaigns, filter])
  const listPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE))
  const pageItems = filtered.slice((listPage - 1) * LIST_PAGE, listPage * LIST_PAGE)
  useEffect(() => { setListPage(1) }, [filter])
  const maxBooked = Math.max(1, ...campaigns.map((c) => c.stats?.booked ?? 0))
  const pickDay = (d: string) => setFilter((f) => (!f.from || f.to ? { ...f, from: d, to: '' } : d < f.from ? { ...f, from: d } : { ...f, to: d }))

  // ── írás-mód ──
  const [draft, setDraft] = useState<Draft | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [count, setCount] = useState<number | null>(vm.subscribers)
  const [sending, setSending] = useState(false)
  const [confirmSend, setConfirmSend] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [step, setStep] = useState(0)
  const [insertOpen, setInsertOpen] = useState(false)
  const [insertKind, setInsertKind] = useState<InsertKind>('title')
  const [styleOpen, setStyleOpen] = useState(false)
  const [loc, setLoc] = useState<Locale>('hu')
  const [viewLoc, setViewLoc] = useState<Locale>('hu')
  const patchDraft = (p: Partial<Draft>) => { setDraft((d) => (d ? { ...d, ...p } : d)); setDirty(true) }

  const startDraft = useCallback((d: Partial<Draft> = {}) => {
    if (!canManage) return
    // új kampány a design levelének vázával: borítókép, cím, szöveg, foglalás gomb
    const blocks = d.blocks?.length ? d.blocks.map((b) => ({ ...b, id: `${b.id}-${Date.now().toString(36)}` })) as ComposerBlock[]
      : [newBlock('image'), newBlock('title'), newBlock('text'), { ...newBlock('button'), label: bookLabel, url: vm.bookingUrl, width: 'full' } as ComposerBlock]
    setDraft({ id: null, subject: '', tr: {}, segments: ['all'], picked: [], when: 0, at: '', ...d, blocks }); setLoc('hu')
    setDirty(false); setSaveState('idle'); setFocusId(blocks[0]?.id ?? null); setStep(0); setTab(0); setMobileOpen(false)
  }, [canManage, bookLabel, vm.bookingUrl])
  const openCampaign = (c: CampaignVM, mobile = false) => {
    if (c.status === 'sent' || !canManage) { setDraft(null); setOpenId(c.id); if (mobile) setMobileOpen(true); return }
    // piszkozat / ütemezett: szerkeszthető (az ütemezett mentéskor piszkozat lesz, újra ütemezhető)
    setOpenId(c.id)
    setLoc('hu')
    setDraft({ id: c.id, subject: c.subject, blocks: c.blocks.length ? c.blocks : [emptyTextBlock()], tr: c.translations, segments: c.segments, picked: c.pickedIds, when: c.status === 'scheduled' ? 1 : 0, at: c.scheduledAt ? localInput(c.scheduledAt) : '' })
    setDirty(false); setSaveState('saved'); setFocusId(c.blocks[0]?.id ?? null); setStep(0)
  }
  const closeDraft = () => { setDraft(null); setDirty(false) }

  // címzett-szám: kijelölt vendégeknél a kijelöltek, különben a szegmensek alapján (élőben a szerverről)
  const segKey = draft?.segments.join(',') ?? ''
  const pickedN = draft?.picked.length ?? 0
  useEffect(() => {
    if (!draft) return
    if (pickedN) { setCount(pickedN); return }
    let alive = true
    setCount(null)
    const t = setTimeout(() => {
      fetch(`/api/marketing/audience?kind=${kind}&businessId=${businessId}&segments=${encodeURIComponent(segKey)}`, { credentials: 'include' })
        .then((r) => r.json()).then((j: { count?: number }) => { if (alive) setCount(j.count ?? 0) }).catch(() => { if (alive) setCount(0) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [segKey, pickedN, kind, businessId, !!draft]) // eslint-disable-line react-hooks/exhaustive-deps

  // a piszkozat folyamatosan mentődik (design 13.7) — ha van tárgya és változott
  const saving = useRef(false)
  const saveDraft = useCallback(async (manual = false) => {
    if (!draft || !canManage) return
    if (!draft.subject.trim()) { if (manual) toast.error('Adj tárgyat a levélnek.'); return }
    if (saving.current) return
    saving.current = true; setSaveState('saving')
    try {
      const r = await fetch('/api/marketing/drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind, businessId, subject: draft.subject, blocks: draft.blocks, translations: draft.tr, draftId: draft.id ?? undefined, customerIds: draft.picked, segments: draft.segments }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Nem sikerült menteni.')
      const first = !draft.id
      setDraft((d) => (d ? { ...d, id: String(j.id) } : d)); setOpenId(String(j.id)); setDirty(false); setSaveState('saved')
      if (manual) toast.success('Mentve vázlatként')
      // az első mentéstől a piszkozat a listában is ott van (a szerver-oldali lista frissül)
      if (manual || first) router.refresh()
    } catch (e) { setSaveState('idle'); if (manual) toast.error(e instanceof Error ? e.message : 'Nem sikerült menteni.') } finally { saving.current = false }
  }, [draft, canManage, kind, businessId, router])
  useEffect(() => {
    if (!dirty || !draft?.subject.trim()) return
    const t = setTimeout(() => void saveDraft(), 1500)
    return () => clearTimeout(t)
  }, [dirty, draft, saveDraft])

  const send = async () => {
    if (!draft) return
    setSending(true)
    try {
      const scheduledAt = draft.when === 1 && draft.at ? new Date(draft.at).toISOString() : undefined
      const r = await fetch('/api/marketing/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind, businessId, subject: draft.subject, bodyHtml: blocksToHtml(draft.blocks), blocks: draft.blocks, translations: draft.tr, customerIds: draft.picked, segments: draft.segments, draftId: draft.id ?? undefined, scheduledAt }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Nem sikerült elküldeni.')
      toast.success(j.scheduled ? `Ütemezve: ${fmtDT(j.scheduledAt)}` : `Elküldve ${nf(j.sent)} címzettnek`)
      setDraft(null); setDirty(false); setOpenId(String(j.id)); setConfirmSend(false)
      router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült elküldeni.'); setConfirmSend(false) } finally { setSending(false) }
  }
  const discard = async () => {
    if (!draft?.id) { closeDraft(); setConfirmDiscard(false); return }
    try {
      const r = await fetch('/api/marketing/drafts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind, businessId, draftId: draft.id }) })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Nem sikerült törölni.')
      toast.success('Piszkozat törölve'); closeDraft(); setOpenId(firstSent); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült törölni.') } finally { setConfirmDiscard(false) }
  }
  const trySend = () => {
    if (!draft) return
    if (!draft.subject.trim()) { toast.error('Adj tárgyat a levélnek.'); return }
    if (!blocksToHtml(draft.blocks).replace(/<[^>]+>/g, '').trim()) { toast.error('A levél még üres.'); return }
    if (draft.when === 1 && (!draft.at || new Date(draft.at).getTime() < Date.now() + 60_000)) { toast.error('Az ütemezett időpont legyen a jövőben.'); return }
    setConfirmSend(true)
  }

  // ── blokkok (paletta, beszúrás, stílus, mobil eszköztár) ──
  // a szerkesztett nyelv: magyarul a fő mezők, más nyelven a fordítás (első váltáskor a magyar levél másolata, üres tárggyal)
  const other = loc === 'hu' ? null : (loc as OtherLocale)
  const curTr = other && draft ? draft.tr[other] ?? null : null
  const blocks = (other ? curTr?.blocks : draft?.blocks) ?? []
  const curSubject = (other ? curTr?.subject : draft?.subject) ?? ''
  const setBlocks = (b: ComposerBlock[]) => { if (!draft) return; if (other) patchDraft({ tr: { ...draft.tr, [other]: { subject: curSubject, blocks: b } } }); else patchDraft({ blocks: b }) }
  const setSubject = (v: string) => { if (!draft) return; if (other) patchDraft({ tr: { ...draft.tr, [other]: { subject: v, blocks } } }); else patchDraft({ subject: v }) }
  const switchLoc = (l: Locale) => {
    if (draft && l !== 'hu' && !draft.tr[l as OtherLocale]) patchDraft({ tr: { ...draft.tr, [l]: { subject: '', blocks: draft.blocks } } })
    setLoc(l)
  }
  const focused = blocks.find((b) => b.id === focusId) ?? null
  // a kijelölt blokk szerkesztése (tartalom-mezők, stílus, formázás, link) — közös a Vendég e-mailekkel
  const { blockFields, support, styleValue, setStyle, format, linkModal } = useBlockInspector({ blocks, setBlocks, focusId, linkPlaceholder: vm.bookingUrl, logo: biz.logo ?? null, bizName: biz.name })
  const insertBlocks = (nb: ComposerBlock[]) => {
    const i = focusId ? blocks.findIndex((b) => b.id === focusId) : -1
    setBlocks(i < 0 ? [...blocks, ...nb] : [...blocks.slice(0, i + 1), ...nb, ...blocks.slice(i + 1)])
    setFocusId(nb[0].id)
  }
  const addKind = (k: InsertKind) => {
    if (k === 'title') return insertBlocks([newBlock('title'), newBlock('text')])
    if (k === 'gallery') return insertBlocks([{ ...newBlock('columns'), cols: [0, 1].map((): ColumnCell => ({ type: 'image', url: '', alt: '' })) } as ComposerBlock])
    if (k === 'logo') return insertBlocks([{ ...newBlock('image'), url: biz.logo ?? '', alt: biz.name, kind: 'logo', width: 'md', align: 'center' } as ComposerBlock])
    if (k === 'social_links') return insertBlocks([{ ...newBlock('social_links'), links: biz.social?.length ? biz.social.map((url) => ({ url })) : [{ url: '' }], align: 'center' } as ComposerBlock])
    const b = newBlock(k, { url: vm.bookingUrl })
    if (b.type === 'button') { b.label = bookLabel; b.url = vm.bookingUrl; b.width = 'full' }
    insertBlocks([b])
  }
  const moveBlock = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id); const j = i + dir
    if (i < 0 || j < 0 || j >= blocks.length) return
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]]; setBlocks(next); setFocusId(id)
  }
  const removeBlock = (id: string) => { const i = blocks.findIndex((b) => b.id === id); const next = blocks.filter((b) => b.id !== id); setBlocks(next.length ? next : [emptyTextBlock()]); setFocusId(next[Math.max(0, i - 1)]?.id ?? null); setStyleOpen(false) }
  const removeFocused = () => { if (focused) removeBlock(focused.id) }
  const editState = (mobile: boolean): LetterEdit => ({ selectedId: focusId, onSelect: setFocusId, onChange: setBlocks, onMove: moveBlock, onRemove: removeBlock, ...(mobile ? { tools: true, onStyle: (id: string) => { setFocusId(id); setStyleOpen(true) }, onInsert: (id: string) => { setFocusId(id); setInsertOpen(true) } } : {}) })

  // ── sablonok ──
  // a sablon szövege a szerkesztett nyelven jön
  const templates = useMemo(() => marketingTemplates({ restaurant, bookingUrl: vm.bookingUrl, logo: biz.logo, social: biz.social, locale: loc }), [restaurant, vm.bookingUrl, biz.logo, biz.social, loc])
  const [tplOpen, setTplOpen] = useState(false)
  const [tplId, setTplId] = useState(templates[0]?.id ?? '')
  const loadTemplate = () => {
    const t = templates.find((x) => x.id === tplId)
    if (!t || !draft) return
    if (other) patchDraft({ tr: { ...draft.tr, [other]: { subject: curSubject.trim() ? curSubject : t.subject, blocks: t.blocks } } })
    else patchDraft({ subject: draft.subject.trim() ? draft.subject : t.subject, blocks: t.blocks, segments: draft.picked.length ? draft.segments : t.segments })
    setFocusId(t.blocks[0]?.id ?? null); setTplOpen(false)
    toast.success(`Sablon betöltve: ${t.title}`)
  }

  // ── címzettek kiválasztása (13.5) ──
  const [pickOpen, setPickOpen] = useState(false)
  const [pickSel, setPickSel] = useState<string[]>([])
  const [pickRows, setPickRows] = useState<SubApi[]>([])
  const [pickQ, setPickQ] = useState('')
  const [pickF, setPickF] = useState<SubscriberFilterValue>(SUB_FILTER0)
  const [pickFOpen, setPickFOpen] = useState(false)
  // annyi sor egy oldalon, amennyi az ablakba kifér (a lábléc nem takarja a lapozót)
  const [pickPer, setPickPer] = useState(8)
  const [pickTotal, setPickTotal] = useState(0)
  const [pickPage, setPickPage] = useState(1)
  // a feliratkozó-lista szűrői az API-nak (keresés, mióta, foglalás, ország)
  const filterParams = (p: URLSearchParams, q: string, f: SubscriberFilterValue) => {
    if (q.trim()) p.set('search', q.trim()); if (f.country) p.set('country', f.country); if (f.since) p.set('since', String(f.since)); if (f.bookings) p.set('bookings', f.bookings)
    if (f.visit) p.set('visit', f.visit); if (f.engage) p.set('engage', f.engage); if (f.service) p.set('service', f.service)
    return p
  }
  const loadPick = useCallback(async () => {
    const p = filterParams(new URLSearchParams({ kind, businessId, page: String(pickPage), limit: String(pickPer) }), pickQ, pickF)
    const r = await fetch(`/api/marketing/subscribers?${p}`, { credentials: 'include' }); const j = await r.json()
    if (r.ok) { setPickRows(j.docs ?? []); setPickTotal(j.totalDocs ?? 0) }
  }, [kind, businessId, pickPage, pickPer, pickQ, pickF]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!pickOpen) return; const t = setTimeout(() => void loadPick(), 200); return () => clearTimeout(t) }, [pickOpen, loadPick])
  const pickAll = async () => {
    const p = filterParams(new URLSearchParams({ kind, businessId, idsOnly: '1' }), pickQ, pickF)
    const j = await (await fetch(`/api/marketing/subscribers?${p}`, { credentials: 'include' })).json()
    const ids: string[] = j.ids ?? []
    setPickSel((s) => (ids.every((i) => s.includes(i)) ? s.filter((i) => !ids.includes(i)) : [...new Set([...s, ...ids])]))
  }
  const openPicker = () => {
    // ablak 85%-a mínusz fejléc, eszköztár, táblázat-fej, lapozó, lábléc (~480 px); egy sor ~58 px
    setPickPer(Math.max(4, Math.min(10, Math.floor((window.innerHeight * 0.85 - 480) / 58))))
    setPickSel(draft?.picked ?? []); setPickQ(''); setPickF(SUB_FILTER0); setPickFOpen(false); setPickPage(1); setPickOpen(true)
  }
  const pickFiltered = subFilterCount(pickF) > 0
  // nemzetközi lista (van külföldi feliratkozó) — csak ilyenkor van Ország oszlop és szűrő
  const intl = vm.countries.some((c) => c !== 'HU')

  // ── kiküldött kampány: címzettek (13.6) és újraküldés ──
  const open = campaigns.find((c) => c.id === openId) ?? null
  const [resOpen, setResOpen] = useState(false)
  const [resRows, setResRows] = useState<{ email: string; name: string | null; openedAt: string | null }[]>([])
  const [resFilter, setResFilter] = useState(0)
  const [resQ, setResQ] = useState('')
  const [resPage, setResPage] = useState(1)
  // a címzett-lista annyi sort mutat, amennyi az ablakba kifér (utána lapozó)
  const [resPer, setResPer] = useState(6)
  const openResults = async () => {
    if (!open) return
    // ablak 85%-a mínusz a fejléc, a kampány-fej, a sáv, a szűrők és a lapozó (~540 px); egy sor ~56 px
    setResPer(Math.max(3, Math.min(12, Math.floor((window.innerHeight * 0.85 - 540) / 56))))
    setResFilter(0); setResQ(''); setResPage(1); setResRows([]); setResOpen(true)
    const j = await (await fetch(`/api/marketing/campaigns/recipients?kind=${kind}&businessId=${businessId}&campaignId=${open.id}`, { credentials: 'include' })).json().catch(() => ({}))
    setResRows(j.recipients ?? [])
  }
  const resFiltered = resRows.filter((r) => (resFilter === 0 || (resFilter === 1 ? !!r.openedAt : !r.openedAt)) && (!resQ.trim() || `${r.name ?? ''} ${r.email}`.toLowerCase().includes(resQ.trim().toLowerCase())))
  const resPages = Math.max(1, Math.ceil(resFiltered.length / resPer))
  const resView: RecipientRow[] = resFiltered.slice((resPage - 1) * resPer, resPage * resPer).map((r) => ({ key: r.email, name: r.name || r.email, meta: r.openedAt ? `megnyitotta ${fmtDT(r.openedAt)}` : 'még nem nyitotta meg', opened: !!r.openedAt }))
  // nyitási arány grafikonja: a kampány napról napra gyűlő megnyitása a küldéstől (sárga), szaggatottal az összes
  // kiküldött kampány ugyanígy számolt átlagos görbéje — kampányok egymás mellé tett arányai egyenes vonalat adnának
  const cumOf = (c: CampaignVM) => { let n = 0; return (c.stats?.perDay ?? []).map((x) => { n += x.v; return pct(n, c.recipients) }) }
  const rate = (() => {
    if (!open?.stats) return { series: [0], avg: [0], ticks: [''] }
    const all = campaigns.filter((c) => c.status === 'sent' && c.stats).map(cumOf)
    const series = cumOf(open)
    const avg = series.map((_, i) => Math.round(all.reduce((t, s) => t + (s[i] ?? 0), 0) / Math.max(1, all.length)))
    return { series, avg, ticks: open.stats.perDay.map((x) => x.d) }
  })()
  const copyOf = (c: CampaignVM, picked: string[] = [], segments: Segment[] = c.segments) => startDraft({ subject: c.subject, blocks: c.blocks, tr: c.translations, picked, segments })
  const resend = async (c: CampaignVM, mode: 'notOpened' | 'newSince') => {
    const j = await (await fetch(`/api/marketing/campaigns/recipients?kind=${kind}&businessId=${businessId}&campaignId=${c.id}&resend=${mode}`, { credentials: 'include' })).json().catch(() => ({}))
    const ids: string[] = j.ids ?? []
    if (!ids.length) { toast.error('Nincs kinek újraküldeni.'); return }
    copyOf(c, ids, ['all'])
    toast.success(`${ids.length} címzett kijelölve — nézd át, és küldd el`)
  }

  // ── feliratkozók (13.2) ──
  const [subRows, setSubRows] = useState<SubscriberRowVM[]>(() => vm.subscriberPage.map(toSubRow))
  const [subTotal, setSubTotal] = useState(vm.subscribers)
  const [subQ, setSubQ] = useState('')
  const [subStatus, setSubStatus] = useState(0)
  const [subF, setSubF] = useState<SubscriberFilterValue>(SUB_FILTER0)
  const [subSort, setSubSort] = useState<'desc' | 'asc'>('desc')
  // melyik oszlop szerint (null: a feliratkozás ideje) — az oszlopcímre kattintva
  const [subOrder, setSubOrder] = useState<string | null>(null)
  const [subPage, setSubPage] = useState(1)
  const [subSel, setSubSel] = useState<string[]>([])
  const [subBusy, setSubBusy] = useState(false)
  const [subConfirm, setSubConfirm] = useState<'unsub' | 'delete' | null>(null)
  const subLoaded = useRef(false)
  const loadSubs = useCallback(async () => {
    const p = filterParams(new URLSearchParams({ kind, businessId, page: String(subPage), limit: String(SUB_PAGE), sort: subSort, ...(subOrder ? { order: subOrder } : {}), status: subStatus ? 'unsubscribed' : 'subscribed' }), subQ, subF)
    const r = await fetch(`/api/marketing/subscribers?${p}`, { credentials: 'include' }); const j = await r.json()
    if (r.ok) { setSubRows((j.docs as SubApi[]).map(toSubRow)); setSubTotal(j.totalDocs ?? 0) }
  }, [kind, businessId, subPage, subSort, subOrder, subStatus, subQ, subF]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== 1) return
    if (!subLoaded.current && subPage === 1 && !subQ && !subStatus && subF === SUB_FILTER0 && subSort === 'desc' && !subOrder) { subLoaded.current = true; return }
    subLoaded.current = true
    const t = setTimeout(() => void loadSubs(), 200)
    return () => clearTimeout(t)
  }, [tab, loadSubs]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSubPage(1); setSubSel([]) }, [subQ, subStatus, subF, subSort, subOrder])
  // oszlopcím: ugyanaz → fordít; új oszlop → szövegnél A–Z, számnál / dátumnál a legnagyobb / legújabb elöl
  const subTh = (k: string) => {
    const key = k === 'since' ? null : k
    const on = subOrder === key
    return { sort: on ? subSort : null, onSort: () => { if (on) setSubSort((d) => (d === 'desc' ? 'asc' : 'desc')); else { setSubOrder(key); setSubSort(k === 'name' || k === 'country' ? 'asc' : 'desc') } } }
  }
  const subPages = Math.max(1, Math.ceil(subTotal / SUB_PAGE))
  const toggleSub = (id: string) => setSubSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  // tömeges műveletek a kijelölt feliratkozókon — a lista alatt, görgetéskor a képernyő alján marad (desktop és mobil)
  const subBulk = canManage && subSel.length > 0 && (
    <BulkDock><StaffBulkBar count={subSel.length} onClear={() => setSubSel([])} actions={[...(subStatus ? [] : [{ label: 'Leiratkoztatás', onClick: () => setSubConfirm('unsub') }]), { label: 'Végleges törlés', danger: true, onClick: () => setSubConfirm('delete') }]} /></BulkDock>
  )
  const subAction = async (what: 'unsub' | 'delete') => {
    setSubBusy(true)
    try {
      if (what === 'unsub') {
        const r = await fetch('/api/marketing/unsubscribe-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind, businessId, customerIds: subSel }) })
        if (!r.ok) throw new Error((await r.json()).error ?? 'Nem sikerült.')
        toast.success(`${subSel.length} vendég leiratkoztatva`)
      } else {
        const emails = subRows.filter((r) => subSel.includes(r.id)).map((r) => r.email)
        await Promise.all(emails.map((email) => fetch('/api/customers', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email }) })))
        toast.success(`${emails.length} vendég véglegesen törölve`)
      }
      setSubSel([]); await loadSubs(); router.refresh()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült.') } finally { setSubBusy(false); setSubConfirm(null) }
  }

  // mobil fejléc-ikonok (DashboardNav): szűrő, új kampány
  useEffect(() => {
    const on: [string, () => void][] = [['davelopment:open-marketing-filter', () => setFilterOpen(true)]]
    if (canManage) on.push(['davelopment:open-marketing-composer', () => startDraft()])
    on.forEach(([e, f]) => window.addEventListener(e, f))
    return () => on.forEach(([e, f]) => window.removeEventListener(e, f))
  }, [canManage, startDraft])

  // ── fejléc ──
  const { used, opened, cap, tier } = vm.month
  const free = Math.max(0, cap - used)
  const sentList = campaigns.filter((c) => c.status === 'sent' && c.stats)
  const openRate = pct(sentList.reduce((n, c) => n + (c.stats?.opened ?? 0), 0), sentList.reduce((n, c) => n + c.recipients, 0))
  const bar = (mobile = false) => <SegmentBar size="md" className={mobile ? 'mt-4' : undefined} segments={[
    { label: 'Megnyitották', value: nf(opened), weight: Math.max(used ? 3 : 10, (opened / Math.max(1, cap)) * 100), tone: 'yellow' },
    { label: mobile ? 'Nem' : 'Nem nyitották meg', value: nf(Math.max(0, used - opened)), weight: Math.max(used ? 3 : 10, ((used - opened) / Math.max(1, cap)) * 100), tone: 'dark' },
    { label: mobile ? 'Szabad' : 'Szabad keret', value: nf(free), weight: Math.max(10, (free / Math.max(1, cap)) * 100), tone: 'hatch' },
  ]} />
  const kpis = <><Kpi icon={Users} value={nf(vm.subscribers)} label="Feliratkozó" /><Kpi icon={Send} value={nf(campaigns.filter((c) => c.status === 'sent').length)} label="Kiküldött kampány" /><Kpi icon={Mail} value={`${openRate}%`} label="Nyitási arány" /></>
  const actions = canManage ? <Button variant="yellow" icon={Plus} onClick={() => startDraft()}>Új kampány</Button> : undefined
  const tabs = (full = false) => <Segmented full={full} className={full ? 'mt-4' : undefined} options={[`Kampányok · ${campaigns.length}`, `Feliratkozók · ${nf(vm.subscribers)}`]} active={tab} onSelect={(i) => { setTab(i); if (i === 1) closeDraft() }} />

  // ── a kampány-kártyák ──
  const saveWord = saveState === 'saving' ? 'mentés…' : saveState === 'saved' && !dirty ? 'mentve' : 'nincs mentve'
  const items: CampaignItem[] = pageItems.map((c) => {
    const isEdit = draft?.id === c.id
    if (c.status === 'sent') {
      const s = c.stats
      return { id: c.id, title: c.subject, status: 'sent', when: `${fmtDT(c.at)} · ${nf(c.recipients)} címzett`, stats: s ? [['Megnyitás', `${pct(s.opened, c.recipients)}%`, pct(s.opened, c.recipients)], ['Kattintás', `${pct(s.clicked, c.recipients)}%`, pct(s.clicked, c.recipients)], ['Foglalás', nf(s.booked), pct(s.booked, maxBooked)]] : undefined }
    }
    if (c.status === 'scheduled' && c.scheduledAt) {
      const days = Math.max(0, Math.ceil((new Date(c.scheduledAt).getTime() - Date.now()) / 86_400_000))
      return { id: c.id, title: c.subject, status: 'scheduled', when: `${fmtDT(c.scheduledAt)} · ${nf(c.recipients)} címzett`, note: `${days ? `Még ${days} nap` : 'Ma'} · ${c.audience}` }
    }
    return { id: c.id, title: c.subject, status: 'draft', when: isEdit ? `Most szerkeszted · ${saveWord}` : `Szerkesztve ${relDay(c.updatedAt)}`, note: c.audience }
  })
  // új (még nem mentett) piszkozat a lista elején
  if (draft && (!draft.id || !campaigns.some((c) => c.id === draft.id))) items.unshift({ id: draft.id ?? '__new', title: draft.subject || 'Új kampány', status: 'draft', when: `Most szerkeszted · ${saveWord}`, note: draft.picked.length ? `${draft.picked.length} kijelölt vendég` : draft.segments.map((s) => SEGMENT_LABEL[s]).join(', ') })
  const listOpenId = draft ? draft.id ?? '__new' : openId
  const onOpenItem = (id: string, mobile = false) => { if (id === '__new' || id === draft?.id) return; const c = campaigns.find((x) => x.id === id); if (c) openCampaign(c, mobile) }
  const listLabel = filtered.length ? `${(listPage - 1) * LIST_PAGE + 1}–${Math.min(filtered.length, listPage * LIST_PAGE)} / ${filtered.length}` : '0'
  const emptyList = <Meta className="px-3 py-10 text-center">{campaigns.length ? 'Nincs a szűrésnek megfelelő kampány.' : 'Még nincs kampányod.'}</Meta>

  // ── írás-mód darabjai ──
  const segments = segmentsFor(kind).map((k) => ({ key: k, label: SEGMENT_LABEL[k], on: !pickedN && (draft?.segments.includes(k) ?? false) }))
  const toggleSeg = (k: string) => {
    if (!draft) return
    const key = k as Segment
    const cur = draft.segments
    const next: Segment[] = key === 'all' ? ['all'] : cur.includes(key) ? cur.filter((s) => s !== key) : [...cur.filter((s) => s !== 'all'), key]
    patchDraft({ segments: next.length ? next : ['all'], picked: [] })
  }
  const audienceCard = draft && <CampaignAudience segments={segments} count={count} onToggle={toggleSeg} onPick={openPicker} picked={pickedN} />
  // ütemezés: a nap a kit naptárával, az idő a kit időválasztójával (nem a böngésző saját mezője)
  const [atD, atT] = (draft?.at ?? '').split('T')
  const atDate = draft && (
    <DatePickerPopover value={atD ?? ''} onChange={(d) => patchDraft({ at: `${d}T${atT || '09:00'}` })} triggerClassName={`${FIELD} h-9 text-left`}>
      {atD ? fmtD(`${atD}T12:00:00`) : 'Nap'}
    </DatePickerPopover>
  )
  const atTime = draft && <TimeSelect value={atT ?? '09:00'} onChange={(t) => patchDraft({ at: `${atD || localInput(new Date().toISOString()).slice(0, 10)}T${t}` })} />
  const sendCard = draft && <CampaignSend used={used} cap={cap} tier={tier} count={count ?? 0} when={draft.when} onWhen={(i) => patchDraft({ when: i, at: i && !draft.at ? localInput(new Date(Date.now() + 86_400_000).toISOString()) : draft.at })} dateField={atDate} timeField={atTime} onSend={trySend} onDraft={() => void saveDraft(true)} onDiscard={() => setConfirmDiscard(true)} busy={sending} draftBusy={saveState === 'saving'} disabled={!count} />
  const subjectField = draft && <Input value={curSubject} onChange={(e) => setSubject(e.target.value)} placeholder={other ? `Tárgy ${LOCALE_LABELS[loc]} nyelven — üresen hagyva ezen a nyelven is magyarul megy` : 'Tárgy — ezt látja a vendég a postaládájában'} aria-label="Tárgy" />
  // nyelvváltó (csak ha az üzlet több nyelvet kínál): a vendég a foglaláskor választott nyelvén kapja, fordítás nélkül magyarul
  const localeBar = draft && vm.locales.length > 1 && (
    <div className="mb-[5px] flex flex-wrap items-center gap-2">
      <LocaleEditBar available={vm.locales} active={loc} onSelect={switchLoc} />
      <Meta className="text-ui-label">{other ? (usableTranslation(draft.tr, loc) ? `A ${LOCALE_LABELS[loc]} nyelvű vendégek ezt kapják.` : `Amíg nincs tárgya, a ${LOCALE_LABELS[loc]} nyelvű vendégek magyarul kapják.`) : 'Mindenki a foglaláskor választott nyelvén kapja; fordítás nélkül magyarul.'}</Meta>
    </div>
  )
  const editor = draft && <CampaignLetter key={loc} biz={biz} blocks={blocks} editState={editState(false)} restaurant={restaurant} locale={loc} />
  const saveBadge = <Pill tone="cell" size="sm">Piszkozat · {saveWord}</Pill>

  // ── kiküldött kampány darabjai ──
  const gauge = open?.stats && <CampaignGauge title={open.subject} open={pct(open.stats.opened, open.recipients)} click={pct(open.stats.clicked, open.recipients)} booked={open.stats.booked} restaurant={restaurant} />
  const details = open?.stats && (
    <CampaignDetails d={{ opened: open.stats.opened, perDay: open.stats.perDay, links: open.stats.links, audience: open.audience, recipients: open.recipients, unsubscribed: open.stats.unsubscribed, notOpened: open.stats.notOpened, newSince: open.stats.newSince }}
      onRecipients={() => void openResults()} onResendNotOpened={canManage ? () => void resend(open, 'notOpened') : undefined} onResendNew={canManage ? () => void resend(open, 'newSince') : undefined} onCopy={canManage ? () => copyOf(open) : () => {}} />
  )
  const sentTr = open ? usableTranslation(open.translations, viewLoc) : null
  const sentLetter = (compact = false) => open && <CampaignLetter key={viewLoc} biz={biz} blocks={sentTr?.blocks ?? open.blocks} restaurant={restaurant} compact={compact} locale={sentTr ? viewLoc : 'hu'} />
  // a kiküldött kampány nyelvei (amin volt fordítás)
  const sentLocales: Locale[] = open ? ['hu', ...vm.locales.filter((l) => usableTranslation(open.translations, l))] : ['hu']
  const sentLocaleBar = sentLocales.length > 1 && <LocaleEditBar className="mb-[5px]" available={sentLocales} active={sentLocales.includes(viewLoc) ? viewLoc : 'hu'} onSelect={setViewLoc} />

  // ── ablakok ──
  const windows = (
    <>
      {/* szűrés: desktopon a lista szűrő-ikonjáról (13.5.1), mobilon a fejléc ikonjáról (13.7) */}
      <PopupModal open={filterOpen} onClose={() => setFilterOpen(false)} panel={
        <Panel pad="lg" size="lg" className="max-h-[85dvh] overflow-y-auto max-sm:rounded-b-none">
          <CampaignFilter wide counts={(['Mind', 'Kiküldve', 'Ütemezve', 'Piszkozat'] as const).map((l, i) => [l, counts[i]] as [string, number])} value={filter} onChange={setFilter} onPickDay={pickDay} onReset={() => setFilter(FILTER0)} onApply={() => setFilterOpen(false)} total={filtered.length} />
        </Panel>
      } />
      {/* címzettek kiválasztása (13.5) */}
      <PopupModal open={pickOpen} onClose={() => setPickOpen(false)} panel={
        <Modal size="xl" className="bg-ui-page" title="Címzettek" subtitle={`${nf(vm.subscribers)} feliratkozó · ${nf(vm.unsubscribed)} leiratkozott`} onClose={() => setPickOpen(false)}
          footer={<><Meta className="mr-auto self-center">{nf(pickSel.length)} kijelölve · a keretből {nf(Math.max(0, cap - used - pickSel.length))} marad</Meta><Button variant="cell" onClick={() => setPickOpen(false)}>Mégse</Button><Button onClick={() => { patchDraft({ picked: pickSel }); setPickOpen(false) }}>Kész</Button></>}>
          {/* a közös lista-eszköztár: kereső, ország, jobbra a tömeges kijelölés */}
          {/* relative: a szűrő-panel az eszköztár teljes szélességében nyílik (az ablakon belül marad) */}
          <div className="relative mb-[5px] flex flex-wrap items-center gap-1.5">
            <SearchField className="w-[240px] max-sm:w-full" value={pickQ} onChange={(v: string) => { setPickQ(v); setPickPage(1) }}>Név vagy e-mail</SearchField>
            <span className="flex">
              <IconButton icon={SlidersHorizontal} label="Szűrők" dot={pickFiltered} onClick={() => setPickFOpen((v) => !v)} aria-expanded={pickFOpen} />
              {pickFOpen && <>
                <span className="fixed inset-0 z-40" onClick={() => setPickFOpen(false)} aria-hidden />
                <Panel className="ui-pop-in absolute inset-x-0 top-full z-50 mt-2 origin-top-left"><SubscriberFilters wide value={pickF} onChange={(v) => { setPickF(v); setPickPage(1) }} countries={vm.countries} services={vm.services} restaurant={restaurant} /></Panel>
              </>}
            </span>
            <span className="ml-auto flex gap-1.5">
              {pickSel.length > 0 && <Button variant="glass" onClick={() => setPickSel([])}>Kijelölés törlése</Button>}
              <Button variant="glass" onClick={() => void pickAll()}>{pickQ || pickFiltered ? 'Találatok kijelölése' : 'Mind kijelölése'}</Button>
            </span>
          </div>
          <RecipientTable intl={intl} rows={pickRows.map((r): RecipientPickRow => ({ id: r.id, name: r.name, email: r.email, country: r.country ?? '', since: fmtD(r.consentAt), bookings: r.bookings, lastVisit: r.lastVisit ? fmtD(`${r.lastVisit.slice(0, 10)}T12:00:00`) : null, opened: r.opened, received: r.received, sel: pickSel.includes(r.id) }))}
            onToggle={(id) => setPickSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))}
            onToggleAll={() => { const ids = pickRows.map((r) => r.id); setPickSel((s) => (ids.every((i) => s.includes(i)) ? s.filter((i) => !ids.includes(i)) : [...new Set([...s, ...ids])])) }}
            page={pickPage} pages={Math.max(1, Math.ceil(pickTotal / pickPer))} label={pickTotal ? `${(pickPage - 1) * pickPer + 1}–${Math.min(pickTotal, pickPage * pickPer)} / ${nf(pickTotal)}` : '0'} onPage={setPickPage} />
        </Modal>
      } />
      {/* kiküldött kampány címzettjei (13.6) — az ablak krém oldal-hátterű, hogy a kártyák, a kereső és a váltó úgy
          látsszanak, mint a referencián (fehér ablakon beleolvadnának) */}
      <PopupModal open={resOpen && !!open} onClose={() => setResOpen(false)} panel={open && open.stats ? (
        <Modal size="xl" className="bg-ui-page" title="Címzettek" subtitle={`${nf(open.recipients)} címzett · ${open.audience}`} onClose={() => setResOpen(false)}>
          <div className="grid items-start gap-[5px] lg:grid-cols-[minmax(0,1fr)_320px]">
            <CampaignResults title={open.subject} sentAt={`Kiküldve ${fmtDT(open.at)}`} opened={open.stats.opened} total={open.recipients} rows={resView} filter={resFilter} onFilter={(i) => { setResFilter(i); setResPage(1) }} query={resQ} onQuery={(q) => { setResQ(q); setResPage(1) }}
              onCopy={canManage ? () => { setResOpen(false); copyOf(open) } : undefined} page={resPage} pages={resPages} label={resFiltered.length ? `${(resPage - 1) * resPer + 1}–${Math.min(resFiltered.length, resPage * resPer)} / ${resFiltered.length}` : '0'} onPage={setResPage} />
            <div className="space-y-[5px]">
              <OpenRateCard pct={pct(open.stats.opened, open.recipients)} series={rate.series} avgSeries={rate.avg} avg={openRate} ticks={rate.ticks} />
              <Card>
                <FieldRow label="Címzett"><span className="text-ui-body text-ui-text">{nf(open.recipients)} fő</span></FieldRow>
                <FieldRow label="Keretből"><span className="text-ui-body text-ui-text">{nf(open.recipients)} / {nf(cap)}</span></FieldRow>
                <FieldRow label="Csomag"><span className="text-ui-body text-ui-text">{tier.charAt(0).toUpperCase() + tier.slice(1)}</span></FieldRow>
              </Card>
            </div>
          </div>
        </Modal>
      ) : undefined} />
      {/* mobil: a kiküldött kampány áttekintése alulról (13.7, 2. telefon) */}
      <PopupModal open={mobileOpen && !!open && open.status === 'sent'} onClose={() => setMobileOpen(false)} panel={open ? (
        <Modal title={open.subject} subtitle={`Kiküldve ${fmtDT(open.at)} · ${nf(open.recipients)} címzett`} onClose={() => setMobileOpen(false)}>
          <div className="space-y-[5px]">{gauge}{details}</div>
          <div className="mt-[5px]">{sentLocaleBar}{sentLetter(true)}</div>
        </Modal>
      ) : undefined} />
      {/* mobil: blokk beszúrása és a kijelölt blokk szerkesztése (13.7) */}
      <PopupModal open={insertOpen} onClose={() => setInsertOpen(false)} panel={
        <Modal title="Blokk beszúrása" subtitle={focused ? `A kijelölt „${blockName(focused) ?? 'blokk'}” alá kerül.` : 'A levél végére kerül.'} onClose={() => setInsertOpen(false)} footer={<Button className="w-full" onClick={() => { addKind(insertKind); setInsertOpen(false) }}>Beszúrás</Button>}>
          <BlockInsertGrid active={insertKind} onPick={setInsertKind} />
        </Modal>
      } />
      <PopupModal open={styleOpen && !!focused} onClose={() => setStyleOpen(false)} panel={
        <Modal title={`${focused ? blockName(focused) ?? 'Blokk' : 'Blokk'}-blokk`} onClose={() => setStyleOpen(false)} footer={<Button className="w-full" onClick={() => setStyleOpen(false)}>Kész</Button>}>
          <div className="flex items-center justify-between"><Meta className="text-ui-label">A szöveget a levélben írod át. A {'{keresztnév}'} helyére a vendég neve kerül.</Meta><Button variant="ghost" size="sm" icon={Trash2} onClick={removeFocused}>Törlés</Button></div>
          <Meta className="mt-4">Stílus</Meta>
          {blockFields}
          <BlockStyle value={styleValue} onChange={setStyle} onFormat={format} supports={support} />
        </Modal>
      } />
      {/* sablon betöltése */}
      <PopupModal open={tplOpen} onClose={() => setTplOpen(false)} panel={
        <Modal title="Sablon betöltése" subtitle="A levél mostani tartalmát lecseréli — a szöveg utána átírható, a kép-helyekre a saját fotód kerül." onClose={() => setTplOpen(false)}
          footer={<><Button variant="cell" onClick={() => setTplOpen(false)}>Mégse</Button><Button onClick={loadTemplate}>Betöltés</Button></>}>
          <div className="space-y-1">
            {templates.map((t) => (
              <button key={t.id} type="button" onClick={() => setTplId(t.id)} className="ui-press block w-full rounded-ui-inner text-left outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20">
                <OptionCard radio title={t.title} selected={t.id === tplId}>{t.desc}</OptionCard>
              </button>
            ))}
          </div>
        </Modal>
      } />
      {linkModal}
      <ConfirmDialog open={confirmSend} title={draft?.when === 1 ? 'Kampány ütemezése' : 'Kampány küldése'} description={draft ? `„${draft.subject}” — ${nf(count ?? 0)} címzett${draft.when === 1 && draft.at ? `, ${fmtDT(new Date(draft.at).toISOString())}` : ''}. Kiküldés után nem módosítható.` : undefined} confirmLabel={draft?.when === 1 ? 'Ütemezés' : 'Küldés'} busy={sending} onConfirm={() => void send()} onCancel={() => setConfirmSend(false)} zIndexClass="z-[100]" />
      <ConfirmDialog open={confirmDiscard} title="Piszkozat törlése" description={draft?.subject || undefined} confirmLabel="Törlés" onConfirm={() => void discard()} onCancel={() => setConfirmDiscard(false)} zIndexClass="z-[100]" />
      <ConfirmDialog open={!!subConfirm} title={subConfirm === 'delete' ? 'Vendégek végleges törlése' : 'Leiratkoztatás'} description={subConfirm === 'delete' ? `${subSel.length} vendég minden adatával együtt törlődik — nem vonható vissza.` : `${subSel.length} vendég nem kap több hírlevelet.`} confirmLabel={subConfirm === 'delete' ? 'Törlés' : 'Leiratkoztatás'} busy={subBusy} onConfirm={() => subConfirm && void subAction(subConfirm)} onCancel={() => setSubConfirm(null)} zIndexClass="z-[100]" />
    </>
  )

  // ── üres állapot (13.3) ──
  if (!vm.subscribers && !campaigns.length && !draft) {
    return (
      <div className="p-4 lg:p-0">
        <PageHead title="Marketing" actions={actions} bar={bar()} kpis={kpis} />
        <EmptyState icon={Mail} title="Még nincs feliratkozott vendéged" action={<span className="flex flex-wrap justify-center gap-1.5">{canManage && <Button icon={Plus} onClick={() => startDraft()}>Első kampány megírása</Button>}<Button variant="glass" href={vm.bookingUrl}>Feliratkozás a foglalóoldalon</Button></span>}>
          A vendégek foglaláskor egy pipával iratkozhatnak fel a hírleveledre. Amint megvan az első, itt írhatsz nekik kampányt — a havi keret a csomagodból jön.
        </EmptyState>
        {windows}
      </div>
    )
  }

  const listCard = (
    <Card pad="sm" className="flex flex-col">
      <div className="flex items-center justify-between px-2 pb-2">
        <span className="text-ui-title font-normal text-ui-text">Kampányok</span>
        <span className="flex gap-1.5"><IconButton icon={SlidersHorizontal} label="Szűrés: időszak, rendezés" size="sm" variant="cell" dot={filter.sort !== 0 || filter.period !== 2} onClick={() => setFilterOpen(true)} />{canManage && <IconButton icon={Plus} label="Új kampány" variant="yellow" size="sm" onClick={() => startDraft()} />}</span>
      </div>
      <Segmented tone="cell" full className="mb-2" options={['Mind', 'Kiküldve', 'Ütemezve', 'Piszkozat']} active={filter.status} onSelect={(i) => setFilter((f) => ({ ...f, status: i }))} />
      <CampaignList items={items} openId={listOpenId} onOpen={(id) => onOpenItem(id)} page={listPage} pages={listPages} label={listLabel} onPage={setListPage} empty={emptyList} />
    </Card>
  )

  return (
    <div className="p-4 lg:p-0">
      {/* ── desktop (13.1, 13.2, 13.4) ── */}
      <div className="max-lg:hidden">
        <PageHead title="Marketing" actions={actions} bar={bar()} kpis={kpis} />
        <div className="mb-[5px] flex flex-wrap items-center gap-1.5">{tabs()}</div>
        {tab === 0 ? (
          <div className={`grid gap-[5px] lg:grid-cols-[310px_minmax(0,1fr)_250px] ${draft ? 'items-start' : ''}`}>
            {listCard}
            {draft ? (
              <>
                {/* közép: a levél szerkeszthető, bal oldalt a sötét blokk-paletta (48 px) — két oldalán ugyanaz az 5 px-es rács-hézag */}
                <div className="relative flex flex-col pl-[53px]">
                  <BlockPalette className="absolute left-0 top-1/2 z-10 -translate-y-1/2" onAdd={(k) => addKind(k)} />
                  {localeBar}
                  <div className="mb-[5px] flex gap-1.5"><div className="min-w-0 flex-1">{subjectField}</div><Button variant="glass" icon={LayoutTemplate} onClick={() => setTplOpen(true)}>Sablonok</Button></div>
                  {editor}
                </div>
                {/* írás-módban a rács nem nyújtja a levelet és a listát a jobb oszlop magasságára (items-start) */}
                <div className="flex flex-col gap-[5px]">
                  <Card>
                    <div className="flex items-center justify-between gap-2"><CardTitle>Kijelölt blokk</CardTitle>{focused && <Pill tone="yellow" size="sm">{blockName(focused) ?? 'Blokk'}</Pill>}</div>
                    <div className="mt-1">{focused ? <>{blockFields}<BlockStyle value={styleValue} onChange={setStyle} onFormat={format} supports={support} /></> : <Meta className="py-2.5 text-ui-label">Kattints egy blokkra a levélben.</Meta>}</div>
                  </Card>
                  {audienceCard}
                  {sendCard}
                </div>
              </>
            ) : open && open.status === 'sent' ? (
              <>
                {/* közép: a kijelölt kiküldött levél, csak megtekintés */}
                <div className="flex flex-col">{sentLocaleBar}{sentLetter()}</div>
                <div className="flex flex-col gap-[5px]">{gauge}{details}</div>
              </>
            ) : (
              <div className="lg:col-span-2"><EmptyState icon={Mail} title="Válassz egy kampányt" action={canManage ? <Button icon={Plus} onClick={() => startDraft()}>Új kampány</Button> : undefined}>A kiküldött kampány megnyitva mutatja a levelet, a megnyitást és a foglalásokat.</EmptyState></div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-1.5">
              <ChipToolbar search="Név vagy e-mail" chips={[['Feliratkozott', vm.subscribers], ['Leiratkozott', vm.unsubscribed]]} active={subStatus} query={subQ} onQuery={setSubQ} onChip={setSubStatus} dot={subFilterCount(subF) > 0}
                filters={<SubscriberFilters value={subF} onChange={setSubF} countries={vm.countries} services={vm.services} restaurant={restaurant} />} />
              <Select toolbar value={subOrder ? '' : subSort} onChange={(e) => { setSubOrder(null); setSubSort(e.target.value as 'desc' | 'asc') }} className="w-[190px]"><option value="" disabled hidden>Oszlop szerint</option><option value="desc">Legújabb elöl</option><option value="asc">Legrégebbi elöl</option></Select>
            </div>
            <div className="relative">
              <SubscriberTable th={subTh} intl={intl} rows={subRows} selected={subSel} onToggle={canManage ? toggleSub : undefined}
                onToggleAll={canManage ? () => { const ids = subRows.map((r) => r.id); setSubSel((s) => (ids.every((i) => s.includes(i)) ? s.filter((i) => !ids.includes(i)) : [...new Set([...s, ...ids])])) } : undefined}
                page={subPage} pages={subPages} label={subTotal ? `${(subPage - 1) * SUB_PAGE + 1}–${Math.min(subTotal, subPage * SUB_PAGE)} / ${nf(subTotal)}` : '0'} onPage={setSubPage}
                empty={<Meta className="px-3 py-10 text-center">{subQ || subFilterCount(subF) ? 'Nincs találat.' : subStatus ? 'Még senki nem iratkozott le.' : 'Még nincs feliratkozó.'}</Meta>} className={subSel.length ? 'pb-20' : ''} />
              {subBulk}
            </div>
          </>
        )}
      </div>

      {/* ── mobil (13.7) ── */}
      <div className="lg:hidden">
        {draft ? (
          <>
            <div className="flex items-center justify-between gap-2"><span className="text-ui-num font-light leading-none text-ui-text">{draft.id ? 'Kampány' : 'Új kampány'}</span><span className="flex items-center gap-1.5">{saveBadge}<IconButton icon={X} label="Bezárás" size="sm" variant="cell" onClick={closeDraft} /></span></div>
            <Segmented className="mt-3" full options={['Levél', 'Címzettek', 'Küldés']} active={step} onSelect={setStep} />
            {step === 0 && (
              <>
                <Button variant="glass" icon={LayoutTemplate} className="mt-3 w-full" onClick={() => setTplOpen(true)}>Sablon betöltése</Button>
                {localeBar && <div className="mt-3">{localeBar}</div>}
                <Field label="Tárgy" className="mt-3"><Input value={curSubject} onChange={(e) => setSubject(e.target.value)} placeholder={other ? 'Üresen hagyva magyarul megy' : 'Ez lesz a levél címe'} /></Field>
                <div className="mt-4">
                  <CampaignLetter key={loc} biz={biz} blocks={blocks} editState={editState(true)} restaurant={restaurant} locale={loc} compact />
                </div>
                <BlockPalette row className="mt-[5px]" onAdd={(k) => addKind(k)} />
              </>
            )}
            {step === 1 && <div className="mt-3 space-y-[5px]">{audienceCard}</div>}
            {step === 2 && <div className="mt-3 space-y-[5px]">{audienceCard}{sendCard}</div>}
          </>
        ) : (
          <>
            <div className="text-ui-num font-light leading-none text-ui-text">Marketing</div>
            {bar(true)}
            {tabs(true)}
            {tab === 0 ? (
              <div className="mt-3 flex flex-col"><CampaignList items={items} openId={mobileOpen ? openId : null} onOpen={(id) => onOpenItem(id, true)} page={listPage} pages={listPages} label={listLabel} onPage={setListPage} mobile empty={emptyList} /></div>
            ) : (
              <>
                <SearchField className="mt-3 w-full" value={subQ} onChange={(v: string) => setSubQ(v)}>Név vagy e-mail</SearchField>
                <SubscriberMobileList className={`mt-3 ${subSel.length ? 'pb-20' : ''}`} rows={subRows} selected={subSel} onToggle={canManage ? toggleSub : undefined} page={subPage} pages={subPages} onPage={setSubPage} />
                {subBulk}
              </>
            )}
          </>
        )}
      </div>
      {windows}
    </div>
  )
}
