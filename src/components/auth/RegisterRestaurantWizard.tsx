'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, Check, Loader2, UtensilsCrossed } from 'lucide-react'
import { motion } from 'framer-motion'
import { listStagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { RESTAURANT_TEMPLATES } from '@/lib/restaurantTemplates'
import { BrandLogo } from '@/components/BrandLogo'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import {
  authInputBase, authInputDark, authLabelBase, authLabelDark,
  authPillBtn, authPillBtnLight, authGhostBtnDark,
  authDivider, authDividerDark, authErrorText, authErrorTextDark,
  BRAND_COPYRIGHT,
} from '@/components/auth/authStyles'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { WizardImportStep } from '@/components/auth/WizardImportStep'
import { AuthVideoBg } from '@/components/auth/AuthVideoBg'

const step2Schema = z.object({
  restaurantName: z.string().min(2, 'Minimum 2 karakter'),
  ownerName: z.string().min(2, 'Minimum 2 karakter'),
  email: z.string().email('Érvényes email szükséges'),
  password: z.string().min(8, 'Minimum 8 karakter'),
  city: z.string().min(2, 'Kötelező'),
  phone: z.string().min(7, 'Érvényes telefonszám'),
})
type Step2Data = z.infer<typeof step2Schema>

export function RegisterRestaurantWizard() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | number | null>(null)

  // Két különálló useForm példány a mobil + desktop form-hoz (lásd RegisterWizard magyarázat)
  const mobileForm = useForm<Step2Data>({ resolver: zodResolver(step2Schema) })
  const desktopForm = useForm<Step2Data>({ resolver: zodResolver(step2Schema) })

  /** Google-folytatás a regisztráció utolsó adatbeviteli lépésén (lásd RegisterWizard) */
  const continueWithGoogle = async (form: typeof mobileForm) => {
    const ok = await form.trigger(['restaurantName', 'ownerName', 'city', 'phone'])
    if (!ok) {
      toast.error('Töltsd ki a kötelező mezőket')
      return
    }
    const v = form.getValues()
    try {
      const res = await fetch('/api/auth/prepare-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'restaurant_owner',
          ownerName: v.ownerName,
          placeName: v.restaurantName,
          city: v.city,
          phone: v.phone,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json?.error ?? 'Nem sikerült előkészíteni a regisztrációt')
        return
      }
      const { signIn } = await import('next-auth/react')
      await signIn('google', { callbackUrl: '/api/auth/complete-registration' })
    } catch {
      toast.error('Nem sikerült elindítani a Google-bejelentkezést')
    }
  }

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const onStep2 = async (data: Step2Data) => {
    setLoading(true)
    try {
      let userId_: string
      let authToken_: string

      const email = data.email.toLowerCase().trim()
      const password = data.password

      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.ownerName, email, password, role: 'restaurant_owner' }),
      })

      if (!userRes.ok) {
        const err = await userRes.json()
        const msg: string = err.errors?.[0]?.message ?? ''
        const isDuplicate = msg.toLowerCase().includes('uniqueness') || msg.toLowerCase().includes('already registered')
        if (!isDuplicate) {
          const status = userRes.status
          throw new Error(`Regisztráció sikertelen (${status}). Ellenőrizd az adatokat.`)
        }

        const recoveryLogin = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        })
        if (!recoveryLogin.ok) throw new Error('Ez az email már regisztrált, de a jelszó nem stimmel. Jelentkezz be!')
        const recoveryData = await recoveryLogin.json()
        authToken_ = recoveryData.token
        userId_ = recoveryData.user?.id ?? recoveryData.user

        const meRes = await fetch('/api/users/me', { credentials: 'include' })
        const meData = await meRes.json()
        if (meData?.user?.restaurant) {
          router.push('/restaurant')
          return
        }
      } else {
        const { doc: user } = await userRes.json()
        userId_ = user.id

        const loginRes = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        })
        if (!loginRes.ok) {
          const loginStatus = loginRes.status
          throw new Error(`Bejelentkezés sikertelen (${loginStatus}) a regisztráció után. Próbálj belépni manuálisan.`)
        }
        const loginData = await loginRes.json()
        authToken_ = loginData.token
      }

      const baseSlug = generateSlug(data.restaurantName)
      let slug = baseSlug
      let restaurantRes = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
        body: JSON.stringify({ name: data.restaurantName, slug, owner: userId_, phone: data.phone, city: data.city, is_active: true }),
      })
      if (!restaurantRes.ok) {
        slug = `${baseSlug}-${Date.now().toString(36)}`
        restaurantRes = await fetch('/api/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
          body: JSON.stringify({ name: data.restaurantName, slug, owner: userId_, phone: data.phone, city: data.city, is_active: true }),
        })
        if (!restaurantRes.ok) throw new Error('Étterem létrehozása sikertelen')
      }
      const { doc: restaurant } = await restaurantRes.json()
      setRestaurantId(restaurant.id)

      // A user.restaurant a PRIMER étterem-jelölés; az aktív üzletet is az újra állítjuk, hogy
      // egy vegyes fiók (aki máshol alkalmazott) a saját friss éttermén kössön ki, ne a régi
      // munkahelyén (különben a /restaurant redirect az aktív membership-üzletre vinné).
      await fetch(`/api/users/${userId_}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
        body: JSON.stringify({ restaurant: restaurant.id, last_active_business: `restaurant:${restaurant.id}` }),
      })

      // A választott asztalfoglalás-sablon alapján a háttérben feltöltjük az étterem kezdő-
      // beállításait — a friss JWT-t fejlécként is átadjuk (nem csak a cookie-ra hagyatkozunk),
      // és a hibát már nem nyeljük el csendben (log + diszkrét, nem blokkoló jelzés).
      // Azonos minta a szalon-regisztrációval (RegisterWizard).
      if (selectedTemplate) {
        fetch('/api/restaurant/seed-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
          credentials: 'include',
          body: JSON.stringify({ restaurantId: restaurant.id, templateId: selectedTemplate }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`seed-template ${res.status}`)
          })
          .catch((e) => {
            console.warn('[register] étterem-sablon seed sikertelen:', e)
            toast.message('A beállításaidat később a vezérlőpulton módosíthatod.')
          })
      }

      setStep(3)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  const finish = async () => {
    // Az aktív üzletet a friss étteremre állítjuk (cookie + DB), mielőtt navigálunk — így egy
    // vegyes fiók (aki máshol alkalmazott) a saját friss éttermén köt ki, ne a régi munkahelyén.
    if (restaurantId) {
      await fetch('/api/business/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'restaurant', id: restaurantId }),
      }).catch(() => null)
    }
    router.push('/restaurant')
  }

  const templateCards = (isDark: boolean) => (
    <div className="grid grid-cols-1 gap-3">
      {RESTAURANT_TEMPLATES.map(tpl => {
        const isSelected = selectedTemplate === tpl.id
        return (
          <button
            key={tpl.id}
            onClick={() => setSelectedTemplate(tpl.id)}
            className={cn(
              'relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200',
              isDark && 'backdrop-blur-[10px]',
              isDark
                ? isSelected ? 'border-gold bg-white/[0.06] ring-2 ring-gold' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                : isSelected ? 'border-gold bg-gold/[0.06] ring-2 ring-gold' : 'border-line-strong bg-white hover:border-ink-soft2/50 hover:bg-paper'
            )}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
                <Check className="h-3 w-3 text-ink-dark" />
              </div>
            )}
            <p className={cn('font-semibold text-sm leading-tight pr-6', isDark ? (isSelected ? 'text-white' : 'text-white/80') : 'text-ink')}>{tpl.label}</p>
            <p className={cn('text-xs mt-1 leading-snug pr-6', isDark ? 'text-white/45' : 'text-ink-soft')}>{tpl.description}</p>
          </button>
        )
      })}
    </div>
  )

  const TOTAL_STEPS = 4
  const progressWidth = (step / TOTAL_STEPS) * 100

  const leftHeadlines: Record<number, { headline: string; sub: string }> = {
    1: { headline: 'MILYEN\nÉTTERMET\nVEZETSZ?', sub: 'Válassz egy sablont — asztalokat és turnusokat állítunk be, te csak testreszabod.' },
    2: { headline: 'CSATLAKOZZ\nHOZZÁNK.', sub: 'Hozd létre a fiókodat és az éttermed pár perc alatt.' },
    3: { headline: 'IMPORTÁLD\nAZ ADATAID.', sub: 'Ha más rendszerből váltasz, töltsd fel az exportált fájlt — asztalok, vendégek, foglalások egyszerre.' },
    4: { headline: 'KÉSZEN\nVAGYOK.', sub: 'Az éttermed elérhető az online foglaláshoz.' },
  }
  const leftText = leftHeadlines[step]

  const StepIndicator = () => (
    <div className="flex gap-1.5">
      {([1, 2, 3, 4] as const).map(s => (
        <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', s === step ? 'bg-white w-4' : s < step ? 'w-1.5 bg-white/40' : 'w-1.5 bg-white/10')} />
      ))}
    </div>
  )

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden relative min-h-dvh bg-ink-dark font-onest flex flex-col">
        <AuthVideoBg fullScreen />
        <div className="relative z-10 flex flex-col flex-1 px-7 pb-10 overflow-y-auto" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center justify-between mb-auto">
            {step === 2 ? (
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-white/45 text-sm hover:text-white/80 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Vissza
              </button>
            ) : (
              <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
                <BrandLogo variant="dark" className="h-8" />
              </Link>
            )}
            <StepIndicator />
          </div>

          {step === 1 && (
            <div className="mt-12">
              <h2 className="text-white font-light text-[2rem] uppercase leading-[1.0] tracking-[-0.02em] mb-2">
                MILYEN<br />ÉTTERMET<br />VEZETSZ?
              </h2>
              <p className="text-white/45 text-sm mb-6">Válassz egy sablont — később testreszabhatod.</p>
              {templateCards(true)}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => selectedTemplate && setStep(2)}
                  disabled={!selectedTemplate}
                  className={authPillBtnLight}
                >
                  Tovább <ChevronRight className="h-4 w-4" />
                </button>
                <Link href="/login" className="block">
                  <button className={authGhostBtnDark}>
                    Van már fiókom
                  </button>
                </Link>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-12">
              <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                CSATLAKOZZ<br />HOZZÁNK.
              </h2>
              <motion.form variants={listStagger.container} initial="hidden" animate="show" onSubmit={mobileForm.handleSubmit(onStep2)} className="space-y-3" noValidate>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Étterem neve</Label>
                  <input
                    placeholder="Pl. Bistro Central"
                    autoComplete="organization"
                    aria-invalid={!!mobileForm.formState.errors.restaurantName}
                    aria-describedby={mobileForm.formState.errors.restaurantName ? 'rreg-m-name-err' : undefined}
                    className={cn(authInputDark, mobileForm.formState.errors.restaurantName && 'ring-2 ring-red-400 border-red-400')}
                    {...mobileForm.register('restaurantName')}
                  />
                  {mobileForm.formState.errors.restaurantName && <p id="rreg-m-name-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.restaurantName.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>A te neved</Label>
                  <input
                    placeholder="Pl. Nagy Gábor"
                    autoComplete="name"
                    aria-invalid={!!mobileForm.formState.errors.ownerName}
                    aria-describedby={mobileForm.formState.errors.ownerName ? 'rreg-m-owner-err' : undefined}
                    className={cn(authInputDark, mobileForm.formState.errors.ownerName && 'ring-2 ring-red-400 border-red-400')}
                    {...mobileForm.register('ownerName')}
                  />
                  {mobileForm.formState.errors.ownerName && <p id="rreg-m-owner-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.ownerName.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Email</Label>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="te@pelda.hu"
                    aria-invalid={!!mobileForm.formState.errors.email}
                    aria-describedby={mobileForm.formState.errors.email ? 'rreg-m-email-err' : undefined}
                    className={cn(authInputDark, mobileForm.formState.errors.email && 'ring-2 ring-red-400 border-red-400')}
                    {...mobileForm.register('email')}
                  />
                  {mobileForm.formState.errors.email && <p id="rreg-m-email-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.email.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Jelszó</Label>
                  <PasswordInput
                    dark
                    autoComplete="new-password"
                    aria-invalid={!!mobileForm.formState.errors.password}
                    aria-describedby={mobileForm.formState.errors.password ? 'rreg-m-pw-err' : undefined}
                    className={cn(authInputDark, mobileForm.formState.errors.password && 'ring-2 ring-red-400 border-red-400')}
                    {...mobileForm.register('password')}
                  />
                  {mobileForm.formState.errors.password && <p id="rreg-m-pw-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.password.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Város</Label>
                    <input
                      placeholder="Budapest"
                      autoComplete="address-level2"
                      aria-invalid={!!mobileForm.formState.errors.city}
                      aria-describedby={mobileForm.formState.errors.city ? 'rreg-m-city-err' : undefined}
                      className={cn(authInputDark, mobileForm.formState.errors.city && 'ring-2 ring-red-400 border-red-400')}
                      {...mobileForm.register('city')}
                    />
                    {mobileForm.formState.errors.city && <p id="rreg-m-city-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.city.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Telefon</Label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+36 30..."
                      aria-invalid={!!mobileForm.formState.errors.phone}
                      aria-describedby={mobileForm.formState.errors.phone ? 'rreg-m-phone-err' : undefined}
                      className={cn(authInputDark, mobileForm.formState.errors.phone && 'ring-2 ring-red-400 border-red-400')}
                      {...mobileForm.register('phone')}
                    />
                    {mobileForm.formState.errors.phone && <p id="rreg-m-phone-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.phone.message}</p>}
                  </div>
                </motion.div>
                <motion.div variants={listStagger.item} className="pt-2 space-y-4">
                  <button type="submit" disabled={loading} className={authPillBtnLight}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                  </button>
                  <Link href="/login" className="block">
                    <button type="button" className={authGhostBtnDark}>
                      Van már fiókom
                    </button>
                  </Link>
                  {/* Alternatív: Google-folytatás (jelszó nélkül) — a regisztráció alján. */}
                  <div className={`${authDividerDark} pt-2`}>
                    <span className="h-px flex-1 bg-white/10" />vagy<span className="h-px flex-1 bg-white/10" />
                  </div>
                  <GoogleSignInButton
                    variant="dark"
                    label="Folytatás Google-lel"
                    onClick={() => continueWithGoogle(mobileForm)}
                  />
                </motion.div>
              </motion.form>
            </div>
          )}

          {step === 3 && (
            <div className="mt-12 flex-1 flex flex-col">
              <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-3">
                IMPORTÁLD<br />AZ ADATAID.
              </h2>
              <p className="text-white/45 text-sm mb-8">Ha más rendszerből váltasz, töltsd fel az exportált fájlt.</p>
              <WizardImportStep isDark onContinue={() => setStep(4)} />
            </div>
          )}

          {step === 4 && (
            <div className="mt-12 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                  KÉSZEN<br />VAGYOK.
                </h2>
                <div className="space-y-3">
                  {['Étterem profil létrehozva', 'Asztalok és turnusok beállítva', 'Foglalási oldal elérhető', 'Dashboard hozzáférés aktív'].map(item => (
                    <div key={item} className="flex items-center gap-3 p-3.5 bg-white/[0.04] border border-white/10 rounded-xl">
                      <div className="h-5 w-5 rounded-full bg-gold flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-ink-dark" />
                      </div>
                      <span className="text-sm font-medium text-white/80">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={finish} className={authPillBtnLight}>
                Ugrás a dashboardra <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex min-h-dvh font-onest">
        <div className="relative w-[45%] bg-ink-dark flex flex-col p-14 select-none">
          <AuthVideoBg />
          <div className="relative z-10 flex flex-col justify-between flex-1">
            <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
              <BrandLogo variant="dark" className="h-8" />
            </Link>
            <div>
              <h1 className="text-white font-light text-[3.25rem] uppercase leading-[1.05] tracking-[-0.02em] whitespace-pre-line">
                {leftText.headline}
              </h1>
              <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">{leftText.sub}</p>
            </div>
            <p className="text-white/30 text-xs">{BRAND_COPYRIGHT}</p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white [color-scheme:light] overflow-y-auto">
          <div className="w-full max-w-sm">
            <div className="h-1 bg-line rounded-full mb-10 overflow-hidden">
              <div className="h-full bg-ink-dark rounded-full transition-all duration-500" style={{ width: `${progressWidth}%` }} />
            </div>

            {step === 1 && (
              <>
                <div className="mb-6">
                  <div className="h-9 w-9 rounded-xl bg-paper flex items-center justify-center mb-3">
                    <UtensilsCrossed className="text-ink-soft" style={{ width: 18, height: 18 }} />
                  </div>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">1 / 4</p>
                  <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink">Milyen éttermet vezetsz?</h2>
                  <p className="text-ink-soft text-sm mt-1">Válassz sablont, te csak testreszabod.</p>
                </div>
                {templateCards(false)}
                <div className="mt-6">
                  <button
                    onClick={() => selectedTemplate && setStep(2)}
                    disabled={!selectedTemplate}
                    className={authPillBtn}
                  >
                    Tovább <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-center text-sm text-ink-soft mt-4">
                  Van már fiókod?{' '}
                  <Link href="/login" className="font-semibold text-ink hover:underline no-underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <div className="mb-8">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-ink-soft text-xs mb-4 hover:text-ink transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Vissza
                  </button>
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">2 / 4</p>
                  <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink">Hozd létre a fiókodat</h2>
                </div>
                <motion.form variants={listStagger.container} initial="hidden" animate="show" onSubmit={desktopForm.handleSubmit(onStep2)} className="space-y-4" noValidate>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Étterem neve</Label>
                    <input
                      placeholder="Pl. Bistro Central"
                      autoComplete="organization"
                      aria-invalid={!!desktopForm.formState.errors.restaurantName}
                      aria-describedby={desktopForm.formState.errors.restaurantName ? 'rreg-d-name-err' : undefined}
                      className={cn(authInputBase, desktopForm.formState.errors.restaurantName && 'ring-2 ring-bad/40 border-bad/60')}
                      {...desktopForm.register('restaurantName')}
                    />
                    {desktopForm.formState.errors.restaurantName && <p id="rreg-d-name-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.restaurantName.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>A te neved</Label>
                    <input
                      placeholder="Pl. Nagy Gábor"
                      autoComplete="name"
                      aria-invalid={!!desktopForm.formState.errors.ownerName}
                      aria-describedby={desktopForm.formState.errors.ownerName ? 'rreg-d-owner-err' : undefined}
                      className={cn(authInputBase, desktopForm.formState.errors.ownerName && 'ring-2 ring-bad/40 border-bad/60')}
                      {...desktopForm.register('ownerName')}
                    />
                    {desktopForm.formState.errors.ownerName && <p id="rreg-d-owner-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.ownerName.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Email</Label>
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="te@pelda.hu"
                      aria-invalid={!!desktopForm.formState.errors.email}
                      aria-describedby={desktopForm.formState.errors.email ? 'rreg-d-email-err' : undefined}
                      className={cn(authInputBase, desktopForm.formState.errors.email && 'ring-2 ring-bad/40 border-bad/60')}
                      {...desktopForm.register('email')}
                    />
                    {desktopForm.formState.errors.email && <p id="rreg-d-email-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.email.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Jelszó</Label>
                    <PasswordInput
                      autoComplete="new-password"
                      aria-invalid={!!desktopForm.formState.errors.password}
                      aria-describedby={desktopForm.formState.errors.password ? 'rreg-d-pw-err' : undefined}
                      className={cn(authInputBase, desktopForm.formState.errors.password && 'ring-2 ring-bad/40 border-bad/60')}
                      {...desktopForm.register('password')}
                    />
                    {desktopForm.formState.errors.password && <p id="rreg-d-pw-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.password.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Város</Label>
                      <input
                        placeholder="Budapest"
                        autoComplete="address-level2"
                        aria-invalid={!!desktopForm.formState.errors.city}
                        aria-describedby={desktopForm.formState.errors.city ? 'rreg-d-city-err' : undefined}
                        className={cn(authInputBase, desktopForm.formState.errors.city && 'ring-2 ring-bad/40 border-bad/60')}
                        {...desktopForm.register('city')}
                      />
                      {desktopForm.formState.errors.city && <p id="rreg-d-city-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.city.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Telefon</Label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="+36 30..."
                        aria-invalid={!!desktopForm.formState.errors.phone}
                        aria-describedby={desktopForm.formState.errors.phone ? 'rreg-d-phone-err' : undefined}
                        className={cn(authInputBase, desktopForm.formState.errors.phone && 'ring-2 ring-bad/40 border-bad/60')}
                        {...desktopForm.register('phone')}
                      />
                      {desktopForm.formState.errors.phone && <p id="rreg-d-phone-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.phone.message}</p>}
                    </div>
                  </motion.div>
                  <motion.button variants={listStagger.item} type="submit" disabled={loading} className={cn(authPillBtn, 'mt-2')}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                  </motion.button>
                </motion.form>
                {/* Alternatív: Google-folytatás (jelszó nélkül) — a regisztráció alján. */}
                <div className={`${authDivider} mt-6`}>
                  <span className="h-px flex-1 bg-line" />vagy<span className="h-px flex-1 bg-line" />
                </div>
                <div className="mt-3">
                  <GoogleSignInButton
                    variant="light"
                    label="Folytatás Google-lel"
                    onClick={() => continueWithGoogle(desktopForm)}
                  />
                </div>
                <p className="mt-6 text-center text-sm text-ink-soft">
                  Van már fiókod?{' '}
                  <Link href="/login" className="font-semibold text-ink hover:underline no-underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">3 / 4</p>
                  <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink">Importáld az adataid</h2>
                  <p className="text-ink-soft text-sm mt-1">Ha más rendszerből váltasz — kihagyható, bármikor elvégezhető.</p>
                </div>
                <WizardImportStep isDark={false} onContinue={() => setStep(4)} />
              </>
            )}

            {step === 4 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-ink-soft uppercase tracking-widest mb-1">4 / 4</p>
                  <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink">Készen vagy!</h2>
                  <p className="text-ink-soft text-sm mt-1">Az éttermed sikeresen létrejött.</p>
                </div>
                <div className="space-y-3">
                  {['Étterem profil létrehozva', 'Asztalok és turnusok beállítva', 'Foglalási oldal elérhető', 'Dashboard hozzáférés aktív'].map(item => (
                    <div key={item} className="flex items-center gap-3 p-3.5 bg-paper rounded-xl">
                      <div className="h-5 w-5 rounded-full bg-gold flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-ink-dark" />
                      </div>
                      <span className="text-sm font-medium text-ink">{item}</span>
                    </div>
                  ))}
                </div>
                <button onClick={finish} className={cn(authPillBtn, 'mt-6')}>
                  Ugrás a dashboardra <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
