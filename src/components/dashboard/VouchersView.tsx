'use client'

import { sortRows, useTableSort } from '@/lib/tableSort'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Check, Gift, Plus, RotateCcw, Tag, TicketCheck, Trash2, Undo2, Wallet } from 'lucide-react'
import { Button, Card, EmptyState, Kpi, Menu, MenuItem, Meta, Modal, Note, PageHead, Pill, SegmentBar } from '@/components/ui-kit'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ChipToolbar } from '@/components/blocks/toolbar'
import { BulkDock, StaffBulkBar } from '@/components/blocks/team'
import { Steps } from '@/components/blocks/onboarding'
import { VoucherCard, type VoucherBiz } from '@/components/blocks/money'
import { DEFAULT_VOUCHER_DESIGN, type VoucherDesign } from '@/lib/voucherDesign'
import { VoucherFit } from '@/components/blocks/voucher-template-picker'
import { isForeignCountry } from '@/lib/countries'
import { UploadTile, type UploadState } from '@/components/blocks/upload'
import {
  PAY, PayCell, V_STATUS, VoucherDetail, VoucherFound, VoucherMobileList, VoucherScan, VoucherTable, VoucherTypeEditor, VoucherTypeList,
  WizBuyerStep, WizConfirmStep, WizDone, WizLink, WizPayStep, WizTypeStep,
  type PayChoice, type VoucherDetailVM, type VoucherStatus, type VoucherTableRow, type VoucherTypeValue, type WizBuyer,
} from '@/components/blocks/vouchers'
import { VoucherQrScanner } from '@/components/dashboard/VoucherQrScanner'
import { LocaleEditBar } from '@/components/settings/LocaleEditBar'
import { useGuestLookup, GuestSuggestList, type GuestSuggestion } from '@/components/shared/GuestLookup'
import { uploadMedia } from '@/lib/uploadMedia'
import { MONTHS_SHORT } from '@/lib/schedule'
import type { Locale } from '@/lib/i18n'
import type { PendingVoucher } from '@/app/api/gift-vouchers/pending/route'
import { useAppendPages } from '@/lib/useAppendPages'
import { LoadMoreSentinel } from '@/components/shared/LoadMoreSentinel'

export type VoucherRow = {
  id: string; code: string; amount_huf: number; type_name: string | null; purchaser_name: string
  payment_method: string | null; status: 'active' | 'redeemed' | 'expired' | 'refunded'
  expires_at: string; redeemed_at: string | null; createdAt: string; issued_by_name: string | null
  recipient_name: string | null; image: string | null
}
export type VoucherTypeVM = { id: string; name: string; amount_huf: number; description: string | null; active: boolean; image: { id: string; url: string | null } | null; design: VoucherDesign; sold: number }

type Detail = {
  id: string; code: string; amount_huf: number; type_name: string | null; status: VoucherRow['status']; payment_method: string | null
  purchaser_name: string; purchaser_email: string; recipient_name: string | null; recipient_email: string | null; message: string | null
  expires_at: string; redeemed_at: string | null; redeemed_for: { date: string | null; time: string | null; name: string | null } | null
  invoice_status: 'none' | 'issued' | 'failed' | 'skipped'; invoice_number: string | null; invoice_pdf_url: string | null
  issued_by: { name: string | null; email: string | null } | null; createdAt: string
}

interface Props {
  restaurant?: boolean
  businessId: string
  vouchers: VoucherRow[]
  types: VoucherTypeVM[]
  biz: VoucherBiz
  stripe: boolean
  locales?: Locale[]
  minAmount: number
  maxAmount: number
  canManage?: boolean
  base: string
}

