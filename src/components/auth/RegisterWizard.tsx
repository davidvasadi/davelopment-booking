'use client'

import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  ChevronRight, ChevronLeft, Check, Loader2,
  Sparkles, HeartPulse, Dumbbell, LayoutGrid, ChefHat,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAIN_CATEGORIES, getSubTypesForCategory, type BusinessType, type MainCategory } from '@/lib/businessTemplates'

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

  const { register, handleSubmit, formState: { errors } } = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
  })

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
          router.push('/bookly/dashboard')
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

      // Seed templates in background — don't block the wizard
      if (selectedTypes.length > 0) {
        fetch('/api/bookly/seed-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ salonId: salon.id, businessTypes: selectedTypes }),
        }).catch(() => {})
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

  const finish = () => router.push('/bookly/dashboard')

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
                  ? isSelected ? 'border-white bg-white/10 ring-1 ring-white' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800/60'
                  : isSelected ? 'border-zinc-900 bg-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
              )}
            >
              <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2.5', isDark ? (isSelected ? 'bg-white' : 'bg-zinc-800') : (isSelected ? 'bg-white' : 'bg-zinc-100'))}>
                <Icon className={cn(isDark ? (isSelected ? 'text-zinc-950' : 'text-zinc-300') : (isSelected ? 'text-zinc-950' : 'text-zinc-500'))} style={{ width: 18, height: 18 }} />
              </div>
              <p className={cn('font-bold text-sm leading-tight', isDark ? (isSelected ? 'text-white' : 'text-zinc-200') : (isSelected ? 'text-white' : 'text-zinc-800'))}>{cat.label}</p>
              <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-zinc-500' : (isSelected ? 'text-zinc-400' : 'text-zinc-500'))}>{cat.description}</p>
            </button>
          )
        })}
        {/* Étterem — soon */}
        <button disabled className={cn(
          'relative flex flex-col items-start p-4 rounded-2xl border text-left opacity-50 cursor-not-allowed',
          isDark ? 'border-zinc-800 bg-zinc-900/40' : 'border-zinc-200 bg-zinc-50'
        )}>
          <span className={cn('absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full', isDark ? 'text-zinc-500 bg-zinc-800' : 'text-zinc-500 bg-zinc-200')}>Hamarosan</span>
          <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center mb-2.5', isDark ? 'bg-zinc-800' : 'bg-zinc-200')}>
            <ChefHat className={isDark ? 'text-zinc-300' : 'text-zinc-500'} style={{ width: 18, height: 18 }} />
          </div>
          <p className={cn('font-bold text-sm leading-tight', isDark ? 'text-zinc-200' : 'text-zinc-700')}>Étterem</p>
          <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-zinc-500' : 'text-zinc-400')}>Asztalfoglalás</p>
        </button>
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
                  ? isSelected ? 'border-white bg-white/10 ring-1 ring-white' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800/60'
                  : isSelected ? 'border-zinc-900 bg-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
              )}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-white flex items-center justify-center">
                  <Check className="h-3 w-3 text-zinc-950" />
                </div>
              )}
              <p className={cn('font-bold text-sm leading-tight mt-1', isDark ? (isSelected ? 'text-white' : 'text-zinc-200') : (isSelected ? 'text-white' : 'text-zinc-800'))}>{opt.label}</p>
              <p className={cn('text-xs mt-0.5 leading-tight', isDark ? 'text-zinc-500' : (isSelected ? 'text-zinc-400' : 'text-zinc-500'))}>{opt.description}</p>
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
        <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col">
          <div className="flex flex-col flex-1 px-7 pt-12 pb-10 overflow-y-auto">
            <div className="flex items-center justify-between mb-auto">
              {subStep === 'types' ? (
                <button
                  onClick={() => setSubStep('category')}
                  className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" /> Vissza
                </button>
              ) : (
                <Link href="/" className="text-white font-black text-xl tracking-tight hover:opacity-70 transition-opacity">Bookly</Link>
              )}
              <div className="flex gap-1.5">
                {([1, 2, 3, 4] as const).map(s => (
                  <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', s === step ? 'bg-white w-4' : s < step ? 'w-1.5 bg-zinc-500' : 'w-1.5 bg-zinc-800')} />
                ))}
              </div>
            </div>
            <div className="mt-12">
              {subStep === 'category' ? (
                <>
                  <h2 className="text-white font-black text-[2rem] uppercase leading-[1.0] tracking-tighter mb-8">
                    MILYEN<br />VÁLLALKOZÁST<br />VEZETSZ?
                  </h2>
                  {mainCatCards(true)}
                  <div className="mt-6 space-y-3">
                    <button onClick={() => setStep(2)} className="w-full h-14 rounded-full border border-zinc-700 text-zinc-400 font-medium text-base">
                      Kihagyás
                    </button>
                    <Link href="/bookly/login" className="w-full h-14 rounded-full flex items-center justify-center text-zinc-600 font-medium text-base">
                      Van már fiókom
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-white font-black text-[2rem] uppercase leading-[1.0] tracking-tighter mb-2">
                    MILYEN<br />SZOLGÁL-<br />TATÁSOKAT<br />KÍNÁLSZ?
                  </h2>
                  <p className="text-zinc-500 text-sm mb-6">Többet is választhatsz.</p>
                  {subTypeCards(true)}
                  <div ref={mobileCTARef} className="mt-6 space-y-4">
                    <button
                      onClick={() => selectedTypes.length > 0 && setStep(2)}
                      disabled={selectedTypes.length === 0}
                      className={cn(
                        'w-full h-14 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all duration-200',
                        selectedTypes.length > 0 ? 'bg-white text-zinc-950 hover:bg-zinc-100' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      )}
                    >
                      Tovább {selectedTypes.length > 0 && `(${selectedTypes.length})`} <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => setStep(2)} className="w-full h-14 rounded-full border border-zinc-700 text-zinc-400 font-medium text-base">
                      Kihagyás
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── DESKTOP ── */}
        <div className="hidden lg:flex min-h-screen">
          <div className="w-[45%] bg-zinc-950 flex flex-col justify-between p-14 select-none">
            <span className="text-white font-black text-xl tracking-tight">Bookly</span>
            <div>
              <h1 className="text-white font-black text-[2.25rem] uppercase leading-[1.05] tracking-tighter whitespace-pre-line">
                {desktopLeftHeadline.h}
              </h1>
              <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">{desktopLeftHeadline.sub}</p>
            </div>
            <p className="text-zinc-700 text-xs">© 2026 Bookly</p>
          </div>

          <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white overflow-y-auto">
            <div className="w-full max-w-sm">
              <div className="h-1 bg-zinc-100 rounded-full mb-10 overflow-hidden">
                <div className="h-full bg-zinc-900 rounded-full transition-all duration-500" style={{ width: '25%' }} />
              </div>

              {subStep === 'category' ? (
                <>
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">1 / 4</p>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Milyen vállalkozást vezetsz?</h2>
                    <p className="text-zinc-500 text-sm mt-1">Beállítjuk az alapokat, te csak testreszabod.</p>
                  </div>
                  {mainCatCards(false)}
                  <button onClick={() => setStep(2)} className="mt-4 w-full h-10 text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
                    Kihagyás — manuálisan töltöm fel
                  </button>
                  <p className="text-center text-sm text-zinc-400 mt-2">
                    Van már fiókod?{' '}
                    <Link href="/bookly/login" className="font-semibold text-zinc-700 hover:underline">Bejelentkezés</Link>
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-6">
                    <button onClick={() => setSubStep('category')} className="flex items-center gap-1.5 text-zinc-400 text-xs mb-4 hover:text-zinc-600 transition-colors">
                      <ChevronLeft className="h-3 w-3" /> Vissza
                    </button>
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">1 / 4 — {MAIN_CATEGORIES.find(c => c.id === selectedCategory)?.label}</p>
                    <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Milyen szolgáltatásokat kínálsz?</h2>
                    <p className="text-zinc-500 text-sm mt-1">Többet is választhatsz.</p>
                  </div>
                  {subTypeCards(false)}
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => selectedTypes.length > 0 && setStep(2)}
                      disabled={selectedTypes.length === 0}
                      className={cn(
                        'w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                        selectedTypes.length > 0 ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                      )}
                    >
                      Tovább {selectedTypes.length > 0 && `(${selectedTypes.length} kiválasztva)`} <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => setStep(2)} className="w-full h-10 text-sm text-zinc-400 hover:text-zinc-600 transition-colors">
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
      <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col">
        <div className="flex flex-col flex-1 px-7 pt-12 pb-10">
          <div className="flex items-center justify-between mb-auto">
            {step === 2 ? (
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-zinc-200 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Vissza
              </button>
            ) : (
              <Link href="/" className="text-white font-black text-xl tracking-tight hover:opacity-70 transition-opacity">Bookly</Link>
            )}
            <div className="flex gap-1.5">
              {([1, 2, 3, 4] as const).map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    s === step ? 'bg-white w-4' : s < step ? 'w-1.5 bg-zinc-500' : 'w-1.5 bg-zinc-800'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Step 2 — registration form */}
          {step === 2 && (
            <div className="mt-12">
              <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                CSATLAKOZZ<br />HOZZÁNK.
              </h2>
              <form onSubmit={handleSubmit(onStep2)} className="space-y-3" noValidate>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Szalon neve</Label>
                  <input
                    placeholder="Pl. Anna Fodrászat"
                    className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.salonName ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`}
                    {...register('salonName')}
                  />
                  {errors.salonName && <p className="text-xs text-red-400">{errors.salonName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">A te neved</Label>
                  <input
                    placeholder="Pl. Kiss Anna"
                    className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.ownerName ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`}
                    {...register('ownerName')}
                  />
                  {errors.ownerName && <p className="text-xs text-red-400">{errors.ownerName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Email</Label>
                  <input
                    type="email"
                    placeholder="te@pelda.hu"
                    className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.email ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`}
                    {...register('email')}
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Jelszó</Label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.password ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`}
                    {...register('password')}
                  />
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Város</Label>
                    <input
                      placeholder="Budapest"
                      className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.city ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`}
                      {...register('city')}
                    />
                    {errors.city && <p className="text-xs text-red-400">{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Telefon</Label>
                    <input
                      placeholder="+36 30..."
                      className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.phone ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`}
                      {...register('phone')}
                    />
                    {errors.phone && <p className="text-xs text-red-400">{errors.phone.message}</p>}
                  </div>
                </div>
                <div className="pt-2 space-y-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                  </button>
                  <Link href="/bookly/login" className="w-full h-14 rounded-full border border-zinc-700 text-zinc-300 font-medium text-base flex items-center justify-center">
                    Van már fiókom
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* Step 3 — staff */}
          {step === 3 && (
            <div className="mt-12 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                  ADD HOZZÁ<br />A CSAPA<br />TODAT.
                </h2>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Munkatárs neve</Label>
                    <input
                      placeholder="Pl. Kovács Péter"
                      className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
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
                  className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-full h-14 rounded-full border border-zinc-700 text-zinc-400 font-medium text-base"
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
                <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                  KÉSZEN<br />VAGYOK.
                </h2>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
                    'Alapszolgáltatások beállítva',
                    'Foglalási oldal elérhető',
                    'Dashboard hozzáférés aktív',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-zinc-950" />
                      </div>
                      <span className="text-sm font-medium text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={finish}
                className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
              >
                Ugrás a dashboardra <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left panel */}
        <div className="w-[45%] bg-zinc-950 flex flex-col justify-between p-14 select-none">
          <span className="text-white font-black text-xl tracking-tight">Bookly</span>
          <div>
            <h1 className="text-white font-black text-[3.25rem] uppercase leading-[1.05] tracking-tighter whitespace-pre-line">
              {leftText.headline}
            </h1>
            <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">{leftText.sub}</p>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 Bookly</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-sm">

            {/* Progress bar */}
            <div className="h-1 bg-zinc-100 rounded-full mb-10 overflow-hidden">
              <div
                className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                style={{ width: `${progressWidth}%` }}
              />
            </div>

            {/* Step 2 */}
            {step === 2 && (
              <>
                <div className="mb-8">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-zinc-400 text-xs mb-4 hover:text-zinc-600 transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Vissza
                  </button>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">2 / 4</p>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Hozd létre a fiókodat</h2>
                </div>
                <form onSubmit={handleSubmit(onStep2)} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Szalon neve</Label>
                    <Input placeholder="Pl. Anna Fodrászat" className={`h-11 rounded-xl bg-zinc-50 ${errors.salonName ? 'border-red-500' : 'border-zinc-200'}`} {...register('salonName')} />
                    {errors.salonName && <p className="text-xs text-red-500">{errors.salonName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">A te neved</Label>
                    <Input placeholder="Pl. Kiss Anna" className={`h-11 rounded-xl bg-zinc-50 ${errors.ownerName ? 'border-red-500' : 'border-zinc-200'}`} {...register('ownerName')} />
                    {errors.ownerName && <p className="text-xs text-red-500">{errors.ownerName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Email</Label>
                    <Input type="email" placeholder="te@pelda.hu" className={`h-11 rounded-xl bg-zinc-50 ${errors.email ? 'border-red-500' : 'border-zinc-200'}`} {...register('email')} />
                    {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Jelszó</Label>
                    <Input type="password" autoComplete="new-password" className={`h-11 rounded-xl bg-zinc-50 ${errors.password ? 'border-red-500' : 'border-zinc-200'}`} {...register('password')} />
                    {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-700">Város</Label>
                      <Input placeholder="Budapest" className={`h-11 rounded-xl bg-zinc-50 ${errors.city ? 'border-red-500' : 'border-zinc-200'}`} {...register('city')} />
                      {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-700">Telefon</Label>
                      <Input placeholder="+36 30..." className={`h-11 rounded-xl bg-zinc-50 ${errors.phone ? 'border-red-500' : 'border-zinc-200'}`} {...register('phone')} />
                      {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2">Tovább <ChevronRight className="h-4 w-4" /></span>}
                  </Button>
                </form>
                <p className="mt-6 text-center text-sm text-zinc-500">
                  Van már fiókod?{' '}
                  <Link href="/bookly/login" className="font-semibold text-zinc-900 hover:underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">3 / 4</p>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Add hozzá az első munkatársat</h2>
                  <p className="text-zinc-500 text-sm mt-1">Kihagyható — később is hozzáadhatsz.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Munkatárs neve</Label>
                    <Input
                      placeholder="Pl. Kovács Péter"
                      className="h-11 rounded-xl bg-zinc-50 border-zinc-200"
                      value={staffName}
                      onChange={e => setStaffName(e.target.value)}
                    />
                  </div>
                  <Button onClick={onStep3} disabled={loading} className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="flex items-center gap-2">Tovább <ChevronRight className="h-4 w-4" /></span>}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="w-full h-12 rounded-full border border-zinc-200 text-sm text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-colors"
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
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">4 / 4</p>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Készen vagy!</h2>
                  <p className="text-zinc-500 text-sm mt-1">A szalonod sikeresen létrejött.</p>
                </div>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
                    'Alapszolgáltatások beállítva',
                    'Foglalási oldal elérhető',
                    'Dashboard hozzáférés aktív',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 p-3.5 bg-zinc-50 rounded-xl">
                      <div className="h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium text-zinc-700">{item}</span>
                    </div>
                  ))}
                </div>
                <Button onClick={finish} className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-6">
                  <span className="flex items-center gap-2">Ugrás a dashboardra <ChevronRight className="h-4 w-4" /></span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
