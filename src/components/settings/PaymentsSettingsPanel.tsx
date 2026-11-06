'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Plus } from 'lucide-react'
import { DatePickerPopover } from '@/components/shared/DatePickerPopover'
import { resolveAvailableLocales, type Locale } from '@/lib/i18n'
import type { Pricing } from '@/lib/pricing'
import { LocaleEditBar } from './LocaleEditBar'
import { consentTemplate } from './contentTemplates'
import { BillingDataCard, ConnectionCard, DepositSettingsCard, VoucherSettings, type DepositValue, type VoucherSummary } from '@/components/blocks/money'
import { Button, Field, FieldRow, Input, Meta, Note, Pill, Segmented, StatusPill, Textarea } from '@/components/ui-kit'
import { SettingsGroup } from '@/components/blocks/settings'
import { GuestSees } from '@/components/blocks/team'
import { Switch } from '@/components/ui/toggle-switch'

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

const todayYmd = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }

type DepositType = 'fixed' | 'percent' | 'per_pax'

export interface DepositSettingsData {
  enabled: boolean
  type: DepositType
  fixedAmountHuf: number | null
  percentValue: number | null
  perPaxAmountHuf: number | null
  refundHoursBefore: number
  /** Mely foglalásoknál (16.1): mindig / X Ft feletti szolgáltatásnál / X fő felett / kiemelt napokon */
  applyWhen: 'always' | 'min_price' | 'min_pax' | 'special_days'
  minPriceHuf: number | null
  minPax: number | null
  /** 0 = vasárnap … 6 = szombat */
  specialWeekdays: number[]
  /** 'YYYY-MM-DD' */
  specialDates: string[]
}

export interface InvoiceSettingsData {
  provider: 'szamlazz' | 'billingo' | 'none'
  hasSzamlazzKey: boolean
  hasBillingoKey: boolean
  /** ki számláz (csak szalon): az üzlet, vagy szakemberenként (vállalkozók — design 16.7) */
  issuer?: 'business' | 'staff'
  /** fizetés a helyszínen (csak szalon — design 16.7 / 6.7.1) */
  onsite?: OnsiteData
}
export type OnsiteData = { enabled: boolean; mode: 'register' | 'invoice'; methods: string[]; invoiceDefault: 'ask' | 'always' }
const ONSITE_DEFAULT: OnsiteData = { enabled: false, mode: 'register', methods: ['cash', 'card', 'transfer'], invoiceDefault: 'ask' }

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
  sections?: Array<'stripe' | 'deposit' | 'voucher' | 'consent' | 'invoicing'>
  /** A LÁTHATÓ Deposit/Voucher/Consent/Invoicing kártyák összevont mentetlen-állapota — a hub
   *  közös lebegő sávjának. (A Stripe/Hírlevél kártya nem számít bele, azok azonnali akciók.) */
  onDirtyChange?: (dirty: boolean) => void
  /** A hub ezen regisztrálja ennek a példánynak a mentés/elvetés műveletét. */
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
  /** A beleegyező nyilatkozat nyelvenkénti fordításához (a foglaló oldal is ennyi nyelven megy). */
  supportedLocales?: (string | null | undefined)[] | null
  /** kézi jóváhagyás van beállítva — az előleg nem kapcsolható be (a szerver is elutasítja) */
  manualApproval?: boolean
}

const ALL_SECTIONS: NonNullable<Props['sections']> = ['stripe', 'deposit', 'voucher', 'consent', 'invoicing']

