'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  Sparkles, HeartPulse, Dumbbell, LayoutGrid, ChefHat,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { listStagger, EASE } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { MAIN_CATEGORIES, getSubTypesForCategory, type BusinessType, type MainCategory, type MainCategoryDef } from '@/lib/businessTemplates'
import { BrandLogo } from '@/components/BrandLogo'
import { signIn } from 'next-auth/react'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { WizardImportStep } from '@/components/auth/WizardImportStep'
import {
  authInputBase, authInputDark, authLabelBase, authLabelDark,
  authPillBtn, authPillBtnLight, authGhostBtnDark,
  authDivider, authDividerDark, authErrorText, authErrorTextDark,
  BRAND_COPYRIGHT,
} from '@/components/auth/authStyles'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { AuthVideoBg } from '@/components/auth/AuthVideoBg'
import { AuthPillButton } from '@/components/auth/AuthPillButton'
import { useAvailabilityCheck } from '@/components/auth/useAvailabilityCheck'
import { FieldStatusIcon } from '@/components/auth/FieldStatusIcon'

const MAIN_CAT_ICONS: Record<MainCategory, React.ElementType> = {
  szepseg: Sparkles,
  egeszseg: HeartPulse,
  fitnesz: Dumbbell,
  egyeb: LayoutGrid,
}

