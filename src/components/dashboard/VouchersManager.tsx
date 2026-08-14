'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, ChevronDown, TicketCheck, Camera, Keyboard, Loader2, Tag, Plus, Check, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatusPills } from '@/components/dashboard/StatusPills'
import { CountUpKpi } from '@/components/dashboard/CountUpKpi'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { VoucherQrScanner } from '@/components/dashboard/VoucherQrScanner'
import { VoucherCreateWizard } from '@/components/dashboard/VoucherCreateWizard'
import { VoucherTypeManager, type VoucherTypeData } from '@/components/settings/VoucherTypeManager'
import { formatPrice } from '@/lib/utils'

/**
 * "Utalványok" dashboard-lista — az eladott ajándékutalványok áttekintése + helyszíni
 * (nem online-foglalásos) beváltás. A `StaffManager.tsx` vizuális nyelvét követi 1:1 (közös
 * `StatusPills`/`CountUpKpi` fejléc, mappa-fül kártya, div-grid sorok + státusz-pill), hogy a
 * dashboard konzisztens maradjon — csak a lista-tartalom más, nincs szerkesztő/bulk-akció.
 */

export type VoucherRow = {
  id: string
  code: string
  amount_huf: number
  type_name?: string | null
  purchaser_name: string
  status: 'active' | 'redeemed' | 'expired' | 'refunded'
  expires_at: string
  redeemed_at?: string | null
  createdAt: string
}

interface Props {
  variant: 'salon' | 'restaurant'
  businessId: string
  initialVouchers: VoucherRow[]
  voucherTypes: VoucherTypeData[]
  minAmountHuf: number
  maxAmountHuf: number
}

const STATUS_OPTIONS: VoucherRow['status'][] = ['active', 'redeemed', 'expired', 'refunded']

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

function statusPill(status: VoucherRow['status']): { label: string; bg: string; color: string; border?: string; dot: string } {
  switch (status) {
    case 'redeemed': return { label: 'Beváltva', bg: '#EFF3FB', color: '#3B5BB5', dot: '#5B7FD4' }
    case 'expired': return { label: 'Lejárt', bg: 'repeating-linear-gradient(115deg, rgba(255,255,255,.6), rgba(255,255,255,.6) 7px, rgba(190,180,140,.16) 7px, rgba(190,180,140,.16) 14px)', color: '#8A8779', border: '1px solid var(--dav-line)', dot: '#B7B2A4' }
    case 'refunded': return { label: 'Visszatérítve', bg: '#FBEEEE', color: '#B5473B', dot: '#D46A5B' }
    default: return { label: 'Aktív', bg: '#E7F1E9', color: '#3B6B4B', dot: '#4F9E6A' }
  }
}

