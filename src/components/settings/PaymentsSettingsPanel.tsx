'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Loader2, ExternalLink, ShieldCheck, ShieldAlert, Mail, FileSignature } from 'lucide-react'
import { monthlyEmailCapForTier, resolveTier } from '@/lib/tier'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import type { Pricing } from '@/lib/pricing'
import { Toggle } from './SettingsToggle'
import { LocaleEditBar } from './LocaleEditBar'
import { consentTemplate } from './contentTemplates'

/**
 * "Fizetések" panel — vendég-előleg (Stripe Connect Express), ajándékutalvány, beleegyező
 * nyilatkozat és számlázás (Számlázz.hu/Billingo) beállítása. A Deposit/Voucher/Consent/
 * Invoicing kártyák a helyi állapotukat a hub közös lebegő mentés-sávjának jelentik
 * (`onDirtyChange`/`registerApi`) — nincs saját, mindig látható "Mentés" gombjuk. A Stripe
 * kártya kivétel: ott a gomb AZONNALI akció (fiók-összekapcsolás), nem "szerkesztés majd
 * mentés", ezért változatlanul saját maga intézi a hívást. A Hírlevél kártya CSAK olvasható
 * infó (a hírlevél-küldés BEÉPÍTVE jár a csomaghoz, a keret bővítése csomagváltással történik
 * az Előfizetés & számlázás fülön) — nincs saját mentés/akció-gomb.
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
  allowCompany?: boolean
}

export interface ConsentSettingsData {
  enabled: boolean
  title: string
  templateText: string
}

interface Props {
  variant: 'salon' | 'restaurant'
  apiBase: string
  deposit: DepositSettingsData
  invoice: InvoiceSettingsData
  voucher: VoucherSettingsData
  consent: ConsentSettingsData
  stripeConnectAccountId: string | null
  stripeConnectOnboarded: boolean
  /** Globális árazási beállítások — a hírlevél-kártya beépített email-keretének kijelzéséhez. */
  pricing: Pricing
  /** Az aktuális üzlet id-je. */
  businessId: string
  /** Az üzlet jelenlegi csomagja (starter/pro/egyedi) — a hírlevél-kártya beépített keretéhez. */
  tier: string | null
  /** Mely kártyák renderelődjenek — a Beállítások-oldal több fülre is beágyazza ugyanezt a
   *  komponenst (Fizetés / API & Integrációk / Dokumentumok & jogi), mindegyik csak a rá
   *  tartozó kártyákat mutatja. Alapértelmezetten mind a hat. */
  sections?: Array<'stripe' | 'deposit' | 'voucher' | 'consent' | 'newsletter' | 'invoicing'>
  /** A LÁTHATÓ Deposit/Voucher/Consent/Invoicing kártyák összevont mentetlen-állapota — a hub
   *  közös lebegő sávjának. (A Stripe/Hírlevél kártya nem számít bele, azok azonnali akciók.) */
  onDirtyChange?: (dirty: boolean) => void
  /** A hub ezen regisztrálja ennek a példánynak a mentés/elvetés műveletét. */
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
  /** A beleegyező nyilatkozat nyelvenkénti fordításához (a foglaló oldal is ennyi nyelven megy). */
  supportedLocales?: (string | null | undefined)[] | null
}

const ALL_SECTIONS: NonNullable<Props['sections']> = ['stripe', 'deposit', 'voucher', 'consent', 'newsletter', 'invoicing']

