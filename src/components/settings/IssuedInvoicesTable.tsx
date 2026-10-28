'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, ChevronDown, ExternalLink } from 'lucide-react'
import { PopupModal } from '@/components/ui/popup-modal'
import { SectionBar, FieldRow } from '@/components/shared/FormSheet'
import { Receipt } from 'lucide-react'
import { DataTableCard, DataTableHead, StatusDot, tableActionCls, type StatusTone } from '@/components/shared/DataTable'
import type { IssuedInvoice } from '@/app/api/invoicing/issued/route'

/**
 * A VENDÉGEKNEK kiállított számlák (előleg + ajándékutalvány) — Beállítások → Fizetés & számlázás.
 * A referencia-táblázat nyelvén (DataTable): cím + kereső + típus/állapot szűrő, szürke fejléc-sáv,
 * státusz pötty + szöveg. Mobilon kártya-sorok.
 */

const COLS = 'md:grid-cols-[1.1fr_1.6fr_1.3fr_0.9fr_0.9fr_1fr_44px]'
const STATUS: Record<IssuedInvoice['status'], { tone: StatusTone; label: string }> = {
  issued: { tone: 'ok', label: 'Kiállítva' },
  failed: { tone: 'bad', label: 'Sikertelen' },
  skipped: { tone: 'muted', label: 'Nem kért' },
}
const PAGE = 10
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' })
const ft = (n: number) => `${n.toLocaleString('hu-HU')} Ft`

