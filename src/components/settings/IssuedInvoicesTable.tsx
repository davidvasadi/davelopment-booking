'use client'

import { useEffect, useMemo, useState } from 'react'
import { PopupModal } from '@/components/ui/popup-modal'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { Pagination } from '@/components/ui-kit'
import { InvoiceModal, IssuedInvoices, type InvoiceSortKey, type IssuedInvoiceRow } from '@/components/blocks/money'
import { sortRows, useTableSort } from '@/lib/tableSort'
import type { IssuedInvoice } from '@/app/api/invoicing/issued/route'

/**
 * Beállítások › Számlák (design 16.7.1–16.7.2): a VENDÉGEKNEK a saját számlázó fiókból kiállított számlák (előleg +
 * ajándékutalvány) — kereső, típus- és állapot-szűrő, lapozó; sorra kattintva a számla adatai és a PDF-előnézet.
 */

const PAGE = 10
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

export function IssuedInvoicesTable({ variant, businessId }: { variant: 'salon' | 'restaurant'; businessId: string }) {
  const [rows, setRows] = useState<IssuedInvoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  // rendezés (az oszlopcímre kattintva) — alapból a legújabb elöl; kijelölés a csoportos letöltéshez
  const { sort, th } = useTableSort<InvoiceSortKey>({ key: 'date', dir: 'desc' })
  const [selected, setSelected] = useState<string[]>([])
  const [stornoAsk, setStornoAsk] = useState(false)
  const [stornoBusy, setStornoBusy] = useState(false)
  // PDF: a tárolt link, vagy az üzlet számlázó fiókjából lekérve (`/api/invoicing/pdf`)
  const pdfUrl = (id: string, download = false) => `/api/invoicing/pdf?kind=${variant}&id=${encodeURIComponent(businessId)}&ref=${encodeURIComponent(id)}${download ? '&download=1' : ''}`

  useEffect(() => {
    fetch(`/api/invoicing/issued?kind=${variant}&id=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Nem sikerült betölteni'); return j })
      .then((j) => setRows(j.rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Nem sikerült betölteni'))
  }, [variant, businessId])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (type === 'all' || r.type === type) && (status === 'all' || r.status === status) &&
      (!s || [r.customer, r.email, r.number, r.source].some((x) => (x ?? '').toLowerCase().includes(s))))
  }, [rows, q, type, status])
  const sorted = useMemo(() => sortRows(filtered, sort, (r, k) => (k === 'no' ? r.number : k === 'item' ? r.source : k === 'who' ? r.customer : k === 'date' ? new Date(r.date) : k === 'sum' ? r.amountHuf : r.status)), [filtered, sort])
  const downloadable = filtered.filter((r) => r.status === 'issued' && r.number)
  const toggle = (id: string) => setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  const toggleAll = () => setSelected((x) => (downloadable.every((r) => x.includes(r.id)) ? [] : downloadable.map((r) => r.id)))
  // a kijelöltek egy ZIP-ben (`/api/invoicing/zip`), legfeljebb 50 egyszerre
  // sztornó a számlázóban (Számlázz.hu / Billingo) — végleges, ezért megerősítés után; tételenként az eredmény
  const storno = async () => {
    setStornoBusy(true)
    try {
      const r = await fetch('/api/invoicing/storno', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ kind: variant, id: businessId, refs: selected.slice(0, 20) }) })
      const j = await r.json().catch(() => ({})) as { results?: { ref: string; ok: boolean; number?: string; error?: string }[]; error?: string }
      if (!r.ok) throw new Error(j.error ?? 'A sztornó nem sikerült')
      const ok = (j.results ?? []).filter((x) => x.ok)
      const bad = (j.results ?? []).filter((x) => !x.ok)
      setRows((list) => list?.map((x) => { const hit = ok.find((o) => o.ref === x.id); return hit ? { ...x, status: 'storno' as const, storno: hit.number ?? null } : x }) ?? list)
      setSelected(bad.map((b) => b.ref))
      if (ok.length) toast.success(`${ok.length} számla sztornózva`)
      if (bad.length) toast.error(`${bad.length} számla nem sztornózható: ${bad[0].error ?? ''}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'A sztornó nem sikerült') } finally { setStornoBusy(false); setStornoAsk(false) }
  }
  const downloadSelected = () => {
    const refs = selected.slice(0, 50).join(',')
    window.location.href = `/api/invoicing/zip?kind=${variant}&id=${encodeURIComponent(businessId)}&refs=${encodeURIComponent(refs)}`
  }
  useEffect(() => setPage(1), [q, type, status])
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const toRow = (r: IssuedInvoice): IssuedInvoiceRow => ({ key: r.id, no: r.number ?? '—', item: r.source, who: r.customer, email: r.email, date: fmtDate(r.date), sum: ft(r.amountHuf), st: r.status, storno: r.storno, issuer: r.issuer ?? null, pay: r.pay ?? null })
  const open = rows?.find((r) => r.id === openId) ?? null

  return (
    <>
      <IssuedInvoices data={sorted.slice((page - 1) * PAGE, page * PAGE).map(toRow)} th={th}
        selected={selected} onToggle={toggle} onToggleAll={toggleAll} onDownloadSelected={downloadSelected} onStornoSelected={() => setStornoAsk(true)} query={q} onQuery={setQ} type={type} onType={setType} status={status} onStatus={setStatus}
        failed={(rows ?? []).filter((r) => r.status === 'failed').length} openKey={openId} onOpen={setOpenId}
        pdfHref={(id) => { const r = rows?.find((x) => x.id === id); return r?.number ? pdfUrl(id, true) : null }}
        message={error ?? (!rows ? 'Betöltés…' : !filtered.length ? (rows.length ? 'Nincs találat.' : 'Még nem készült számla a vendégeidnek.') : null)}
        pagination={filtered.length > PAGE ? <Pagination page={page} pages={pages} label={`${(page - 1) * PAGE + 1}–${Math.min(filtered.length, page * PAGE)} / ${filtered.length}`} onPage={setPage} className="mt-3 px-1" /> : undefined} />
      <ConfirmDialog open={stornoAsk} title={`${selected.length} számla sztornózása`} confirmLabel="Sztornó" busy={stornoBusy} onConfirm={() => void storno()} onCancel={() => setStornoAsk(false)} zIndexClass="z-[100]"
        description="A számlázódban (Számlázz.hu / Billingo) ellenszámla készül, a vendég e-mailben megkapja. Ez végleges, nem vonható vissza." />
      <PopupModal open={!!open} onClose={() => setOpenId(null)} panel={open ? (
        <InvoiceModal row={toRow(open)} onClose={() => setOpenId(null)} onStorno={() => { setSelected([open.id]); setOpenId(null); setStornoAsk(true) }}
          download={open.number ? pdfUrl(open.id, true) : null} openHref={open.number ? pdfUrl(open.id) : null}
          pdf={open.number ? <iframe title={`Számla ${open.number}`} src={pdfUrl(open.id)} className="h-[70vh] min-h-[420px] w-full" /> : undefined} />
      ) : undefined} />
    </>
  )
}
