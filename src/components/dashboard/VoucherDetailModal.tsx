'use client'

import { useEffect, useState } from 'react'
import { Loader2, Copy, Check, X, Gift, UserRound, Receipt, FileText } from 'lucide-react'
import { PopupModal } from '@/components/ui/popup-modal'
import { SectionBar, FieldRow } from '@/components/shared/FormSheet'
import { formatPrice } from '@/lib/utils'

/**
 * Egy kiállított utalvány részletes nézete (Utalványok lista → sorra kattintva) — szalon és
 * étterem közös. Adatlap-stílus (FormSheet), mint az új utalvány / új foglalás ablak:
 * balra az utalvány + fizetés/számla, jobbra a vásárló, a megajándékozott és a QR-kód.
 */

type Detail = {
  id: string
  code: string
  amount_huf: number
  type_name: string | null
  status: 'active' | 'redeemed' | 'expired' | 'refunded'
  payment_method: string | null
  purchaser_name: string
  purchaser_email: string
  recipient_name: string | null
  recipient_email: string | null
  message: string | null
  expires_at: string
  redeemed_at: string | null
  redeemed_for: { date: string | null; time: string | null; name: string | null } | null
  invoice_status: 'none' | 'issued' | 'failed' | 'skipped'
  issued_by: { name: string | null; email: string | null; avatarUrl: string | null } | null
  invoice_number: string | null
  invoice_pdf_url: string | null
  qr_code_url: string | null
  createdAt: string
}

const STATUS: Record<Detail['status'], { label: string; bg: string; color: string }> = {
  active: { label: 'Aktív', bg: '#E7F1E9', color: '#3B6B4B' },
  redeemed: { label: 'Beváltva', bg: '#EFF3FB', color: '#3B5BB5' },
  expired: { label: 'Lejárt', bg: '#F1EEE6', color: '#8A8779' },
  refunded: { label: 'Visszatérítve', bg: '#FBEEEE', color: '#B5473B' },
}

const fmt = (iso?: string | null, withTime = false) =>
  iso ? new Date(iso).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '—'