export function PaymentsSettingsPanel({ variant, apiBase, deposit, invoice, voucher, consent, stripeConnectAccountId, stripeConnectOnboarded, pricing, businessId, tier, sections = ALL_SECTIONS, onDirtyChange, registerApi, supportedLocales, manualApproval = false }: Props) {
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
  const [issuer, setIssuer] = useState<'business' | 'staff'>(invoice.issuer ?? 'business')
  const [onsite, setOnsite] = useState<OnsiteData>(invoice.onsite ?? ONSITE_DEFAULT)
  const [szamlazzKeyInput, setSzamlazzKeyInput] = useState('')
  const [billingoKeyInput, setBillingoKeyInput] = useState('')
  // Kulcs törlése (mentéskor null-t küldünk) — korábban nem lehetett eltávolítani egy kulcsot
  const [delSzamlazz, setDelSzamlazz] = useState(false)
  const [delBillingo, setDelBillingo] = useState(false)
  // elmentett kulcsnál a mező csak a „Csere” után jelenik meg
  const [keyEdit, setKeyEdit] = useState(false)
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
  // Ajándékutalvány (16.14): az eladás, a lejárók és az aktív típusok összesítője — a fül megnyitásakor
  const [voucherSummary, setVoucherSummary] = useState<VoucherSummary | null>(null)
  useEffect(() => {
    if (!sections.includes('voucher') || !businessId) return
    fetch(`/api/gift-vouchers/summary?kind=${variant}&businessId=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && !j.error) setVoucherSummary(j) }).catch(() => {})
  }, [businessId, variant]) // eslint-disable-line react-hooks/exhaustive-deps

  // Csak a ténylegesen LÁTSZÓ (`sections`) kártyák dirty-je számít bele az összevont
  // állapotba — egy `sections={['consent']}` példányon a d/v/invoiceProvider mögötti state
  // sose renderelődik, tehát nem is szerkeszthető, de a biztonság kedvéért `show()`-val zárva.
  const depositDirty = show('deposit') && JSON.stringify(d) !== JSON.stringify(deposit)
  const voucherDirty = show('voucher') && JSON.stringify(v) !== JSON.stringify(voucher)
  const consentDirty = show('consent') && JSON.stringify(c) !== JSON.stringify(consent)
  const invoiceDirty = show('invoicing') && (invoiceProvider !== savedInv.provider || issuer !== (savedInv.issuer ?? 'business') || JSON.stringify(onsite) !== JSON.stringify(savedInv.onsite ?? ONSITE_DEFAULT) || szamlazzKeyInput.trim() !== '' || billingoKeyInput.trim() !== '' || delSzamlazz || delBillingo)
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
            apply_when: d.applyWhen,
            min_price_huf: d.applyWhen === 'min_price' ? d.minPriceHuf : null,
            min_pax: d.applyWhen === 'min_pax' ? d.minPax : null,
            special_days: d.applyWhen === 'special_days' ? { weekdays: d.specialWeekdays, dates: d.specialDates } : null,
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
          const invoice_settings: Record<string, unknown> = { invoice_provider: invoiceProvider, ...(variant === 'salon' ? { issuer } : {}) }
          if (szamlazzKeyInput.trim()) invoice_settings.szamlazz_agent_key_enc = szamlazzKeyInput.trim()
          else if (delSzamlazz) invoice_settings.szamlazz_agent_key_enc = null
          if (billingoKeyInput.trim()) invoice_settings.billingo_api_key_enc = billingoKeyInput.trim()
          else if (delBillingo) invoice_settings.billingo_api_key_enc = null
          body.invoice_settings = invoice_settings
          if (variant === 'salon') body.onsite_payment = { enabled: onsite.enabled, mode: onsite.mode, methods: onsite.methods.join(','), invoice_default: onsite.invoiceDefault }
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
              issuer,
              onsite,
              hasSzamlazzKey: szamlazzKeyInput.trim() ? true : delSzamlazz ? false : savedInv.hasSzamlazzKey,
              hasBillingoKey: billingoKeyInput.trim() ? true : delBillingo ? false : savedInv.hasBillingoKey,
            })
            setDelSzamlazz(false)
            setDelBillingo(false)
            setKeyEdit(false)
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
        setIssuer(savedInv.issuer ?? 'business')
        setOnsite(savedInv.onsite ?? ONSITE_DEFAULT)
        setSzamlazzKeyInput('')
        setBillingoKeyInput('')
        setDelSzamlazz(false)
        setDelBillingo(false)
        setKeyEdit(false)
        setTranslateTitle(translatePristine.title)
        setTranslateText(translatePristine.text)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, v, c, invoiceProvider, issuer, onsite, szamlazzKeyInput, billingoKeyInput, delSzamlazz, delBillingo, savedInv, deposit, voucher, consent, invoice, translateLocale, translateTitle, translateText, translatePristine, translateDirty])

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
      {/* Előleg (design 16.1) — szalon: fix vagy az ár %-a, étterem: fix vagy fő után; típusváltáskor a többi összeg-mező
          nullázódik, hogy ne maradjon ellentmondó érték a DB-ben */}
      {show('deposit') && (() => {
        const paymentsHref = variant === 'salon' ? '/dashboard/settings?tab=payments' : '/restaurant/settings?tab=payments'
        const value: DepositValue = { enabled: d.enabled, type: d.type, amount: d.type === 'percent' ? d.percentValue : d.type === 'per_pax' ? d.perPaxAmountHuf : d.fixedAmountHuf, refundHours: d.refundHoursBefore, when: d.applyWhen, minPriceHuf: d.minPriceHuf, minPax: d.minPax, weekdays: d.specialWeekdays, dates: d.specialDates }
        return (
          <DepositSettingsCard save={false} restaurant={variant === 'restaurant'} value={value} manualApproval={manualApproval} rulesHref={variant === 'salon' ? '/dashboard/settings?tab=site' : '/restaurant/settings?tab=site'}
            datePicker={<DatePickerPopover value={todayYmd()} onChange={(day) => setD((s) => ({ ...s, specialDates: s.specialDates.includes(day) ? s.specialDates : [...s.specialDates, day] }))} triggerClassName="inline-flex h-9 items-center gap-1.5 rounded-full bg-ui-cell px-3.5 text-ui-meta text-ui-text ui-press"><Plus className="h-3.5 w-3.5" /> Dátum</DatePickerPopover>}
            onChange={(x) => setD((s) => ({ ...s, enabled: x.enabled, type: x.type, refundHoursBefore: x.refundHours, applyWhen: x.when, minPriceHuf: x.minPriceHuf, minPax: x.minPax, specialWeekdays: x.weekdays, specialDates: x.dates, fixedAmountHuf: x.type === 'fixed' ? x.amount : null, percentValue: x.type === 'percent' ? x.amount : null, perPaxAmountHuf: x.type === 'per_pax' ? x.amount : null }))}
            prereqs={{
              terms: termsFilled === null ? { state: 'loading' } : termsFilled ? { state: 'ok', okLabel: 'Kitöltve' } : { state: 'missing', action: 'Kitöltöm', href: docsHref },
              stripe: stripeConnectOnboarded ? { state: 'ok', okLabel: 'Bekötve' } : { state: 'missing', action: 'Bekötöm', href: paymentsHref },
              invoicing: !invLive ? { state: 'loading' } : invLive.ok ? { state: 'ok', okLabel: invLive.detail ?? 'Bekötve' } : { state: 'optional', action: 'Beállítom', href: paymentsHref },
            }} />
        )
      })()}

      {/* Ajándékutalvány (design 16.14) */}
      {show('voucher') && (
        <VoucherSettings save={false} summary={voucherSummary} typesHref={variant === 'salon' ? '/dashboard/vouchers' : '/restaurant/vouchers'}
          invoicing={invLive ? invLive.ok : null} invoicingHref={variant === 'salon' ? '/dashboard/settings?tab=payments' : '/restaurant/settings?tab=payments'}
          value={{ enabled: v.enabled, validityMonths: v.validityMonths, minAmountHuf: v.minAmountHuf, maxAmountHuf: v.maxAmountHuf, allowCompany: v.allowCompany !== false }}
          onChange={(x) => setV((s) => ({ ...s, ...x }))} />
      )}

      {/* Beleegyező nyilatkozat — mindig nyitott kártya (nincs nyit/zár gomb), EGY mezőkészlet
          van, amit a nyelvváltó sáv vezérel (nem külön HU + külön fordítás-blokk). */}
      {/* Beleegyező nyilatkozat (design 16.12) — a Dokumentumok lap második csoportja: be / ki, cím, szöveg (nyelvenként),
          kiindulási sablon; a vendég foglaláskor kapcsolóval vagy helyszínen tableten fogadja el */}
      {show('consent') && (() => {
        const isTranslating = translateLocale !== null
        const activeTitle = isTranslating ? translateTitle : c.title
        const activeText = isTranslating ? translateText : c.templateText
        const setActiveTitle = (val: string) => (isTranslating ? setTranslateTitle(val) : setC((x) => ({ ...x, title: val })))
        const setActiveText = (val: string) => (isTranslating ? setTranslateText(val) : setC((x) => ({ ...x, templateText: val })))
        return (
          <div id="consent" className="scroll-mt-6">
            <SettingsGroup icon={Check} title="Beleegyező nyilatkozat">
              <FieldRow label="Kérjük a vendégtől" hint="foglaláskor kapcsolóval, vagy helyszínen tableten"><Switch checked={c.enabled} onChange={(on) => setC((x) => ({ ...x, enabled: on }))} ariaLabel="Beleegyező nyilatkozat" /></FieldRow>
              {c.enabled && (
                <>
                  <FieldRow label="Elfogadás" stacked><Pill tone="dark">Foglaláskor, kapcsolóval</Pill><Pill tone="dark">Helyszínen, tableten</Pill></FieldRow>
                  {consentLocales.length > 0 && <div className="mt-2"><LocaleEditBar available={['hu', ...consentLocales]} active={translateLocale ?? 'hu'} onSelect={openTranslate} loading={translateLoading} /></div>}
                  {translateLoading ? <Meta className="py-6 text-center">Betöltés…</Meta> : (
                    <>
                      <Field label="Nyilatkozat címe" className="mt-2"><Input value={activeTitle} onChange={(e) => setActiveTitle(e.target.value)} placeholder={isTranslating ? (c.title || 'Beleegyező nyilatkozat') : 'Beleegyező nyilatkozat'} autoComplete="off" /></Field>
                      <Field label="Nyilatkozat szövege" className="mt-3"><Textarea rows={4} value={activeText} onChange={(e) => setActiveText(e.target.value)} placeholder={isTranslating ? (c.templateText || 'Fordítás…') : 'Ezt a szöveget látja majd a vendég elfogadásra…'} className="min-h-[72px]" /></Field>
                      {!activeText.trim() && <Button variant="cell" size="sm" className="mt-2" onClick={() => { const tpl = consentTemplate(translateLocale ?? 'hu', variant === 'restaurant' ? 'restaurant' : 'salon'); setActiveTitle(tpl.title); setActiveText(tpl.text) }}>Kiindulási szöveg</Button>}
                    </>
                  )}
                </>
              )}
            </SettingsGroup>
            {c.enabled && <GuestSees className="mx-6 mt-4">A foglalás végén egy kapcsoló: „Elfogadom a foglalási feltételeket és a nyilatkozatot” — a szöveg egy kattintással kinyílik. Az elfogadás dátummal, IP-vel és a pontos szöveg-verzióval mentődik.</GuestSees>}
          </div>
        )
      })()}

      {/* Számlázás — élő státusz (valódi ellenőrzés, nem csak „van-e elmentett kulcs”), mire készül
          számla, szolgáltató-választó (pipa CSAK az aktív, működő bekötésen), kulcs csere/törlés,
          legutóbbi kiállítások. */}
      {/* Fizetés & számlázás (design 16.7): két kapcsolat-kártya (Stripe, számlázó), alatta az automatikus számla —
          a mentett beállítást élőben ellenőrizzük (Billingónál valódi API-hívással) */}
      {(show('stripe') || show('invoicing')) && (() => {
        const savedLabel = savedInv.provider === 'szamlazz' ? 'Számlázz.hu' : savedInv.provider === 'billingo' ? 'Billingo' : null
        const savedHasKey = savedInv.provider === 'szamlazz' ? savedInv.hasSzamlazzKey : savedInv.provider === 'billingo' ? savedInv.hasBillingoKey : false
        const liveOk = !!invLive?.ok && savedHasKey
        const invStatus: { tone: 'ok' | 'pending' | 'bad' | 'neutral'; label: string } = savedInv.provider === 'none' ? { tone: 'neutral', label: 'Kikapcsolva' }
          : !savedHasKey ? { tone: 'bad', label: 'Nincs kulcs' } : !invLive ? { tone: 'pending', label: 'Ellenőrzés…' } : liveOk ? { tone: 'ok', label: 'Összekötve' } : { tone: 'bad', label: 'Hibás bekötés' }
        const which = invoiceProvider === 'billingo' ? 'billingo' : 'szamlazz'
        const has = which === 'szamlazz' ? savedInv.hasSzamlazzKey : savedInv.hasBillingoKey
        const del = which === 'szamlazz' ? delSzamlazz : delBillingo
        const val = which === 'szamlazz' ? szamlazzKeyInput : billingoKeyInput
        const setVal = which === 'szamlazz' ? setSzamlazzKeyInput : setBillingoKeyInput
        const setDel = which === 'szamlazz' ? setDelSzamlazz : setDelBillingo
        const on = invoiceProvider !== 'none'
        return (
          <div className="flex flex-col gap-[5px]">
            <div className="grid gap-[5px] sm:grid-cols-2">
              {show('stripe') && (
                <div ref={stripeCardRef} className={`flex rounded-ui-card ${stripeAlert ? 'animate-ui-shake ring-2 ring-ui-bad-dot/60' : ''}`}>
                  <ConnectionCard className="flex-1" name="Stripe" desc="Online kártyás fizetés: előleg és utalvány. A pénz közvetlenül a te fiókodba érkezik — a platform sosem kezeli a pénzedet."
                    status={stripeConnectOnboarded ? { tone: 'ok', label: 'Összekötve' } : stripeConnectAccountId ? { tone: 'pending', label: 'Félbemaradt' } : { tone: 'pending', label: 'Nincs összekötve' }}
                    note={!stripeConnectOnboarded && stripeConnectAccountId ? <Note warn className="mt-3">Az összekötés félbemaradt — folytasd, hogy előleget és utalványt tudj fogadni.</Note> : undefined}
                    btn={stripeConnectOnboarded ? { label: 'Kezelés a Stripe-on', onClick: () => void openStripeDashboard(), busy: loginLinkLoading } : { label: stripeConnectAccountId ? 'Összekötés folytatása' : 'Összekötés', onClick: () => void startOnboarding(), busy: connecting, primary: true }} />
                </div>
              )}
              {show('invoicing') && (
                <ConnectionCard kind={invoiceProvider === 'billingo' ? 'billingo' : 'szamlazz'} name={savedLabel ?? 'Számlázó'} status={invStatus}
                  desc="Minden online fizetésről magától számla készül a saját Számlázz.hu / Billingo fiókodból, és a vendég e-mailben kapja."
                  note={savedInv.provider !== 'none' && savedHasKey && invLive && !liveOk && invLive.reason ? <Note warn className="mt-3">{invLive.reason}</Note> : undefined}
                  btn={{ label: on ? 'Beállítás lent' : 'Bekapcsolás', primary: !on, onClick: () => { if (!on) setInvoiceProvider(savedInv.provider !== 'none' ? savedInv.provider : 'szamlazz'); document.getElementById('invoice-key')?.focus() } }} />
              )}
            </div>
            {show('invoicing') && (
              <BillingDataCard title="Automatikus számla" rows={[
                // ki számláz (design 16.7): szakemberenként a csapat vállalkozó — mindenki a saját profiljában köti be
                ...(variant === 'salon' ? [['Ki számláz?', <span key="i" className="flex flex-col items-end gap-1"><Segmented options={['Az üzlet', 'Szakemberenként']} active={issuer === 'staff' ? 1 : 0} tone="cell" size="sm" onSelect={(i) => setIssuer(i ? 'staff' : 'business')} />{issuer === 'staff' && <Meta className="max-w-[320px] text-right text-ui-label">Mindenki a saját nevére: Munkatársak › a munkatárs › Saját számlázás (számlázó, adószám, Stripe). Az ajándékutalványt az üzlet állítja ki.</Meta>}</span>]] as [string, React.ReactNode][] : []),
                ['Automatikus számla', <Switch key="s" checked={on} onChange={(v) => setInvoiceProvider(v ? (savedInv.provider !== 'none' ? savedInv.provider : 'szamlazz') : 'none')} ariaLabel="Automatikus számla" />],
                ...(on ? [
                  ['Számlázó', <Segmented key="p" options={['Számlázz.hu', 'Billingo']} active={which === 'billingo' ? 1 : 0} tone="cell" size="sm" onSelect={(i) => { setInvoiceProvider(i ? 'billingo' : 'szamlazz'); setKeyEdit(false) }} />],
                  [which === 'szamlazz' ? 'Agent-kulcs' : 'API-kulcs', (
                    // elmentett kulcs: állapot + Csere / Törlés (a kulcsot sosem mutatjuk vissza); nincs kulcs vagy csere: a mező
                    has && !keyEdit ? (
                      <span key="k" className="flex flex-wrap items-center justify-end gap-1.5">
                        {del
                          ? <><StatusPill status="bad">Mentéskor törlődik</StatusPill><Button variant="cell" size="sm" onClick={() => setDel(false)}>Mégse</Button></>
                          : <><StatusPill status="ok">Kulcs elmentve</StatusPill>
                            <Button id="invoice-key" variant="cell" size="sm" onClick={() => setKeyEdit(true)}>Csere</Button>
                            <Button variant="cell" size="sm" className="text-ui-bad" onClick={() => { setDel(true); setVal('') }}>Törlés</Button></>}
                      </span>
                    ) : (
                      <span key="k" className="flex w-[300px] max-w-full flex-col items-end gap-1">
                        {/* nem `type="password"`: arra a böngésző jelszókezelője a belépési jelszót írná (és a lap keresőjébe az e-mailt) —
                            szöveg-mező pöttyözve, kitöltés nélkül */}
                        <Input id="invoice-key" size="sm" type="text" autoComplete="off" spellCheck={false} data-1p-ignore data-lpignore="true" data-form-type="other" autoFocus={keyEdit}
                          value={val} onChange={(e) => { setVal(e.target.value); if (e.target.value) setDel(false) }} className={`w-full ${val ? '[-webkit-text-security:disc]' : ''}`}
                          placeholder={has ? 'Új kulcs beillesztése' : 'Kulcs beillesztése'} />
                        <Meta className="text-right text-ui-label">
                          {which === 'szamlazz' ? 'Számlázz.hu › Beállítások › Számla Agent' : 'Billingo › Beállítások › API kulcsok'}
                          {has && <> · <button type="button" onClick={() => { setKeyEdit(false); setVal('') }} className="underline">Mégse</button></>}
                        </Meta>
                      </span>
                    )
                  )],
                ] as [string, React.ReactNode][] : []),
                ['Mire készül számla', <Meta key="m" className="max-w-[60%] text-right">előleg · online / linkes utalvány · helyszíni utalvány (választható)</Meta>],
              ]}
                footer={<>
                  {invoiceDirty && <Meta className="mt-3 text-ui-label">Nem mentett módosítás — az állapot mentés után frissül.</Meta>}
                  {!on && (savedInv.hasSzamlazzKey || savedInv.hasBillingoKey) && (
                    <Note warn className="mt-3">Kikapcsolva, de van elmentett kulcsod — ha már nem kell:{' '}
                      {savedInv.hasSzamlazzKey && <button type="button" onClick={() => setDelSzamlazz(!delSzamlazz)} className="underline">{delSzamlazz ? 'Számlázz.hu-kulcs törlődik ✓' : 'Számlázz.hu-kulcs törlése'}</button>}{' '}
                      {savedInv.hasBillingoKey && <button type="button" onClick={() => setDelBillingo(!delBillingo)} className="underline">{delBillingo ? 'Billingo-kulcs törlődik ✓' : 'Billingo-kulcs törlése'}</button>}
                    </Note>
                  )}
                </>} />
            )}
            {/* fizetés a helyszínen (design 16.7 / 6.7.1) — csak szalon; a lezárás ablakában foglalásonként átállítható a számla */}
            {show('invoicing') && variant === 'salon' && (
              <BillingDataCard title="Fizetés a helyszínen" rows={[
                ['Fizetés a lezáráskor', <span key="e" className="flex flex-col items-end gap-1"><Switch checked={onsite.enabled} onChange={(x) => setOnsite((o) => ({ ...o, enabled: x }))} ariaLabel="Fizetés a lezáráskor" /><Meta className="text-right text-ui-label">{onsite.enabled ? 'a foglalás a „Fizetés” gombbal zárul' : 'kikapcsolva — a foglalás egy gombbal zárul'}</Meta></span>],
                ...(onsite.enabled ? [
                  ['Bizonylat', <span key="m" className="flex flex-col items-end gap-1"><Segmented options={['Pénztárgép', 'Számlázó']} active={onsite.mode === 'invoice' ? 1 : 0} tone="cell" size="sm" onSelect={(i) => setOnsite((o) => ({ ...o, mode: i && on ? 'invoice' : 'register' }))} /><Meta className="text-right text-ui-label">{onsite.mode === 'invoice' ? 'a lezáráskor a számlázódból' : 'a nyugtát a pénztárgépen adod — itt csak rögzítjük'}</Meta></span>],
                  ['Fizetési módok', <span key="p" className="flex flex-wrap justify-end gap-1">{([['cash', 'Készpénz'], ['card', 'Bankkártya'], ['transfer', 'Átutalás'], ['link', 'Fizetési link']] as const).map(([k, l]) => (
                    <button key={k} type="button" className="rounded-full ui-press" aria-pressed={onsite.methods.includes(k)} onClick={() => setOnsite((o) => ({ ...o, methods: o.methods.includes(k) ? o.methods.filter((x) => x !== k) : [...o.methods, k] }))}><Pill tone={onsite.methods.includes(k) ? 'dark' : 'cell'}>{l}</Pill></button>
                  ))}</span>],
                  ...(onsite.mode === 'invoice' ? [['Számla', <Segmented key="d" options={['Mindig', 'Ha kéri']} active={onsite.invoiceDefault === 'always' ? 0 : 1} tone="cell" size="sm" onSelect={(i) => setOnsite((o) => ({ ...o, invoiceDefault: i ? 'ask' : 'always' }))} />]] as [string, React.ReactNode][] : []),
                ] as [string, React.ReactNode][] : []),
              ]} footer={onsite.enabled && onsite.mode === 'register' ? <Note className="mt-3">Egy fizetésről egy bizonylat: ha pénztárgépen adsz nyugtát, ugyanarról ne menjen számla is.</Note> : onsite.enabled && !on ? <Note warn className="mt-3">A számlázós módhoz előbb kapcsold be fent az automatikus számlát.</Note> : undefined} />
            )}
          </div>
        )
      })()}
    </div>
  )
}