export function PaymentsSettingsPanel({ variant, apiBase, deposit, invoice, voucher, consent, stripeConnectAccountId, stripeConnectOnboarded, pricing, tier, sections = ALL_SECTIONS, onDirtyChange, registerApi, supportedLocales }: Props) {
  const show = (s: NonNullable<Props['sections']>[number]) => sections.includes(s)
  const [connecting, setConnecting] = useState(false)
  const [loginLinkLoading, setLoginLinkLoading] = useState(false)
  // Ha a szerver az előleg/utalvány bekapcsolását a hiányzó Stripe-onboarding miatt utasítja
  // el, a toast mellett a Stripe-kártyára is rá kell irányítani a figyelmet — a felhasználó
  // különben nem feltétlenül köti össze a hibaüzenetet ezzel a fenti kártyával.
  const stripeCardRef = useRef<HTMLDivElement>(null)
  const [stripeAlert, setStripeAlert] = useState(false)
  const flagStripeCard = () => {
    stripeCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setStripeAlert(true)
    setTimeout(() => setStripeAlert(false), 1600)
  }

  const [d, setD] = useState<DepositSettingsData>(deposit)
  const [v, setV] = useState<VoucherSettingsData>(voucher)
  const [c, setC] = useState<ConsentSettingsData>(consent)

  // Beleegyező nyilatkozat — fordítások. A HU-tól eltérő nyelvekre a `?locale=` paraméterrel
  // megy a mentés (külön API-hívás), DE ugyanabba a fő Mentés-gombba/dirty-állapotba tartozik,
  // mint a többi kártya — nincs külön "Fordítás mentése" gomb, ld. lent a `dirty`/`save()`.
  const consentLocales = resolveAvailableLocales(supportedLocales).filter((l) => l !== 'hu')
  const [translateLocale, setTranslateLocale] = useState<Locale | null>(null)
  const [translateTitle, setTranslateTitle] = useState('')
  const [translateText, setTranslateText] = useState('')
  // A legutóbb BETÖLTÖTT/MENTETT (még nem szerkesztett) fordítás-érték — ehhez képest dől el,
  // van-e mentendő változás ezen a nyelven (ugyanaz a minta, mint a `deposit`/`voucher`/`consent` propnál).
  const [translatePristine, setTranslatePristine] = useState({ title: '', text: '' })
  const [translateLoading, setTranslateLoading] = useState(false)

  const openTranslate = async (loc: Locale) => {
    if (loc === 'hu') { setTranslateLocale(null); return }
    setTranslateLocale(loc)
    setTranslateLoading(true)
    try {
      // `fallback-locale=null` nélkül a Payload a magyar szöveget adta vissza fallbackként egy
      // még le nem fordított nyelvnél — emiatt tűnt úgy, hogy az angol (vagy bármelyik) fordítás
      // "nem töltődik be": valójában a magyar tartalom jelent meg, nem az (üres) angol.
      const res = await fetch(`${apiBase}?locale=${loc}&fallback-locale=null`, { credentials: 'include' })
      if (res.ok) {
        const json = await res.json()
        const title = json?.consent_settings?.title ?? ''
        const text = json?.consent_settings?.template_text ?? ''
        setTranslateTitle(title)
        setTranslateText(text)
        setTranslatePristine({ title, text })
      }
    } finally {
      setTranslateLoading(false)
    }
  }
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
  const translateDirty = show('consent') && translateLocale !== null && (translateTitle !== translatePristine.title || translateText !== translatePristine.text)
  const dirty = depositDirty || voucherDirty || consentDirty || invoiceDirty || translateDirty

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
            allow_company: v.allowCompany !== false,
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
        try {
          // A HU-mentés (fő body) és a fordítás-mentés (?locale=) KÉT külön API-hívás (a Payload
          // localizált mezői nyelvenként külön PATCH-csel írhatók), de EGY Mentés-gombhoz,
          // egy dirty-állapothoz tartoznak — nincs külön "Fordítás mentése" akció/gomb.
          if (Object.keys(body).length > 0) {
            const res = await fetch(apiBase, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(body),
            })
            if (!res.ok) {
              // A szerver konkrét indoklást ad vissza pl. az előleg-bekapcsolás feltétel-kapujánál
              // (nincs kitöltve a foglalási feltétel) — ezt mutassuk, ne az általános hibaszöveget.
              const json = await res.json().catch(() => null)
              const message = typeof json?.error === 'string' ? json.error : undefined
              // A hiányzó Stripe-onboarding miatti elutasításnál a toast mellett a Stripe-kártyát
              // is megrezegtetjük/pirosra emeljük, hogy egyértelmű legyen, hol kell javítani.
              if (message?.includes('kösd össze a fiókodat a Stripe-pal')) flagStripeCard()
              throw new Error(message)
            }
          }
          if (translateDirty && translateLocale) {
            const res = await fetch(`${apiBase}?locale=${translateLocale}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ consent_settings: { title: translateTitle || undefined, template_text: translateText || undefined } }),
            })
            if (!res.ok) throw new Error()
            setTranslatePristine({ title: translateTitle, text: translateText })
          }
          setSzamlazzKeyInput('')
          setBillingoKeyInput('')
          return true
        } catch (err) {
          toast.error(err instanceof Error && err.message ? err.message : 'Hiba történt')
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
        setTranslateTitle(translatePristine.title)
        setTranslateText(translatePristine.text)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, v, c, invoiceProvider, szamlazzKeyInput, billingoKeyInput, deposit, voucher, consent, invoice, translateLocale, translateTitle, translateText, translatePristine, translateDirty])

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
      <div
        ref={stripeCardRef}
        className={`rounded-[26px] dav-card-glass px-6 py-5 transition-shadow duration-300 ${stripeAlert ? 'animate-shake ring-2 ring-red-400/70' : ''}`}
      >
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

      {/* Hírlevél — csak olvasható infó, a keret a csomaggal jár, nincs önálló kapcsoló/választó. */}
      {show('newsletter') && (
      <div className="rounded-[26px] dav-card-glass px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-ink-dark">
              <Mail className="h-[18px] w-[18px] text-gold" strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[15px] font-medium text-ink">Hírlevél — mindig bekapcsolva</div>
              <div className="text-[13px] text-ink-soft">
                Minden csomagba beépítve, nincs mit bekapcsolnod: a foglaló oldalon a vendégeid feliratkozhatnak, a Marketing menüpontban pedig kampányt küldhetsz nekik.
              </div>
            </div>
          </div>
          <div className="shrink-0 rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink">
            {resolveTier(tier) === 'egyedi' ? 'Korlátlan email' : `${monthlyEmailCapForTier(pricing, resolveTier(tier)).toLocaleString('hu-HU')} email / hó`}
          </div>
        </div>
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
            <label className="flex items-start gap-2.5 text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                checked={v.allowCompany !== false}
                onChange={(e) => setV((s) => ({ ...s, allowCompany: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[#1D1C19]"
              />
              <span>
                „Cégként vásárolok” opció a vásárlásnál
                <span className="block text-[12px] text-ink-soft2">Adószámos számlát kérhet a vásárló. Csak beállított számlázóval (Számlázás fül) jelenik meg.</span>
              </span>
            </label>
          </div>
        )}
      </div>
      )}

      {/* Beleegyező nyilatkozat — mindig nyitott kártya (nincs nyit/zár gomb), EGY mezőkészlet
          van, amit a nyelvváltó sáv vezérel (nem külön HU + külön fordítás-blokk). */}
      {show('consent') && (
      <div id="consent" className="rounded-[26px] dav-card-glass overflow-hidden font-onest scroll-mt-6">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-ink-dark">
            <FileSignature className="h-[18px] w-[18px] text-gold" strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">Beleegyező nyilatkozat</div>
            <div className="text-[13px] text-ink-soft">A vendégnek el kell fogadnia a foglalás véglegesítéséhez — vagy helyszínen, check-inkor.</div>
          </div>
          <Toggle
            checked={c.enabled}
            onChange={() => setC((s) => ({ ...s, enabled: !s.enabled }))}
          />
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6">
            {c.enabled && (() => {
              const isTranslating = translateLocale !== null
              const activeTitle = isTranslating ? translateTitle : c.title
              const activeText = isTranslating ? translateText : c.templateText
              const setActiveTitle = (val: string) => (isTranslating ? setTranslateTitle(val) : setC((s) => ({ ...s, title: val })))
              const setActiveText = (val: string) => (isTranslating ? setTranslateText(val) : setC((s) => ({ ...s, templateText: val })))
              return (
                <div className="space-y-3">
                  {consentLocales.length > 0 && (
                    <LocaleEditBar
                      available={['hu', ...consentLocales]}
                      active={translateLocale ?? 'hu'}
                      onSelect={openTranslate}
                      loading={translateLoading}
                    />
                  )}
                  {translateLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ink-soft" /></div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Nyilatkozat címe</label>
                        <input
                          type="text"
                          name="consent-title"
                          autoComplete="off"
                          value={activeTitle}
                          onChange={(e) => setActiveTitle(e.target.value)}
                          placeholder={isTranslating ? (c.title || 'Beleegyező nyilatkozat') : 'Beleegyező nyilatkozat'}
                          className="w-full rounded-[12px] border border-line-strong bg-white px-3.5 py-2.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Nyilatkozat szövege</label>
                        {!activeText.trim() && (
                          <button
                            type="button"
                            onClick={() => {
                              const tpl = consentTemplate(translateLocale ?? 'hu')
                              setActiveTitle(tpl.title)
                              setActiveText(tpl.text)
                            }}
                            className="text-[12px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
                          >
                            Sablon betöltése
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={5}
                        value={activeText}
                        onChange={(e) => setActiveText(e.target.value)}
                        placeholder={isTranslating ? (c.templateText || 'Fordítás…') : 'Ezt a szöveget látja majd a vendég elfogadásra…'}
                        className="w-full rounded-[12px] border border-line-strong bg-white px-3.5 py-3 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
                      />
                      <p className="text-[12px] text-ink-soft2">
                        {isTranslating
                          ? 'Ez a fordítás is a lenti Mentés gombbal kerül elmentésre, nincs külön mentés.'
                          : 'A vendég a foglalás során fogadja el (kapcsolóval), vagy a személyzet a helyszínen, tableten íratja alá vele érkezéskor — mindkét elfogadás dátummal, IP-vel és a pontos szöveg-verzióval mentődik a foglaláshoz.'}
                      </p>
                    </>
                  )}
                </div>
              )
            })()}
        </div>
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