export function VoucherDetailModal({ voucherId, onClose, paymentLabels }: { voucherId: string | null; onClose: () => void; paymentLabels: Record<string, string> }) {
  const [d, setD] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!voucherId) return
    let cancelled = false
    setD(null)
    setError(null)
    fetch(`/api/gift-vouchers/${voucherId}`, { credentials: 'include' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Nem sikerült betölteni'); return j })
      .then((j) => { if (!cancelled) setD(j) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Nem sikerült betölteni') })
    return () => { cancelled = true }
  }, [voucherId])

  const copy = async () => {
    if (!d) return
    await navigator.clipboard.writeText(d.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const text = 'text-[14px] text-ink'
  const st = d ? STATUS[d.status] : null

  return (
    <PopupModal open={!!voucherId} onClose={onClose} title={d?.code ?? 'Utalvány'} subtitle="Utalvány részletei" maxWidth="sm:max-w-[760px] lg:max-w-[1000px]">
      {error ? (
        <p className="py-8 text-center text-[13px] text-[#C0453F]">{error}</p>
      ) : !d ? (
        <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Betöltés…</div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
          {/* ── BAL: utalvány + fizetés/számla ── */}
          <div className="space-y-5">
            <section>
              <SectionBar icon={Gift} label="Utalvány" />
              <FieldRow label="Kód">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[14px] font-semibold tracking-wide text-ink">{d.code}</span>
                  <button type="button" onClick={copy} aria-label="Kód másolása" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper hover:text-ink">
                    {copied ? <Check className="h-4 w-4 text-[#1D7A4C]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </FieldRow>
              <FieldRow label="Típus"><span className={text}>{d.type_name ?? '—'}</span></FieldRow>
              <FieldRow label="Összeg"><span className={`${text} font-semibold`}>{formatPrice(d.amount_huf, 'HUF')}</span></FieldRow>
              <FieldRow label="Státusz">
                {st && <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>}
              </FieldRow>
              <FieldRow label="Kiállítva"><span className={text}>{fmt(d.createdAt, true)}</span></FieldRow>
              <FieldRow label="Kiállította">
                {d.issued_by ? (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    {/* kis avatar (Google-profilkép), ennek hiányában monogram */}
                    {d.issued_by.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.issued_by.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-dark text-[10px] font-semibold text-white">
                        {(d.issued_by.name || d.issued_by.email || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </span>
                    )}
                    <span className={`${text} truncate`}>{d.issued_by.name || d.issued_by.email}</span>
                  </span>
                ) : (
                  <span className={d.payment_method === 'online' ? text : 'text-[14px] text-ink-soft2'}>
                    {d.payment_method === 'online' ? 'A vendég vásárolta online, a foglalóoldalon' : 'Nincs rögzítve'}
                  </span>
                )}
              </FieldRow>
              <FieldRow label="Lejárat" last={d.status !== 'redeemed'}><span className={text}>{fmt(d.expires_at)}</span></FieldRow>
              {d.status === 'redeemed' && (
                <FieldRow
                  label="Beváltva"
                  last
                  hint={d.redeemed_for ? `Foglaláshoz: ${[d.redeemed_for.date ? fmt(d.redeemed_for.date) : null, d.redeemed_for.time, d.redeemed_for.name].filter(Boolean).join(' · ')}` : 'Helyszíni beváltás'}
                >
                  <span className={text}>{fmt(d.redeemed_at, true)}</span>
                </FieldRow>
              )}
            </section>

            <section>
              <SectionBar icon={Receipt} label="Fizetés és számla" />
              <FieldRow label="Fizetés"><span className={text}>{paymentLabels[d.payment_method ?? 'unknown'] ?? paymentLabels.unknown}</span></FieldRow>
              <FieldRow
                label="Számla"
                last
                hint={d.invoice_status === 'failed' ? 'A számla kiállítása nem sikerült — állítsd ki kézzel a számlázó fiókodban.' : d.invoice_status === 'none' ? 'Nem készült számla (nincs bekötve számlázó, vagy még folyamatban).' : d.invoice_status === 'skipped' ? 'Kiállításkor kikapcsolták (pl. pénztárgépből számláztak).' : undefined}
                hintTone={d.invoice_status === 'failed' ? 'bad' : 'muted'}
              >
                {d.invoice_status === 'issued' ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#1D7A4C]"><Check className="h-4 w-4" strokeWidth={2.4} /> {d.invoice_number ?? 'Kiállítva'}</span>
                    {d.invoice_pdf_url && (
                      <a href={d.invoice_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft hover:text-ink">
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </a>
                    )}
                  </div>
                ) : d.invoice_status === 'skipped' ? (
                  <span className="text-[14px] text-ink">Nem kért számlát</span>
                ) : d.invoice_status === 'failed' ? (
                  <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#C0453F]"><X className="h-4 w-4" strokeWidth={2.4} /> Sikertelen</span>
                ) : (
                  <span className="text-[14px] text-ink-soft2">—</span>
                )}
              </FieldRow>
            </section>
          </div>

          {/* ── JOBB: vásárló + megajándékozott + QR ── */}
          <div className="space-y-5">
            <section>
              <SectionBar icon={UserRound} label="Vásárló" />
              <FieldRow label="Név"><span className={text}>{d.purchaser_name}</span></FieldRow>
              <FieldRow label="Email" last>
                <a href={`mailto:${d.purchaser_email}`} className={`${text} block truncate hover:underline`}>{d.purchaser_email}</a>
              </FieldRow>
            </section>
            <section>
              <SectionBar icon={Gift} label="Megajándékozott" />
              <FieldRow label="Név"><span className={d.recipient_name ? text : 'text-[14px] text-ink-soft2'}>{d.recipient_name ?? '—'}</span></FieldRow>
              <FieldRow label="Email">
                {d.recipient_email ? <a href={`mailto:${d.recipient_email}`} className={`${text} block truncate hover:underline`}>{d.recipient_email}</a> : <span className="text-[14px] text-ink-soft2">—</span>}
              </FieldRow>
              <FieldRow label="Üzenet" stacked last>
                <p className={`${d.message ? 'text-ink' : 'text-ink-soft2'} whitespace-pre-wrap text-[14px] leading-relaxed [overflow-wrap:anywhere]`}>{d.message || '—'}</p>
              </FieldRow>
            </section>
            {d.qr_code_url && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.qr_code_url} alt={`QR-kód: ${d.code}`} className="h-36 w-36 rounded-[12px]" />
              </div>
            )}
          </div>
        </div>
      )}
    </PopupModal>
  )
}
