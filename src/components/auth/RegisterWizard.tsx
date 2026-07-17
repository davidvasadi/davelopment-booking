'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  Sparkles, HeartPulse, Dumbbell, LayoutGrid, ChefHat,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { listStagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { MAIN_CATEGORIES, getSubTypesForCategory, type BusinessType, type MainCategory } from '@/lib/businessTemplates'
import { SchedulioLogo } from '@/components/SchedulioLogo'
import { signIn } from 'next-auth/react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import {
  authInputBase, authInputDark, authLabelBase, authLabelDark,
  authPillBtn, authPillBtnLight, authGhostBtnDark,
  authDivider, authDividerDark, authErrorText, authErrorTextDark,
  BRAND_COPYRIGHT,
} from '@/components/auth/authStyles'

const MAIN_CAT_ICONS: Record<MainCategory, React.ElementType> = {
  szepseg: Sparkles,
  egeszseg: HeartPulse,
  fitnesz: Dumbbell,
  egyeb: LayoutGrid,
}

const step2Schema = z.object({
  salonName: z.string().min(2, 'Minimum 2 karakter'),
  ownerName: z.string().min(2, 'Minimum 2 karakter'),
  email: z.string().email('Érvényes email szükséges'),
  password: z.string().min(8, 'Minimum 8 karakter'),
  city: z.string().min(2, 'Kötelező'),
  phone: z.string().min(7, 'Érvényes telefonszám'),
})
type Step2Data = z.infer<typeof step2Schema>