/** Formátum-előszűrés, mielőtt a hook hálózati elérhetőség-ellenőrzést indítana. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmailFormatValid = (v: string) => EMAIL_RE.test(v)
const isNameFormatValid = (v: string) => v.trim().length >= 2

const step2Schema = z.object({
  salonName: z.string().min(1, 'Kötelező mező').min(2, 'Minimum 2 karakter'),
  ownerName: z.string().min(1, 'Kötelező mező').min(2, 'Minimum 2 karakter'),
  email: z.string().min(1, 'Kötelező mező').email('Érvényes email szükséges'),
  password: z.string().min(1, 'Kötelező mező').min(8, 'Minimum 8 karakter'),
  city: z.string().min(1, 'Kötelező mező').min(2, 'Minimum 2 karakter'),
  phone: z.string().min(1, 'Kötelező mező').min(7, 'Érvényes telefonszám'),
})
type Step2Data = z.infer<typeof step2Schema>

export function RegisterWizard() {
  const router = useRouter()
  // A landing árazás-kártyáján kiválasztott csomag (?tier=starter) — enélkül minden regisztráció
  // csendben Pro-ra esett vissza, függetlenül attól, melyik kártyát nyomta meg a felhasználó.
  const searchParams = useSearchParams()
  const selectedTier = searchParams.get('tier') === 'starter' ? 'starter' : undefined
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [subStep, setSubStep] = useState<'category' | 'types'>('category')
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null)
  const [selectedTypes, setSelectedTypes] = useState<BusinessType[]>([])
  const mobileCTARef = useRef<HTMLDivElement>(null)
  const [salonId, setSalonId] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')

  // Két különálló useForm példány a mobil + desktop form-hoz, hogy a react-hook-form
  // ne olvasson üres desktop-inputokból mobilon (és fordítva).
  const mobileForm = useForm<Step2Data>({ resolver: zodResolver(step2Schema) })
  const desktopForm = useForm<Step2Data>({ resolver: zodResolver(step2Schema) })

  // Élő elérhetőség-ellenőrzés (email foglalt-e, szalonnév/slug ütközik-e) — a hookot a
  // React-szabályok miatt feltétel nélkül, a komponens tetején kell hívni (nem a step===2
  // ágban), de amíg a mezők üresek (más lépésen vagyunk), nem indít hálózati kérést.
  const mobileEmailVal = mobileForm.watch('email') ?? ''
  const desktopEmailVal = desktopForm.watch('email') ?? ''
  const mobileNameVal = mobileForm.watch('salonName') ?? ''
  const desktopNameVal = desktopForm.watch('salonName') ?? ''
  const mobileEmailStatus = useAvailabilityCheck('email', mobileEmailVal, isEmailFormatValid(mobileEmailVal))
  const desktopEmailStatus = useAvailabilityCheck('email', desktopEmailVal, isEmailFormatValid(desktopEmailVal))
  const mobileNameStatus = useAvailabilityCheck('business-name', mobileNameVal, isNameFormatValid(mobileNameVal))
  const desktopNameStatus = useAvailabilityCheck('business-name', desktopNameVal, isNameFormatValid(desktopNameVal))

  /**
   * „Folytatás Google-lel" a 2. lépés végén: a cégadatok (név, város, telefon, sajátnév)
   * pending-cookie-ba mennek, majd indítjuk a Google OAuth-flow-t. A flow után a
   * /api/auth/complete-registration létrehozza a szalont és userhez kapcsolja.
   * A jelszó-mező itt nem kell — a Google adja az emailt és identifies a usert.
   */
  const continueWithGoogle = async (form: typeof mobileForm) => {
    // Validáljuk a Google-fluxhoz szükséges mezőket (a `password` nem kell)
    const ok = await form.trigger(['salonName', 'ownerName', 'city', 'phone'])
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
          role: 'salon_owner',
          ownerName: v.ownerName,
          placeName: v.salonName,
          city: v.city,
          phone: v.phone,
          tier: selectedTier,
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
      // Az email-t normalizáljuk: mobilon az autocapitalize nagybetűssé teheti az első karaktert,
      // Payload pedig kisbetűsítve tárolja.
      const email = data.email.toLowerCase().trim()

      // Minden (user + szalon + kezdő-sablon) EGY szerver-oldali kérésben történik — a Users
      // collection `verify: true`-ja miatt a friss fiók úgysem kapna érvényes tokent egy
      // azonnali login-próbálkozástól, tehát a régi „create → login (JWT-vel) → create salon"
      // lánc itt nem működne. Lásd `/api/auth/register` route.
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'salon',
          ownerName: data.ownerName,
          placeName: data.salonName,
          email,
          password: data.password,
          city: data.city,
          phone: data.phone,
          businessTypes: selectedTypes,
          tier: selectedTier,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (err.error === 'already_registered') throw new Error('Ez az email már regisztrált.')
        if (err.error === 'unverified_pending') throw new Error('Ez az email már regisztrált, de még nincs megerősítve — nézd meg a postafiókod a korábbi levélért.')
        throw new Error('Regisztráció sikertelen. Ellenőrizd az adatokat.')
      }

      const created = await res.json().catch(() => ({}))
      // A fiók már létrejött, de a megerősítő email KÉSZAKARVA még nem ment ki — a wizard
      // a hátralévő (import) lépésen is végigvisz, a levél csak az 5. lépésnél (finish()) megy.
      setRegisteredEmail(email)
      setSalonId(created?.businessId ? String(created.businessId) : '')
      setStep(4)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  const finish = async () => {
    // A megerősítő email csak MOST megy ki — lásd `onStep2` megjegyzését. A `reg-setup-token`
    // (amit a `/api/auth/register` állított ki) igazolja a szervernek, hogy tényleg erről a
    // frissen létrehozott, még nem megerősített fiókról van szó.
    try {
      await fetch('/api/auth/finish-registration', { method: 'POST', credentials: 'include' })
    } catch {
      // nem blokkoló — a check-email oldal mindenképp a helyes útmutatást adja
    }
    router.push(`/register/check-email?email=${encodeURIComponent(registeredEmail)}`)
  }

  // A sikeres-képernyő (5.) nem számít bele — az csak visszaigazolás, nincs "hátralévő" rész,
  // ezért a Figma is 4 szegmenst mutat (node 350:1621). A korábbi folytonos sáv + a "3/5"-re
  // ugró felirat (miközben az 1-2. lépés "/4"-et írt ki) volt a felhasználó által jelzett hiba.
  const TOTAL_STEPS = 4
  // A 3. lépés (munkatárs-hívás) kikerült a folyamatból — a szám-sorrend emiatt ugrik
  // (1, 2, 4, 5), a haladás-sávnak viszont folytonosnak (1..4) kell látszania.
  const progressStep = Math.min(step <= 2 ? step : step - 1, TOTAL_STEPS)

  /** Figma-pontos, diszkrét szegmens-sáv (4 db pill) — mindegyik szegmens saját animált
   *  kitöltéssel (framer `scaleX`), nem csak egy néma CSS-színváltás. */
  const progressPills = (current: number) => (
    <div className="flex gap-1.5 mb-10">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div key={i} className="h-2 flex-1 rounded-full overflow-hidden" style={{ background: '#f7f7f7' }}>
          <motion.div
            className="h-full w-full rounded-full bg-ink-dark"
            style={{ transformOrigin: 'left' }}
            initial={false}
            animate={{ scaleX: i < current ? 1 : 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </div>
      ))}
    </div>
  )

  // ─── STEP 1: Two-phase business type selection ───────────────────────────
  if (step === 1) {
    const subTypes = selectedCategory ? getSubTypesForCategory(selectedCategory) : []

    // Reusable card renderers
    const renderCatCard = (cat: MainCategoryDef, isDark: boolean) => {
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
            isDark && 'backdrop-blur-[10px]',
            isDark
              ? isSelected ? 'border-gold bg-white/[0.06] ring-2 ring-gold' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
              : isSelected ? 'border-gold bg-gold/[0.06] ring-2 ring-gold' : 'border-transparent bg-[#f7f7f7] hover:brightness-[0.97]'
          )}
        >
          {isSelected && (
            <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
              <Check className="h-3 w-3 text-ink-dark" />
            </div>
          )}
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2.5', isDark ? (isSelected ? 'bg-gold' : 'bg-white/10') : (isSelected ? 'bg-gold' : 'bg-white'))}>
            <Icon className={cn(isDark ? (isSelected ? 'text-ink-dark' : 'text-white/70') : (isSelected ? 'text-ink-dark' : 'text-ink-soft'))} style={{ width: 18, height: 18 }} />
          </div>
          <p className={cn('font-semibold text-sm leading-tight', isDark ? (isSelected ? 'text-white' : 'text-white/80') : 'text-ink')}>{cat.label}</p>
          <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-white/45' : 'text-ink-soft')}>{cat.description}</p>
        </button>
      )
    }

    const restaurantCard = (isDark: boolean) => (
      <Link href="/register-restaurant" className={cn(
        'relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200',
        isDark && 'backdrop-blur-[10px]',
        isDark
          ? 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
          : 'border-transparent bg-[#f7f7f7] hover:brightness-[0.97]'
      )}>
        <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2.5', isDark ? 'bg-white/10' : 'bg-white')}>
          <ChefHat className={isDark ? 'text-white/70' : 'text-ink-soft'} style={{ width: 18, height: 18 }} />
        </div>
        <p className={cn('font-semibold text-sm leading-tight', isDark ? 'text-white/80' : 'text-ink')}>Étterem</p>
        <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-white/45' : 'text-ink-soft')}>Asztalfoglalás</p>
      </Link>
    )

    // Az Étterem-csempe a rács 4. helyére kerül (a fitnesz mellé), az "Egyéb" pedig egyedül
    // marad az utolsó sorban — user explicit kérése, hogy ne az Étterem lógjon ki magányosan.
    const mainCatCards = (isDark: boolean) => (
      <div className="grid grid-cols-2 gap-3">
        {MAIN_CATEGORIES.slice(0, -1).map(cat => renderCatCard(cat, isDark))}
        {restaurantCard(isDark)}
        {MAIN_CATEGORIES.slice(-1).map(cat => renderCatCard(cat, isDark))}
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
                isDark && 'backdrop-blur-[10px]',
                isDark
                  ? isSelected ? 'border-gold bg-white/[0.06] ring-2 ring-gold' : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  : isSelected ? 'border-gold bg-gold/[0.06] ring-2 ring-gold' : 'border-transparent bg-[#f7f7f7] hover:brightness-[0.97]'
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
        <div className="lg:hidden relative min-h-dvh bg-ink-dark font-onest flex flex-col">
          <AuthVideoBg fullScreen />
          <div className="relative z-10 flex flex-col flex-1 px-7 pb-10 overflow-y-auto" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
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
                  <BrandLogo variant="dark" className="h-8" />
                </Link>
              )}
              <div className="flex gap-1.5">
                {([1, 2, 3, 4, 5] as const).map(s => (
                  <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', s === step ? 'bg-gold w-4' : s < step ? 'w-1.5 bg-white/40' : 'w-1.5 bg-white/10')} />
                ))}
              </div>
            </div>
            <div className="mt-12">
              <AnimatePresence mode="wait" initial={false}>
                {subStep === 'category' ? (
                  <motion.div key="category" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
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
                  </motion.div>
                ) : (
                  <motion.div key="types" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── DESKTOP ── */}
        <div className="hidden lg:block min-h-dvh bg-[#f7f7f7] p-5 font-onest">
        <div className="flex h-[calc(100dvh-40px)] gap-5">
          <div className="relative w-[45%] overflow-hidden rounded-[30px] bg-ink-dark flex flex-col p-14 select-none">
            <AuthVideoBg />
            <div className="relative z-10 flex flex-col justify-between flex-1">
              <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
                <BrandLogo variant="dark" className="h-8" />
              </Link>
              <div>
                <h1 className="text-white font-light text-[2.25rem] uppercase leading-[1.05] tracking-[-0.02em] whitespace-pre-line">
                  {desktopLeftHeadline.h}
                </h1>
                <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">{desktopLeftHeadline.sub}</p>
              </div>
              <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="text-white/30 text-xs hover:text-white/50 transition-colors">{BRAND_COPYRIGHT}</a>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-y-auto rounded-[30px] bg-white px-6 py-12 [color-scheme:light]">
            <div className="w-full max-w-md">
              {progressPills(1)}

              <AnimatePresence mode="wait" initial={false}>
                {subStep === 'category' ? (
                  <motion.div key="category" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
                    <div className="mb-6">
                      <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">1 / 4</p>
                      <h2 className="text-[36px] font-light leading-[1.15] tracking-[-0.02em] text-ink">Milyen vállalkozást vezetsz?</h2>
                      <p className="text-ink-soft text-base mt-2">Beállítjuk az alapokat, te csak testreszabod.</p>
                    </div>
                    {mainCatCards(false)}
                    <button onClick={() => setStep(2)} className="mt-4 w-full h-10 text-sm text-ink-soft hover:text-ink transition-colors">
                      Kihagyás — manuálisan töltöm fel
                    </button>
                    <p className="text-center text-sm text-ink-soft mt-2">
                      Van már fiókod?{' '}
                      <Link href="/login" className="font-semibold text-ink hover:underline no-underline">Bejelentkezés</Link>
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="types" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
                    <div className="mb-6">
                      <button onClick={() => setSubStep('category')} className="flex items-center gap-1.5 text-ink-soft text-xs mb-4 hover:text-ink transition-colors">
                        <ChevronLeft className="h-3 w-3" /> Vissza
                      </button>
                      <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">1 / 4 — {MAIN_CATEGORIES.find(c => c.id === selectedCategory)?.label}</p>
                      <h2 className="text-[36px] font-light leading-[1.15] tracking-[-0.02em] text-ink">Milyen szolgáltatásokat kínálsz?</h2>
                      <p className="text-ink-soft text-base mt-2">Többet is választhatsz.</p>
                    </div>
                    {subTypeCards(false)}
                    <div className="mt-6 space-y-3">
                      <AuthPillButton
                        onClick={() => selectedTypes.length > 0 && setStep(2)}
                        disabled={selectedTypes.length === 0}
                        className="disabled:cursor-not-allowed"
                      >
                        Tovább {selectedTypes.length > 0 && `(${selectedTypes.length} kiválasztva)`}
                      </AuthPillButton>
                      <button onClick={() => setStep(2)} className="w-full h-10 text-sm text-ink-soft hover:text-ink transition-colors">
                        Kihagyás — manuálisan töltöm fel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
    4: { headline: 'IMPORTÁLD\nAZ ADATAID.', sub: 'Más rendszerből? Töltsd fel az exportált fájlt — asztalok, munkatársak, vendégek egyszerre.' },
    5: { headline: 'KÉSZEN\nVAGYOK.', sub: 'A szalonod elérhető az ügyfelek számára.' },
  }
  const leftText = leftHeadlines[step]

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      <div className="lg:hidden relative min-h-dvh bg-ink-dark font-onest flex flex-col">
        <AuthVideoBg fullScreen />
        <div className="relative z-10 flex flex-col flex-1 px-7 pb-10" style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}>
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
              <motion.form variants={listStagger.container} initial="hidden" animate="show" onSubmit={mobileForm.handleSubmit(onStep2)} className="space-y-3" noValidate>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Szalon neve</Label>
                  <div className="relative">
                    <input
                      autoComplete="organization"
                      placeholder="Pl. Anna Fodrászat"
                      aria-invalid={!!mobileForm.formState.errors.salonName}
                      aria-describedby={mobileForm.formState.errors.salonName ? 'reg-m-salon-err' : undefined}
                      className={cn(authInputDark, 'pr-11', mobileForm.formState.errors.salonName && 'ring-2 ring-red-400 border-red-400')}
                      {...mobileForm.register('salonName')}
                    />
                    <FieldStatusIcon status={mobileNameStatus} />
                  </div>
                  {mobileForm.formState.errors.salonName
                    ? <p id="reg-m-salon-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.salonName.message}</p>
                    : mobileNameStatus === 'taken' && <p className={authErrorTextDark}>Ez a név már foglalt — a nyilvános oldalad címe ütközne egy meglévővel.</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>A te neved</Label>
                  <input
                    autoComplete="name"
                    placeholder="Pl. Kiss Anna"
                    aria-invalid={!!mobileForm.formState.errors.ownerName}
                    aria-describedby={mobileForm.formState.errors.ownerName ? 'reg-m-owner-err' : undefined}
                    className={cn(authInputDark, mobileForm.formState.errors.ownerName && 'ring-2 ring-red-400 border-red-400')}
                    {...mobileForm.register('ownerName')}
                  />
                  {mobileForm.formState.errors.ownerName && <p id="reg-m-owner-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.ownerName.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Email</Label>
                  <div className="relative">
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="te@pelda.hu"
                      aria-invalid={!!mobileForm.formState.errors.email}
                      aria-describedby={mobileForm.formState.errors.email ? 'reg-m-email-err' : undefined}
                      className={cn(authInputDark, 'pr-11', mobileForm.formState.errors.email && 'ring-2 ring-red-400 border-red-400')}
                      {...mobileForm.register('email')}
                    />
                    <FieldStatusIcon status={mobileEmailStatus} />
                  </div>
                  {mobileForm.formState.errors.email
                    ? <p id="reg-m-email-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.email.message}</p>
                    : mobileEmailStatus === 'taken' && <p className={authErrorTextDark}>Ez az email már regisztrált.</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="space-y-1.5">
                  <Label className={authLabelDark}>Jelszó</Label>
                  <PasswordInput
                    dark
                    autoComplete="new-password"
                    aria-invalid={!!mobileForm.formState.errors.password}
                    aria-describedby={mobileForm.formState.errors.password ? 'reg-m-pw-err' : undefined}
                    className={cn(authInputDark, mobileForm.formState.errors.password && 'ring-2 ring-red-400 border-red-400')}
                    {...mobileForm.register('password')}
                  />
                  {mobileForm.formState.errors.password && <p id="reg-m-pw-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.password.message}</p>}
                </motion.div>
                <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Város</Label>
                    <input
                      autoComplete="address-level2"
                      placeholder="Budapest"
                      aria-invalid={!!mobileForm.formState.errors.city}
                      aria-describedby={mobileForm.formState.errors.city ? 'reg-m-city-err' : undefined}
                      className={cn(authInputDark, mobileForm.formState.errors.city && 'ring-2 ring-red-400 border-red-400')}
                      {...mobileForm.register('city')}
                    />
                    {mobileForm.formState.errors.city && <p id="reg-m-city-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.city.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className={authLabelDark}>Telefon</Label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+36 30..."
                      aria-invalid={!!mobileForm.formState.errors.phone}
                      aria-describedby={mobileForm.formState.errors.phone ? 'reg-m-phone-err' : undefined}
                      className={cn(authInputDark, mobileForm.formState.errors.phone && 'ring-2 ring-red-400 border-red-400')}
                      {...mobileForm.register('phone')}
                    />
                    {mobileForm.formState.errors.phone && <p id="reg-m-phone-err" role="alert" className={authErrorTextDark}>{mobileForm.formState.errors.phone.message}</p>}
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
                    onClick={() => continueWithGoogle(mobileForm)}
                  />
                </motion.div>
              </motion.form>
            </div>
          )}

          {/* Step 4 — import (optional) */}
          {step === 4 && (
            <div className="mt-12 flex-1 flex flex-col">
              <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-3">
                IMPORTÁLD<br />AZ ADATAID.
              </h2>
              <p className="text-white/45 text-sm mb-8">Ha más rendszerből váltasz, töltsd fel az exportált fájlt.</p>
              <WizardImportStep isDark onContinue={() => setStep(5)} />
            </div>
          )}

          {/* Step 5 — success */}
          {step === 5 && (
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
                    'Már csak az email-cím megerősítése van hátra',
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
              <button onClick={finish} className={authPillBtnLight}>
                Megerősítő email kiküldése <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      <div className="hidden lg:block min-h-dvh bg-[#f7f7f7] p-5 font-onest">
      <div className="flex h-[calc(100dvh-40px)] gap-5">
        {/* Left panel */}
        <div className="relative w-[45%] overflow-hidden rounded-[30px] bg-ink-dark flex flex-col p-14 select-none">
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
            <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="text-white/30 text-xs hover:text-white/50 transition-colors">{BRAND_COPYRIGHT}</a>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center overflow-y-auto rounded-[30px] bg-white px-6 py-12 [color-scheme:light]">
          <div className="w-full max-w-sm">

            {progressPills(progressStep)}

            <AnimatePresence mode="wait" initial={false}>
            {/* Step 2 */}
            {step === 2 && (
              <motion.div key={2} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
                <div className="mb-8">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-ink-soft text-xs mb-4 hover:text-ink transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Vissza
                  </button>
                  <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">2 / 4</p>
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Hozd létre a fiókodat</h2>
                </div>
                <motion.form variants={listStagger.container} initial="hidden" animate="show" onSubmit={desktopForm.handleSubmit(onStep2)} className="space-y-4" noValidate>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Szalon neve</Label>
                    <div className="relative">
                      <input
                        autoComplete="organization"
                        placeholder="Pl. Anna Fodrászat"
                        aria-invalid={!!desktopForm.formState.errors.salonName}
                        aria-describedby={desktopForm.formState.errors.salonName ? 'reg-d-salon-err' : undefined}
                        className={cn(authInputBase, 'pr-11', desktopForm.formState.errors.salonName && 'ring-2 ring-bad/40 border-bad/60')}
                        {...desktopForm.register('salonName')}
                      />
                      <FieldStatusIcon status={desktopNameStatus} />
                    </div>
                    {desktopForm.formState.errors.salonName
                      ? <p id="reg-d-salon-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.salonName.message}</p>
                      : desktopNameStatus === 'taken' && <p className={authErrorText}>Ez a név már foglalt — a nyilvános oldalad címe ütközne egy meglévővel.</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>A te neved</Label>
                    <input
                      autoComplete="name"
                      placeholder="Pl. Kiss Anna"
                      aria-invalid={!!desktopForm.formState.errors.ownerName}
                      aria-describedby={desktopForm.formState.errors.ownerName ? 'reg-d-owner-err' : undefined}
                      className={cn(authInputBase, desktopForm.formState.errors.ownerName && 'ring-2 ring-bad/40 border-bad/60')}
                      {...desktopForm.register('ownerName')}
                    />
                    {desktopForm.formState.errors.ownerName && <p id="reg-d-owner-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.ownerName.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Email</Label>
                    <div className="relative">
                      <input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="te@pelda.hu"
                        aria-invalid={!!desktopForm.formState.errors.email}
                        aria-describedby={desktopForm.formState.errors.email ? 'reg-d-email-err' : undefined}
                        className={cn(authInputBase, 'pr-11', desktopForm.formState.errors.email && 'ring-2 ring-bad/40 border-bad/60')}
                        {...desktopForm.register('email')}
                      />
                      <FieldStatusIcon status={desktopEmailStatus} />
                    </div>
                    {desktopForm.formState.errors.email
                      ? <p id="reg-d-email-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.email.message}</p>
                      : desktopEmailStatus === 'taken' && <p className={authErrorText}>Ez az email már regisztrált.</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>Jelszó</Label>
                    <PasswordInput
                      autoComplete="new-password"
                      aria-invalid={!!desktopForm.formState.errors.password}
                      aria-describedby={desktopForm.formState.errors.password ? 'reg-d-pw-err' : undefined}
                      className={cn(authInputBase, desktopForm.formState.errors.password && 'ring-2 ring-bad/40 border-bad/60')}
                      {...desktopForm.register('password')}
                    />
                    {desktopForm.formState.errors.password && <p id="reg-d-pw-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.password.message}</p>}
                  </motion.div>
                  <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Város</Label>
                      <input
                        autoComplete="address-level2"
                        placeholder="Budapest"
                        aria-invalid={!!desktopForm.formState.errors.city}
                        aria-describedby={desktopForm.formState.errors.city ? 'reg-d-city-err' : undefined}
                        className={cn(authInputBase, desktopForm.formState.errors.city && 'ring-2 ring-bad/40 border-bad/60')}
                        {...desktopForm.register('city')}
                      />
                      {desktopForm.formState.errors.city && <p id="reg-d-city-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.city.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Telefon</Label>
                      <input
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        placeholder="+36 30..."
                        aria-invalid={!!desktopForm.formState.errors.phone}
                        aria-describedby={desktopForm.formState.errors.phone ? 'reg-d-phone-err' : undefined}
                        className={cn(authInputBase, desktopForm.formState.errors.phone && 'ring-2 ring-bad/40 border-bad/60')}
                        {...desktopForm.register('phone')}
                      />
                      {desktopForm.formState.errors.phone && <p id="reg-d-phone-err" role="alert" className={authErrorText}>{desktopForm.formState.errors.phone.message}</p>}
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
              </motion.div>
            )}

            {/* Step 4 — import (optional) */}
            {step === 4 && (
              <motion.div key={4} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">3 / 4</p>
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Importáld az adataid</h2>
                  <p className="text-ink-soft text-sm mt-1">Ha más rendszerből váltasz — kihagyható, bármikor elvégezhető.</p>
                </div>
                <WizardImportStep isDark={false} onContinue={() => setStep(5)} />
              </motion.div>
            )}

            {/* Step 5 — success */}
            {step === 5 && (
              <motion.div key={5} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25, ease: EASE }}>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-ink-soft2 uppercase tracking-widest mb-1">Kész</p>
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Készen vagy!</h2>
                  <p className="text-ink-soft text-sm mt-1">A szalonod sikeresen létrejött — már csak egy kattintás van hátra.</p>
                </div>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
                    'Alapszolgáltatások beállítva',
                    'Foglalási oldal elérhető',
                    'Már csak az email-cím megerősítése van hátra',
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
                  Megerősítő email kiküldése <ChevronRight className="h-4 w-4" />
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>
    </>
  )
}