const PAGE = 10
const nf = (n: number) => n.toLocaleString('hu-HU')
const short = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${Math.round(n / 1000)} e` : String(n))
const dayLbl = (iso: string | null, year = true) => { if (!iso) return '—'; const d = new Date(iso); return `${year ? `${d.getFullYear()}. ` : ''}${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}.` }
const json = (method: string, body: unknown) => ({ method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' as const, body: JSON.stringify(body) })
const EMPTY_BUYER: WizBuyer = { name: '', email: '', city: '', address: '', company: false, tax: '', toName: '', toEmail: '', message: '', country: 'HU', lang: 'hu' }
const PAID_LABEL: Record<string, string> = { cash: 'Készpénz', pos_card: 'Bankkártya, helyben', transfer: 'Átutalás', link: 'Stripe fizetési link' }

/**
 * Utalványok (design 12.1–12.9): fejléc a darab-csíkkal és a számokkal, eszköztár (kereső, állapot-gombok, fizetési mód), a
 * táblázat kijelöléssel és mellette a kijelölt utalvány (kártya, adatok, Beváltás, ⋯ állapot / törlés); Beváltás QR-olvasóval,
 * Típusok kezelése (lista + szerkesztő), Új utalvány 4 lépésben (típus, vásárló, fizetés, ellenőrzés). Mobilon lista + lapok.
 */
export function VouchersView({ restaurant = false, businessId, vouchers: initial, types: initialTypes, biz, stripe, locales = ['hu'], minAmount, maxAmount, canManage = false, base }: Props) {
  const router = useRouter()
  const [vatNotice, setVatNotice] = useState(false)
  useEffect(() => { try { setVatNotice(localStorage.getItem('vat-notice-2026-11') !== '1') } catch { /* privát mód */ } }, [])
  const [vouchers, setVouchers] = useState(initial)
  useEffect(() => { setVouchers(initial) }, [initial])
  const [types, setTypes] = useState(initialTypes)
  useEffect(() => { setTypes(initialTypes) }, [initialTypes])
  const kindBody = restaurant ? { kind: 'restaurant', restaurantId: businessId } : { kind: 'salon', salonId: businessId }
  const typeImage = (name: string | null) => types.find((t) => t.name === name)?.image?.url ?? null
  const typeDesign = (name: string | null) => types.find((t) => t.name === name)?.design ?? null

  // ── függő fizetési linkek (a betöltés egyben szinkronizál: a kifizetett link utalvánnyá válik) ──
  const [pending, setPending] = useState<PendingVoucher[]>([])
  const loadPending = useCallback(() => {
    fetch(`/api/gift-vouchers/pending?kind=${restaurant ? 'restaurant' : 'salon'}&id=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { pending?: PendingVoucher[]; reconciled?: number } | null) => {
        if (!d) return
        setPending(d.pending ?? [])
        if ((d.reconciled ?? 0) > 0) { toast.success(`${d.reconciled} kifizetett utalvány bekerült a listába`); router.refresh() }
      }).catch(() => {})
  }, [restaurant, businessId, router])
  useEffect(() => { loadPending() }, [loadPending])

  // ── szűrés ──
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | VoucherStatus>('all')
  const [pay, setPay] = useState('all')
  const cnt = (s: VoucherStatus) => (s === 'pending' ? pending.length : vouchers.filter((v) => v.status === s).length)
  // rendezés az oszlopcímre kattintva (alapból a legújabb elöl)
  const { sort: vSort, th: vTh } = useTableSort<string>()
  const rows: (VoucherTableRow & { createdAt: string; amountHuf: number; exp: string })[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const p = pending.map((x) => ({ key: `p:${x.sessionId}`, code: null, type: x.typeName ?? 'Utalvány', buyer: x.purchaserName ?? x.purchaserEmail ?? '—', by: `fizetési link · ${dayLbl(x.expiresAt, false)}-ig`, amount: nf(x.amountHuf), pay: 'payment_link', expires: '—', status: 'pending' as const, createdAt: x.createdAt, amountHuf: x.amountHuf, exp: x.expiresAt }))
    const v = vouchers.map((x) => ({ key: x.id, code: x.code, type: x.type_name ?? 'Utalvány', buyer: x.purchaser_name, by: x.issued_by_name ? `Kiállította: ${x.issued_by_name}` : x.payment_method === 'online' ? 'foglalóoldalon' : '—', amount: nf(x.amount_huf), pay: x.payment_method ?? 'other', expires: dayLbl(x.expires_at), status: x.status as VoucherStatus, createdAt: x.createdAt, amountHuf: x.amount_huf, exp: x.expires_at }))
    return [...p, ...v].filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (pay !== 'all' && r.pay !== pay) return false
      return !q || (r.code ?? '').toLowerCase().includes(q) || r.buyer.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [vouchers, pending, query, status, pay])
  const sortedRows = useMemo(() => sortRows(rows, vSort, (r, k) => (k === 'code' ? r.code : k === 'buyer' ? r.buyer : k === 'amount' ? r.amountHuf : k === 'expires' ? (r.exp ? new Date(r.exp) : null) : r.status)), [rows, vSort])
  // lapozás + görgetésre hozzáfűzés (szűrő / keresés / rendezés váltásakor az elejéről)
  const paging = useAppendPages(sortedRows.length, PAGE, `${query}|${status}|${pay}|${vSort?.key}|${vSort?.dir}`)
  const pages = paging.pages
  const pageRows = sortedRows.slice(paging.from, paging.to)

  // ── kijelölés + tömeges törlés ──
  const [selected, setSelected] = useState<string[]>([])
  const [bulkDel, setBulkDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const bulkDelete = async () => {
    setBusy(true)
    const res = await Promise.allSettled(selected.map((id) => fetch(`/api/gift-vouchers/${id}`, { method: 'DELETE', credentials: 'include' }).then((r) => { if (!r.ok) throw new Error() })))
    const ok = selected.filter((_, i) => res[i].status === 'fulfilled')
    setVouchers((l) => l.filter((v) => !ok.includes(v.id)))
    setSelected([]); setBulkDel(false); setBusy(false)
    if (ok.length < res.length) toast.error(`${res.length - ok.length} törlése nem sikerült`); else toast.success('Törölve')
  }

  // ── a kijelölt utalvány (részlet) ──
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  // értesítésből érkezve (?voucher=<id>) pontosan az az utalvány nyílik meg; utána a paraméter kikerül a címből
  useEffect(() => {
    const url = new URL(window.location.href)
    const id = url.searchParams.get('voucher')
    if (!id) return
    setOpenKey(id); setMobileOpen(true)
    url.searchParams.delete('voucher'); url.searchParams.delete('t')
    window.history.replaceState(null, '', url.toString())
  }, [])
  useEffect(() => {
    if (!openKey && rows[0]) setOpenKey(rows.find((r) => r.status !== 'pending')?.key ?? rows[0].key)
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!openKey || openKey.startsWith('p:')) { setDetail(null); return }
    let cancelled = false
    fetch(`/api/gift-vouchers/${openKey}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled) setDetail(d) }).catch(() => {})
    return () => { cancelled = true }
  }, [openKey])
  const open = (k: string, mobile = false) => { setOpenKey(k); if (mobile) setMobileOpen(true) }
  const openRow = vouchers.find((v) => v.id === openKey) ?? null
  const openPending = openKey?.startsWith('p:') ? pending.find((p) => `p:${p.sessionId}` === openKey) ?? null : null

  const updateStatus = async (v: VoucherRow, s: VoucherRow['status']) => {
    setMenu(false)
    const r = await fetch(`/api/gift-vouchers/${v.id}`, json('PATCH', { status: s }))
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { toast.error(j.error ?? 'Nem sikerült frissíteni.'); return }
    setVouchers((l) => l.map((x) => (x.id === v.id ? { ...x, status: j.status ?? s, redeemed_at: j.redeemed_at ?? x.redeemed_at } : x)))
    setDetail((d) => (d && d.id === v.id ? { ...d, status: j.status ?? s } : d))
    toast.success('Állapot módosítva')
  }
  const [del, setDel] = useState(false)
  const remove = async () => {
    if (!openRow) return
    setBusy(true)
    const r = await fetch(`/api/gift-vouchers/${openRow.id}`, { method: 'DELETE', credentials: 'include' })
    setBusy(false); setDel(false)
    if (!r.ok) { toast.error('Törlés sikertelen'); return }
    setVouchers((l) => l.filter((x) => x.id !== openRow.id)); setOpenKey(null); setMobileOpen(false); toast.success('Törölve')
  }
  const [cancelLinkId, setCancelLinkId] = useState<string | null>(null)
  const cancelPending = async (sessionId: string) => {
    setBusy(true)
    const r = await fetch(`/api/gift-vouchers/pending?kind=${restaurant ? 'restaurant' : 'salon'}&id=${encodeURIComponent(businessId)}&sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE', credentials: 'include' })
    const j = await r.json().catch(() => ({}))
    setBusy(false); setCancelLinkId(null)
    if (!r.ok) { toast.error(j.error ?? 'Nem sikerült visszavonni'); loadPending(); return }
    setPending((p) => p.filter((x) => x.sessionId !== sessionId)); setOpenKey(null); setMobileOpen(false); toast.success('A fizetési link visszavonva')
  }
  const copyLink = (key: string) => { const p = pending.find((x) => `p:${x.sessionId}` === key); if (p?.url) { void navigator.clipboard.writeText(p.url); toast.success('Link másolva') } }

  const [menu, setMenu] = useState(false)
  const detailVM: VoucherDetailVM | null = detail ? {
    amount: `${nf(detail.amount_huf)} Ft`, code: detail.code, to: detail.recipient_name?.split(' ').slice(-1)[0] ?? null, expires: dayLbl(detail.expires_at), status: detail.status,
    bg: typeImage(detail.type_name) ? 'photo' : 'dark', photo: typeImage(detail.type_name), design: typeDesign(detail.type_name),
    rows: [
      ['Típus', detail.type_name ?? '—'],
      ['Vásárló', detail.purchaser_name],
      ...(detail.recipient_name || detail.recipient_email ? [['Megajándékozott', detail.recipient_name || detail.recipient_email] as [string, React.ReactNode]] : []),
      ['Fizetés', <PayCell key="p" pay={detail.payment_method ?? 'other'} />],
      ['Kiállította', `${detail.issued_by?.name || detail.issued_by?.email || (detail.payment_method === 'online' ? 'Foglalóoldal' : '—')} · ${dayLbl(detail.createdAt, false)}`],
      [detail.status === 'redeemed' ? 'Beváltva' : 'Lejár', detail.status === 'redeemed' ? `${dayLbl(detail.redeemed_at, false)}${detail.redeemed_for?.name ? ` · ${detail.redeemed_for.name}` : ''}` : dayLbl(detail.expires_at)],
      ...(detail.invoice_status === 'issued' ? [['Számla', detail.invoice_number ?? 'kiállítva'] as [string, React.ReactNode]] : detail.invoice_status === 'failed' ? [['Számla', 'sikertelen'] as [string, React.ReactNode]] : []),
    ],
  } : null
  const statusMenu = menu && openRow && (
    <>
      <span className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
      <Menu label="Állapot módosítása" className="absolute bottom-12 right-0 z-20 w-60">
        {(['active', 'redeemed', 'expired', 'refunded'] as const).map((s) => (
          <MenuItem key={s} icon={s === 'active' ? RotateCcw : s === 'redeemed' ? Check : s === 'expired' ? Ban : Undo2} active={openRow.status === s} disabled={openRow.status === s}
            trailing={openRow.status === s ? 'jelenlegi' : undefined} onClick={() => void updateStatus(openRow, s)}>{V_STATUS[s].label}</MenuItem>
        ))}
        <div className="my-1 border-t border-dashed border-ui-divider" />
        <MenuItem icon={Trash2} danger onClick={() => { setMenu(false); setDel(true) }}>Törlés</MenuItem>
      </Menu>
    </>
  )
  const detailNode = (mobile = false) => openPending ? (
    <Card className={mobile ? '' : ''}>
      <WizLink url={openPending.url ?? ''} name={openPending.purchaserName ?? 'a vásárlónak'} onCopy={() => copyLink(`p:${openPending.sessionId}`)} onCancel={() => setCancelLinkId(openPending.sessionId)} cancelling={busy} emailSent onEmail={undefined} />
      <Meta className="mt-3">{openPending.typeName} · {nf(openPending.amountHuf)} Ft · link lejár: {dayLbl(openPending.expiresAt, false)}</Meta>
    </Card>
  ) : detailVM && openRow ? (
    <VoucherDetail v={detailVM} restaurant={restaurant} biz={biz} onRedeem={canManage && detail?.status === 'active' ? () => { setMobileOpen(false); setFound(null); setCode(detail.code); setRedeemOpen(true); void lookup(detail.code) } : undefined}
      pdfHref={detail?.invoice_pdf_url ?? null} onMenu={canManage ? () => setMenu((m) => !m) : undefined} menu={statusMenu}
      extra={detail?.message ? <Note className="mt-3">„{detail.message}”</Note> : undefined} />
  ) : <Card><Meta>{rows.length ? 'Betöltés…' : 'Válassz egy utalványt a listából.'}</Meta></Card>

  // ── beváltás (12.7) ──
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [code, setCode] = useState('')
  const [found, setFound] = useState<VoucherRow | null | 'none'>(null)
  const [redeeming, setRedeeming] = useState(false)
  const lookup = async (raw: string) => {
    const c = raw.trim().toUpperCase()
    if (!c) return
    setCode(c)
    setFound(vouchers.find((v) => v.code.toUpperCase() === c) ?? 'none')
  }
  const redeem = async () => {
    const c = code.trim().toUpperCase()
    setRedeeming(true)
    try {
      const r = await fetch('/api/gift-vouchers/redeem', json('POST', { ...kindBody, code: c }))
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Nem sikerült beváltani.')
      setVouchers((l) => l.map((v) => (v.code.toUpperCase() === c ? { ...v, status: 'redeemed', redeemed_at: j.redeemed_at } : v)))
      setDetail((d) => (d && d.code.toUpperCase() === c ? { ...d, status: 'redeemed', redeemed_at: j.redeemed_at } : d))
      toast.success(`Beváltva: ${c}`)
      setRedeemOpen(false); setCode(''); setFound(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült beváltani.')
    } finally { setRedeeming(false) }
  }
  const foundNode = found === 'none' ? <Note warn>Nincs ilyen kódú utalvány ennél az üzletnél.</Note>
    : found ? <VoucherFound bare status={found.status} code={found.code} amount={`${nf(found.amount_huf)} Ft`} bg={typeImage(found.type_name) ? 'photo' : 'dark'} photo={typeImage(found.type_name)} design={typeDesign(found.type_name)} restaurant={restaurant} biz={biz}
        rows={[['Típus', found.type_name ?? '—'], ...(found.recipient_name ? [['Megajándékozott', found.recipient_name] as [string, string]] : []), ['Lejár', dayLbl(found.expires_at)]]}
        note={found.status === 'redeemed' ? `Beváltva ${dayLbl(found.redeemed_at, false)}` : found.status === 'expired' ? `Lejárt ${dayLbl(found.expires_at, false)}` : 'Ez az utalvány nem váltható be.'}
        onRedeem={() => void redeem()} busy={redeeming} />
    : null

  // ── típusok (12.3) ──
  const [typesOpen, setTypesOpen] = useState(false)
  const [tEdit, setTEdit] = useState<{ id: string | null; v: VoucherTypeValue; imageId: string | null } | null>(null)
  const [tLoc, setTLoc] = useState<Locale>('hu')
  const [tLocBusy, setTLocBusy] = useState(false)
  const [tUp, setTUp] = useState<UploadState | null>(null)
  const [tDel, setTDel] = useState(false)
  const openType = (id: string | null) => {
    const t = types.find((x) => x.id === id)
    setTLoc('hu'); setTUp(null)
    setTEdit(t ? { id: t.id, v: { name: t.name, amount: String(t.amount_huf), description: t.description ?? '', active: t.active, image: t.image?.url ?? null, design: t.design }, imageId: t.image?.id ?? null } : { id: null, v: { name: '', amount: '', description: '', active: true, image: null, design: DEFAULT_VOUCHER_DESIGN }, imageId: null })
  }
  const switchTLoc = async (l: Locale) => {
    if (!tEdit?.id || l === tLoc) { setTLoc(l); return }
    setTLocBusy(true)
    try {
      const r = await fetch(`/api/gift-voucher-types/${tEdit.id}?locale=${l}&fallback-locale=null`, { credentials: 'include' })
      const d = await r.json()
      const t = types.find((x) => x.id === tEdit.id)
      setTEdit({ ...tEdit, v: { ...tEdit.v, name: l === 'hu' ? t?.name ?? '' : d?.name ?? '', description: l === 'hu' ? t?.description ?? '' : d?.description ?? '' } })
      setTLoc(l)
    } catch { toast.error('A nyelvi tartalom betöltése sikertelen') } finally { setTLocBusy(false) }
  }
  const saveType = async () => {
    if (!tEdit) return
    const amount = Number(tEdit.v.amount.replace(/\D/g, ''))
    if (!tEdit.v.name.trim()) { toast.error('A név kötelező'); return }
    if (tLoc === 'hu' && (amount < minAmount || amount > maxAmount)) { toast.error(`Az összeg ${nf(minAmount)} és ${nf(maxAmount)} Ft között lehet`); return }
    setBusy(true)
    try {
      if (tLoc !== 'hu' && tEdit.id) {
        const r = await fetch(`/api/gift-voucher-types/${tEdit.id}?locale=${tLoc}`, json('PATCH', { name: tEdit.v.name.trim(), description: tEdit.v.description.trim() || undefined }))
        if (!r.ok) throw new Error()
      } else {
        const body = { ...(restaurant ? { restaurant: Number(businessId) } : { salon: Number(businessId) }), name: tEdit.v.name.trim(), amount_huf: amount, description: tEdit.v.description.trim() || undefined, active: tEdit.v.active, image: tEdit.imageId ?? null, card_layout: tEdit.v.design.layout, card_color: tEdit.v.design.color, card_text: tEdit.v.design.text === 'auto' ? null : tEdit.v.design.text ?? null }
        const r = tEdit.id ? await fetch(`/api/gift-voucher-types/${tEdit.id}`, json('PATCH', body)) : await fetch('/api/gift-voucher-types', json('POST', body))
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.errors?.[0]?.message ?? j?.error)
        const doc = j.doc ?? j
        const vm: VoucherTypeVM = { id: String(doc.id), name: body.name, amount_huf: amount, description: body.description ?? null, active: body.active, image: tEdit.imageId ? { id: tEdit.imageId, url: tEdit.v.image } : null, design: tEdit.v.design, sold: types.find((x) => x.id === String(doc.id))?.sold ?? 0 }
        setTypes((l) => (tEdit.id ? l.map((x) => (x.id === tEdit.id ? vm : x)) : [...l, vm]))
        setTEdit({ ...tEdit, id: vm.id })
      }
      toast.success('Mentve')
      router.refresh()
    } catch (e) { toast.error(e instanceof Error && e.message ? e.message : 'A mentés sikertelen') } finally { setBusy(false) }
  }
  const deleteType = async () => {
    if (!tEdit?.id) return
    setBusy(true)
    const r = await fetch(`/api/gift-voucher-types/${tEdit.id}`, { method: 'DELETE', credentials: 'include' })
    setBusy(false); setTDel(false)
    if (!r.ok) { toast.error('A törlés sikertelen (eladott utalványos típus helyett kapcsold ki a „Megvásárolható”-t)'); return }
    setTypes((l) => l.filter((x) => x.id !== tEdit.id)); setTEdit(null); toast.success('Törölve')
  }
  const onTypeImage = async (f: File) => {
    try { const up = await uploadMedia(f, setTUp); setTEdit((e) => (e ? { ...e, imageId: String(up.id), v: { ...e.v, image: up.url } } : e)); setTUp(null) }
    catch (err) { toast.error(err instanceof Error ? err.message : 'A feltöltés nem sikerült'); setTUp(null) }
  }
  // a háttér-sor vége (a 4 szín a szerkesztőben): a feltöltött kép — rákattintva újra az a háttér — és a feltöltés
  const typeBg = tEdit && (
    <>
      {tUp && !tUp.error ? <UploadTile src={tUp.src} pct={tUp.pct} proc={tUp.proc} className="h-9 w-9 rounded-full" />
        : tEdit.v.image && <span title="Saját kép" className="block h-9 w-9 overflow-hidden rounded-full ring-2 ring-ui-dark ring-offset-2 ring-offset-ui-cell">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={tEdit.v.image} alt="" className="h-full w-full object-cover" /></span>}
      <label title="Saját kép feltöltése" /* ui-allow: szaggatott „új” hely */ className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-dashed border-ui-dark/30 text-ui-muted">
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onTypeImage(f); e.target.value = '' }} /><Plus className="h-4 w-4" />
      </label>
    </>
  )

  // ── új utalvány (12.5 / 12.6) ──
  const [wiz, setWiz] = useState<{ step: number; typeId: string | null; buyer: WizBuyer; payChoice: PayChoice | null; invoice: boolean; errors: Partial<Record<keyof WizBuyer, string>> } | null>(null)
  const [wizDone, setWizDone] = useState<{ code: string } | null>(null)
  const [wizLink, setWizLink] = useState<{ url: string; sessionId: string | null } | null>(null)
  const [wizBusy, setWizBusy] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [invoicing, setInvoicing] = useState<{ provider: string | null; ok: boolean; reason?: string; detail?: string } | null>(null)
  const startWizard = () => { setWiz({ step: 0, typeId: types.find((t) => t.active)?.id ?? null, buyer: EMPTY_BUYER, payChoice: null, invoice: true, errors: {} }); setWizDone(null); setWizLink(null); setEmailSent(false) }
  useEffect(() => {
    if (!wiz || wiz.step < 2 || invoicing) return
    fetch(`/api/invoicing/status?kind=${restaurant ? 'restaurant' : 'salon'}&id=${encodeURIComponent(businessId)}`, { credentials: 'include' }).then((r) => r.json()).then(setInvoicing).catch(() => setInvoicing({ provider: null, ok: false, reason: 'Nem sikerült ellenőrizni' }))
  }, [wiz?.step]) // eslint-disable-line react-hooks/exhaustive-deps
  const gl = useGuestLookup(!!wiz && wiz.step === 1)
  const [lookFor, setLookFor] = useState<'buyer' | 'to'>('buyer')
  const applyGuest = (g: GuestSuggestion) => {
    if (!wiz) return
    const b = wiz.buyer
    setWiz({ ...wiz, buyer: lookFor === 'buyer'
      ? { ...b, name: g.name, email: g.email ?? b.email, city: g.city ?? b.city, address: g.address ?? b.address, ...(g.taxNumber ? { company: true, tax: g.taxNumber } : {}) }
      : { ...b, toName: g.name, toEmail: g.email ?? b.toEmail } })
    gl.clear()
  }
  const wizType = types.find((t) => t.id === wiz?.typeId) ?? null
  const validBuyer = (b: WizBuyer) => {
    const e: Partial<Record<keyof WizBuyer, string>> = {}
    if (!b.name.trim()) e.name = 'A vásárló neve kötelező.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) e.email = 'Érvénytelen e-mail-cím.'
    if (!b.city.trim()) e.city = 'A település kell a számlához.'
    if (!b.address.trim()) e.address = 'A cím kell a számla kiküldéséhez.'
    if (b.company && !isForeignCountry(b.country) && !b.tax.trim()) e.tax = 'Céges vásárlásnál az adószám kötelező.'
    if (b.toEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.toEmail)) e.toEmail = 'Érvénytelen e-mail-cím.'
    return e
  }
  const next = () => {
    if (!wiz) return
    if (wiz.step === 0 && !wiz.typeId) { toast.error('Válassz típust'); return }
    if (wiz.step === 1) { const e = validBuyer(wiz.buyer); if (Object.keys(e).length) { setWiz({ ...wiz, errors: e }); return } }
    if (wiz.step === 2 && !wiz.payChoice) { toast.error('Válaszd ki, hogyan fizettek'); return }
    setWiz({ ...wiz, step: wiz.step + 1, errors: {} })
  }
  const submitWizard = async () => {
    if (!wiz || !wiz.payChoice) return
    const b = wiz.buyer
    const link = wiz.payChoice === 'link'
    setWizBusy(true)
    try {
      const r = await fetch('/api/gift-vouchers/manual-create', json('POST', {
        ...kindBody, voucherTypeId: wiz.typeId, paymentMode: link ? 'link' : 'paid', ...(link ? {} : { paidMethod: wiz.payChoice }),
        issueInvoice: link ? true : wiz.invoice && !!invoicing?.ok,
        purchaserName: b.name.trim(), purchaserEmail: b.email.trim(), purchaserCity: b.city.trim(), purchaserAddress: b.address.trim(), purchaserTaxNumber: b.company && !isForeignCountry(b.country) ? b.tax.trim() : undefined, purchaserCountry: b.country || undefined, locale: b.lang || 'hu',
        recipientName: b.toName.trim() || undefined, recipientEmail: b.toEmail.trim() || undefined, message: b.message.trim() || undefined,
      }))
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Nem sikerült létrehozni az utalványt.')
      if (link) setWizLink({ url: j.url, sessionId: j.sessionId ?? null })
      else { setWizDone({ code: j.code }); router.refresh() }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült létrehozni az utalványt.') } finally { setWizBusy(false) }
  }
  // fizetési link: élőben figyeljük, mikor fizet a vendég (a webhook hozza létre az utalványt)
  useEffect(() => {
    if (!wizLink?.sessionId) return
    let cancelled = false
    const check = async () => {
      try {
        const p = new URLSearchParams({ sessionId: wizLink.sessionId!, ...(restaurant ? { restaurantId: businessId } : { salonId: businessId }) })
        const j = await (await fetch(`/api/gift-vouchers/by-payment-intent?${p}`, { credentials: 'include' })).json()
        if (!cancelled && j.found) { setWizLink(null); setWizDone({ code: j.code }); router.refresh() }
      } catch { /* újrapróbálja */ }
    }
    const t = setInterval(check, 3000)
    void check()
    return () => { cancelled = true; clearInterval(t) }
  }, [wizLink?.sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
  const emailLink = async () => {
    if (!wizLink || !wiz || !wizType) return
    setWizBusy(true)
    try {
      const r = await fetch('/api/gift-vouchers/send-link-email', json('POST', { ...kindBody, url: wizLink.url, purchaserName: wiz.buyer.name, purchaserEmail: wiz.buyer.email, amountHuf: wizType.amount_huf, typeName: wizType.name }))
      const j = await r.json()
      if (!r.ok) throw new Error(j.error ?? 'Nem sikerült elküldeni.')
      setEmailSent(true); toast.success('Elküldve')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Nem sikerült elküldeni.') } finally { setWizBusy(false) }
  }
  const closeWizard = () => { setWiz(null); setWizDone(null); setWizLink(null); loadPending() }
  const preview = wizType ? <VoucherFit><VoucherCard lang={wiz?.buyer.lang} to={wiz?.buyer.toName.split(' ').slice(-1)[0] || undefined} amount={`${nf(wizType.amount_huf)} Ft`} code="—" bg={wizType.image?.url ? 'photo' : 'dark'} photo={wizType.image?.url} design={wizType.design} restaurant={restaurant} biz={biz} expires="kiállításkor" /></VoucherFit> : null
  const STEP_LABELS = ['Típus', 'Vásárló', 'Fizetés', 'Ellenőrzés']

  // mobil fejléc-ikonok (DashboardNav): beváltás, új, típusok, szűrő
  const [filterOpen, setFilterOpen] = useState(false)
  useEffect(() => {
    const on: [string, () => void][] = [
      ['davelopment:open-vouchers-redeem', () => { setFound(null); setCode(''); setRedeemOpen(true) }],
      ['davelopment:open-vouchers-create', () => startWizard()],
      ['davelopment:open-vouchers-types', () => { setTypesOpen(true); openType(types[0]?.id ?? null) }],
      ['davelopment:open-vouchers-filter', () => setFilterOpen(true)],
    ]
    if (!canManage) on.splice(0, 3)
    on.forEach(([e, f]) => window.addEventListener(e, f))
    return () => on.forEach(([e, f]) => window.removeEventListener(e, f))
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // ── fejléc ──
  const active = cnt('active'), redeemed = cnt('redeemed'), lapsed = cnt('expired') + cnt('refunded')
  const sum = vouchers.length || 1
  const revenue = vouchers.reduce((n, v) => n + (v.status !== 'refunded' ? v.amount_huf : 0), 0)
  const bar = (mobile = false) => <SegmentBar className={mobile ? 'mt-4' : undefined} segments={vouchers.length ? [
    { label: 'Aktív', value: mobile ? String(active) : `${active} db`, weight: (active / sum) * 100 || 3, tone: 'dark' },
    { label: 'Beváltva', value: mobile ? String(redeemed) : `${redeemed} db`, weight: (redeemed / sum) * 100 || 3, tone: 'yellow' },
    { label: 'Lejárt', value: mobile ? String(lapsed) : `${lapsed} db`, weight: (lapsed / sum) * 100 || 3, tone: 'hatch' },
  ] : [{ label: 'Aktív', value: '0 db', weight: 34, tone: 'dark' }, { label: 'Beváltva', value: '0 db', weight: 33, tone: 'yellow' }, { label: 'Lejárt', value: '0 db', weight: 33, tone: 'hatch' }]} />
  const kpis = <><Kpi icon={Gift} value={nf(vouchers.length)} label="Eladva" /><Kpi icon={Wallet} value={short(revenue)} label="Bevétel (Ft)" /><Kpi icon={TicketCheck} value={nf(redeemed)} label="Beváltva" /></>
  const actions = canManage ? <>
    <Button variant="glass" icon={Tag} onClick={() => { setTypesOpen(true); openType(types[0]?.id ?? null) }}>Típusok kezelése</Button>
    <Button variant="glass" icon={TicketCheck} onClick={() => { setFound(null); setCode(''); setRedeemOpen(true) }}>Beváltás</Button>
    <Button variant="yellow" icon={Plus} onClick={startWizard}>Új utalvány</Button>
  </> : undefined
  const chipDefs: [string, VoucherStatus | 'all'][] = [['Mind', 'all'], ['Függőben', 'pending'], ['Aktív', 'active'], ['Beváltva', 'redeemed'], ['Lejárt', 'expired'], ['Visszatérítve', 'refunded']]
  const chips = chipDefs.filter(([, s]) => s === 'all' || s === 'active' || cnt(s) > 0).map(([l, s]) => [l, s === 'all' ? vouchers.length + pending.length : cnt(s)] as [string, number])
  const chipKeys = chipDefs.filter(([, s]) => s === 'all' || s === 'active' || cnt(s) > 0).map(([, s]) => s)
  const payFilter = (
    <div>
      <Meta className="mb-1.5">Fizetési mód</Meta>
      <div className="flex flex-wrap gap-1.5">
        {[['all', 'Mind'], ...Object.entries(PAY).map(([k, p]) => [k, p.short])].map(([k, l]) => <button key={k} type="button" onClick={() => setPay(k)} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={pay === k ? 'dark' : 'cell'}>{l}</Pill></button>)}
      </div>
    </div>
  )

  if (!vouchers.length && !pending.length) {
    return (
      <div className="p-4 lg:p-0">
        <PageHead title="Utalványok" actions={actions} bar={bar()} kpis={kpis} />
        <EmptyState icon={Gift} title="Még nincs eladott utalvány" action={canManage ? <span className="flex flex-wrap justify-center gap-1.5"><Button icon={Tag} onClick={() => { setTypesOpen(true); openType(types[0]?.id ?? null) }}>{types.length ? 'Típusok kezelése' : 'Első típus létrehozása'}</Button><Button variant="glass" icon={Plus} onClick={startWizard}>Új utalvány</Button></span> : undefined}>
          Hozz létre egy típust (pl. 20 000 Ft-os ajándékutalvány) — utána a foglalóoldaladon is megvásárolható, és itt látod mindet.
        </EmptyState>
        {windows()}
      </div>
    )
  }

  function windows() {
    return (
      <>
        {/* beváltás */}
        <PopupModal open={redeemOpen} onClose={() => setRedeemOpen(false)} panel={
          <Modal title="Utalvány beváltása" subtitle="Olvasd be a QR-kódot vagy írd be a kódot" onClose={() => setRedeemOpen(false)}>
            {found ? foundNode : <VoucherScan camera={redeemOpen ? <div className="overflow-hidden rounded-ui-inner"><VoucherQrScanner onDetected={(c) => void lookup(c)} /></div> : undefined} code={code} onCode={setCode} onSearch={() => void lookup(code)} />}
            {found && <Button variant="cell" className="mt-2 w-full" onClick={() => { setFound(null); setCode('') }}>Másik kód</Button>}
          </Modal>
        } />
        {/* típusok */}
        <PopupModal open={typesOpen} onClose={() => { setTypesOpen(false); setTEdit(null) }} title="Utalvány-típusok" subtitle="A vendégek ezek közül választhatnak vásárláskor" maxWidth="sm:max-w-[1180px]" asideWidth="w-[640px]"
          headerAction={canManage ? <Button variant="yellow" size="sm" icon={Plus} onClick={() => openType(null)}>Új típus</Button> : undefined}
          aside={tEdit ? <VoucherTypeEditor bare wide lang={tLoc} value={tEdit.v} onChange={(v) => setTEdit({ ...tEdit, v, imageId: v.image ? tEdit.imageId : null })} restaurant={restaurant} biz={biz} textOnly={tLoc !== 'hu'} background={typeBg}
            top={tEdit.id ? <LocaleEditBar available={locales} active={tLoc} onSelect={(l) => void switchTLoc(l)} loading={tLocBusy} /> : undefined}
            onSave={canManage ? () => void saveType() : undefined} onCancel={() => setTEdit(null)} onDelete={canManage && tEdit.id ? () => setTDel(true) : undefined} busy={busy} />
            : <Meta className="px-6 pb-6 pt-6">Válassz egy típust a listából, vagy hozz létre újat.</Meta>}>
          <VoucherTypeList bare types={types.map((t) => ({ id: t.id, name: t.name, amount: `${nf(t.amount_huf)} Ft`, meta: t.active ? `${t.sold} eladva` : 'inaktív', active: t.active }))} openId={tEdit?.id ?? null} onOpen={openType} />
        </PopupModal>
        {/* új utalvány */}
        <PopupModal open={!!wiz} onClose={closeWizard} panel={wiz ? (
          <Modal size="lg" title="Új utalvány" subtitle={wizDone ? 'Kész' : wizLink ? 'Fizetésre vár' : `${wiz.step + 1} / 4 · ${['Típus', 'Vásárló adatai', 'Fizetés módja', 'Ellenőrzés'][wiz.step]}`} onClose={closeWizard}
            footer={wizDone || wizLink ? undefined : <>
              {wiz.step > 0 && <Button variant="cell" className="mr-auto" onClick={() => setWiz({ ...wiz, step: wiz.step - 1 })}>Vissza</Button>}
              {wiz.step < 3 ? <Button onClick={next}>{wiz.step === 1 ? 'Tovább a fizetéshez' : 'Tovább'}</Button> : <Button onClick={() => void submitWizard()} loading={wizBusy}>{wiz.payChoice === 'link' ? 'Fizetési link készítése' : 'Utalvány kiállítása'}</Button>}
            </>}>
            {wizDone ? (
              <WizDone card={preview && <VoucherFit><VoucherCard lang={wiz.buyer.lang} to={wiz.buyer.toName.split(' ').slice(-1)[0] || undefined} amount={`${nf(wizType?.amount_huf ?? 0)} Ft`} code={wizDone.code} bg={wizType?.image?.url ? 'photo' : 'dark'} photo={wizType?.image?.url} design={wizType?.design} restaurant={restaurant} biz={biz} /></VoucherFit>}
                invoice={wiz.invoice && invoicing?.ok ? invoicing.detail ?? 'e-mailben megy ki' : null} sentTo={[wiz.buyer.email, wiz.buyer.toEmail].filter(Boolean).join(', ')} onDone={closeWizard} />
            ) : wizLink ? (
              <>
                <WizLink url={wizLink.url} name={wiz.buyer.name || 'a vásárlónak'} onCopy={() => { void navigator.clipboard.writeText(wizLink.url); toast.success('Link másolva') }} onEmail={() => void emailLink()} emailing={wizBusy} emailSent={emailSent}
                  onCancel={() => { if (wizLink.sessionId) void cancelPending(wizLink.sessionId).then(closeWizard); else closeWizard() }} cancelling={busy} />
                <Note className="mt-3">Várakozás a vendég fizetésére… Bezárás után a link „Függőben” látszik a listában.</Note>
              </>
            ) : (
              <>
                <Steps active={wiz.step} labels={STEP_LABELS} className="mb-5" />
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="min-w-0">
                    {wiz.step === 0 && <WizTypeStep types={types.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name, amount: `${nf(t.amount_huf)} Ft`, image: t.image?.url ?? null, design: t.design }))} selected={wiz.typeId} onSelect={(id) => setWiz({ ...wiz, typeId: id })} restaurant={restaurant} biz={biz} />}
                    {wiz.step === 1 && <WizBuyerStep langs={locales} value={wiz.buyer} errors={wiz.errors}
                      onChange={(b, f) => { setWiz({ ...wiz, buyer: b, errors: { ...wiz.errors, [f]: undefined } }); if (f === 'name' || f === 'email') { setLookFor('buyer'); gl.type(f, String(b[f])) } else if (f === 'toName' || f === 'toEmail') { setLookFor('to'); gl.type(f === 'toName' ? 'name' : 'email', String(b[f])) } }}
                      suggest={(f) => <GuestSuggestList show={(lookFor === 'buyer' && (f === 'name' || f === 'email') && gl.field === f) || (lookFor === 'to' && ((f === 'toName' && gl.field === 'name') || (f === 'toEmail' && gl.field === 'email')))} results={gl.results} onPick={applyGuest} />} />}
                    {wiz.step === 2 && <WizPayStep stripe={stripe} invoicing={invoicing ? { ok: invoicing.ok, label: invoicing.ok ? 'Összekötve' : invoicing.provider ? 'Hibás bekötés' : 'Nincs összekötve', hint: invoicing.ok ? invoicing.detail : invoicing.reason } : null} selected={wiz.payChoice} onSelect={(p) => setWiz({ ...wiz, payChoice: p })} settingsHref={`${base}/settings?tab=payments`} />}
                    {wiz.step === 3 && wizType && <WizConfirmStep rows={[['Utalvány', `${wizType.name} · ${nf(wizType.amount_huf)} Ft`], ['Vásárló', `${wiz.buyer.name} · ${wiz.buyer.email}`], ...(wiz.buyer.toName || wiz.buyer.toEmail ? [['Megajándékozott', [wiz.buyer.toName, wiz.buyer.toEmail].filter(Boolean).join(' · ')] as [string, string]] : []), ['Fizetés', PAID_LABEL[wiz.payChoice ?? 'cash']]]}
                      invoice={wiz.payChoice === 'link' ? true : wiz.invoice && !!invoicing?.ok} onInvoice={(on) => setWiz({ ...wiz, invoice: on })} invoiceDisabled={wiz.payChoice === 'link' || !invoicing?.ok}
                      invoiceHint={!invoicing ? 'Ellenőrzés…' : invoicing.ok ? `${invoicing.detail ?? 'Számlázó'} · e-mailben megy ki` : invoicing.reason ?? 'A számlázó nincs bekötve'} />}
                  </div>
                  <div className="space-y-[5px] max-lg:hidden"><Meta className="mb-1">Előnézet</Meta>{preview}</div>
                </div>
              </>
            )}
          </Modal>
        ) : undefined} />
        {/* mobil: a kijelölt utalvány és a szűrő alulról */}
        <PopupModal open={mobileOpen && !!openKey} onClose={() => setMobileOpen(false)} panel={<Modal title={openRow?.purchaser_name ?? openPending?.purchaserName ?? 'Utalvány'} onClose={() => setMobileOpen(false)}>{detailNode(true)}</Modal>} />
        <PopupModal open={filterOpen} onClose={() => setFilterOpen(false)} panel={
          <Modal title="Szűrés" onClose={() => setFilterOpen(false)} footer={<Button className="w-full" onClick={() => setFilterOpen(false)}>Mutasd · {rows.length} utalvány</Button>}>
            <Meta className="mb-1.5">Állapot</Meta>
            <div className="flex flex-wrap gap-1.5">{chips.map(([l, n], i) => <button key={l} type="button" onClick={() => setStatus(chipKeys[i])} className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20"><Pill tone={status === chipKeys[i] ? 'dark' : 'cell'}>{l} <span className="opacity-50">{n}</span></Pill></button>)}</div>
            <div className="mt-4">{payFilter}</div>
            {(status !== 'all' || pay !== 'all') && <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setStatus('all'); setPay('all') }}>Alaphelyzet</Button>}
            {canManage && <Button variant="cell" icon={Tag} className="mt-4 w-full" onClick={() => { setFilterOpen(false); setTypesOpen(true); openType(types[0]?.id ?? null) }}>Típusok kezelése</Button>}
          </Modal>
        } />
        <ConfirmDialog open={del} title="Utalvány törlése" description={openRow ? `${openRow.code} — a művelet nem vonható vissza.` : undefined} confirmLabel="Törlés" busy={busy} onConfirm={() => void remove()} onCancel={() => setDel(false)} zIndexClass="z-[100]" />
        <ConfirmDialog open={bulkDel} title="Kijelöltek törlése" description={`${selected.length} utalvány — a művelet nem vonható vissza.`} confirmLabel="Törlés" busy={busy} onConfirm={() => void bulkDelete()} onCancel={() => setBulkDel(false)} zIndexClass="z-[100]" />
        <ConfirmDialog open={!!cancelLinkId} title="Fizetési link visszavonása" description="A vendég ezután már nem tud fizetni ezen a linken, és nem jön létre utalvány." confirmLabel="Visszavonás" busy={busy} onConfirm={() => cancelLinkId && void cancelPending(cancelLinkId)} onCancel={() => setCancelLinkId(null)} zIndexClass="z-[100]" />
        <ConfirmDialog open={tDel} title="Típus törlése" description={tEdit?.v.name} confirmLabel="Törlés" busy={busy} onConfirm={() => void deleteType()} onCancel={() => setTDel(false)} zIndexClass="z-[100]" />
      </>
    )
  }

  return (
    <div className="p-4 lg:p-0">
      {/* egyszeri tájékoztatás a számlázás változásáról (docs/manual) — bezárás után ebben a böngészőben nem jön elő */}
      {vatNotice && (
        <Note tip className="mb-4">
          <strong>Változott az utalványok és a foglaló számlázása.</strong> Az utalvány eladásakor és a foglaló befizetésekor
          mostantól áfa nélküli bizonylat megy (még nem tudni, mire költik). Az ÁFA a beváltáskor / a látogatáskor keletkezik:
          a lezárásnál vagy a pénztárgépen a teljes összeget számlázd, az utalvány és a foglaló ott fizetési mód. A korábban
          áfásan eladott utalványok a régi módon mennek tovább.{' '}
          <button type="button" className="font-medium underline" onClick={() => { setVatNotice(false); try { localStorage.setItem('vat-notice-2026-11', '1') } catch { /* privát mód */ } }}>Megértettem</button>
        </Note>
      )}
      {/* ── desktop (12.1) ── */}
      <div className="max-lg:hidden">
        <PageHead title="Utalványok" actions={actions} bar={bar()} kpis={kpis} />
        <ChipToolbar chipsInFilter chipsLabel="Állapot" search="Kód, vásárló, típus" chips={chips} active={Math.max(0, chipKeys.indexOf(status))} query={query} onQuery={setQuery} onChip={(i) => setStatus(chipKeys[i])} dot={pay !== 'all'} filters={payFilter} />
        <div className="grid gap-[5px] xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* a lista a mellette lévő részlet magasságáig ér (egyforma, kompakt), a sorok benne görgetnek */}
          <div className="relative flex min-h-[480px] min-w-0 flex-col justify-end">
            <div className="absolute inset-0"><VoucherTable fill th={vTh} rows={pageRows} openKey={openKey} selected={selected} onOpen={(k) => open(k)} onToggle={(k) => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
              onToggleAll={() => { const keys = pageRows.filter((r) => r.status !== 'pending').map((r) => r.key); setSelected((s) => (keys.every((k) => s.includes(k)) ? s.filter((k) => !keys.includes(k)) : [...new Set([...s, ...keys])])) }}
              onCopyLink={copyLink} page={paging.page} pages={pages} label={paging.label} onPage={paging.goTo} more={<LoadMoreSentinel hasMore={paging.hasMore} loading={false} onMore={paging.more} />}
              empty={<Meta className="px-3 py-10 text-center">Nincs a szűrésnek megfelelő utalvány.</Meta>} className={selected.length ? 'pb-20' : ''} /></div>
            {canManage && selected.length > 0 && <BulkDock className="mb-4"><StaffBulkBar count={selected.length} onClear={() => setSelected([])} actions={[{ label: 'Törlés', danger: true, onClick: () => setBulkDel(true) }]} /></BulkDock>}
          </div>
          <div className="min-w-0">{detailNode()}</div>
        </div>
      </div>

      {/* ── mobil (12.8) ── */}
      <div className="lg:hidden">
        {/* a beváltás (QR) a fejléc ikonjai közt */}
        <div className="text-ui-num font-light leading-none text-ui-text">Utalványok</div>
        {bar(true)}
        <VoucherMobileList className="mt-4" rows={rows} openKey={mobileOpen ? openKey : null} onOpen={(k) => open(k, true)} />
      </div>
      {windows()}
    </div>
  )
}