export function RegisterWizard() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [subStep, setSubStep] = useState<'category' | 'types'>('category')
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<BusinessType[]>([])
  const mobileCTARef = useRef<HTMLDivElement>(null)
  const [userId, setUserId] = useState('')
  const [salonId, setSalonId] = useState('')
  const [token, setToken] = useState('')
  const [staffName, setStaffName] = useState('')

  const { register, handleSubmit, formState: { errors }, getValues, trigger } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
  })

  /**
   * „Folytatás Google-lel" a 2. lépés végén: a cégadatok (név, város, telefon, sajátnév)
   * pending-cookie-ba mennek, majd indítjuk a Google OAuth-flow-t. A flow után a
   * /api/auth/complete-registration létrehozza a szalont és userhez kapcsolja.
   * A jelszó-mező itt nem kell — a Google adja az emailt és identifies a usert.
   */
  const continueWithGoogle = async () => {
    // Validáljuk a Google-fluxhoz szükséges mezőket (a `password` nem kell)
    const ok = await trigger(['salonName', 'ownerName', 'city', 'phone'])
    if (!ok) {
      toast.error('Töltsd ki a kötelező mezőket')
      return
    }
    const v = getValues()
    try {
      const res = await fetch('/api/auth/prepare-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'salon_owner',
          ownerName: v.ownerName,
          placeName: v.salonName,
          city: v.city,
          phone: v.phone,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        toast.error(json?.error ?? 'Nem sikerült előkészíteni a regisztrációt')
        return
      }
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

      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.ownerName, email: data.email, password: data.password, role: 'salon_owner' }),
      })

      if (!userRes.ok) {
        const err = await userRes.json()
        const msg: string = err.errors?.[0]?.message ?? ''
        const isDuplicate = msg.toLowerCase().includes('uniqueness') || msg.toLowerCase().includes('email')
        if (!isDuplicate) throw new Error('Regisztráció sikertelen. Ellenőrizd az adatokat.')

        const recoveryLogin = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
          credentials: 'include',
        })
        if (!recoveryLogin.ok) throw new Error('Ez az email már regisztrált, de a jelszó nem stimmel. Jelentkezz be!')
        const recoveryData = await recoveryLogin.json()
        authToken_ = recoveryData.token
        userId_ = recoveryData.user?.id ?? recoveryData.user

        const meRes = await fetch('/api/users/me', { credentials: 'include' })
        const meData = await meRes.json()
        if (meData?.user?.salon) {
          router.push('/dashboard')
          return
        }
      } else {
        const { doc: user } = await userRes.json()
        userId_ = user.id

        const loginRes = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
          credentials: 'include',
        })
        if (!loginRes.ok) throw new Error('Bejelentkezés sikertelen a regisztráció után')
        const loginData = await loginRes.json()
        authToken_ = loginData.token
      }

      setUserId(userId_)
      setToken(authToken_)

      const baseSlug = generateSlug(data.salonName)
      let slug = baseSlug
      let salonRes = await fetch('/api/salons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
        body: JSON.stringify({ name: data.salonName, slug, owner: userId_, phone: data.phone, city: data.city, is_active: true }),
      })
      if (!salonRes.ok) {
        slug = `${baseSlug}-${Date.now().toString(36)}`
        salonRes = await fetch('/api/salons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
          body: JSON.stringify({ name: data.salonName, slug, owner: userId_, phone: data.phone, city: data.city, is_active: true }),
        })
        if (!salonRes.ok) throw new Error('Szalon létrehozása sikertelen')
      }
      const { doc: salon } = await salonRes.json()
      setSalonId(salon.id)

      await fetch(`/api/users/${userId_}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
        body: JSON.stringify({ salon: salon.id }),
      })

      // A választott üzlet-típus(ok) alapján a háttérben feltöltjük a szolgáltatás-katalógust
      // (kategóriák + szolgáltatások árral/idővel) — így az új tulaj nem üres dashboarddal indul.
      // Nem blokkoljuk a wizardot, DE a hibát már nem nyeljük el csendben: a friss JWT-t
      // fejlécként is átadjuk (nem csak a cookie-ra hagyatkozunk), és ha mégsem sikerül,
      // logolunk + diszkrét (nem blokkoló) jelzést adunk, mert a katalógus a dashboardon pótolható.
      if (selectedTypes.length > 0) {
        fetch('/api/seed-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
          credentials: 'include',
          body: JSON.stringify({ salonId: salon.id, businessTypes: selectedTypes }),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`seed-templates ${res.status}`)
          })
          .catch((e) => {
            console.warn('[register] szolgáltatás-sablon seed sikertelen:', e)
            toast.message('A szolgáltatásaidat később a vezérlőpulton állíthatod be.')
          })
      }

      setStep(3)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  const onStep3 = async () => {
    if (staffName.trim()) {
      setLoading(true)
      try {
        await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
          body: JSON.stringify({ name: staffName.trim(), salon: salonId, is_active: true }),
        })
      } catch {
        // nem blokkoló
      } finally {
        setLoading(false)
      }
    }
    setStep(4)
  }

  const finish = () => router.push('/dashboard')

  const TOTAL_STEPS = 4
  const progressWidth = (step / TOTAL_STEPS) * 100

  // ─── STEP 1: Two-phase business type selection ───────────────────────────
  if (step === 1) {
    const subTypes = selectedCategory ? getSubTypesForCategory(selectedCategory) : []

    // Reusable card renderers
    const mainCatCards = (isDark: boolean) => (
      <div className="grid grid-cols-2 gap-3">
        {MAIN_CATEGORIES.map(cat => {
          const Icon = MAIN_CAT_ICONS[cat.id]
          const isSelected = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id)
                setSelectedTypes([])
                setSubStep('types')
                setTimeout(() => mobileCTARef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
              }}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200',
                isDark
                  ? isSelected ? 'border-gold bg-white/[0.06] ring-2 ring-gold' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  : isSelected ? 'border-gold bg-gold/[0.06] ring-2 ring-gold' : 'border-line-strong bg-white hover:border-ink-soft2/50 hover:bg-paper'
              )}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
                  <Check className="h-3 w-3 text-ink-dark" />
                </div>
              )}
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2.5', isDark ? (isSelected ? 'bg-gold' : 'bg-white/10') : (isSelected ? 'bg-gold' : 'bg-paper'))}>
                <Icon className={cn(isDark ? (isSelected ? 'text-ink-dark' : 'text-white/70') : (isSelected ? 'text-ink-dark' : 'text-ink-soft'))} style={{ width: 18, height: 18 }} />
              </div>
              <p className={cn('font-semibold text-sm leading-tight', isDark ? (isSelected ? 'text-white' : 'text-white/80') : 'text-ink')}>{cat.label}</p>
              <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-white/45' : 'text-ink-soft')}>{cat.description}</p>
            </button>
          )
        })}
        {/* Étterem — külön regisztrációs flow */}
        <Link href="/register-restaurant" className={cn(
          'relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200',
          isDark
            ? 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
            : 'border-line-strong bg-white hover:border-ink-soft2/50 hover:bg-paper'
        )}>
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2.5', isDark ? 'bg-white/10' : 'bg-paper')}>
            <ChefHat className={isDark ? 'text-white/70' : 'text-ink-soft'} style={{ width: 18, height: 18 }} />
          </div>
          <p className={cn('font-semibold text-sm leading-tight', isDark ? 'text-white/80' : 'text-ink')}>Étterem</p>
          <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-white/45' : 'text-ink-soft')}>Asztalfoglalás</p>
        </Link>
      </div>
    )

    const subTypeCards = (isDark: boolean) => (
      <div className="grid grid-cols-2 gap-3">
        {subTypes.map(opt => {
          const isSelected = selectedTypes.includes(opt.type)
          return (
            <button
              key={opt.type}
              onClick={() => {
                setSelectedTypes(prev =>
                  prev.includes(opt.type) ? prev.filter(t => t !== opt.type) : [...prev, opt.type]
                )
                setTimeout(() => mobileCTARef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50)
              }}
              className={cn(
                'relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200',
                isDark
                  ? isSelected ? 'border-gold bg-white/[0.06] ring-2 ring-gold' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  : isSelected ? 'border-gold bg-gold/[0.06] ring-2 ring-gold' : 'border-line-strong bg-white hover:border-ink-soft2/50 hover:bg-paper'
              )}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
                  <Check className="h-3 w-3 text-ink-dark" />
                </div>
              )}
              <p className={cn('font-semibold text-sm leading-tight mt-1', isDark ? (isSelected ? 'text-white' : 'text-white/80') : 'text-ink')}>{opt.label}</p>
              <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-white/45' : 'text-ink-soft')}>{opt.description}</p>
            </button>
          )
        })}
      </div>
    )

    const desktopLeftHeadline = subStep === 'category'
      ? { h: 'MILYEN\nVÁLLALKOZÁST\nVEZETSZ?', sub: 'Beállítjuk az alapokat — kategóriák, minta szolgáltatások — te csak testreszabod.' }
      : { h: 'MILYEN\nSZOLGÁLTA-\nTÁSOKAT\nKÍNÁLSZ?', sub: 'Többet is választhatsz — pl. fodrász és körömszalon egyszerre.' }

    return (
      <>
        {/* ── MOBILE ── */}
        <div className="lg:hidden min-h-screen bg-ink-dark font-onest flex flex-col">
          <div className="flex flex-col flex-1 px-7 pt-12 pb-10 overflow-y-auto">
            <div className="flex items-center justify-between mb-auto">
              {subStep === 'types' ? (
                <button
                  onClick={() => setSubStep('category')}
                  className="flex items-center gap-1.5 text-white/45 text-sm hover:text-white/80 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Vissza
                </button>
              ) : (
                <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
                  <SchedulioLogo variant="dark" className="h-8" />
                </Link>
              )}
              <div className="flex gap-1.5">
                {([1, 2, 3, 4] as const).map(s => (
                  <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', s === step ? 'bg-gold w-4' : s < step ? 'w-1.5 bg-white/40' : 'w-1.5 bg-white/10')} />
                ))}
              </div>
            </div>
            <div className="mt-12">
              {subStep === 'category' ? (
                <>
                  <h2 className="text-white font-light text-[2rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                    MILYEN<br />VÁLLALKOZÁST<br />VEZETSZ?
                  </h2>
                  {mainCatCards(true)}
                  <div className="mt-6 space-y-3">
                    <button onClick={() => setStep(2)} className={authGhostBtnDark}>
                      Kihagyás
                    </button>
                    <Link href="/login" className="w-full h-14 rounded-dav-pill flex items-center justify-center text-white/40 font-medium text-base hover:text-white/70 transition-colors">
                      Van már fiókom
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-white font-light text-[2rem] uppercase leading-[1.0] tracking-[-0.02em] mb-2">
                    MILYEN<br />SZOLGÁL-<br />TATÁSOKAT<br />KÍNÁLSZ?
                  </h2>
                  <p className="text-white/45 text-sm mb-6">Többet is választhatsz.</p>
                  {subTypeCards(true)}
                  <div ref={mobileCTARef} className="mt-6 space-y-4">
                    <button
                      onClick={() => selectedTypes.length > 0 && setStep(2)}
                      disabled={selectedTypes.length === 0}
                      className={cn(authPillBtnLight, 'disabled:cursor-not-allowed')}
                    >
                      Tovább {selectedTypes.length > 0 && `(${selectedTypes.length})`} <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => setStep(2)} className={authGhostBtnDark}>
                      Kihagyás
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP ── */}
        <div className="hidden lg:flex min-h-screen font-onest">
          <div className="w-[45%] bg-ink-dark flex flex-col justify-between p-14 select-none">
            <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
              <SchedulioLogo variant="dark" className="h-8" />
            </Link>
            <div>
              <h1 className="text-white font-light text-[2.25rem] uppercase leading-[1.05] tracking-[-0.02em] whitespace-pre-line">
                {desktopLeftHeadline.h}
              </h1>
              <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">{desktopLeftHeadline.sub}</p>
            </div>
            <p className="text-white/30 text-xs">{BRAND_COPYRIGHT}</p>
          </div>

          <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white [color-scheme:light] overflow-y-auto">
            <div className="w-full max-w-sm">
              <div className="h-1 bg-line rounded-full mb-10 overflow-hidden">
                <div className="h-full bg-ink-dark rounded-full transition-all duration-500" style={{ width: '25%' }} />
              </div>

              {subStep === 'category' ? (
                <>
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">1 / 4</p>
                    <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Milyen vállalkozást vezetsz?</h2>
                    <p className="text-ink-soft text-sm mt-1">Beállítjuk az alapokat, te csak testreszabod.</p>
                  </div>
                  {mainCatCards(false)}
                  <button onClick={() => setStep(2)} className="mt-4 w-full h-10 text-sm text-ink-soft hover:text-ink transition-colors">
                    Kihagyás — manuálisan töltöm fel
                  </button>
                  <p className="text-center text-sm text-ink-soft mt-2">
                    Van már fiókod?{' '}
                    <Link href="/login" className="font-semibold text-ink hover:underline no-underline">Bejelentkezés</Link>
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <button onClick={() => setSubStep('category')} className="flex items-center gap-1.5 text-ink-soft text-xs mb-4 hover:text-ink transition-colors">
                      <ChevronLeft className="h-3 w-3" /> Vissza
                    </button>
                    <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">1 / 4 — {MAIN_CATEGORIES.find(c => c.id === selectedCategory)?.label}</p>
                    <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Milyen szolgáltatásokat kínálsz?</h2>
                    <p className="text-ink-soft text-sm mt-1">Többet is választhatsz.</p>
                  </div>
                  {subTypeCards(false)}
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => selectedTypes.length > 0 && setStep(2)}
                      disabled={selectedTypes.length === 0}
                      className={cn(authPillBtn, 'disabled:cursor-not-allowed')}
                    >
                      Tovább {selectedTypes.length > 0 && `(${selectedTypes.length} kiválasztva)`} <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => setStep(2)} className="w-full h-10 text-sm text-ink-soft hover:text-ink transition-colors">
                      Kihagyás — manuálisan töltöm fel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── STEPS 2–4: Desktop split / Mobile dark ───────────────────────────────
  const leftHeadlines: Record<number, { headline: string; sub: string }> = {
    2: { headline: 'CSATLAKOZZ\nHOZZÁNK.', sub: 'Hozd létre a fiókodat és szalonod pár perc alatt.' },
    3: { headline: 'ADD HOZZÁ\nA CSAPA\nTODAT.', sub: 'Munkatársaid nevével testreszabhatod az időpontfoglalást.' },
    4: { headline: 'KÉSZEN\nVAGYOK.', sub: 'A szalonod elérhető az ügyfelek számára.' },
  }
  const leftText = leftHeadlines[step]

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      <div className="lg:hidden min-h-screen bg-ink-dark font-onest flex flex-col">
        <div className="flex flex-col flex-1 px-7 pt-12 pb-10">
          <div className="flex items-center justify-between mb-auto">
            {step === 2 ? (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-white/45 text-sm hover:text-white/80 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Vissza
              </button>
            ) : (
              <Link href="/" aria-label="davelopment booking" className="text-white font-light text-xl tracking-[-0.01em] hover:opacity-70 transition-opacity">davelopment booking</Link>
            )}
            <div className="flex gap-1.5">
              {([1, 2, 3, 4] as const).map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    s === step ? 'bg-gold w-4' : s < step ? 'w-1.5 bg-white/40' : 'w-1.5 bg-white/10'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Step 2 — registration form */}
          {step === 2 && (
            <div className="mt-12">
              <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                CSATLAKOZZ<br />HOZZÁNK.
              </h2>
              <motion.form variants={listStagger.container} initial="hidden" animate="show" onSubmit={handleSubmit(onStep2)} className="space-y-3" noValidate>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Szalon neve</Label>
                  <input
                    autoComplete="organization"
                    placeholder="Pl. Anna Fodrászat"
                    aria-invalid={!!errors.salonName}
                    aria-describedby={errors.salonName ? 'reg-m-salon-err' : undefined}
                    className={cn(authInputDark, errors.salonName && 'ring-2 ring-red-400 border-red-400')}
                    {...register('salonName')}
                  />
                  {errors.salonName && <p id="reg-m-salon-err" role="alert" className={authErrorTextDark}>{errors.salonName.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>A te neved</Label>
                  <input
                    autoComplete="name"
                    placeholder="Pl. Kiss Anna"
                    aria-invalid={!!errors.ownerName}
                    aria-describedby={errors.ownerName ? 'reg-m-owner-err' : undefined}
                    className={cn(authInputDark, errors.ownerName && 'ring-2 ring-red-400 border-red-400')}
                    {...register('ownerName')}
                  />
                  {errors.ownerName && <p id="reg-m-owner-err" role="alert" className={authErrorTextDark}>{errors.ownerName.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Email</Label>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="te@pelda.hu"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'reg-m-email-err' : undefined}
                    className={cn(authInputDark, errors.email && 'ring-2 ring-red-400 border-red-400')}
                    {...register('email')}
                  />
                  {errors.email && <p id="reg-m-email-err" role="alert" className={authErrorTextDark}>{errors.email.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Jelszó</Label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'reg-m-pw-err' : undefined}
                    className={cn(authInputDark, errors.password && 'ring-2 ring-red-400 border-red-400')}
                    {...register('password')}
                  />
                  {errors.password && <p id="reg-m-pw-err" role="alert" className={authErrorTextDark}>{errors.password.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Város</Label>
                    <input
                      autoComplete="address-level2"
                      placeholder="Budapest"
                      aria-invalid={!!errors.city}
                      aria-describedby={errors.city ? 'reg-m-city-err' : undefined}
                      className={cn(authInputDark, errors.city && 'ring-2 ring-red-400 border-red-400')}
                      {...register('city')}
                    />
                    {errors.city && <p id="reg-m-city-err" role="alert" className={authErrorTextDark}>{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Telefon</Label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+36 30..."
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? 'reg-m-phone-err' : undefined}
                      className={cn(authInputDark, errors.phone && 'ring-2 ring-red-400 border-red-400')}
                      {...register('phone')}
                    />
                    {errors.phone && <p id="reg-m-phone-err" role="alert" className={authErrorTextDark}>{errors.phone.message}</p>}
                  </div>
                </motion.div>
                <motion.div variants={listStagger.item} className="pt-2 space-y-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={authPillBtnLight}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                  </button>
                  <Link href="/login" className="block">
                    <button type="button" className={authGhostBtnDark}>
                      Van már fiókom
                    </button>
                  </Link>
                  {/* Alternatív: Google-fiókkal folytatás (jelszó nélkül) — a wizard alján. */}
                  <div className={`${authDividerDark} pt-2`}>
                    <span className="h-px flex-1 bg-white/10" />vagy<span className="h-px flex-1 bg-white/10" />
                  </div>
                  <GoogleSignInButton
                    variant="dark"
                    label="Folytatás Google-lel"
                    onClick={continueWithGoogle}
                  />
                </motion.div>
              </motion.form>
            </div>
          )}

          {/* Step 3 — staff */}
          {step === 3 && (
            <div className="mt-12 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                  ADD HOZZÁ<br />A CSAPA<br />TODAT.
                </h2>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Munkatárs neve</Label>
                    <input
                      autoComplete="name"
                      placeholder="Pl. Kovács Péter"
                      className={authInputDark}
                      value={staffName}
                      onChange={e => setStaffName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <button
                  onClick={onStep3}
                  disabled={loading}
                  className={authPillBtnLight}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className={authGhostBtnDark}
                >
                  Kihagyás
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — success */}
          {step === 4 && (
            <div className="mt-12 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                  KÉSZEN<br />VAGYOK.
                </h2>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
                    'Alapszolgáltatások beállítva',
                    'Foglalási oldal elérhető',
                    'Dashboard hozzáférés aktív',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 p-3.5 bg-white/[0.03] border border-white/10 rounded-xl">
                      <div className="h-5 w-5 rounded-full bg-gold flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-ink-dark" />
                      </div>
                      <span className="text-sm font-medium text-white/80">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={finish}
                className={authPillBtnLight}
              >
                Ugrás a dashboardra <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen font-onest">
        {/* Left panel */}
        <div className="w-[45%] bg-ink-dark flex flex-col justify-between p-14 select-none">
          <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
            <SchedulioLogo variant="dark" className="h-8" />
          </Link>
          <div>
            <h1 className="text-white font-light text-[3.25rem] uppercase leading-[1.05] tracking-[-0.02em] whitespace-pre-line">
              {leftText.headline}
            </h1>
            <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">{leftText.sub}</p>
          </div>
          <p className="text-white/30 text-xs">{BRAND_COPYRIGHT}</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white [color-scheme:light]">
          <div className="w-full max-w-sm">

            {/* Progress bar */}
            <div className="h-1 bg-line rounded-full mb-10 overflow-hidden">
              <div
                className="h-full bg-ink-dark rounded-full transition-all duration-500"
                style={{ width: `${progressWidth}%` }}
              />
            </div>

            {/* Step 2 */}
            {step === 2 && (
              <>
                <div className="mb-8">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-ink-soft text-xs mb-4 hover:text-ink transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Vissza
                  </button>
                  <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">2 / 4</p>
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Hozd létre a fiókodat</h2>
                </div>
                <motion.form variants={listStagger.container} initial="hidden" animate="show" onSubmit={handleSubmit(onStep2)} className="space-y-4" noValidate>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Szalon neve</Label>
                    <input
                      autoComplete="organization"
                      placeholder="Pl. Anna Fodrászat"
                      aria-invalid={!!errors.salonName}
                      aria-describedby={errors.salonName ? 'reg-d-salon-err' : undefined}
                      className={cn(authInputBase, errors.salonName && 'ring-2 ring-bad/40 border-bad/60')}
                      {...register('salonName')}
                    />
                    {errors.salonName && <p id="reg-d-salon-err" role="alert" className={authErrorText}>{errors.salonName.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>A te neved</Label>
                    <input
                      autoComplete="name"
                      placeholder="Pl. Kiss Anna"
                      aria-invalid={!!errors.ownerName}
                      aria-describedby={errors.ownerName ? 'reg-d-owner-err' : undefined}
                      className={cn(authInputBase, errors.ownerName && 'ring-2 ring-bad/40 border-bad/60')}
                      {...register('ownerName')}
                    />
                    {errors.ownerName && <p id="reg-d-owner-err" role="alert" className={authErrorText}>{errors.ownerName.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Email</Label>
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="te@pelda.hu"
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'reg-d-email-err' : undefined}
                      className={cn(authInputBase, errors.email && 'ring-2 ring-bad/40 border-bad/60')}
                      {...register('email')}
                    />
                    {errors.email && <p id="reg-d-email-err" role="alert" className={authErrorText}>{errors.email.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Jelszó</Label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'reg-d-pw-err' : undefined}
                      className={cn(authInputBase, errors.password && 'ring-2 ring-bad/40 border-bad/60')}
                      {...register('password')}
                    />
                    {errors.password && <p id="reg-d-pw-err" role="alert" className={authErrorText}>{errors.password.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Város</Label>
                      <input
                        autoComplete="address-level2"
                        placeholder="Budapest"
                        aria-invalid={!!errors.city}
                        aria-describedby={errors.city ? 'reg-d-city-err' : undefined}
                        className={cn(authInputBase, errors.city && 'ring-2 ring-bad/40 border-bad/60')}
                        {...register('city')}
                      />
                      {errors.city && <p id="reg-d-city-err" role="alert" className={authErrorText}>{errors.city.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Telefon</Label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="+36 30..."
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? 'reg-d-phone-err' : undefined}
                        className={cn(authInputBase, errors.phone && 'ring-2 ring-bad/40 border-bad/60')}
                        {...register('phone')}
                      />
                      {errors.phone && <p id="reg-d-phone-err" role="alert" className={authErrorText}>{errors.phone.message}</p>}
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
                    onClick={continueWithGoogle}
                  />
                </div>
                <p className="mt-6 text-center text-sm text-ink-soft">
                  Van már fiókod?{' '}
                  <Link href="/login" className="font-semibold text-ink hover:underline no-underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">3 / 4</p>
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Add hozzá az első munkatársat</h2>
                  <p className="text-ink-soft text-sm mt-1">Kihagyható — később is hozzáadhatsz.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className={authLabelBase}>Munkatárs neve</Label>
                    <input
                      autoComplete="name"
                      placeholder="Pl. Kovács Péter"
                      className={authInputBase}
                      value={staffName}
                      onChange={e => setStaffName(e.target.value)}
                    />
                  </div>
                  <button onClick={onStep3} disabled={loading} className={authPillBtn}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="w-full h-12 rounded-dav-pill border border-line-strong text-sm text-ink-soft hover:text-ink hover:bg-paper transition-colors"
                  >
                    Kihagyás
                  </button>
                </div>
              </>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">4 / 4</p>
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Készen vagy!</h2>
                  <p className="text-ink-soft text-sm mt-1">A szalonod sikeresen létrejött.</p>
                </div>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
                    'Alapszolgáltatások beállítva',
                    'Foglalási oldal elérhető',
                    'Dashboard hozzáférés aktív',
                  ].map(item => (
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