export function VouchersManager({ variant, businessId, initialVouchers, voucherTypes, minAmountHuf, maxAmountHuf }: Props) {
  const [vouchers, setVouchers] = useState<VoucherRow[]>(initialVouchers)
  // A `router.refresh()` (pl. a VoucherCreateWizard sikeres fizetés után) friss `initialVouchers`
  // propot küld, de a `useState` csak MOUNT-kor olvassa be — enélkül a lista a wizard bezárása
  // után is a régi maradna, csak teljes oldal-újratöltésnél frissülne.
  useEffect(() => { setVouchers(initialVouchers) }, [initialVouchers])
  const [statusFilter, setStatusFilter] = useState<'all' | VoucherRow['status']>('all')
  const [query, setQuery] = useState('')
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [mode, setMode] = useState<'code' | 'camera'>('code')
  const [codeInput, setCodeInput] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [typesOpen, setTypesOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)

  // Mobilon a fejléc csengő melletti ikonjai nyitják ezeket (DashboardNav dispatch-eli) — a
  // Foglalások/Beállítások fejléc-ikon mintáját követve.
  useEffect(() => {
    const openRedeem = () => { setMode('code'); setRedeemOpen(true) }
    const openActions = () => setMobileActionsOpen(true)
    window.addEventListener('davelopment:open-vouchers-redeem', openRedeem)
    window.addEventListener('davelopment:open-vouchers-actions', openActions)
    return () => {
      window.removeEventListener('davelopment:open-vouchers-redeem', openRedeem)
      window.removeEventListener('davelopment:open-vouchers-actions', openActions)
    }
  }, [])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const PAGE_SIZE = 15
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const toggleSelect = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const confirmBulkDelete = async () => {
    const ids = Array.from(selected)
    if (ids.length === 0) { setBulkOpen(false); return }
    setBulkBusy(true)
    try {
      const results = await Promise.allSettled(ids.map(id => fetch(`/api/gift-vouchers/${id}`, { method: 'DELETE', credentials: 'include' })))
      const okIds = ids.filter((id, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok)
      setVouchers(prev => prev.filter(v => !okIds.includes(v.id)))
      setSelected(prev => { const next = new Set(prev); okIds.forEach(id => next.delete(id)); return next })
      if (okIds.length < ids.length) toast.error(`${ids.length - okIds.length} törlése sikertelen`)
      else toast.success('Törölve')
    } finally {
      setBulkBusy(false)
      setBulkOpen(false)
    }
  }

  const activeCount = vouchers.filter(v => v.status === 'active').length
  const redeemedCount = vouchers.filter(v => v.status === 'redeemed').length
  const otherCount = vouchers.length - activeCount - redeemedCount
  const totalRevenue = vouchers.reduce((sum, v) => sum + (v.status !== 'refunded' ? v.amount_huf : 0), 0)
  const total = vouchers.length || 1

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vouchers.filter(v => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (!q) return true
      return v.code.toLowerCase().includes(q) || v.purchaser_name.toLowerCase().includes(q) || (v.type_name ?? '').toLowerCase().includes(q)
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [vouchers, statusFilter, query])

  // Szűrés/keresés váltásakor a lapozás visszaáll az elejére.
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [statusFilter, query])
  const visible = filtered.slice(0, visibleCount)

  const redeem = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase()
    if (!code) return
    setRedeeming(true)
    try {
      const res = await fetch('/api/gift-vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(variant === 'salon' ? { kind: 'salon', salonId: businessId, code } : { kind: 'restaurant', restaurantId: businessId, code }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült beváltani.')
      setVouchers(prev => prev.map(v => v.code === code ? { ...v, status: 'redeemed', redeemed_at: json.redeemed_at } : v))
      toast.success(`Beváltva: ${code}`)
      setRedeemOpen(false)
      setCodeInput('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült beváltani.')
    } finally {
      setRedeeming(false)
    }
  }

  const updateStatus = async (v: VoucherRow, status: VoucherRow['status']) => {
    setStatusMenuId(null)
    if (status === v.status) return
    setUpdatingId(v.id)
    try {
      const res = await fetch(`/api/gift-vouchers/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült frissíteni.')
      setVouchers(prev => prev.map(x => x.id === v.id ? { ...x, status: json.status, redeemed_at: json.redeemed_at } : x))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült frissíteni.')
    } finally {
      setUpdatingId(null)
    }
  }

  const toDelete = vouchers.find(v => v.id === deleteId) ?? null
  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/gift-vouchers/${deleteId}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error()
      setVouchers(prev => prev.filter(x => x.id !== deleteId))
      toast.success('Törölve')
      setDeleteId(null)
    } catch {
      toast.error('Törlés sikertelen')
    } finally {
      setDeleting(false)
    }
  }

  const GRID = 'grid-cols-[24px_1.3fr_1.5fr_1fr_1fr_140px_40px]'

  // Mobilon a fejléc csengő melletti ikonjai (DashboardNav) váltják ki ezt a sort — ott csak a
  // fekete beolvasás-ikon + a lenti PopupModal nyílik, hogy ne foglaljon annyi helyet.
  const actionButtons = (
    <div className="hidden flex-wrap items-center gap-2.5 lg:flex">
      <button
        onClick={() => setTypesOpen(true)}
        className="flex h-[38px] items-center gap-2 rounded-[18px] bg-white px-4 text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper"
      >
        <Tag className="h-[15px] w-[15px]" strokeWidth={1.7} /> Típusok kezelése
      </button>
      <button
        onClick={() => setCreateOpen(true)}
        className="flex h-[38px] items-center gap-2 rounded-[18px] bg-white px-4 text-[13px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper"
      >
        <Plus className="h-[15px] w-[15px]" strokeWidth={1.9} /> Új utalvány
      </button>
      <button
        onClick={() => { setMode('code'); setRedeemOpen(true) }}
        className="flex h-[38px] items-center gap-2 rounded-[18px] bg-ink-dark px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-ink"
      >
        <TicketCheck className="h-[15px] w-[15px]" strokeWidth={1.9} /> Beváltás
      </button>
      {selected.size > 0 && (
        <button
          onClick={() => setBulkOpen(true)}
          className="flex h-[38px] items-center gap-2 rounded-[18px] bg-[#C0392B] px-4 text-[13px] font-semibold text-white shadow-[0_2px_6px_rgba(70,60,20,.14)] transition-colors hover:bg-[#a93226]"
        >
          <Trash2 className="h-[15px] w-[15px]" strokeWidth={1.9} /> Kijelöltek törlése ({selected.size})
        </button>
      )}
    </div>
  )

  return (
    <>
      {/* ── HEADER: cím felül → alatta a TELJES-SZÉLESSÉGŰ státusz-csík (bal) + 3 nagy szám (jobb) ── */}
      <div className="mb-6">
        <PageHeader
          eyebrow="Fizetés"
          title="Utalványok"
          description="Az eladott ajándékutalványok áttekintése és helyszíni beváltása"
        />
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <StatusPills
            eager
            className="flex-1 lg:max-w-[760px]"
            segments={[
              { label: 'Aktív', pct: (activeCount / total) * 100, value: activeCount, suffix: ' db', background: '#1D1C19', color: '#fff' },
              { label: 'Beváltva', pct: (redeemedCount / total) * 100, value: redeemedCount, suffix: ' db', background: '#F1CE45', color: '#1D1C19' },
              { label: 'Lejárt / visszatérítve', pct: (otherCount / total) * 100, value: otherCount, suffix: ' db', background: 'repeating-linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,.5) 7px, rgba(190,180,140,.24) 7px, rgba(190,180,140,.24) 14px)', color: '#57564f', border: '1px solid var(--dav-line-strong)', align: 'end' },
            ]}
          />
          <div className="flex flex-wrap items-start gap-8 lg:gap-10">
            <CountUpKpi icon="tag" value={vouchers.length} label="Eladva" />
            <CountUpKpi icon="wallet" value={totalRevenue} label="Bevétel" suffix=" Ft" group />
            <CountUpKpi icon="done" value={redeemedCount} label="Beváltva" />
          </div>
        </div>
      </div>

      {/* ── MAPPA-FÜL kártya ── */}
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative z-10 flex h-[48px] w-fit min-w-[380px] max-w-[600px] items-center gap-2 rounded-t-[24px] bg-[rgba(255,255,255,.62)] px-4 backdrop-blur-[20px] sm:px-6">
            <div className="relative shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="cursor-pointer appearance-none rounded-[18px] bg-white py-2 pl-4 pr-8 text-[12.5px] font-semibold text-ink shadow-[0_1px_4px_rgba(70,60,20,.06)] focus:outline-none"
              >
                <option value="all">Minden állapot</option>
                <option value="active">Aktív</option>
                <option value="redeemed">Beváltva</option>
                <option value="expired">Lejárt</option>
                <option value="refunded">Visszatérítve</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
            </div>
            <div className="flex w-[140px] sm:min-w-[110px] sm:flex-1 items-center gap-2.5 rounded-[18px] bg-white px-3 py-2 sm:px-4 shadow-[0_1px_4px_rgba(70,60,20,.06)]">
              <Search className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kód, vásárló, típus"
                className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-soft2 focus:outline-none"
              />
            </div>
            <span
              className="pointer-events-none absolute -right-[24px] bottom-0 h-[24px] w-[24px]"
              style={{ background: 'radial-gradient(circle at top right, transparent 23px, rgba(255,255,255,.62) 23.5px)' }}
            />
          </div>

          {actionButtons}
        </div>

        <div className="rounded-b-[28px] rounded-tr-[28px] bg-[rgba(255,255,255,.9)] p-5 shadow-[0_18px_42px_-26px_rgba(70,60,20,.3)] backdrop-blur-[18px] sm:p-6">
          <div className={`hidden ${GRID} items-center gap-3.5 border-b border-line pb-3.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-soft2 lg:grid`}>
            <div />
            <div>Kód / típus</div>
            <div>Vásárló</div>
            <div>Összeg</div>
            <div>Lejárat</div>
            <div>Státusz</div>
            <div />
          </div>

          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-soft">Nincs találat.</p>
          )}

          {visible.map((v) => {
            const sp = statusPill(v.status)
            const isSel = selected.has(v.id)
            return (
              <div
                key={v.id}
                style={isSel ? { background: 'var(--dav-accent)' } : undefined}
                className={`mt-2 rounded-[18px] transition-all ${isSel ? 'shadow-[0_10px_24px_-12px_rgba(180,150,40,.55)]' : 'hover:bg-gold/10'}`}
              >
                {/* DESKTOP */}
                <div className={`hidden ${GRID} items-center gap-3.5 px-3.5 py-2.5 lg:grid`}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(v.id) }}
                    aria-pressed={isSel}
                    aria-label="Kijelölés"
                    className={`flex h-[18px] w-[18px] items-center justify-center rounded-[6px] border-[1.5px] transition-colors ${isSel ? 'border-ink-dark bg-ink-dark' : 'border-line-strong hover:border-ink-dark'}`}
                  >
                    {isSel && <span className="h-2 w-2 rounded-[2px] bg-gold" />}
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-[14.5px] font-semibold tracking-wide text-ink">{v.code}</p>
                    {v.type_name && <p className="truncate text-[12px] font-medium text-ink-soft">{v.type_name}</p>}
                  </div>
                  <div className="truncate text-[13.5px] font-medium text-ink">{v.purchaser_name}</div>
                  <div className="text-[13.5px] font-medium text-ink">{formatPrice(v.amount_huf, 'HUF')}</div>
                  <div className="text-[13.5px] font-medium text-ink-soft">{fmtDate(v.expires_at)}</div>
                  <div className="relative">
                    <button
                      type="button"
                      disabled={updatingId === v.id}
                      onClick={(e) => { e.stopPropagation(); setStatusMenuId(statusMenuId === v.id ? null : v.id) }}
                      className="inline-flex items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold disabled:opacity-60"
                      style={{ background: sp.bg, color: sp.color, border: sp.border }}
                    >
                      {updatingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-[7px] w-[7px] rounded-full" style={{ background: sp.dot }} />}
                      {sp.label}
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                    {statusMenuId === v.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} />
                        <div className="absolute left-0 top-[36px] z-20 w-44 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                          {STATUS_OPTIONS.map((s) => {
                            const opt = statusPill(s)
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateStatus(v, s)}
                                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                              >
                                <span className="h-2 w-2 rounded-full" style={{ background: opt.dot }} />
                                {opt.label}
                                {v.status === s && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteId(v.id) }}
                    title="Törlés"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#C0392B] transition-colors hover:bg-paper"
                  >
                    <Trash2 className="h-[14px] w-[14px]" strokeWidth={1.6} />
                  </button>
                </div>
                {/* MOBIL */}
                <div className="flex items-center justify-between gap-3 px-3.5 py-3 lg:hidden">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-wide text-ink">{v.code}</p>
                    <p className="truncate text-[12.5px] font-medium text-ink-soft">{v.purchaser_name} · {formatPrice(v.amount_huf, 'HUF')}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        disabled={updatingId === v.id}
                        onClick={(e) => { e.stopPropagation(); setStatusMenuId(statusMenuId === v.id ? null : v.id) }}
                        className="inline-flex items-center gap-1.5 rounded-[14px] px-3 py-[5px] text-[12px] font-semibold disabled:opacity-60"
                        style={{ background: sp.bg, color: sp.color, border: sp.border }}
                      >
                        {updatingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-[7px] w-[7px] rounded-full" style={{ background: sp.dot }} />}
                        {sp.label}
                      </button>
                      {statusMenuId === v.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setStatusMenuId(null)} />
                          <div className="absolute right-0 top-[36px] z-20 w-44 rounded-[14px] border border-line bg-white p-1.5 shadow-dav-container">
                            {STATUS_OPTIONS.map((s) => {
                              const opt = statusPill(s)
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => updateStatus(v, s)}
                                  className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-paper"
                                >
                                  <span className="h-2 w-2 rounded-full" style={{ background: opt.dot }} />
                                  {opt.label}
                                  {v.status === s && <Check className="ml-auto h-4 w-4 text-ink" strokeWidth={2} />}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(v.id) }}
                      title="Törlés"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#C0392B] transition-colors hover:bg-paper"
                    >
                      <Trash2 className="h-[14px] w-[14px]" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-[14px] bg-paper text-[13px] font-semibold text-ink transition-colors hover:bg-[#EFEFEC]"
            >
              Korábbiak betöltése ({filtered.length - visibleCount})
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Utalvány törlése"
        description={toDelete ? `Biztosan törlöd a(z) ${toDelete.code} kódú utalványt? A művelet nem vonható vissza — a Stripe-tranzakció/számla ettől függetlenül megmarad.` : 'Biztosan törlöd ezt az utalványt?'}
        confirmLabel="Törlés"
        cancelLabel="Mégse"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={bulkOpen}
        title="Kijelöltek törlése"
        description={`Biztosan törlöd a kijelölt ${selected.size} utalványt? A művelet nem vonható vissza — a Stripe-tranzakciók/számlák ettől függetlenül megmaradnak.`}
        confirmLabel={`Törlés (${selected.size})`}
        cancelLabel="Mégse"
        destructive
        busy={bulkBusy}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkOpen(false)}
      />

      <PopupModal open={redeemOpen} onClose={() => setRedeemOpen(false)} title="Utalvány beváltása" subtitle="Helyszíni beváltás — nem foglaláshoz kötött">
        <div className="space-y-4">
          <div className="flex rounded-[14px] bg-paper p-1">
            <button
              type="button"
              onClick={() => setMode('code')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-semibold transition-colors ${mode === 'code' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
            >
              <Keyboard className="h-3.5 w-3.5" /> Kód beírása
            </button>
            <button
              type="button"
              onClick={() => setMode('camera')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[13px] font-semibold transition-colors ${mode === 'camera' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
            >
              <Camera className="h-3.5 w-3.5" /> Kamera
            </button>
          </div>

          {mode === 'code' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') redeem(codeInput) }}
                placeholder="XXXX-XXXX"
                className="h-12 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-center text-lg font-semibold tracking-[0.1em] text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
              />
              <button
                type="button"
                onClick={() => redeem(codeInput)}
                disabled={redeeming || !codeInput.trim()}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-ink-dark text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {redeeming && <Loader2 className="h-4 w-4 animate-spin" />}
                Beváltás
              </button>
            </div>
          ) : (
            <VoucherQrScanner onDetected={(code) => redeem(code)} />
          )}
        </div>
      </PopupModal>

      <PopupModal open={typesOpen} onClose={() => setTypesOpen(false)} title="Utalvány-típusok" subtitle="A vendégek ezek közül választhatnak vásárláskor">
        <VoucherTypeManager
          variant={variant}
          businessId={businessId}
          initialTypes={voucherTypes}
          minAmountHuf={minAmountHuf}
          maxAmountHuf={maxAmountHuf}
        />
      </PopupModal>

      <VoucherCreateWizard
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        variant={variant}
        businessId={businessId}
        voucherTypes={voucherTypes}
      />

      <PopupModal open={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)} title="Utalványok">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { setMobileActionsOpen(false); setTypesOpen(true) }}
            className="flex w-full items-center gap-3 rounded-[14px] border border-line px-4 py-3.5 text-left text-[14px] font-semibold text-ink transition-colors hover:bg-paper"
          >
            <Tag className="h-[18px] w-[18px]" strokeWidth={1.7} /> Típusok kezelése
          </button>
          <button
            type="button"
            onClick={() => { setMobileActionsOpen(false); setCreateOpen(true) }}
            className="flex w-full items-center gap-3 rounded-[14px] border border-line px-4 py-3.5 text-left text-[14px] font-semibold text-ink transition-colors hover:bg-paper"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.9} /> Új utalvány
          </button>
        </div>
      </PopupModal>
    </>
  )
}
