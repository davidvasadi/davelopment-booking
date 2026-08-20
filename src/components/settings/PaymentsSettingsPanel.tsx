'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CreditCard, Loader2, ExternalLink, ShieldCheck, ShieldAlert, Mail, ArrowRight, FileSignature } from 'lucide-react'
import { Switch } from '@/components/ui/toggle-switch'
import { NotchedPricingCard } from '@/components/dashboard/NotchedPricingCard'
import { cn } from '@/lib/utils'
import { buttonHover, EASE } from '@/lib/motion'
import { monthlyEmailCap } from '@/lib/newsletterLimits'
import type { Pricing } from '@/lib/pricing'

/**
 * "Fizetések" panel — vendég-előleg (Stripe Connect Express), ajándékutalvány, beleegyező
 * nyilatkozat és számlázás (Számlázz.hu/Billingo) beállítása. A Deposit/Voucher/Consent/
 * Invoicing kártyák a helyi állapotukat a hub közös lebegő mentés-sávjának jelentik
 * (`onDirtyChange`/`registerApi`) — nincs saját, mindig látható "Mentés" gombjuk. A Stripe és
 * Hírlevél kártya kivétel: ott a gombok AZONNALI akciók (fiók-összekapcsolás / csomagváltás),
 * nem "szerkesztés majd mentés", ezért változatlanul saját maguk intézik a hívást.
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

export interface VoucherSettingsData {
  enabled: boolean
  minAmountHuf: number
  maxAmountHuf: number
  validityMonths: number
}

export interface ConsentSettingsData {
  enabled: boolean
  title: string
  templateText: string
}

type NewsletterPackage = 'none' | 'ingyenes' | 'alap' | 'premium'

interface Props {
  variant: 'salon' | 'restaurant'
  apiBase: string
  deposit: DepositSettingsData
  invoice: InvoiceSettingsData
  voucher: VoucherSettingsData
  consent: ConsentSettingsData
  stripeConnectAccountId: string | null
  stripeConnectOnboarded: boolean
  /** Globális árazási beállítások — a hírlevél-csomagválasztó kártyáihoz. */
  pricing: Pricing
  /** Az aktuális üzlet id-je — a csomagváltás POST-jához. */
  businessId: string
  /** A hírlevél funkció jelenlegi csomagja. */
  newsletterPackage: NewsletterPackage
  /** Mely kártyák renderelődjenek — a Beállítások-oldal több fülre is beágyazza ugyanezt a
   *  komponenst (Fizetés / API & Integrációk / Dokumentumok & jogi), mindegyik csak a rá
   *  tartozó kártyákat mutatja. Alapértelmezetten mind a hat. */
  sections?: Array<'stripe' | 'deposit' | 'voucher' | 'consent' | 'newsletter' | 'invoicing'>
  /** A LÁTHATÓ Deposit/Voucher/Consent/Invoicing kártyák összevont mentetlen-állapota — a hub
   *  közös lebegő sávjának. (A Stripe/Hírlevél kártya nem számít bele, azok azonnali akciók.) */
  onDirtyChange?: (dirty: boolean) => void
  /** A hub ezen regisztrálja ennek a példánynak a mentés/elvetés műveletét. */
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
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

const ALL_SECTIONS: NonNullable<Props['sections']> = ['stripe', 'deposit', 'voucher', 'consent', 'newsletter', 'invoicing']