export function IssuedInvoicesTable({ variant, businessId }: { variant: 'salon' | 'restaurant'; businessId: string }) {
  const [rows, setRows] = useState<IssuedInvoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'deposit' | 'voucher'>('all')
  const [status, setStatus] = useState<'all' | IssuedInvoice['status']>('all')
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<IssuedInvoice | null>(null)
  // PDF: a tárolt link, vagy az üzlet Számlázz.hu fiókjából lekérve (`/api/invoicing/pdf`)
  const pdfUrl = (r: IssuedInvoice, download = false) => `/api/invoicing/pdf?kind=${variant}&id=${encodeURIComponent(businessId)}&ref=${encodeURIComponent(r.id)}${download ? '&download=1' : ''}`

  useEffect(() => {
    fetch(`/api/invoicing/issued?kind=${variant}&id=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Nem sikerült betölteni'); return j })
      .then((j) => setRows(j.rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Nem sikerült betölteni'))
  }, [variant, businessId])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (type === 'all' || r.type === type) &&
      (status === 'all' || r.status === status) &&
      (!s || [r.customer, r.email, r.number, r.source].some((x) => (x ?? '').toLowerCase().includes(s))),
    )
  }, [rows, q, type, status])
  useEffect(() => setShown(PAGE), [q, type, status])

  const failedCount = (rows ?? []).filter((r) => r.status === 'failed').length
  const selectCls = `${tableActionCls} cursor-pointer appearance-none pr-8`

  return (
    <DataTableCard
      title="Kiállított számlák"
      search={{ value: q, onChange: setQ, placeholder: 'Vevő, számlaszám…' }}
      actions={
        <>
          <span className="relative">
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={selectCls} aria-label="Típus">
              <option value="all">Minden típus</option>
              <option value="deposit">Előleg</option>
              <option value="voucher">Ajándékutalvány</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </span>
          <span className="relative">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={selectCls} aria-label="Állapot">
              <option value="all">Minden állapot</option>
              <option value="issued">Kiállítva</option>
              <option value="failed">Sikertelen{failedCount ? ` (${failedCount})` : ''}</option>
              <option value="skipped">Nem kért</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft" />
          </span>
        </>
      }
    >
      <p className="-mt-2 mb-3 text-[12.5px] text-ink-soft">A vendégeidnek a saját számlázó fiókodból kiállított számlák — előlegek és ajándékutalványok.</p>
      <DataTableHead cols={COLS} labels={['Számlaszám', 'Tétel', 'Vevő', 'Dátum', 'Összeg', 'Állapot', '']} />
      {error ? (
        <p className="py-8 text-center text-[13px] text-[#C0392B]">{error}</p>
      ) : !rows ? (
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Betöltés…</div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-ink-soft">{rows.length === 0 ? 'Még nem készült számla a vendégeidnek.' : 'Nincs találat.'}</p>
      ) : (
        <>
          {filtered.slice(0, shown).map((r) => {
            const st = STATUS[r.status]
            return (
              <div key={r.id}>
                {/* DESKTOP sor */}
                <div role="button" tabIndex={0} onClick={() => setOpen(r)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(r) }} className={`hidden ${COLS} cursor-pointer items-center gap-3 rounded-[10px] px-3 py-3 text-[13.5px] transition-colors hover:bg-[#F7F7F7] md:grid`}>
                  <span className="truncate font-semibold text-ink">{r.number ?? '—'}</span>
                  <span className="truncate text-ink">{r.source}</span>
                  <span className="truncate text-ink" title={r.email ?? undefined}>{r.customer}</span>
                  <span className="text-ink">{fmtDate(r.date)}</span>
                  <span className="text-ink">{ft(r.amountHuf)}</span>
                  <StatusDot tone={st.tone}>{st.label}</StatusDot>
                  {r.status === 'issued' && r.number ? (
                    <a href={pdfUrl(r, true)} onClick={(e) => e.stopPropagation()} title="PDF letöltése" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white hover:text-ink">
                      <Download className="h-4 w-4" />
                    </a>
                  ) : <span />}
                </div>
                {/* MOBIL sor */}
                <div role="button" tabIndex={0} onClick={() => setOpen(r)} className="flex cursor-pointer items-start justify-between gap-3 border-b border-line py-3 last:border-0 md:hidden">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">{r.customer}</p>
                    <p className="truncate text-[12px] text-ink-soft">{r.source}</p>
                    <p className="text-[12px] text-ink-soft">{r.number ?? '—'} · {fmtDate(r.date)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[14px] font-medium text-ink">{ft(r.amountHuf)}</span>
                    <StatusDot tone={st.tone}>{st.label}</StatusDot>

                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length > shown && (
            <div className="pt-3 text-center">
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className={tableActionCls}>További {Math.min(PAGE, filtered.length - shown)} számla</button>
            </div>
          )}
        </>
      )}
      {/* Számla megnyitása: adatok + PDF-előnézet (a számlázó fiókodból) */}
      <PopupModal open={!!open} onClose={() => setOpen(null)} title={open?.number ?? 'Számla'} subtitle={open?.source} maxWidth="sm:max-w-[760px] lg:max-w-[1100px]">
        {open && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
            <section>
              <SectionBar icon={Receipt} label="Számla" />
              <FieldRow label="Számlaszám"><span className="text-[14px] font-semibold text-ink">{open.number ?? '—'}</span></FieldRow>
              <FieldRow label="Tétel"><span className="text-[14px] text-ink">{open.source}</span></FieldRow>
              <FieldRow label="Vevő"><span className="block truncate text-[14px] text-ink">{open.customer}</span></FieldRow>
              {open.email && <FieldRow label="Email"><a href={`mailto:${open.email}`} className="block truncate text-[14px] text-ink hover:underline">{open.email}</a></FieldRow>}
              <FieldRow label="Dátum"><span className="text-[14px] text-ink">{fmtDate(open.date)}</span></FieldRow>
              <FieldRow label="Összeg"><span className="text-[14px] font-semibold text-ink">{ft(open.amountHuf)}</span></FieldRow>
              <FieldRow
                label="Állapot"
                last
                hint={open.status === 'failed' ? 'A kiállítás nem sikerült — állítsd ki kézzel a számlázó fiókodban.' : open.status === 'skipped' ? 'Kiállításkor kikapcsolták (pl. pénztárgépből számláztak).' : undefined}
                hintTone={open.status === 'failed' ? 'bad' : 'muted'}
              >
                <StatusDot tone={STATUS[open.status].tone}>{STATUS[open.status].label}</StatusDot>
              </FieldRow>
              {open.status === 'issued' && open.number && (
                <div className="mt-4 flex flex-wrap gap-2 px-3">
                  <a href={pdfUrl(open, true)} className={tableActionCls}><Download className="h-4 w-4" /> Letöltés</a>
                  <a href={pdfUrl(open)} target="_blank" rel="noopener noreferrer" className={tableActionCls}><ExternalLink className="h-4 w-4" /> Új lapon</a>
                </div>
              )}
            </section>
            <div className="min-h-[420px] overflow-hidden rounded-[16px] border border-line bg-[#F7F7F7]">
              {open.status === 'issued' && open.number ? (
                <iframe title={`Számla ${open.number}`} src={pdfUrl(open)} className="h-[70vh] min-h-[420px] w-full" />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center p-6 text-center text-[13px] text-ink-soft">Ehhez a tételhez nincs PDF.</div>
              )}
            </div>
          </div>
        )}
      </PopupModal>
    </DataTableCard>
  )
}
