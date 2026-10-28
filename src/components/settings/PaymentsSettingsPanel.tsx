'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, Loader2, ExternalLink, ShieldCheck, ShieldAlert, Mail, FileSignature, Receipt, AlertTriangle, Lock, Check, Gift, HandCoins, ChevronRight } from 'lucide-react'
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

/** Fókuszba görgeti a mezőt — mobil billentyűzet felugrásakor a natív "scroll az inputra"
 *  gyakran nem elég (a mező a toolbar/billentyűzet alá csúszik); ez explicit, középre görgetve
 *  biztosítja, hogy a mező látható maradjon a felugró billentyűzet felett is. */
function scrollFieldIntoView(e: { currentTarget: HTMLElement }) {
  setTimeout(() => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150)
}

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

export function PaymentsSettingsPanel({ variant, apiBase, deposit, invoice, voucher, consent, stripeConnectAccountId, stripeConnectOnboarded, pricing, businessId, tier, sections = ALL_SECTIONS, onDirtyChange, registerApi, supportedLocales }: Props) {
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
  // Kulcs törlése (mentéskor null-t küldünk) — korábban nem lehetett eltávolítani egy kulcsot
  const [delSzamlazz, setDelSzamlazz] = useState(false)
  const [delBillingo, setDelBillingo] = useState(false)
  // A ténylegesen MENTETT állapot (mentés után helyben frissül, nem kell oldal-újratöltés)
  const [savedInv, setSavedInv] = useState(invoice)
  useEffect(() => { setSavedInv(invoice) }, [invoice])
  // Élő számlázó-státusz (`/api/invoicing/status`); a kiállított számlák listája külön táblázat
  const [invLive, setInvLive] = useState<{ provider: string | null; ok: boolean; reason?: string; detail?: string } | null>(null)
  const loadInvLive = () => {
    if (!businessId) return
    setInvLive(null)
    fetch(`/api/invoicing/status?kind=${variant}&id=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setInvLive(j?.error ? { provider: null, ok: false, reason: j.error } : j))
      .catch(() => setInvLive({ provider: null, ok: false, reason: 'Az állapot nem kérdezhető le.' }))
  }
  useEffect(() => { if (sections.includes('invoicing') || sections.includes('voucher') || sections.includes('deposit')) loadInvLive() }, [businessId, variant]) // eslint-disable-line react-hooks/exhaustive-deps
  // Előleg-feltétel: kitöltött foglalási feltételek (a szerver is ezt ellenőrzi bekapcsoláskor)
  const docsHref = variant === 'salon' ? '/dashboard/settings?tab=documents' : '/restaurant/settings?tab=documents'
  const [termsFilled, setTermsFilled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!sections.includes('deposit')) return
    fetch(apiBase, { credentials: 'include' })
      .then((r) => r.json())
      .then((doc: { terms_sections?: { title?: string | null; body?: string | null }[] | null }) => {
        const secs = Array.isArray(doc?.terms_sections) ? doc.terms_sections : []
        setTermsFilled(secs.some((x) => (x?.title ?? '').trim() !== '' || (x?.body ?? '').trim() !== ''))
      })
      .catch(() => setTermsFilled(null))
  }, [apiBase]) // eslint-disable-line react-hooks/exhaustive-deps
  // Utalvány-típusok (az Ajándékutalvány kártya áttekintéséhez) — publikus lista-végpont
  const [voucherTypes, setVoucherTypes] = useState<{ id: string; name: string; amount_huf: number; active?: boolean | null }[] | null>(null)
  useEffect(() => {
    if (!sections.includes('voucher') || !businessId) return
    fetch(`/api/gift-voucher-types?${variant === 'salon' ? 'salonId' : 'restaurantId'}=${encodeURIComponent(businessId)}`)
      .then((r) => r.json()).then((j) => setVoucherTypes(j.docs ?? [])).catch(() => setVoucherTypes([]))
  }, [businessId, variant]) // eslint-disable-line react-hooks/exhaustive-deps

  // Csak a ténylegesen LÁTSZÓ (`sections`) kártyák dirty-je számít bele az összevont
  // állapotba — egy `sections={['consent']}` példányon a d/v/invoiceProvider mögötti state
  // sose renderelődik, tehát nem is szerkeszthető, de a biztonság kedvéért `show()`-val zárva.
  const depositDirty = show('deposit') && JSON.stringify(d) !== JSON.stringify(deposit)
  const voucherDirty = show('voucher') && JSON.stringify(v) !== JSON.stringify(voucher)
  const consentDirty = show('consent') && JSON.stringify(c) !== JSON.stringify(consent)
  const invoiceDirty = show('invoicing') && (invoiceProvider !== savedInv.provider || szamlazzKeyInput.trim() !== '' || billingoKeyInput.trim() !== '' || delSzamlazz || delBillingo)
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
          else if (delSzamlazz) invoice_settings.szamlazz_agent_key_enc = null
          if (billingoKeyInput.trim()) invoice_settings.billingo_api_key_enc = billingoKeyInput.trim()
          else if (delBillingo) invoice_settings.billingo_api_key_enc = null
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
          if (invoiceDirty) {
            setSavedInv({
              provider: invoiceProvider,
              hasSzamlazzKey: szamlazzKeyInput.trim() ? true : delSzamlazz ? false : savedInv.hasSzamlazzKey,
              hasBillingoKey: billingoKeyInput.trim() ? true : delBillingo ? false : savedInv.hasBillingoKey,
            })
            setDelSzamlazz(false)
            setDelBillingo(false)
            loadInvLive()
          }
          setSzamlazzKeyInput('')
          setBillingoKeyInput('')
          return true
        } catch (err) {
          const msg = err instanceof Error && err.message ? err.message : 'Hiba történt'
          // a hiányzó foglalási feltételek miatti elutasításnál egy kattintással oda lehessen menni
          if (msg.includes('foglalási feltételeket')) {
            setTermsFilled(false)
            toast.error('Előbb töltsd ki a foglalási feltételeket — ezekben rögzíted a vendég felé az előleg visszatérítési szabályait.', {
              action: { label: 'Kitöltöm', onClick: () => { window.location.href = docsHref } },
            })
          } else toast.error(msg)
          return false
        }
      },
      discard: () => {
        setD(deposit)
        setV(voucher)
        setC(consent)
        setInvoiceProvider(savedInv.provider)
        setSzamlazzKeyInput('')
        setBillingoKeyInput('')
        setDelSzamlazz(false)
        setDelBillingo(false)
        setTranslateTitle(translatePristine.title)
        setTranslateText(translatePristine.text)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, v, c, invoiceProvider, szamlazzKeyInput, billingoKeyInput, delSzamlazz, delBillingo, savedInv, deposit, voucher, consent, invoice, translateLocale, translateTitle, translateText, translatePristine, translateDirty])

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
        className={`rounded-[22px] border border-line bg-white px-6 py-5 transition-shadow duration-300 ${stripeAlert ? 'animate-shake ring-2 ring-red-400/70' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <div>
            <div className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">Stripe fizetési fiók</div>
            <div className="text-[13px] text-ink-soft">A vendég-előleg egyenesen ide érkezik — a platform sosem kezeli a pénzedet.</div>
          </div>
        </div>
        <div className="mt-4">
          {stripeConnectOnboarded ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                <ShieldCheck className="h-4 w-4" /> Csatlakoztatva
              </span>
              <button
                type="button"
                onClick={openStripeDashboard}
                disabled={loginLinkLoading}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-[12px] border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-ink/30 disabled:opacity-60 sm:w-auto"
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
      <div className="rounded-[22px] border border-line bg-white px-6 py-5">
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div>
              <div className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">Hírlevél — mindig bekapcsolva</div>
              <div className="text-[13px] text-ink-soft">
                Minden csomagba beépítve, nincs mit bekapcsolnod: a foglaló oldalon a vendégeid feliratkozhatnak, a Marketing menüpontban pedig kampányt küldhetsz nekik.
              </div>
            </div>
          </div>
          <div className="inline-flex shrink-0 self-start rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[13px] font-semibold text-ink sm:self-auto">
            {resolveTier(tier) === 'egyedi' ? 'Korlátlan email' : `${monthlyEmailCapForTier(pricing, resolveTier(tier)).toLocaleString('hu-HU')} email / hó`}
          </div>
        </div>
      </div>
      )}

      {/* Előleg — az Ajándékutalvány kártya mintájára: áttekintés (Stripe + számlázó), szabályok élő
          példákkal, számlázás. Étteremnél csak fix Ft-összeg (nincs ár-alap a %-hoz). */}
      {show('deposit') && (() => {
        const paymentsHref = variant === 'salon' ? '/dashboard/settings?tab=payments' : '/restaurant/settings?tab=payments'
        const row = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3.5 last:border-0'
        const seg = (on: boolean) => `h-8 rounded-full border px-3 text-[12px] font-semibold transition-colors ${on ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong'}`
        const isPercent = variant === 'salon' && d.type === 'percent'
        const amountExample = isPercent
          ? d.percentValue ? `Pl. egy 12 000 Ft-os szolgáltatásnál ${Math.round(12000 * d.percentValue / 100).toLocaleString('hu-HU')} Ft előleg.` : 'Add meg, hány százalék legyen.'
          : d.fixedAmountHuf ? `Minden ${variant === 'salon' ? 'foglalásnál' : 'asztalfoglalásnál'} ${d.fixedAmountHuf.toLocaleString('hu-HU')} Ft előleg.` : 'Add meg az előleg összegét.'
        const amountMissing = isPercent ? !d.percentValue : !d.fixedAmountHuf
        const h = d.refundHoursBefore
        const refundExample = h === 0
          ? 'A foglalás kezdetéig bármikor visszatérítéssel lemondható.'
          : `Pl. egy pénteki 18:00-s foglalás ${h % 24 === 0 && h / 24 <= 6 ? `${['péntek', 'csütörtök', 'szerda', 'kedd', 'hétfő', 'vasárnap', 'szombat'][h / 24]} 18:00-ig` : `${h} órával előtte`} mondható le visszatérítéssel — utána az előleg nálad marad.`
        return (
      <div className="rounded-[22px] border border-line bg-white px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div>
              <div className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">Előleg</div>
              <div className="text-[13px] text-ink-soft">Online foglaláskor a vendég kártyával előleget fizet — csökkenti az el nem jövő vendégeket.</div>
            </div>
          </div>
          <Toggle checked={d.enabled} onChange={() => setD((s) => ({ ...s, enabled: !s.enabled }))} />
        </div>

        {/* Előfeltételek — egységes sorok (mint a Szabályok), jobbra pötty + szöveg státusz;
            ami hiányzik, ott egy körvonalas gomb visz a beállításához. */}
        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Előfeltételek</p>
          <div className="">
            {([
              {
                label: 'Foglalási feltételek',
                desc: 'Ebben rögzíted a vendég felé a visszatérítés szabályait.',
                state: termsFilled === null ? 'loading' : termsFilled ? 'ok' : 'missing',
                okText: 'Kitöltve', missingText: 'Hiányzik',
                href: docsHref, action: termsFilled ? 'Megnyitás' : 'Kitöltöm',
              },
              {
                label: 'Online fizetés (Stripe)',
                desc: 'Ide érkezik a vendég által fizetett előleg.',
                state: stripeConnectOnboarded ? 'ok' : 'missing',
                okText: 'Bekötve', missingText: 'Nincs bekötve',
                href: paymentsHref, action: stripeConnectOnboarded ? null : 'Bekötöm',
              },
              {
                label: 'Számlázó',
                desc: 'Sikeres fizetés után automatikusan kiáll a számla. Nem kötelező.',
                state: !invLive ? 'loading' : invLive.ok ? 'ok' : 'optional',
                okText: invLive?.detail ?? 'Bekötve', missingText: invLive?.provider ? 'Hibás bekötés' : 'Nincs számla',
                href: paymentsHref, action: invLive && !invLive.ok ? 'Beállítom' : null,
              },
            ] as const).map((r) => (
              <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3.5 last:border-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">{r.label}</p>
                  <p className="text-[12px] text-ink-soft">{r.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${r.state === 'ok' ? 'text-ok' : r.state === 'missing' ? 'text-[#B7790B]' : 'text-ink-soft'}`}>
                    {r.state === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className={`h-[7px] w-[7px] rounded-full ${r.state === 'ok' ? 'bg-ok-fill' : r.state === 'missing' ? 'bg-[#D99A1E]' : 'bg-[#B7B2A4]'}`} />}
                    {r.state === 'loading' ? 'Ellenőrzés…' : r.state === 'ok' ? r.okText : r.missingText}
                  </span>
                  {r.action && r.state !== 'loading' && (
                    <a href={r.href} className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-line bg-white px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-line-strong">
                      {r.action} <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {d.enabled && (
          <div>
            <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Szabályok</p>
            <div className="">
              <div className={row}>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">Összeg</p>
                  <p className={`text-[12px] ${amountMissing ? 'font-medium text-amber-600' : 'text-ink-soft'}`}>{amountExample}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Típusváltáskor a MÁSIK típus mezőjét nullázzuk — ne maradjon ellentmondó érték a DB-ben */}
                  {variant === 'salon' && (
                    <>
                      <button type="button" onClick={() => setD((s) => ({ ...s, type: 'fixed', percentValue: null }))} className={seg(d.type === 'fixed')}>Fix összeg</button>
                      <button type="button" onClick={() => setD((s) => ({ ...s, type: 'percent', fixedAmountHuf: null }))} className={seg(d.type === 'percent')}>Százalék</button>
                    </>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
                    {isPercent ? (
                      <input type="number" inputMode="numeric" min={1} max={100} value={d.percentValue ?? ''} onChange={(e) => setD((s) => ({ ...s, percentValue: e.target.value ? Math.min(100, Number(e.target.value)) : null }))} onFocus={scrollFieldIntoView} aria-label="Előleg százalék" className="h-8 w-[72px] rounded-full border border-line bg-white px-2 text-center text-[13px] text-ink focus:outline-none focus:border-line-strong" />
                    ) : (
                      <input type="number" inputMode="numeric" min={0} step={500} value={d.fixedAmountHuf ?? ''} onChange={(e) => setD((s) => ({ ...s, type: 'fixed', fixedAmountHuf: e.target.value ? Number(e.target.value) : null }))} onFocus={scrollFieldIntoView} aria-label="Előleg összeg" className="h-8 w-[100px] rounded-full border border-line bg-white px-3 text-right text-[13px] text-ink focus:outline-none focus:border-line-strong" />
                    )}
                    {isPercent ? '%' : 'Ft'}
                  </span>
                </div>
              </div>
              <div className={row}>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-ink">Ingyenes lemondás</p>
                  <p className="text-[12px] text-ink-soft">{refundExample}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[12, 24, 48, 72].map((n) => (
                    <button key={n} type="button" onClick={() => setD((s) => ({ ...s, refundHoursBefore: n }))} className={seg(d.refundHoursBefore === n)}>{n} óra</button>
                  ))}
                  <input type="number" inputMode="numeric" min={0} value={d.refundHoursBefore} onChange={(e) => setD((s) => ({ ...s, refundHoursBefore: Math.max(0, Number(e.target.value) || 0) }))} onFocus={scrollFieldIntoView} aria-label="Ingyenes lemondás órában" className="h-8 w-[64px] rounded-full border border-line bg-white px-2 text-center text-[12.5px] text-ink focus:outline-none focus:border-line-strong" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
        )
      })()}

      {/* Ajándékutalvány */}
      {show('voucher') && (() => {
        // Ajándékutalvány — áttekintés (típusok, linkek) + szabályok + számlázás, adatlap-sorokban.
        const vouchersHref = variant === 'salon' ? '/dashboard/vouchers' : '/restaurant/vouchers'
        const paymentsHref = variant === 'salon' ? '/dashboard/settings?tab=payments' : '/restaurant/settings?tab=payments'
        const activeTypes = (voucherTypes ?? []).filter((t) => t.active !== false)
        const until = new Date(); until.setMonth(until.getMonth() + (v.validityMonths || 1))
        const rangeBad = v.minAmountHuf > 0 && v.maxAmountHuf > 0 && v.minAmountHuf > v.maxAmountHuf
        const outOfRange = activeTypes.filter((t) => t.amount_huf < v.minAmountHuf || (v.maxAmountHuf > 0 && t.amount_huf > v.maxAmountHuf))
        const numCls = 'h-9 w-[110px] rounded-[10px] border border-line bg-white px-2.5 text-right text-[14px] text-ink focus:outline-none focus:border-line-strong'
        const row = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3.5 last:border-0'
        return (
      <div className="rounded-[22px] border border-line bg-white px-6 py-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div>
              <div className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">Ajándékutalvány</div>
              <div className="text-[13px] text-ink-soft">Vendégeid a foglalóoldalon vásárolhatnak, te pedig helyben is kiállíthatsz utalványt.</div>
            </div>
          </div>
          <Toggle checked={v.enabled} onChange={() => setV((s) => ({ ...s, enabled: !s.enabled }))} />
        </div>

        {v.enabled && (
          <>
            {/* Áttekintés — típusok + gyors-linkek */}
            <div className="py-1">
              {voucherTypes === null ? (
                <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> Típusok betöltése…</span>
              ) : activeTypes.length === 0 ? (
                <span className="inline-flex items-start gap-1.5 text-[13px] font-semibold text-amber-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Még nincs aktív utalvány-típus — amíg nincs, a vendégek nem tudnak vásárolni.
                </span>
              ) : (
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
                    <ShieldCheck className="h-4 w-4" /> Elérhető a foglalóoldalon — {activeTypes.length} típus
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTypes.map((t) => (
                      <span key={t.id} className="inline-flex h-7 items-center rounded-full border border-line bg-white px-2.5 text-[12px] font-medium text-ink">
                        {t.name} · {t.amount_huf.toLocaleString('hu-HU')} Ft
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <a href={vouchersHref} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink hover:underline">Típusok és eladott utalványok <ExternalLink className="h-3 w-3" /></a>
              </div>
            </div>

            {/* Szabályok */}
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Szabályok</p>
              <div className="">
                <div className={row}>
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">Érvényesség</p>
                    <p className="text-[12px] text-ink-soft">Ma vásárolt utalvány {until.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}-ig váltható be.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[3, 6, 12, 24].map((m) => (
                      <button key={m} type="button" onClick={() => setV((s) => ({ ...s, validityMonths: m }))} className={`h-8 rounded-full border px-3 text-[12px] font-semibold transition-colors ${v.validityMonths === m ? 'border-ink-dark bg-ink-dark text-white' : 'border-line bg-white text-ink hover:border-line-strong'}`}>
                        {m} hó
                      </button>
                    ))}
                    <input
                      type="number" inputMode="numeric" min={1} max={60}
                      value={v.validityMonths}
                      onChange={(e) => setV((s) => ({ ...s, validityMonths: Math.max(1, Number(e.target.value) || 1) }))}
                      onFocus={scrollFieldIntoView}
                      aria-label="Érvényesség hónapban"
                      className="h-8 w-[64px] rounded-full border border-line bg-white px-2 text-center text-[12.5px] text-ink focus:outline-none focus:border-line-strong"
                    />
                  </div>
                </div>
                <div className={row}>
                  <div>
                    <p className="text-[13.5px] font-medium text-ink">Összeghatár</p>
                    <p className={`text-[12px] ${rangeBad || outOfRange.length ? 'font-medium text-amber-600' : 'text-ink-soft'}`}>
                      {rangeBad
                        ? 'A minimum nagyobb, mint a maximum.'
                        : outOfRange.length
                          ? `${outOfRange.length} típus összege kívül esik ezen a határon.`
                          : 'Az utalvány-típusok összege ezen belül lehet.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <input type="number" inputMode="numeric" min={0} step={1000} value={v.minAmountHuf} onChange={(e) => setV((s) => ({ ...s, minAmountHuf: Number(e.target.value) || 0 }))} onFocus={scrollFieldIntoView} aria-label="Minimum összeg" className={numCls} />
                    –
                    <input type="number" inputMode="numeric" min={0} step={1000} value={v.maxAmountHuf} onChange={(e) => setV((s) => ({ ...s, maxAmountHuf: Number(e.target.value) || 0 }))} onFocus={scrollFieldIntoView} aria-label="Maximum összeg" className={numCls} />
                    Ft
                  </div>
                </div>
              </div>
            </div>

            {/* Számlázás */}
            <div>
              <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Számlázás</p>
              <div className="">
                <div className={row}>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">„Cégként vásárolok” a foglalóoldalon</p>
                    <p className="text-[12px] text-ink-soft">A vásárló adószámos számlát kérhet. Csak bekötött számlázóval jelenik meg.</p>
                    {invLive && !invLive.ok && (
                      <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" /> {invLive.provider ? 'Hibás számlázó-bekötés' : 'Nincs bekötve számlázó'} —
                        <a href={paymentsHref} className="underline underline-offset-2">beállítás</a>
                      </p>
                    )}
                    {invLive?.ok && <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-ok"><Check className="h-3.5 w-3.5" strokeWidth={2.5} /> {invLive.detail}</p>}
                  </div>
                  <Toggle checked={v.allowCompany !== false} onChange={() => setV((s) => ({ ...s, allowCompany: s.allowCompany === false }))} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
        )
      })()}

      {/* Beleegyező nyilatkozat — mindig nyitott kártya (nincs nyit/zár gomb), EGY mezőkészlet
          van, amit a nyelvváltó sáv vezérel (nem külön HU + külön fordítás-blokk). */}
      {show('consent') && (
      <div id="consent" className="rounded-[22px] border border-line bg-white overflow-hidden font-onest scroll-mt-6">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">Beleegyező nyilatkozat</div>
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
                              const tpl = consentTemplate(translateLocale ?? 'hu', variant === 'restaurant' ? 'restaurant' : 'salon')
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

      {/* Számlázás — élő státusz (valódi ellenőrzés, nem csak „van-e elmentett kulcs”), mire készül
          számla, szolgáltató-választó (pipa CSAK az aktív, működő bekötésen), kulcs csere/törlés,
          legutóbbi kiállítások. */}
      {show('invoicing') && (() => {
        const savedLabel = savedInv.provider === 'szamlazz' ? 'Számlázz.hu' : savedInv.provider === 'billingo' ? 'Billingo' : null
        const savedHasKey = savedInv.provider === 'szamlazz' ? savedInv.hasSzamlazzKey : savedInv.provider === 'billingo' ? savedInv.hasBillingoKey : false
        const liveOk = !!invLive?.ok && savedHasKey
        const pillCls = (on: boolean) => `inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[13px] font-medium transition-colors ${on ? 'border-ink-dark bg-ink-dark text-white' : 'border-line-strong text-ink-soft hover:border-ink-soft'}`
        const keyField = (which: 'szamlazz' | 'billingo') => {
          const has = which === 'szamlazz' ? savedInv.hasSzamlazzKey : savedInv.hasBillingoKey
          const del = which === 'szamlazz' ? delSzamlazz : delBillingo
          const val = which === 'szamlazz' ? szamlazzKeyInput : billingoKeyInput
          const setVal = which === 'szamlazz' ? setSzamlazzKeyInput : setBillingoKeyInput
          const setDel = which === 'szamlazz' ? setDelSzamlazz : setDelBillingo
          return (
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{which === 'szamlazz' ? 'Számlázz.hu Agent-kulcs' : 'Billingo API-kulcs'}</label>
                {has && !del && (
                  <button type="button" onClick={() => { setDel(true); setVal('') }} className="text-[12px] font-semibold text-[#C0453F] hover:underline">Kulcs törlése</button>
                )}
              </div>
              <input
                type="password"
                value={val}
                onChange={(e) => { setVal(e.target.value); if (e.target.value) setDel(false) }}
                placeholder={del ? 'Mentéskor törlődik — vagy írj be új kulcsot' : has ? '•••••••• elmentve — cseréhez írj be újat' : which === 'szamlazz' ? 'Agent-kulcs beillesztése' : 'API-kulcs beillesztése'}
                className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60"
              />
              {del ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-medium text-amber-600">
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} /> A kulcs mentéskor törlődik. <button type="button" onClick={() => setDel(false)} className="underline">Mégse</button>
                </p>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-soft2">
                  <Lock className="h-3 w-3" strokeWidth={2} /> Titkosítva tároljuk — {which === 'szamlazz' ? 'a Számlázz.hu fiókod Beállítások → Számla Agent menüjében' : 'a Billingo fiókod Beállítások → API kulcsok menüjében'} találod.
                </p>
              )}
            </div>
          )
        }
        return (
      <div className="rounded-[22px] border border-line bg-white px-6 py-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div>
            <div className="text-[15px] font-bold uppercase tracking-[0.02em] text-ink">Automatikus számlázás</div>
            <div className="text-[13px] text-ink-soft">Sikeres fizetés után a számla a saját Számlázz.hu / Billingo fiókodból áll ki, és emailben megy a vevőnek.</div>
          </div>
        </div>

        {/* Élő státusz — a MENTETT beállítást ellenőrzi (Billingónál valódi API-hívással) */}
        <div className="py-1">
          {savedInv.provider === 'none' ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
              <span className="h-2 w-2 rounded-full bg-track-off" /> Kikapcsolva — nem készül automatikus számla
            </span>
          ) : !savedHasKey ? (
            <span className="inline-flex items-start gap-1.5 text-[13px] font-semibold text-amber-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {savedLabel} kiválasztva, de nincs elmentve kulcs — így nem készül számla.
            </span>
          ) : !invLive ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft"><Loader2 className="h-4 w-4 animate-spin" /> {savedLabel} ellenőrzése…</span>
          ) : liveOk ? (
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ok">
              <ShieldCheck className="h-4 w-4" /> Működik — {savedLabel} bekötve
            </span>
          ) : (
            <span className="inline-flex items-start gap-1.5 text-[13px] font-semibold text-amber-600">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {invLive.reason ?? `${savedLabel}: hibás bekötés`}
            </span>
          )}
          {invoiceDirty && <p className="mt-1.5 text-[11.5px] text-ink-soft2">Nem mentett módosítás — a státusz mentés után frissül.</p>}
        </div>

        {/* Mire készül számla */}
        <div className="divide-y divide-line">
          {[
            ['Előleg', 'Online foglalásnál befizetett előleg után.'],
            ['Ajándékutalvány — online / fizetési link', 'Minden sikeres kártyás fizetés után.'],
            ['Ajándékutalvány — helyszíni kiállítás', 'Választható a kiállításkor.'],
          ].map(([t, d]) => (
            <div key={t} className="flex items-start justify-between gap-3 py-2.5">
              <span className="text-[13px] font-medium text-ink">{t}</span>
              <span className="max-w-[60%] text-right text-[12px] text-ink-soft">{d}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Számlázó</p>
          <div className="flex flex-wrap gap-2">
            {(['szamlazz', 'billingo', 'none'] as const).map((p) => (
              <button key={p} type="button" onClick={() => setInvoiceProvider(p)} className={pillCls(invoiceProvider === p)}>
                {p === 'szamlazz' ? 'Számlázz.hu' : p === 'billingo' ? 'Billingo' : 'Nincs'}
                {/* pipa CSAK a mentett, aktív ÉS működő bekötésen */}
                {p !== 'none' && savedInv.provider === p && liveOk && <Check className={`h-3 w-3 ${invoiceProvider === p ? 'text-gold' : 'text-ok'}`} strokeWidth={2.5} />}
              </button>
            ))}
          </div>
        </div>

        {invoiceProvider === 'szamlazz' && keyField('szamlazz')}
        {invoiceProvider === 'billingo' && keyField('billingo')}
        {invoiceProvider === 'none' && (savedInv.hasSzamlazzKey || savedInv.hasBillingoKey) && (
          <div className="space-y-2 rounded-[14px] bg-warn-bg px-4 py-3">
            <p className="text-[12.5px] text-ink-soft">Kikapcsolva a számlázás, de van elmentett kulcsod — ha már nem kell, töröld:</p>
            <div className="flex flex-wrap gap-3">
              {savedInv.hasSzamlazzKey && (
                <button type="button" onClick={() => setDelSzamlazz(!delSzamlazz)} className="text-[12px] font-semibold text-[#C0453F] hover:underline">{delSzamlazz ? '✓ Számlázz.hu-kulcs törlődik' : 'Számlázz.hu-kulcs törlése'}</button>
              )}
              {savedInv.hasBillingoKey && (
                <button type="button" onClick={() => setDelBillingo(!delBillingo)} className="text-[12px] font-semibold text-[#C0453F] hover:underline">{delBillingo ? '✓ Billingo-kulcs törlődik' : 'Billingo-kulcs törlése'}</button>
              )}
            </div>
          </div>
        )}

      </div>
        )
      })()}
    </div>
  )
}