export function PaymentsSettingsPanel({ variant, apiBase, deposit, invoice, voucher, consent, stripeConnectAccountId, stripeConnectOnboarded, pricing, businessId, newsletterPackage, sections = ALL_SECTIONS, onDirtyChange, registerApi }: Props) {
  const show = (s: NonNullable<Props['sections']>[number]) => sections.includes(s)
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [loginLinkLoading, setLoginLinkLoading] = useState(false)

  const [switching, setSwitching] = useState(false)
  const [pendingPackage, setPendingPackage] = useState<NewsletterPackage | null>(null)
  const newsletterEnabled = newsletterPackage !== 'none'

  const switchNewsletterPackage = async (pkg: NewsletterPackage) => {
    if (pkg === newsletterPackage || switching) return
    setSwitching(true)
    setPendingPackage(pkg)
    try {
      const res = await fetch('/api/marketing/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind: variant, businessId, package: pkg }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült váltani a csomagot.')
      toast.success('Csomag frissítve')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült váltani a csomagot.')
    } finally {
      setSwitching(false)
      setPendingPackage(null)
    }
  }
  const toggleNewsletterEnabled = (on: boolean) => switchNewsletterPackage(on ? 'ingyenes' : 'none')

  const [d, setD] = useState<DepositSettingsData>(deposit)
  const [v, setV] = useState<VoucherSettingsData>(voucher)
  const [c, setC] = useState<ConsentSettingsData>(consent)
  const [invoiceProvider, setInvoiceProvider] = useState(invoice.provider)
  const [szamlazzKeyInput, setSzamlazzKeyInput] = useState('')
  const [billingoKeyInput, setBillingoKeyInput] = useState('')

  // Csak a ténylegesen LÁTSZÓ (`sections`) kártyák dirty-je számít bele az összevont
  // állapotba — egy `sections={['consent']}` példányon a d/v/invoiceProvider mögötti state
  // sose renderelődik, tehát nem is szerkeszthető, de a biztonság kedvéért `show()`-val zárva.
  const depositDirty = show('deposit') && JSON.stringify(d) !== JSON.stringify(deposit)
  const voucherDirty = show('voucher') && JSON.stringify(v) !== JSON.stringify(voucher)
  const consentDirty = show('consent') && JSON.stringify(c) !== JSON.stringify(consent)
  const invoiceDirty = show('invoicing') && (invoiceProvider !== invoice.provider || szamlazzKeyInput.trim() !== '' || billingoKeyInput.trim() !== '')
  const dirty = depositDirty || voucherDirty || consentDirty || invoiceDirty

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    registerApi?.({
      save: async () => {
        // Védekező tisztítás mentéskor: csak a KIVÁLASZTOTT típushoz tartozó összeg-mező mehet
        // ki nem-nullként — így a DB-ben sose maradhat egy korábbi típusváltásból itt felejtett,
        // már nem releváns érték (ami a számításnál/kijelzésnél zavaró, ellentmondó állapotot okozna).
        const body: Record<string, unknown> = {}
        if (depositDirty) {
          body.deposit_settings = {
            enabled: d.enabled,
            type: d.type,
            fixed_amount_huf: d.type === 'fixed' ? d.fixedAmountHuf : null,
            percent_value: d.type === 'percent' ? d.percentValue : null,
            per_pax_amount_huf: d.type === 'per_pax' ? d.perPaxAmountHuf : null,
            refund_hours_before: d.refundHoursBefore,
            payment_gateway: 'stripe',
          }
        }
        if (voucherDirty) {
          body.voucher_settings = {
            enabled: v.enabled,
            min_amount_huf: v.minAmountHuf,
            max_amount_huf: v.maxAmountHuf,
            validity_months: v.validityMonths,
          }
        }
        if (consentDirty) {
          body.consent_settings = { enabled: c.enabled, title: c.title, template_text: c.templateText }
        }
        if (invoiceDirty) {
          // A kulcs-mezőket CSAK akkor küldjük, ha a user írt bele valamit — üresen hagyva a
          // MEGLÉVŐ (titkosított) érték marad, nem íródik felül üresre.
          const invoice_settings: Record<string, unknown> = { invoice_provider: invoiceProvider }
          if (szamlazzKeyInput.trim()) invoice_settings.szamlazz_agent_key_enc = szamlazzKeyInput.trim()
          if (billingoKeyInput.trim()) invoice_settings.billingo_api_key_enc = billingoKeyInput.trim()
          body.invoice_settings = invoice_settings
        }
        if (Object.keys(body).length === 0) return true
        try {
          const res = await fetch(apiBase, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error()
          setSzamlazzKeyInput('')
          setBillingoKeyInput('')
          return true
        } catch {
          toast.error('Hiba történt')
          return false
        }
      },
      discard: () => {
        setD(deposit)
        setV(voucher)
        setC(consent)
        setInvoiceProvider(invoice.provider)
        setSzamlazzKeyInput('')
        setBillingoKeyInput('')
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, v, c, invoiceProvider, szamlazzKeyInput, billingoKeyInput, deposit, voucher, consent, invoice])

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

  return (
    <div className="space-y-4">
      {/* Stripe Connect állapot */}
      {show('stripe') && (
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
      )}

      {/* Hírlevél */}
      {show('newsletter') && (
      <div className="rounded-[26px] dav-card-glass px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-ink-dark">
              <Mail className="h-[18px] w-[18px] text-gold" strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[15px] font-medium text-ink">Hírlevél</div>
              <div className="text-[13px] text-ink-soft">A foglaló-oldalon megjelenik egy feliratkozó kapcsoló a vendégeidnek.</div>
            </div>
          </div>
          <Switch checked={newsletterEnabled} onChange={toggleNewsletterEnabled} disabled={switching} ariaLabel="Hírlevél funkció be/ki" />
        </div>

        {newsletterEnabled && (
          <div className="grid grid-cols-1 items-stretch gap-5 border-t border-dashed border-line pt-4 md:grid-cols-3">
            {([
              { key: 'ingyenes' as const, label: 'Ingyenes', sub: 'Kezdéshez', priceMain: '0', priceUnit: 'Ft / hó', marketingLabel: 'Ingyen', dotColor: '#A8A496', cap: monthlyEmailCap(pricing, 'ingyenes') },
              { key: 'alap' as const, label: 'Alap', sub: 'Rendszeres kampányokhoz', priceMain: pricing.newsletter_alap_huf.toLocaleString('hu-HU'), priceUnit: 'Ft / hó', marketingLabel: 'Népszerű', dotColor: '#F1CE45', cap: monthlyEmailCap(pricing, 'alap') },
              { key: 'premium' as const, label: 'Prémium', sub: 'Nagy forgalmú üzleteknek', priceMain: pricing.newsletter_premium_huf.toLocaleString('hu-HU'), priceUnit: 'Ft / hó', marketingLabel: 'Bővebb', dotColor: '#1D1C19', cap: monthlyEmailCap(pricing, 'premium') },
            ]).map((card) => {
              const alapCap = monthlyEmailCap(pricing, 'alap')
              const premiumCap = monthlyEmailCap(pricing, 'premium')
              const selected = newsletterPackage === card.key
              const featured = card.key === 'alap'
              const isPending = switching && pendingPackage === card.key
              const badgeLabel = selected ? 'Aktív' : card.marketingLabel
              const feats = [
                { label: 'Feliratkozó kapcsoló a foglaló-oldalon', included: true },
                { label: 'Márkázott, saját logós email-sablon', included: true },
                { label: 'Kampány-előzmény és nyitási statisztika', included: true },
                { label: `Legalább ${alapCap.toLocaleString('hu-HU')} email/hó keret`, included: card.cap >= alapCap },
                { label: `Legalább ${premiumCap.toLocaleString('hu-HU')} email/hó keret`, included: card.cap >= premiumCap },
              ]
              const cta = (
                <motion.button
                  type="button"
                  disabled={selected || switching}
                  onClick={() => switchNewsletterPackage(card.key)}
                  variants={buttonHover}
                  initial="rest"
                  whileHover={selected || switching ? undefined : 'hover'}
                  className={cn(
                    'flex h-11 w-full items-center rounded-full text-[13.5px] font-medium transition-opacity hover:opacity-90 disabled:opacity-90',
                    selected ? 'justify-center border border-dashed' : 'justify-between pl-5 pr-1.5',
                    featured
                      ? (selected ? 'border-white/25 text-white' : 'bg-white text-ink-dark')
                      : (selected ? 'border-line-strong text-ink' : 'bg-ink-dark text-white'),
                  )}
                >
                  {selected ? 'Jelenlegi csomagod' : 'Váltás erre'}
                  {!selected && (
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold">
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-dark" />
                      ) : (
                        <>
                          <motion.div className="absolute flex" variants={{ rest: { x: 0 }, hover: { x: 32 } }} transition={{ duration: 0.28, ease: EASE }}>
                            <ArrowRight className="h-3.5 w-3.5 text-ink-dark" />
                          </motion.div>
                          <motion.div className="absolute flex" variants={{ rest: { x: -32 }, hover: { x: 0 } }} transition={{ duration: 0.28, ease: EASE }}>
                            <ArrowRight className="h-3.5 w-3.5 text-ink-dark" />
                          </motion.div>
                        </>
                      )}
                    </span>
                  )}
                </motion.button>
              )
              return (
                <div key={card.key} className="h-full">
                  <NotchedPricingCard
                    featured={featured}
                    badgeLabel={badgeLabel}
                    dotColor={card.dotColor}
                    title={card.label}
                    priceMain={card.priceMain}
                    priceUnit={card.priceUnit}
                    sub={card.sub}
                    feats={feats}
                    cta={cta}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* Előleg-szabály */}
      {show('deposit') && (
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
      </div>
      )}

      {/* Ajándékutalvány */}
      {show('voucher') && (
      <div className="rounded-[26px] dav-card-glass px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium text-ink">Ajándékutalvány</div>
            <div className="text-[13px] text-ink-soft">A típusok kezelése és az eladott utalványok a dashboard "Utalványok" oldalán érhetők el.</div>
          </div>
          <Toggle checked={v.enabled} onChange={() => setV((s) => ({ ...s, enabled: !s.enabled }))} />
        </div>

        {v.enabled && (
          <div className="space-y-3 border-t border-dashed border-line pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Min. összeg (Ft)</label>
                <input
                  type="number" min={0}
                  value={v.minAmountHuf}
                  onChange={(e) => setV((s) => ({ ...s, minAmountHuf: Number(e.target.value) || 0 }))}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Max. összeg (Ft)</label>
                <input
                  type="number" min={0}
                  value={v.maxAmountHuf}
                  onChange={(e) => setV((s) => ({ ...s, maxAmountHuf: Number(e.target.value) || 0 }))}
                  className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Érvényesség (hónap)</label>
              <input
                type="number" min={1}
                value={v.validityMonths}
                onChange={(e) => setV((s) => ({ ...s, validityMonths: Number(e.target.value) || 1 }))}
                className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
              />
              <p className="mt-1 text-[12px] text-ink-soft2">A vásárlástól számítva ennyi hónapig váltható be az utalvány.</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Beleegyező nyilatkozat */}
      {show('consent') && (
      <div className="rounded-[26px] dav-card-glass px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-ink-dark">
              <FileSignature className="h-[18px] w-[18px] text-gold" strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[15px] font-medium text-ink">Beleegyező nyilatkozat</div>
              <div className="text-[13px] text-ink-soft">A vendégnek el kell fogadnia a foglalás véglegesítéséhez — vagy helyszínen, check-inkor.</div>
            </div>
          </div>
          <Toggle checked={c.enabled} onChange={() => setC((s) => ({ ...s, enabled: !s.enabled }))} />
        </div>

        {c.enabled && (
          <div className="space-y-3 border-t border-dashed border-line pt-4">
            <div className="space-y-1.5">
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Nyilatkozat címe</label>
              <input
                type="text"
                name="consent-title"
                autoComplete="off"
                value={c.title}
                onChange={(e) => setC((s) => ({ ...s, title: e.target.value }))}
                placeholder="Beleegyező nyilatkozat"
                className="w-full rounded-[12px] border border-line-strong bg-white px-3.5 py-2.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Nyilatkozat szövege</label>
              {!c.templateText.trim() && (
                <button
                  type="button"
                  onClick={() => setC((s) => ({
                    ...s,
                    templateText:
                      'Kijelentem, hogy az általam igénybe vett kezeléssel/szolgáltatással kapcsolatos kockázatokról tájékoztatást kaptam, ' +
                      'egészségügyi állapotomról (allergia, gyógyszerérzékenység, bőrprobléma stb.) a valóságnak megfelelően nyilatkoztam, ' +
                      'és a szolgáltatás elvégzéséhez hozzájárulok.',
                  }))}
                  className="text-[12px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
                >
                  Sablon betöltése
                </button>
              )}
            </div>
            <textarea
              rows={5}
              value={c.templateText}
              onChange={(e) => setC((s) => ({ ...s, templateText: e.target.value }))}
              placeholder="Ezt a szöveget látja majd a vendég elfogadásra…"
              className="w-full rounded-[12px] border border-line-strong bg-white px-3.5 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
            />
            <p className="text-[12px] text-ink-soft2">
              A vendég a foglalás során fogadja el (kapcsolóval), vagy a személyzet a helyszínen, tableten íratja alá vele érkezéskor — mindkét
              elfogadás dátummal, IP-vel és a pontos szöveg-verzióval mentődik a foglaláshoz.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Számlázás */}
      {show('invoicing') && (
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
      </div>
      )}
    </div>
  )
}
