'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Copy, Check, CheckCircle2, ImagePlus, Mail, ChevronLeft, ChevronRight, UserRound, Gift, Receipt, TriangleAlert } from 'lucide-react'
import { SectionBar, FieldRow, ROW_INPUT, pillSmCls } from '@/components/shared/FormSheet'
import { useGuestLookup, GuestSuggestList, type GuestSuggestion } from '@/components/shared/GuestLookup'
import { PopupModal } from '@/components/ui/popup-modal'
import { Switch } from '@/components/ui/toggle-switch'
import { stepSlide, stepSlideTransition } from '@/lib/motion'
import { formatPrice, cn } from '@/lib/utils'
import type { VoucherTypeData } from '@/components/settings/VoucherTypeManager'

/**
 * Admin-oldali utalvány-kiállító wizard — a személyzet MAGA hoz létre/ad el egy utalványt a
 * dashboardból (nem csak a vendég online, a publikus oldalon). 3 lépés: típus-választás →
 * vásárló/megajándékozott adatok → fizetés módja (már kifizetve / fizetési link). A
 * `/api/gift-vouchers/manual-create` route-ot hívja (`src/app/api/gift-vouchers/manual-create/
 * route.ts`), ami MINDKÉT módot kiszolgálja.
 */

type Step = 'type' | 'buyer' | 'payment' | 'confirm' | 'success' | 'link'
type PaidMethod = 'cash' | 'pos_card' | 'transfer'
const PAID_LABEL: Record<PaidMethod, string> = { cash: 'Készpénz', pos_card: 'Bankkártya', transfer: 'Átutalás' }

interface Props {
  open: boolean
  onClose: () => void
  variant: 'salon' | 'restaurant'
  businessId: string
  voucherTypes: VoucherTypeData[]
}

function imageUrlOf(image: VoucherTypeData['image']): string | null {
  return image && typeof image === 'object' ? image.url ?? null : null
}

// keret nélküli adatlap-érték (FormSheet)
const val = `${ROW_INPUT} w-full outline-none`

