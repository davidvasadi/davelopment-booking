'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Copy, Check, CheckCircle2, ImagePlus, Mail, ArrowLeft } from 'lucide-react'
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

type Step = 'type' | 'buyer' | 'payment' | 'success' | 'link'

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

  const submit = async (paymentMode: 'paid' | 'link') => {
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

  const title = step === 'type' ? 'Válassz típust' : step === 'buyer' ? 'Vásárló adatai' : step === 'payment' ? 'Fizetés módja' : step === 'success' ? 'Utalvány kiállítva' : 'Fizetési link kész'

  return (
    <PopupModal open={open} onClose={close} title={title} subtitle="Új utalvány kiállítása">
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div key={step} custom={dir} variants={stepSlide} initial="enter" animate="center" exit="exit" transition={stepSlideTransition}>
      {step === 'type' && (
        <div className="space-y-3">
          {activeTypes.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-soft">Nincs aktív utalvány-típus — előbb hozz létre egyet a "Típusok kezelése" gombbal.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 rounded-[16px]">
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
        <div className="space-y-3">
          <button onClick={() => goTo('type', -1)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Vissza
          </button>
          {selectedType && (
            <p className="text-[13px] text-ink-soft">
              {selectedType.name} · <span className="font-semibold text-ink">{formatPrice(selectedType.amount_huf, 'HUF')}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div key={`name-${shakeKey}`} className={cn(fieldErrors.name && 'animate-shake')}>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Vásárló neve *</label>
              <input
                value={purchaserName} onChange={e => { setPurchaserName(e.target.value); clearFieldError('name') }}
                className={cn('mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60', fieldErrors.name && 'ring-1 ring-red-400 border-red-400')}
              />
              {fieldErrors.name && <p role="alert" className="mt-1 text-[11px] text-red-400">{fieldErrors.name}</p>}
            </div>
            <div key={`email-${shakeKey}`} className={cn(fieldErrors.email && 'animate-shake')}>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Email *</label>
              <input
                type="email" value={purchaserEmail} onChange={e => { setPurchaserEmail(e.target.value); clearFieldError('email') }}
                className={cn('mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60', fieldErrors.email && 'ring-1 ring-red-400 border-red-400')}
              />
              {fieldErrors.email && <p role="alert" className="mt-1 text-[11px] text-red-400">{fieldErrors.email}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div key={`city-${shakeKey}`} className={cn(fieldErrors.city && 'animate-shake')}>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Település *</label>
              <input
                value={purchaserCity} onChange={e => { setPurchaserCity(e.target.value); clearFieldError('city') }}
                className={cn('mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60', fieldErrors.city && 'ring-1 ring-red-400 border-red-400')}
              />
              {fieldErrors.city && <p role="alert" className="mt-1 text-[11px] text-red-400">{fieldErrors.city}</p>}
            </div>
            <div key={`address-${shakeKey}`} className={cn(fieldErrors.address && 'animate-shake')}>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Cím *</label>
              <input
                value={purchaserAddress} onChange={e => { setPurchaserAddress(e.target.value); clearFieldError('address') }}
                className={cn('mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60', fieldErrors.address && 'ring-1 ring-red-400 border-red-400')}
              />
              {fieldErrors.address && <p role="alert" className="mt-1 text-[11px] text-red-400">{fieldErrors.address}</p>}
            </div>
          </div>
          <p className="-mt-1.5 text-[11px] text-ink-soft2">Település és cím nélkül a Számlázz.hu nem tudja kiküldeni a számlát emailben.</p>

          <div className="flex items-center justify-between gap-3 py-1">
            <span className="text-[13px] text-ink">Céges vásárló (adószámos számla kell)</span>
            <Switch checked={isCompany} onChange={setIsCompany} ariaLabel="Céges vásárló" />
          </div>
          {isCompany && (
            <div key={`taxNumber-${shakeKey}`} className={cn(fieldErrors.taxNumber && 'animate-shake')}>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Adószám *</label>
              <input
                value={purchaserTaxNumber} onChange={e => { setPurchaserTaxNumber(e.target.value); clearFieldError('taxNumber') }}
                placeholder="12345678-1-42"
                className={cn('mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60', fieldErrors.taxNumber && 'ring-1 ring-red-400 border-red-400')}
              />
              {fieldErrors.taxNumber ? (
                <p role="alert" className="mt-1 text-[11px] text-red-400">{fieldErrors.taxNumber}</p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-soft2">A "Vásárló neve" mezőbe ekkor a cég neve kerüljön.</p>
              )}
            </div>
          )}

          <div className="!mt-5 h-px bg-line" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Megajándékozott neve</label>
              <input value={recipientName} onChange={e => setRecipientName(e.target.value)} className="mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60" />
            </div>
            <div key={`recipientEmail-${shakeKey}`} className={cn(fieldErrors.recipientEmail && 'animate-shake')}>
              <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Email</label>
              <input
                type="email" value={recipientEmail} onChange={e => { setRecipientEmail(e.target.value); clearFieldError('recipientEmail') }}
                className={cn('mt-1.5 h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60', fieldErrors.recipientEmail && 'ring-1 ring-red-400 border-red-400')}
              />
              {fieldErrors.recipientEmail ? (
                <p role="alert" className="mt-1 text-[11px] text-red-400">{fieldErrors.recipientEmail}</p>
              ) : (
                <p className="mt-1 text-[11px] text-ink-soft2">Ha megadod, neki is elküldjük az utalványt.</p>
              )}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Üzenet (opcionális)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className="mt-1.5 w-full rounded-[12px] border border-line-strong bg-white px-3.5 py-2.5 text-sm text-ink focus-visible:ring-2 focus-visible:ring-gold/60" />
          </div>
          <button
            type="button"
            onClick={goToPaymentStep}
            className="flex h-11 w-full items-center justify-center rounded-[12px] bg-ink-dark text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Tovább
          </button>
        </div>
      )}

      {step === 'payment' && (
        <div className="space-y-3">
          <button onClick={() => goTo('buyer', -1)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" /> Vissza
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit('paid')}
            className="flex w-full items-center justify-between rounded-[14px] border border-line px-4 py-3.5 text-left transition-colors hover:bg-paper disabled:opacity-60"
          >
            <div>
              <div className="text-[13.5px] font-semibold text-ink">Már kifizetve</div>
              <div className="text-[12px] text-ink-soft">Helyszíni készpénz/kártya — a kód azonnal kiállításra kerül.</div>
            </div>
            {submitting && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-soft" />}
          </button>
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
        </div>
      )}

      {step === 'success' && result && (
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500" />
          <p className="text-xl font-semibold tracking-wide text-ink">{result.code}</p>
          <p className="mt-1 text-sm text-ink-soft">{formatPrice(result.amountHuf, 'HUF')}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.qrCodeDataUrl} alt="QR-kód" className="mx-auto my-5 h-36 w-36 rounded-[12px]" />
          <button type="button" onClick={close} className="flex h-11 w-full items-center justify-center rounded-[12px] bg-ink-dark text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90">
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
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-line-strong bg-white text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper disabled:opacity-60"
          >
            {emailing ? <Loader2 className="h-4 w-4 animate-spin" /> : emailSent ? <Check className="h-4 w-4 text-emerald-600" /> : <Mail className="h-4 w-4" />}
            {emailSent ? 'Elküldve a vásárlónak' : 'Elküldés emailben a vásárlónak'}
          </button>
          <div className="flex items-center justify-center gap-2 rounded-[12px] bg-gold/10 px-3.5 py-3 text-[13px] font-medium text-ink">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Várakozás a vendég fizetésére…
          </div>
          <button type="button" onClick={close} className="flex h-11 w-full items-center justify-center rounded-[12px] bg-white text-[13.5px] font-semibold text-ink shadow-[0_2px_6px_rgba(70,60,20,.07)] transition-colors hover:bg-paper">
            Bezárás
          </button>
          <p className="text-[11.5px] text-ink-soft2">Bezárás után is feldolgozzuk a fizetést a háttérben — az utalvány a listában jelenik meg, ha megtörtént.</p>
        </div>
      )}
        </motion.div>
      </AnimatePresence>
    </PopupModal>
  )
}
