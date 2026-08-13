'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Loader2, ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react'

/**
 * "Fizetések" panel — vendég-előleg (Stripe Connect Express) + számlázás (Számlázz.hu/Billingo)
 * beállítása. Önálló, beágyazott (embedded) komponens, mint az `IntegrationsPanel`/
 * `BookingFeatures` — a saját PATCH-jét maga intézi az `apiBase`-re, nem a SettingsHub közös
 * lebegő mentés-sávján keresztül.
 */

type DepositType = 'fixed' | 'percent' | 'per_pax'

export interface DepositSettingsData {
  enabled: boolean
  type: DepositType
  fixedAmountHuf: number | null
  percentValue: number | null
  perPaxAmountHuf: number | null
  refundHoursBefore: number
}

export interface InvoiceSettingsData {
  provider: 'szamlazz' | 'billingo' | 'none'
  hasSzamlazzKey: boolean
  hasBillingoKey: boolean
}

interface Props {
  variant: 'salon' | 'restaurant'
  apiBase: string
  deposit: DepositSettingsData
  invoice: InvoiceSettingsData
  stripeConnectAccountId: string | null
  stripeConnectOnboarded: boolean
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${checked ? 'bg-ink-dark' : 'bg-[#DAD5C6]'}`}
    >
      <span className={`absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow-sm transition-all ${checked ? 'right-[3px]' : 'left-[3px]'}`} />
    </button>
  )
}

export function PaymentsSettingsPanel({ variant, apiBase, deposit, invoice, stripeConnectAccountId, stripeConnectOnboarded }: Props) {
  const [connecting, setConnecting] = useState(false)
  const [loginLinkLoading, setLoginLinkLoading] = useState(false)

  const [d, setD] = useState<DepositSettingsData>(deposit)
  const [saving, setSaving] = useState(false)

  const [invoiceProvider, setInvoiceProvider] = useState(invoice.provider)
  const [szamlazzKeyInput, setSzamlazzKeyInput] = useState('')
  const [billingoKeyInput, setBillingoKeyInput] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  const startOnboarding = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/stripe/connect/onboard', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'Nem sikerült elindítani a Stripe onboardingot.')
      window.location.href = json.url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
      setConnecting(false)
    }
  }

  const openStripeDashboard = async () => {
    setLoginLinkLoading(true)
    try {
      const res = await fetch('/api/stripe/connect/login-link', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'Nem sikerült megnyitni a Stripe fiókot.')
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setLoginLinkLoading(false)
    }
  }

  const saveDeposit = async () => {
    setSaving(true)
    try {
      // Védekező tisztítás mentéskor: csak a KIVÁLASZTOTT típushoz tartozó összeg-mező mehet
      // ki nem-nullként — így a DB-ben sose maradhat egy korábbi típusváltásból itt felejtett,
      // már nem releváns érték (ami a számításnál/kijelzésnél zavaró, ellentmondó állapotot okozna).
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deposit_settings: {
            enabled: d.enabled,
            type: d.type,
            fixed_amount_huf: d.type === 'fixed' ? d.fixedAmountHuf : null,
            percent_value: d.type === 'percent' ? d.percentValue : null,
            per_pax_amount_huf: d.type === 'per_pax' ? d.perPaxAmountHuf : null,
            refund_hours_before: d.refundHoursBefore,
            payment_gateway: 'stripe',
          },
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Mentve')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSaving(false)
    }
  }

  const saveInvoiceSettings = async () => {
    setSavingInvoice(true)
    try {
      // A kulcs-mezőket CSAK akkor küldjük, ha a user írt bele valamit — üresen hagyva a
      // MEGLÉVŐ (titkosított) érték marad, nem íródik felül üresre.
      const body: Record<string, unknown> = { invoice_settings: { invoice_provider: invoiceProvider } }
      if (szamlazzKeyInput.trim()) (body.invoice_settings as Record<string, unknown>).szamlazz_agent_key_enc = szamlazzKeyInput.trim()
      if (billingoKeyInput.trim()) (body.invoice_settings as Record<string, unknown>).billingo_api_key_enc = billingoKeyInput.trim()
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast.success('Mentve')
      setSzamlazzKeyInput('')
      setBillingoKeyInput('')
    } catch {
      toast.error('Hiba történt')
    } finally {
      setSavingInvoice(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Stripe Connect állapot */}
      <div className="rounded-[26px] dav-card-glass px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-ink-dark">
            <CreditCard className="h-[18px] w-[18px] text-gold" strokeWidth={1.6} />
          </div>
          <div>
            <div className="text-[15px] font-medium text-ink">Stripe fizetési fiók</div>
            <div className="text-[13px] text-ink-soft">A vendég-előleg egyenesen ide érkezik — a platform sosem kezeli a pénzedet.</div>
          </div>
        </div>
        <div className="mt-4">
          {stripeConnectOnboarded ? (
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#2F7A3C]">
                <ShieldCheck className="h-4 w-4" /> Csatlakoztatva
              </span>
              <button
                type="button"
                onClick={openStripeDashboard}
                disabled={loginLinkLoading}
                className="inline-flex items-center gap-1.5 rounded-[12px] border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-60"
              >
                {loginLinkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                Fiók kezelése a Stripe-on
              </button>
            </div>
          ) : (
            <div>
              {stripeConnectAccountId && (
                <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-medium text-[#B45309]">
                  <ShieldAlert className="h-4 w-4" /> Az onboarding félbemaradt — folytasd, hogy előleget tudj fogadni.
                </p>
              )}
              <button
                type="button"
                onClick={startOnboarding}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-[14px] bg-ink-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {stripeConnectAccountId ? 'Onboarding folytatása' : 'Stripe fiók összekapcsolása'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Előleg-szabály */}
      <div className="rounded-[26px] dav-card-glass px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium text-ink">Vendég-előleg</div>
            <div className="text-[13px] text-ink-soft">A vendégnek fizetnie kell a foglalás véglegesítéséhez.</div>
          </div>
          <Toggle checked={d.enabled} onChange={() => setD((s) => ({ ...s, enabled: !s.enabled }))} />
        </div>

        {d.enabled && (
          <div className="space-y-3 border-t border-dashed border-line pt-4">
            {/* Étteremnél nincs értelmes alapja a %-nak/fejenkéntinek a jelenlegi egyszerűsített
                körben — csak egy sima Ft-összeg kérünk, típus-választó nélkül. Szalonnál marad
                a Fix/Százalék választás, mert ott van ár-alap (service.price). */}
            {variant === 'salon' && (
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Típus</label>
                <div className="mt-1.5 flex gap-2">
                  {/* Típusváltáskor a MÁSIK típus mezőjét nullázzuk — különben egy korábbi
                      kísérlet (pl. beírt százalék) némán ottmarad a DB-ben, miközben a UI már
                      fixet mutat, ami zavaró, ellentmondó állapotot eredményez mentéskor. */}
                  <button
                    type="button"
                    onClick={() => setD((s) => ({ ...s, type: 'fixed', percentValue: null }))}
                    className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${d.type === 'fixed' ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft'}`}
                  >
                    Fix összeg
                  </button>
                  <button
                    type="button"
                    onClick={() => setD((s) => ({ ...s, type: 'percent', fixedAmountHuf: null }))}
                    className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${d.type === 'percent' ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft'}`}
                  >
                    Százalék
                  </button>
                </div>
              </div>
            )}

            {variant === 'salon' && d.type === 'fixed' && (
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Összeg (Ft)</label>
                <input
                  type="number" min={0}
                  value={d.fixedAmountHuf ?? ''}
                  onChange={(e) => setD((s) => ({ ...s, fixedAmountHuf: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                />
              </div>
            )}
            {variant === 'salon' && d.type === 'percent' && (
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Százalék (%)</label>
                <input
                  type="number" min={1} max={100}
                  value={d.percentValue ?? ''}
                  onChange={(e) => setD((s) => ({ ...s, percentValue: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                />
              </div>
            )}
            {variant === 'restaurant' && (
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Összeg (Ft)</label>
                <input
                  type="number" min={0}
                  value={d.fixedAmountHuf ?? ''}
                  onChange={(e) => setD((s) => ({ ...s, type: 'fixed', fixedAmountHuf: e.target.value ? Number(e.target.value) : null }))}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                />
              </div>
            )}

            <div>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Ingyenes lemondás határideje (óra a foglalás előtt)</label>
              <input
                type="number" min={0}
                value={d.refundHoursBefore}
                onChange={(e) => setD((s) => ({ ...s, refundHoursBefore: Number(e.target.value) || 0 }))}
                className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
              />
              <p className="mt-1 text-[12px] text-ink-soft2">Ennyi órával a foglalás előtt még teljes visszatérítés jár — utána az előleg az üzletnél marad.</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveDeposit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-[12px] bg-ink-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Mentés
          </button>
        </div>
      </div>

      {/* Számlázás */}
      <div className="rounded-[26px] dav-card-glass px-6 py-5 space-y-3.5">
        <div>
          <div className="text-[15px] font-medium text-ink">Számlázás az előlegről</div>
          <div className="text-[13px] text-ink-soft">Sikeres előleg-fizetés után automatikus bizonylat a saját Számlázz.hu/Billingo fiókodból.</div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setInvoiceProvider('szamlazz')} className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${invoiceProvider === 'szamlazz' ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft'}`}>Számlázz.hu</button>
          <button type="button" onClick={() => setInvoiceProvider('billingo')} className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${invoiceProvider === 'billingo' ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft'}`}>Billingo</button>
          <button type="button" onClick={() => setInvoiceProvider('none')} className={`rounded-[10px] border px-3 py-1.5 text-[13px] font-medium ${invoiceProvider === 'none' ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft'}`}>Nincs</button>
        </div>

        {invoiceProvider === 'szamlazz' && (
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Számlázz.hu Agent kulcs</label>
            <input
              type="password"
              value={szamlazzKeyInput}
              onChange={(e) => setSzamlazzKeyInput(e.target.value)}
              placeholder={invoice.hasSzamlazzKey ? '•••••••• beállítva — cserére írj be új kulcsot' : 'Agent kulcs beillesztése'}
              className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          </div>
        )}
        {invoiceProvider === 'billingo' && (
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Billingo API kulcs</label>
            <input
              type="password"
              value={billingoKeyInput}
              onChange={(e) => setBillingoKeyInput(e.target.value)}
              placeholder={invoice.hasBillingoKey ? '•••••••• beállítva — cserére írj be új kulcsot' : 'API kulcs beillesztése'}
              className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveInvoiceSettings}
            disabled={savingInvoice}
            className="inline-flex items-center gap-2 rounded-[12px] bg-ink-dark px-4 py-2.5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {savingInvoice && <Loader2 className="h-4 w-4 animate-spin" />}
            Mentés
          </button>
        </div>
      </div>
    </div>
  )
}
