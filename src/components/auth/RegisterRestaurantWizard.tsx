'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, Check, Loader2, UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RESTAURANT_TEMPLATES } from '@/lib/restaurantTemplates'
import { SchedulioLogo } from '@/components/SchedulioLogo'

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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

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
        body: JSON.stringify({ name: data.ownerName, email: data.email, password: data.password, role: 'restaurant_owner' }),
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
          body: JSON.stringify({ email: data.email, password: data.password }),
          credentials: 'include',
        })
        if (!loginRes.ok) throw new Error('Bejelentkezés sikertelen a regisztráció után')
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

      await fetch(`/api/users/${userId_}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${authToken_}` },
        body: JSON.stringify({ restaurant: restaurant.id }),
      })

      if (selectedTemplate) {
        fetch('/api/restaurant/seed-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ restaurantId: restaurant.id, templateId: selectedTemplate }),
        }).catch(() => {})
      }

      setStep(3)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  const finish = () => router.push('/restaurant')

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
              isDark
                ? isSelected ? 'border-white bg-white/10 ring-1 ring-white' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-800/60'
                : isSelected ? 'border-zinc-900 bg-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200 bg-white hover:border-zinc-400 hover:bg-zinc-50'
            )}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-white flex items-center justify-center">
                <Check className="h-3 w-3 text-zinc-950" />
              </div>
            )}
            <p className={cn('font-bold text-sm leading-tight', isDark ? (isSelected ? 'text-white' : 'text-zinc-200') : (isSelected ? 'text-white' : 'text-zinc-800'))}>{tpl.label}</p>
            <p className={cn('text-xs mt-1 leading-snug pr-6', isDark ? 'text-zinc-500' : (isSelected ? 'text-zinc-400' : 'text-zinc-500'))}>{tpl.description}</p>
          </button>
        )
      })}
    </div>
  )

  const TOTAL_STEPS = 3
  const progressWidth = (step / TOTAL_STEPS) * 100

  const leftHeadlines: Record<number, { headline: string; sub: string }> = {
    1: { headline: 'MILYEN\nÉTTERMET\nVEZETSZ?', sub: 'Válassz egy sablont — asztalokat és turnusokat állítunk be, te csak testreszabod.' },
    2: { headline: 'CSATLAKOZZ\nHOZZÁNK.', sub: 'Hozd létre a fiókodat és az éttermed pár perc alatt.' },
    3: { headline: 'KÉSZEN\nVAGYOK.', sub: 'Az étterme elérhető az online foglaláshoz.' },
  }
  const leftText = leftHeadlines[step]

  const StepIndicator = () => (
    <div className="flex gap-1.5">
      {([1, 2, 3] as const).map(s => (
        <div key={s} className={cn('h-1.5 rounded-full transition-all duration-300', s === step ? 'bg-white w-4' : s < step ? 'w-1.5 bg-zinc-500' : 'w-1.5 bg-zinc-800')} />
      ))}
    </div>
  )

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col">
        <div className="flex flex-col flex-1 px-7 pt-12 pb-10 overflow-y-auto">
          <div className="flex items-center justify-between mb-auto">
            {step === 2 ? (
              <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-zinc-400 text-sm hover:text-zinc-200 transition-colors">
                <ChevronLeft className="h-4 w-4" /> Vissza
              </button>
            ) : (
              <Link href="/" aria-label="Schedulio" className="w-fit hover:opacity-80 transition-opacity">
                <SchedulioLogo variant="dark" className="h-8" />
              </Link>
            )}
            <StepIndicator />
          </div>

          {step === 1 && (
            <div className="mt-12">
              <h2 className="text-white font-black text-[2rem] uppercase leading-[1.0] tracking-tighter mb-2">
                MILYEN<br />ÉTTERMET<br />VEZETSZ?
              </h2>
              <p className="text-zinc-500 text-sm mb-6">Válassz egy sablont — később testreszabhatod.</p>
              {templateCards(true)}
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => selectedTemplate && setStep(2)}
                  disabled={!selectedTemplate}
                  className={cn(
                    'w-full h-14 rounded-full font-bold text-base flex items-center justify-center gap-2 transition-all duration-200',
                    selectedTemplate ? 'bg-white text-zinc-950 hover:bg-zinc-100' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  )}
                >
                  Tovább <ChevronRight className="h-4 w-4" />
                </button>
                <Link href="/login" className="w-full h-14 rounded-full flex items-center justify-center text-zinc-600 font-medium text-base">
                  Van már fiókom
                </Link>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="mt-12">
              <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                CSATLAKOZZ<br />HOZZÁNK.
              </h2>
              <form onSubmit={handleSubmit(onStep2)} className="space-y-3" noValidate>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Étterem neve</Label>
                  <input placeholder="Pl. Bistro Central" className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.restaurantName ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`} {...register('restaurantName')} />
                  {errors.restaurantName && <p className="text-xs text-red-400">{errors.restaurantName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">A te neved</Label>
                  <input placeholder="Pl. Nagy Gábor" className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.ownerName ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`} {...register('ownerName')} />
                  {errors.ownerName && <p className="text-xs text-red-400">{errors.ownerName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Email</Label>
                  <input type="email" placeholder="te@pelda.hu" className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.email ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`} {...register('email')} />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Jelszó</Label>
                  <input type="password" autoComplete="new-password" className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.password ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`} {...register('password')} />
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Város</Label>
                    <input placeholder="Budapest" className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.city ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`} {...register('city')} />
                    {errors.city && <p className="text-xs text-red-400">{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Telefon</Label>
                    <input placeholder="+36 30..." className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.phone ? 'border-red-500' : 'border-zinc-800 focus:border-zinc-500'}`} {...register('phone')} />
                    {errors.phone && <p className="text-xs text-red-400">{errors.phone.message}</p>}
                  </div>
                </div>
                <div className="pt-2 space-y-4">
                  <button type="submit" disabled={loading} className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ChevronRight className="h-4 w-4" /></>}
                  </button>
                  <Link href="/login" className="w-full h-14 rounded-full border border-zinc-700 text-zinc-300 font-medium text-base flex items-center justify-center">
                    Van már fiókom
                  </Link>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="mt-12 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                  KÉSZEN<br />VAGYOK.
                </h2>
                <div className="space-y-3">
                  {['Étterem profil létrehozva', 'Asztalok és turnusok beállítva', 'Foglalási oldal elérhető', 'Dashboard hozzáférés aktív'].map(item => (
                    <div key={item} className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <div className="h-5 w-5 rounded-full bg-white flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-zinc-950" />
                      </div>
                      <span className="text-sm font-medium text-zinc-300">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={finish} className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2">
                Ugrás a dashboardra <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex min-h-screen">
        <div className="w-[45%] bg-zinc-950 flex flex-col justify-between p-14 select-none">
          <Link href="/" aria-label="Schedulio" className="w-fit hover:opacity-80 transition-opacity">
            <SchedulioLogo variant="dark" className="h-8" />
          </Link>
          <div>
            <h1 className="text-white font-black text-[3.25rem] uppercase leading-[1.05] tracking-tighter whitespace-pre-line">
              {leftText.headline}
            </h1>
            <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">{leftText.sub}</p>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 Schedulio by [davelopment]®</p>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white overflow-y-auto">
          <div className="w-full max-w-sm">
            <div className="h-1 bg-zinc-100 rounded-full mb-10 overflow-hidden">
              <div className="h-full bg-zinc-900 rounded-full transition-all duration-500" style={{ width: `${progressWidth}%` }} />
            </div>

            {step === 1 && (
              <>
                <div className="mb-6">
                  <div className="h-9 w-9 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
                    <UtensilsCrossed className="text-zinc-700" style={{ width: 18, height: 18 }} />
                  </div>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">1 / 3</p>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Milyen éttermet vezetsz?</h2>
                  <p className="text-zinc-500 text-sm mt-1">Válassz sablont, te csak testreszabod.</p>
                </div>
                {templateCards(false)}
                <div className="mt-6">
                  <button
                    onClick={() => selectedTemplate && setStep(2)}
                    disabled={!selectedTemplate}
                    className={cn(
                      'w-full h-12 rounded-full font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                      selectedTemplate ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                    )}
                  >
                    Tovább <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-center text-sm text-zinc-400 mt-4">
                  Van már fiókod?{' '}
                  <Link href="/login" className="font-semibold text-zinc-700 hover:underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {step === 2 && (
              <>
                <div className="mb-8">
                  <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-zinc-400 text-xs mb-4 hover:text-zinc-600 transition-colors">
                    <ChevronLeft className="h-3 w-3" /> Vissza
                  </button>
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">2 / 3</p>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Hozd létre a fiókodat</h2>
                </div>
                <form onSubmit={handleSubmit(onStep2)} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Étterem neve</Label>
                    <Input placeholder="Pl. Bistro Central" className={`h-11 rounded-xl bg-zinc-50 ${errors.restaurantName ? 'border-red-500' : 'border-zinc-200'}`} {...register('restaurantName')} />
                    {errors.restaurantName && <p className="text-xs text-red-500">{errors.restaurantName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">A te neved</Label>
                    <Input placeholder="Pl. Nagy Gábor" className={`h-11 rounded-xl bg-zinc-50 ${errors.ownerName ? 'border-red-500' : 'border-zinc-200'}`} {...register('ownerName')} />
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
                  <Link href="/login" className="font-semibold text-zinc-900 hover:underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {step === 3 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">3 / 3</p>
                  <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Készen vagy!</h2>
                  <p className="text-zinc-500 text-sm mt-1">Az éttermed sikeresen létrejött.</p>
                </div>
                <div className="space-y-3">
                  {['Étterem profil létrehozva', 'Asztalok és turnusok beállítva', 'Foglalási oldal elérhető', 'Dashboard hozzáférés aktív'].map(item => (
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