export function VoucherCreateWizard({ open, onClose, variant, businessId, voucherTypes }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('type')
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [purchaserName, setPurchaserName] = useState('')
  const [purchaserEmail, setPurchaserEmail] = useState('')
  const [purchaserCity, setPurchaserCity] = useState('')
  const [purchaserAddress, setPurchaserAddress] = useState('')
  const [isCompany, setIsCompany] = useState(false)
  const [purchaserTaxNumber, setPurchaserTaxNumber] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ code: string; amountHuf: number; qrCodeDataUrl: string } | null>(null)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [linkSessionId, setLinkSessionId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [shakeKey, setShakeKey] = useState(0)
  const [dir, setDir] = useState(1)
  // helyszíni fizetés módja — kiválasztás után még egy megerősítő lépés jön (véletlen kattintás ellen)
  const [paidMethod, setPaidMethod] = useState<PaidMethod | null>(null)
  // Élő számlázó-státusz (Számlázz.hu / Billingo) — az ellenőrző lépésen mutatjuk, kiáll-e a számla
  const [invoiceStatus, setInvoiceStatus] = useState<{ provider: string | null; ok: boolean; reason?: string; detail?: string } | null>(null)
  useEffect(() => {
    if (!open || (step !== 'confirm' && step !== 'link') || invoiceStatus) return
    let cancelled = false
    fetch(`/api/invoicing/status?kind=${variant}&id=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setInvoiceStatus(d?.error ? { provider: null, ok: false, reason: d.error } : d) })
      .catch(() => { if (!cancelled) setInvoiceStatus({ provider: null, ok: false, reason: 'A számlázó állapota nem kérdezhető le.' }) })
    return () => { cancelled = true }
  }, [open, step, variant, businessId]) // eslint-disable-line react-hooks/exhaustive-deps
  // Készüljön-e számla — kikapcsolható, ha pl. a pénztárgépből számláznak (duplikáció ellen)
  const [issueInvoice, setIssueInvoice] = useState(true)
  const willInvoice = issueInvoice && !!invoiceStatus?.ok
  // Visszatérő vendég javaslat (mint az új foglalásnál) — a vásárló ÉS a megajándékozott mezőkre is;
  // `lookupFor` dönti el, melyik blokkot tölti ki a kiválasztott vendég.
  const lookup = useGuestLookup(open && step === 'buyer')
  const [lookupFor, setLookupFor] = useState<'buyer' | 'recipient'>('buyer')
  const typeLookup = (target: 'buyer' | 'recipient', f: 'name' | 'email', v: string) => { setLookupFor(target); lookup.type(f, v) }
  const applySuggestion = (g: GuestSuggestion) => {
    if (lookupFor === 'buyer') {
      setPurchaserName(g.name); clearFieldError('name')
      if (g.email) { setPurchaserEmail(g.email); clearFieldError('email') }
      if (g.city) { setPurchaserCity(g.city); clearFieldError('city') }
      if (g.address) { setPurchaserAddress(g.address); clearFieldError('address') }
      // korábban adószámmal számlázott vendég → céges vásárló, adószámmal együtt
      if (g.taxNumber) { setIsCompany(true); setPurchaserTaxNumber(g.taxNumber); clearFieldError('taxNumber') }
    } else {
      setRecipientName(g.name)
      if (g.email) { setRecipientEmail(g.email); clearFieldError('recipientEmail') }
    }
    lookup.clear()
  }
  const showSuggest = (target: 'buyer' | 'recipient', f: 'name' | 'email') => lookupFor === target && lookup.field === f

  const goTo = (next: Step, direction: number) => {
    setDir(direction)
    setStep(next)
  }

  // A fizetési-link lépésen ÉLŐBEN figyeljük, mikor fizet a vendég — a voucher-rekord a
  // Connect webhookból jön létre aszinkron (a vendég a SAJÁT eszközén fizet), ez a pollozás
  // adja a live visszajelzést a dashboardnak, hogy ne kelljen kézzel frissíteni/ellenőrizni. A
  // Checkout Session ID-jával kérdezünk (mindig megvan), NEM a session-létrehozáskor kapott
  // payment_intent-tel — az ugyanis a válaszban nem mindig populált még szinkron módon.
  useEffect(() => {
    if (step !== 'link' || !linkSessionId) return
    let cancelled = false
    const check = async () => {
      try {
        const params = new URLSearchParams({
          sessionId: linkSessionId,
          ...(variant === 'salon' ? { salonId: businessId } : { restaurantId: businessId }),
        })
        const res = await fetch(`/api/gift-vouchers/by-payment-intent?${params}`, { credentials: 'include' })
        const json = await res.json()
        if (!cancelled && json.found) {
          setResult({ code: json.code, amountHuf: json.amountHuf, qrCodeDataUrl: json.qrCodeDataUrl })
          goTo('success', 1)
          // A háttérben azonnal frissítjük a listát is — nem várunk arra, hogy bezárják a
          // wizardot, így ha nyitva hagyják a siker-képernyőn, a lista mögötte már friss.
          router.refresh()
        }
      } catch { /* következő pollozás úgyis újrapróbálja */ }
    }
    const interval = setInterval(check, 3000)
    check()
    return () => { cancelled = true; clearInterval(interval) }
  }, [step, linkSessionId, variant, businessId])

  const activeTypes = voucherTypes.filter(t => t.active !== false)
  const selectedType = voucherTypes.find(t => t.id === selectedTypeId) ?? null

  const reset = () => {
    lookup.clear()
    setStep('type')
    setSelectedTypeId(null)
    setPurchaserName('')
    setPurchaserEmail('')
    setPurchaserCity('')
    setPurchaserAddress('')
    setIsCompany(false)
    setPurchaserTaxNumber('')
    setRecipientName('')
    setRecipientEmail('')
    setMessage('')
    setResult(null)
    setLinkUrl(null)
    setLinkSessionId(null)
    setEmailSent(false)
    setFieldErrors({})
    setPaidMethod(null)
    setInvoiceStatus(null)
    setIssueInvoice(true)
  }

  const close = () => {
    if (step === 'success') router.refresh()
    reset()
    onClose()
  }

  const buyerFieldErrorMap = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!purchaserName.trim()) e.name = 'A vásárló neve kötelező.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(purchaserEmail)) e.email = 'Érvénytelen email-cím.'
    if (!purchaserCity.trim()) e.city = 'A település megadása kötelező a számlázáshoz.'
    if (!purchaserAddress.trim()) e.address = 'A cím megadása kötelező a számla kiküldéséhez.'
    if (isCompany && !purchaserTaxNumber.trim()) e.taxNumber = 'Céges vásárlásnál az adószám megadása kötelező.'
    if (recipientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) e.recipientEmail = 'Érvénytelen email-cím a megajándékozottnál.'
    return e
  }

  const clearFieldError = (key: string) => {
    setFieldErrors(prev => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next })
  }

  const goToPaymentStep = () => {
    const e = buyerFieldErrorMap()
    setFieldErrors(e)
    if (Object.keys(e).length > 0) { setShakeKey(k => k + 1); return }
    goTo('payment', 1)
  }

  const submit = async (paymentMode: 'paid' | 'link', paidMethod?: 'cash' | 'pos_card' | 'transfer') => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/gift-vouchers/manual-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(variant === 'salon' ? { kind: 'salon', salonId: businessId } : { kind: 'restaurant', restaurantId: businessId }),
          voucherTypeId: selectedTypeId,
          paymentMode,
          ...(paidMethod ? { paidMethod } : {}),
          // fizetési linknél (online kártyás fizetés) mindig készül számla; helyszíni fizetésnél választható
          issueInvoice: paymentMode === 'link' ? true : issueInvoice,
          purchaserName, purchaserEmail,
          purchaserCity: purchaserCity.trim(),
          purchaserAddress: purchaserAddress.trim(),
          purchaserTaxNumber: isCompany ? purchaserTaxNumber.trim() : undefined,
          recipientName: recipientName.trim() || undefined,
          recipientEmail: recipientEmail.trim() || undefined,
          message: message.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült létrehozni az utalványt.')
      if (paymentMode === 'paid') {
        setResult(json)
        goTo('success', 1)
      } else {
        setLinkUrl(json.url)
        setLinkSessionId(json.sessionId ?? null)
        goTo('link', 1)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült létrehozni az utalványt.')
    } finally {
      setSubmitting(false)
    }
  }

  // Mégse a link-képernyőn: a Stripe-on is visszavonjuk (expire) — ne lehessen utólag kifizetni
  const [cancellingLink, setCancellingLink] = useState(false)
  const cancelLink = async () => {
    if (!linkSessionId) { close(); return }
    setCancellingLink(true)
    try {
      const res = await fetch(`/api/gift-vouchers/pending?kind=${variant}&id=${encodeURIComponent(businessId)}&sessionId=${encodeURIComponent(linkSessionId)}`, { method: 'DELETE', credentials: 'include' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Nem sikerült visszavonni a linket')
      toast.success('A fizetési link visszavonva')
      close()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült visszavonni a linket')
    } finally {
      setCancellingLink(false)
    }
  }

  const copyLink = async () => {
    if (!linkUrl) return
    await navigator.clipboard.writeText(linkUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const emailLink = async () => {
    if (!linkUrl || !selectedType) return
    setEmailing(true)
    try {
      const res = await fetch('/api/gift-vouchers/send-link-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(variant === 'salon' ? { kind: 'salon', salonId: businessId } : { kind: 'restaurant', restaurantId: businessId }),
          url: linkUrl,
          purchaserName, purchaserEmail,
          amountHuf: selectedType.amount_huf,
          typeName: selectedType.name,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Nem sikerült elküldeni az emailt.')
      setEmailSent(true)
      toast.success('Elküldve')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nem sikerült elküldeni az emailt.')
    } finally {
      setEmailing(false)
    }
  }

  const title = step === 'type' ? 'Válassz típust' : step === 'buyer' ? 'Vásárló adatai' : step === 'payment' ? 'Fizetés módja' : step === 'confirm' ? 'Ellenőrzés' : step === 'success' ? 'Utalvány kiállítva' : 'Fizetési link kész'

  return (
    // Széles ablak (mint az új foglalás): a típus- és az adatlépés két oszlopban fér ki; a
    // fizetés/siker lépés marad keskeny.
    <PopupModal
      open={open}
      onClose={close}
      title={title}
      subtitle="Új utalvány kiállítása"
      maxWidth={step === 'type' || step === 'buyer' ? 'sm:max-w-[760px] lg:max-w-[1000px]' : 'sm:max-w-[560px]'}
    >
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={step} custom={dir} variants={stepSlide} initial="enter" animate="center" exit="exit" transition={stepSlideTransition}>
      {step === 'type' && (
        <div className="space-y-3">
          {activeTypes.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-soft">Nincs aktív utalvány-típus — előbb hozz létre egyet a "Típusok kezelése" gombbal.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 rounded-[16px] sm:grid-cols-3 lg:grid-cols-4">
              {activeTypes.map((t) => {
                const url = imageUrlOf(t.image)
                const selected = selectedTypeId === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedTypeId(t.id); goTo('buyer', 1) }}
                    className={cn(
                      'flex flex-col items-start overflow-hidden rounded-[14px] border text-left transition-colors',
                      selected ? 'border-gold bg-gold/10' : 'border-line hover:bg-paper',
                    )}
                  >
                    <div className="h-20 w-full bg-paper">
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><ImagePlus className="h-5 w-5 text-ink-soft2" /></div>
                      )}
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="truncate text-[12.5px] font-medium text-ink">{t.name}</div>
                      <div className="text-[12px] text-ink-soft">{formatPrice(t.amount_huf, 'HUF')}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {step === 'buyer' && (
        // Adatlap-stílus (FormSheet) — ugyanaz, mint a foglalás- és a munkatárs-szerkesztő ablakban
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => goTo('type', -1)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
              <ChevronLeft className="h-3.5 w-3.5" /> Vissza
            </button>
            {selectedType && (
              <span className={pillSmCls(true)}>
                {selectedType.name} · {formatPrice(selectedType.amount_huf, 'HUF')}
              </span>
            )}
          </div>

          {/* két oszlop: balra a vásárló (számlázás), jobbra a megajándékozott */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-8">
          <section>
            <SectionBar icon={UserRound} label="Vásárló" />
            <div key={`name-${shakeKey}`} className={cn(fieldErrors.name && 'animate-shake')}>
              <FieldRow label="Név *" hint={fieldErrors.name} hintTone="bad">
                <input value={purchaserName} onChange={e => { setPurchaserName(e.target.value); clearFieldError('name'); typeLookup('buyer', 'name', e.target.value) }} placeholder={isCompany ? 'Cég neve' : 'Vásárló neve'} autoComplete="off" className={val} />
              </FieldRow>
              <GuestSuggestList show={showSuggest('buyer', 'name')} results={lookup.results} onPick={applySuggestion} />
            </div>
            <div key={`email-${shakeKey}`} className={cn(fieldErrors.email && 'animate-shake')}>
              <FieldRow label="Email *" hint={fieldErrors.email} hintTone="bad">
                <input type="email" value={purchaserEmail} onChange={e => { setPurchaserEmail(e.target.value); clearFieldError('email'); typeLookup('buyer', 'email', e.target.value) }} placeholder="ide megy a számla" autoComplete="off" className={val} />
              </FieldRow>
              <GuestSuggestList show={showSuggest('buyer', 'email')} results={lookup.results} onPick={applySuggestion} />
            </div>
            <div key={`city-${shakeKey}`} className={cn(fieldErrors.city && 'animate-shake')}>
              <FieldRow label="Település *" hint={fieldErrors.city} hintTone="bad">
                <input value={purchaserCity} onChange={e => { setPurchaserCity(e.target.value); clearFieldError('city') }} placeholder="Irányítószám, város" className={val} />
              </FieldRow>
            </div>
            <div key={`address-${shakeKey}`} className={cn(fieldErrors.address && 'animate-shake')}>
              <FieldRow label="Cím *" hint={fieldErrors.address ?? 'Cím nélkül a Számlázz.hu nem tudja emailben kiküldeni a számlát.'} hintTone={fieldErrors.address ? 'bad' : 'muted'}>
                <input value={purchaserAddress} onChange={e => { setPurchaserAddress(e.target.value); clearFieldError('address') }} placeholder="Utca, házszám" className={val} />
              </FieldRow>
            </div>
            <FieldRow label="Céges" last={!isCompany}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-ink">{isCompany ? 'Adószámos számla' : 'Magánszemély'}</span>
                <Switch size="sm" checked={isCompany} onChange={setIsCompany} ariaLabel="Céges vásárló" />
              </div>
            </FieldRow>
            {isCompany && (
              <div key={`taxNumber-${shakeKey}`} className={cn(fieldErrors.taxNumber && 'animate-shake')}>
                <FieldRow label="Adószám *" last hint={fieldErrors.taxNumber ?? 'A „Név” mezőbe ekkor a cég neve kerüljön.'} hintTone={fieldErrors.taxNumber ? 'bad' : 'muted'}>
                  <input value={purchaserTaxNumber} onChange={e => { setPurchaserTaxNumber(e.target.value); clearFieldError('taxNumber') }} placeholder="12345678-1-42" className={val} />
                </FieldRow>
              </div>
            )}
          </section>

          {/* flex-col: az Üzenet mező kitölti a maradék magasságot (a bal oszlop aljáig) */}
          <section className="flex flex-col">
            <SectionBar icon={Gift} label="Megajándékozott" />
            <FieldRow label="Név">
              <input value={recipientName} onChange={e => { setRecipientName(e.target.value); typeLookup('recipient', 'name', e.target.value) }} placeholder="opcionális" autoComplete="off" className={val} />
            </FieldRow>
            <GuestSuggestList show={showSuggest('recipient', 'name')} results={lookup.results} onPick={applySuggestion} />
            <div key={`recipientEmail-${shakeKey}`} className={cn(fieldErrors.recipientEmail && 'animate-shake')}>
              <FieldRow label="Email" hint={fieldErrors.recipientEmail ?? 'Ha megadod, neki is elküldjük az utalványt.'} hintTone={fieldErrors.recipientEmail ? 'bad' : 'muted'}>
                <input type="email" value={recipientEmail} onChange={e => { setRecipientEmail(e.target.value); clearFieldError('recipientEmail'); typeLookup('recipient', 'email', e.target.value) }} placeholder="opcionális" autoComplete="off" className={val} />
              </FieldRow>
              <GuestSuggestList show={showSuggest('recipient', 'email')} results={lookup.results} onPick={applySuggestion} />
            </div>
            <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
              <span className="text-[13px] text-ink-soft">Üzenet</span>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Pl. Boldog születésnapot!" className="min-h-[72px] w-full flex-1 resize-none bg-transparent text-[14px] leading-relaxed text-ink [overflow-wrap:anywhere] placeholder:text-ink-soft2 focus:outline-none" />
            </div>
          </section>
          </div>

          <button
            type="button"
            onClick={goToPaymentStep}
            className="flex h-11 w-full items-center justify-center rounded-dav-pill lg:ml-auto lg:w-[260px] bg-ink-dark text-[14px] font-semibold text-white transition-colors hover:bg-ink"
          >
            Tovább
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-3">
          <button onClick={() => goTo('buyer', -1)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
            <ChevronLeft className="h-3.5 w-3.5" /> Vissza
          </button>
          {/* a fizetési link az elsődleges (a vendég maga fizet) — alatta a helyszíni fizetés */}
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit('link')}
            className="flex w-full items-center justify-between rounded-[14px] border border-line px-4 py-3.5 text-left transition-colors hover:bg-paper disabled:opacity-60"
          >
            <div>
              <div className="text-[13.5px] font-semibold text-ink">Fizetési link küldése</div>
              <div className="text-[12px] text-ink-soft">A vendég a saját eszközén fizet — a kód csak sikeres fizetés után jön létre.</div>
            </div>
            {submitting && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-soft" />}
          </button>
          <div className="rounded-[14px] border border-line px-4 py-3.5">
            <div className="text-[13.5px] font-semibold text-ink">Már kifizetve, helyben</div>
            <div className="text-[12px] text-ink-soft">Hogyan fizettek? A következő lépésben még ellenőrizheted, mielőtt kiállítjuk.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([['cash', 'Készpénz'], ['pos_card', 'Bankkártya'], ['transfer', 'Átutalás']] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  disabled={submitting}
                  onClick={() => { setPaidMethod(m); goTo('confirm', 1) }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-dav-pill border border-line bg-white px-4 text-[13px] font-semibold text-ink transition-colors hover:border-ink-dark disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && paidMethod && selectedType && (
        <div className="space-y-4">
          <button onClick={() => goTo('payment', -1)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
            <ChevronLeft className="h-3.5 w-3.5" /> Vissza
          </button>
          <section>
            <SectionBar icon={Gift} label="Összegzés" />
            <FieldRow label="Utalvány"><span className="text-[14px] text-ink">{selectedType.name} · <b>{formatPrice(selectedType.amount_huf, 'HUF')}</b></span></FieldRow>
            <FieldRow label="Vásárló"><span className="block truncate text-[14px] text-ink">{purchaserName} · {purchaserEmail}</span></FieldRow>
            {recipientName || recipientEmail ? (
              <FieldRow label="Megajándékozott"><span className="block truncate text-[14px] text-ink">{[recipientName, recipientEmail].filter(Boolean).join(' · ')}</span></FieldRow>
            ) : null}
            <FieldRow label="Fizetés" last><span className="text-[14px] text-ink">{PAID_LABEL[paidMethod]} — már kifizetve, helyben</span></FieldRow>
          </section>
          {/* Mi történik kiállításkor — ugyanaz az adatlap-sor stílus, a számlázónál élő státusszal */}
          <section>
            <SectionBar icon={Receipt} label="Kiállításkor" />
            <FieldRow label="Kód"><span className="text-[13px] text-ink">Azonnal aktív, QR-kóddal</span></FieldRow>
            <FieldRow label="Email"><span className="block truncate text-[13px] text-ink">{[purchaserEmail, recipientEmail].filter(Boolean).join(', ')}</span></FieldRow>
            {/* Számla kiállítása: kapcsoló + mellette a számlázó bekötésének élő státusza.
                Ha nincs (jól) bekötve: figyelmeztető szín + link a Beállítások → Számlázás fülre. */}
            <FieldRow
              label="Számla kiállítása"
              wideLabel
              last
              hint={invoiceStatus && !invoiceStatus.ok ? invoiceStatus.reason : undefined}
              hintTone="warn"
            >
              <div className="flex items-center gap-3">
                <InvoiceStatusValue status={invoiceStatus} />
                <Switch size="sm" checked={willInvoice} disabled={!invoiceStatus?.ok} onChange={setIssueInvoice} ariaLabel="Számla kiállítása" />
              </div>
            </FieldRow>
            {invoiceStatus && !invoiceStatus.ok && (
              <div className="px-3 pt-1">
                <a href={variant === 'salon' ? '/dashboard/settings?tab=invoicing' : '/restaurant/settings?tab=invoicing'} className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 underline-offset-2 hover:underline">
                  Számlázó beállítása <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </section>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit('paid', paidMethod)}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-dav-pill bg-ink-dark text-[14px] font-semibold text-white transition-colors hover:bg-ink disabled:opacity-40"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Utalvány kiállítása
          </button>
        </div>
      )}

      {step === 'success' && result && (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500" />
          <p className="text-xl font-semibold tracking-wide text-ink">{result.code}</p>
          <p className="mt-1 text-sm text-ink-soft">{formatPrice(result.amountHuf, 'HUF')}{paidMethod ? ` · ${PAID_LABEL[paidMethod]}` : ''}</p>
          <p className="mt-2 text-[12px] text-ink-soft2">Emailben elküldve: {purchaserEmail}{recipientEmail ? `, ${recipientEmail}` : ''}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.qrCodeDataUrl} alt="QR-kód" className="mx-auto my-5 h-36 w-36 rounded-[12px]" />
          <button type="button" onClick={close} className="flex h-11 w-full items-center justify-center rounded-dav-pill bg-ink-dark text-[14px] font-semibold text-white transition-colors hover:bg-ink">
            Kész
          </button>
        </div>
      )}

      {step === 'link' && linkUrl && (
        <div className="space-y-4 text-center">
          <p className="text-[13px] text-ink-soft">Mutasd meg vagy küldd el ezt a linket a vendégnek.</p>
          <div className="flex items-center gap-2 rounded-[12px] border border-line-strong bg-white px-3.5 py-3">
            <span className="min-w-0 flex-1 truncate text-left text-[12.5px] text-ink">{linkUrl}</span>
            <button type="button" onClick={copyLink} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-white">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={emailLink}
            disabled={emailing || emailSent}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-dav-pill border border-line bg-white text-[14px] font-semibold text-ink transition-colors hover:border-line-strong disabled:opacity-60"
          >
            {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : emailSent ? <Check className="h-4 w-4 text-emerald-600" /> : <Mail className="h-4 w-4" />}
            {emailSent ? 'Elküldve a vásárlónak' : 'Elküldés emailben a vásárlónak'}
          </button>
          <div className="flex items-center justify-center gap-2 rounded-[12px] bg-gold/10 px-3.5 py-3 text-[13px] font-medium text-ink">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Várakozás a vendég fizetésére…
          </div>
          {/* Számla: fizetési linknél mindig készül — ha nincs (jól) bekötve számlázó, itt jelezzük */}
          <div className="text-left">
            <FieldRow label="Számla" last hint={invoiceStatus && !invoiceStatus.ok ? invoiceStatus.reason : invoiceStatus?.ok ? 'Sikeres fizetés után automatikusan kiáll.' : undefined} hintTone={invoiceStatus && !invoiceStatus.ok ? 'warn' : 'muted'}>
              <InvoiceStatusValue status={invoiceStatus} />
            </FieldRow>
            {invoiceStatus && !invoiceStatus.ok && (
              <div className="px-3 pt-1">
                <a href={variant === 'salon' ? '/dashboard/settings?tab=invoicing' : '/restaurant/settings?tab=invoicing'} className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 underline-offset-2 hover:underline">
                  Számlázó beállítása <ChevronRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={cancelLink} disabled={cancellingLink} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-dav-pill border border-line bg-white text-[14px] font-medium text-[#C0453F] transition-colors hover:border-[#C0453F]/40 disabled:opacity-50">
              {cancellingLink && <Loader2 className="h-4 w-4 animate-spin" />} Mégse — link visszavonása
            </button>
            <button type="button" onClick={close} className="flex h-11 flex-1 items-center justify-center rounded-dav-pill bg-ink-dark text-[14px] font-semibold text-white transition-colors hover:bg-ink">
              Bezárás
            </button>
          </div>
          <p className="text-[11.5px] text-ink-soft2">Bezárás után a link „Függőben” látszik a listában; fizetés után ott jelenik meg az utalvány.</p>
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </PopupModal>
  )
}

/** A számlázó bekötésének állapota a „Számla kiállítása” kapcsoló mellett. */
function InvoiceStatusValue({ status }: { status: { provider: string | null; ok: boolean; detail?: string } | null }) {
  if (!status) return <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Ellenőrzés…</span>
  if (!status.ok) return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-amber-600"><TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.2} /> {status.provider ? 'Hibás bekötés' : 'Nincs bekötve'}</span>
  return <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1D7A4C]"><Check className="h-3.5 w-3.5" strokeWidth={2.4} /> {status.detail}</span>
}
