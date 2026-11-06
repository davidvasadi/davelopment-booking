'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { toast } from 'sonner'
import { trackEvent } from '@/lib/adsTracking'
import { SUB_TYPES } from '@/lib/businessTemplates'
import { REGISTER_RESTAURANT_TYPES, RESTAURANT_TEMPLATES } from '@/lib/restaurantTemplates'
import { AuthMobile, AuthScreen, LoginCodeForm } from '@/components/blocks/auth'
import { AccountStep, BusinessTypeStep, ImportStep, ReadyCard, Steps, type AccountValues } from '@/components/blocks/onboarding'
import { AuthVideoBg } from '@/components/auth/AuthVideoBg'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { WizardImportStep } from '@/components/auth/WizardImportStep'
import { useAvailabilityCheck } from '@/components/auth/useAvailabilityCheck'
import { slugify } from '@/lib/slug'

/**
 * Regisztráció (design 3.3) — szalon és étterem egy folyamatban: 1 vállalkozás (szalon: szolgáltatás-típusok, étterem:
 * a hely típusa — ebből jönnek a minta-kategóriák / termek), 2 fiók: adatok → kód e-mailben → a kód beírásakor jön
 * létre a fiók és be is lép (jelszó nincs, a kód egyben e-mail-megerősítés); vagy Google, 3 import (kihagyható),
 * 4 kész: a foglalóoldal linkje, irány a dashboard. A bal panel üzenete lépésenként változik.
 */
const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://booking.davelopment.hu').replace(/^https?:\/\//, '').replace(/\/$/, '')
const RESEND_SECONDS = 30
const TITLES = [
  { title: <>Indulj el<br />30 nap<br />ingyen.</>, sub: 'Beállítjuk az alapokat — kategóriák, minta szolgáltatások —, te csak testreszabod.' },
  { title: <>Pár adat,<br />és kész<br />a fiók.</>, sub: 'Jelszó nincs — egy kódot küldünk e-mailben, azzal lépsz be most és később is.' },
  { title: <>Hozd át,<br />ami már<br />megvan.</>, sub: 'Vendégek, szolgáltatások, munkatársak egy fájlból — vagy hagyd ki, és kezdd tisztán.' },
  { title: <>Jöhetnek<br />a vendégek.</>, sub: 'A foglalóoldalad él — oszd meg, és fogadd az első foglalást.' },
]
const ERR: Record<string, string> = {
  already_registered: 'Ezzel az e-mail címmel már van fiók — lépj be.',
  rate_limited: 'Túl sok kérés — próbáld újra pár perc múlva.',
  send_failed: 'Nem sikerült elküldeni a kódot — próbáld újra.',
  expired: 'Lejárt a kód — kérj újat.',
  locked: 'Túl sok hibás próbálkozás — kérj új kódot.',
  create_failed: 'Nem sikerült létrehozni a fiókot — próbáld újra.',
}

export function RegisterFlow({ initialKind = 'salon' }: { initialKind?: 'salon' | 'restaurant' }) {
  const params = useSearchParams()
  const tier = params.get('tier') === 'pro' ? 'pro' : params.get('tier') === 'starter' ? 'starter' : undefined
  const [mounted, setMounted] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<'salon' | 'restaurant'>(params.get('type') === 'restaurant' ? 'restaurant' : initialKind)
  const [types, setTypes] = useState<string[]>([])
  const [template, setTemplate] = useState<string>(REGISTER_RESTAURANT_TYPES[0].id)
  const [v, setV] = useState<AccountValues>({ placeName: '', ownerName: '', email: '', city: '', phone: '', consent: false })
  const [errors, setErrors] = useState<Partial<Record<keyof AccountValues, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [codeStep, setCodeStep] = useState(false)
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [slug, setSlug] = useState('')
  const [home, setHome] = useState('/dashboard')
  // ajánló program: a kód a linkből (`/r/<kód>` → ?ref= és süti) vagy kézzel; érvényesség + ki ajánlotta
  const [refCode, setRefCode] = useState('')
  const [ref, setRef] = useState<{ status: 'idle' | 'checking' | 'ok' | 'bad'; by: string | null }>({ status: 'idle', by: null })
  useEffect(() => {
    const fromCookie = document.cookie.split('; ').find((c) => c.startsWith('dav_ref='))?.slice(8)
    const c = (params.get('ref') ?? (fromCookie ? decodeURIComponent(fromCookie) : '')).toUpperCase()
    if (c) setRefCode(c)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = refCode.trim()
    if (!c) { setRef({ status: 'idle', by: null }); return }
    setRef((r) => ({ ...r, status: 'checking' }))
    const t = setTimeout(() => {
      void fetch(`/api/referral/check?code=${encodeURIComponent(c)}`).then((r) => r.json()).then((j: { valid?: boolean; by?: string }) => setRef(j.valid ? { status: 'ok', by: j.by ?? null } : { status: 'bad', by: null })).catch(() => setRef({ status: 'idle', by: null }))
    }, 400)
    return () => clearTimeout(t)
  }, [refCode])

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 1024px)')
    const up = () => setDesktop(mq.matches)
    up(); mq.addEventListener('change', up)
    return () => mq.removeEventListener('change', up)
  }, [])
  useEffect(() => { trackEvent('ads_conversion_signup', { kind }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (resendIn <= 0) return; const t = setTimeout(() => setResendIn((s) => s - 1), 1000); return () => clearTimeout(t) }, [resendIn])

  const nameStatus = useAvailabilityCheck('business-name', v.placeName, v.placeName.trim().length >= 2)
  const options = kind === 'salon' ? SUB_TYPES.map((t) => ({ id: t.type, label: t.label })) : REGISTER_RESTAURANT_TYPES
  // étteremnél: mit tölt be a választott sablon
  const hint = kind === 'restaurant' ? RESTAURANT_TEMPLATES.find((t) => t.id === template)?.description : undefined
  const selected = kind === 'salon' ? types : [template]
  const account = () => ({ kind, ownerName: v.ownerName.trim(), placeName: v.placeName.trim(), city: v.city.trim() || undefined, phone: v.phone.trim() || undefined, tier, ...(ref.status === 'ok' ? { referralCode: refCode.trim() } : {}), ...(kind === 'salon' ? { businessTypes: types } : { templateId: template }) })

  const validate = () => {
    const e: typeof errors = {}
    if (v.placeName.trim().length < 2) e.placeName = 'Add meg a nevet'
    else if (nameStatus === 'taken') e.placeName = 'Ez a név már foglalt — válassz másikat'
    if (v.ownerName.trim().length < 2) e.ownerName = 'Add meg a neved'
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Érvényes e-mail címet adj meg'
    if (!v.consent) e.consent = 'Fogadd el az ÁSZF-et a folytatáshoz'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const sendCode = async () => {
    if (!validate()) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/auth/code/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: v.email.trim(), purpose: 'register', account: account() }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(ERR[j.error] ?? 'Nem sikerült — ellenőrizd az adatokat.'); return }
      setCode(''); setCodeStep(true); setResendIn(RESEND_SECONDS)
    } finally { setBusy(false) }
  }

  const verify = async (value = code) => {
    if (value.length < 6 || busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/auth/code/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email: v.email.trim(), code: value }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.error === 'wrong' ? `Hibás kód — még ${j.left} próbálkozás.` : ERR[j.error] ?? 'Nem sikerült — próbáld újra.'); setCode(''); return }
      setSlug(slugify(v.placeName)); setHome(j.redirect ?? '/dashboard')
      trackEvent('ads_conversion_booking', { kind })
      setCodeStep(false); setStep(2)
    } finally { setBusy(false) }
  }

  const google = async () => {
    if (!validate()) return
    // a Google-regisztráció a sütiből veszi át az ajánló kódot
    if (ref.status === 'ok') document.cookie = `dav_ref=${encodeURIComponent(refCode.trim())}; path=/; max-age=${60 * 86400}; samesite=lax`
    const r = await fetch('/api/auth/prepare-registration', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: kind === 'salon' ? 'salon_owner' : 'restaurant_owner', ownerName: v.ownerName.trim(), placeName: v.placeName.trim(), city: v.city.trim(), phone: v.phone.trim(), tier }) })
    if (!r.ok) { setError('Nem sikerült előkészíteni a regisztrációt.'); return }
    await signIn('google', { callbackUrl: '/api/auth/complete-registration' })
  }

  const copy = () => { void navigator.clipboard?.writeText(`https://${APP_HOST}/${slug}`).then(() => toast.success('Link másolva')) }

  if (!mounted) return <div className="min-h-dvh bg-ui-dark" />

  // mobilon minden lépés a sötét videón, üvegből (mint a belépés, design 3.5)
  const dark = !desktop
  const body = codeStep ? (
    <>
      <Steps active={1} dark={dark} />
      <LoginCodeForm dark={dark} email={v.email.trim()} code={code} onCode={(c) => { setCode(c); setError(null) }} onSubmit={(c) => void verify(c)} busy={busy} error={error}
        onOtherEmail={() => { setCodeStep(false); setError(null) }} onResend={() => void sendCode()} resendIn={resendIn} submitLabel="Fiók létrehozása" />
    </>
  ) : step === 0 ? (
    <>
      <BusinessTypeStep dark={dark} kind={kind} onKind={(k) => { setKind(k); setError(null) }} options={options} selected={selected}
        onToggle={(id) => (kind === 'salon' ? setTypes([id]) : setTemplate(id))} hint={hint} onNext={() => setStep(1)} />
      <div className={`mt-4 text-center text-ui-meta ${dark ? 'text-white/60' : 'text-ui-muted'}`}>Már van fiókod? <a href="/login" className={`underline underline-offset-4 ${dark ? 'text-white' : 'text-ui-text'}`}>Bejelentkezés</a></div>
    </>
  ) : step === 1 ? (
    <AccountStep dark={dark} kind={kind} values={v} onChange={(p) => { setV((x) => ({ ...x, ...p })); setErrors((e) => { const n = { ...e }; for (const k of Object.keys(p)) delete n[k as keyof AccountValues]; return n }); setError(null) }}
      referral={{ code: refCode, onCode: setRefCode, status: ref.status, by: ref.by }}
      slugUrl={`${APP_HOST}/${slugify(v.placeName) || '…'}`} slugStatus={nameStatus} errors={errors} error={error} busy={busy} onSubmit={() => void sendCode()} onBack={() => setStep(0)}
      google={<GoogleSignInButton variant={dark ? 'dark' : 'light'} spread={!dark} label="Folytatás Google-lel" onClick={() => void google()} />} termsHref="/terms" />
  ) : step === 2 ? (
    <ImportStep dark={dark}><WizardImportStep isDark={dark} onContinue={() => setStep(3)} /></ImportStep>
  ) : (
    <ReadyCard kind={kind} url={`${APP_HOST}/${slug}`} onCopy={copy} href={home} />
  )

  const t = ref.status === 'ok' && step < 2 && !codeStep
    ? { title: <>Jó helyen<br />jársz.</>, sub: `${ref.by ?? 'Egy partnerünk'} ajánlott — 30 nap ingyenes próba, kártya nélkül. Ha te is ajánlasz valakit, aki előfizet, egy hónapot kapsz ingyen.` }
    : TITLES[codeStep ? 1 : step]
  return desktop
    ? <AuthScreen full media={<AuthVideoBg />} logoHref="/" title={t.title} sub={t.sub}>{body}</AuthScreen>
    : (
      <AuthMobile full media={<AuthVideoBg fullScreen />} logoHref="/" onBack={step > 0 && step < 2 ? () => (codeStep ? setCodeStep(false) : setStep(step - 1)) : undefined}>
        {body}
      </AuthMobile>
    )
}
