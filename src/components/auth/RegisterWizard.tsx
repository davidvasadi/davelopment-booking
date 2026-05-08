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
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const step1Schema = z.object({
  salonName: z.string().min(2, 'Minimum 2 karakter'),
  ownerName: z.string().min(2, 'Minimum 2 karakter'),
  email: z.string().email('Érvényes email szükséges'),
  password: z.string().min(8, 'Minimum 8 karakter'),
  city: z.string().min(2, 'Kötelező'),
  phone: z.string().min(7, 'Érvényes telefonszám'),
})
type Step1Data = z.infer<typeof step1Schema>

const LEFT_TEXTS = [
  { step: 1, headline: 'CSATLAKOZZ\nHOZZÁNK.', sub: 'Hozd létre a fiókodat és szalonomat pár perc alatt.' },
  { step: 2, headline: 'ADD HOZZÁ\nA CSAPATODAT.', sub: 'Munkatársaid nevével testreszabhatod az időpontfoglalást.' },
  { step: 3, headline: 'KÉSZEN\nVAGYOK.', sub: 'A szalonod elérhető az ügyfelek számára.' },
]

export function RegisterWizard() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState('')
  const [salonId, setSalonId] = useState('')
  const [token, setToken] = useState('')
  const [staffName, setStaffName] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
  })

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const onStep1 = async (data: Step1Data) => {
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

        // Email already exists — try to log in and continue with salon creation
        const recoveryLogin = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: data.password }),
          credentials: 'include',
        })
        if (!recoveryLogin.ok) {
          throw new Error('Ez az email már regisztrált, de a jelszó nem stimmel. Jelentkezz be!')
        }
        const recoveryData = await recoveryLogin.json()
        authToken_ = recoveryData.token
        userId_ = recoveryData.user?.id ?? recoveryData.user

        // Check if they already have a salon
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

      // slug uniqueness: try base slug, then add timestamp suffix if taken
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

      setStep(2)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Hiba történt')
    } finally {
      setLoading(false)
    }
  }

  const onStep2 = async () => {
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
    setStep(3)
  }

  const finish = () => router.push('/bookly/dashboard')

  const leftText = LEFT_TEXTS[step - 1]

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col">
        <div className="flex flex-col flex-1 px-7 pt-12 pb-10">

          {/* Header with progress dots */}
          <div className="flex items-center justify-between mb-auto">
            <span className="text-white font-black text-xl tracking-tight">Bookly</span>
            <div className="flex gap-1.5">
              {([1, 2, 3] as const).map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-1.5 w-1.5 rounded-full transition-all duration-300',
                    s === step ? 'bg-white w-4' : s < step ? 'bg-zinc-500' : 'bg-zinc-700'
                  )}
                />
              ))}
            </div>
          </div>

          {/* Step 1 — dark form */}
          {step === 1 && (
            <div className="mt-12">
              <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                CSATLA<br />KOZZ<br />HOZZÁNK.
              </h2>
              <form onSubmit={handleSubmit(onStep1)} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Szalon neve</Label>
                  <input
                    placeholder="Pl. Anna Fodrászat"
                    className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                    {...register('salonName')}
                  />
                  {errors.salonName && <p className="text-xs text-red-400">{errors.salonName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">A te neved</Label>
                  <input
                    placeholder="Pl. Kiss Anna"
                    className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                    {...register('ownerName')}
                  />
                  {errors.ownerName && <p className="text-xs text-red-400">{errors.ownerName.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Email</Label>
                  <input
                    type="email"
                    placeholder="te@pelda.hu"
                    className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                    {...register('email')}
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Jelszó</Label>
                  <input
                    type="password"
                    className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                    {...register('password')}
                  />
                  {errors.password && <p className="text-xs text-red-400">{errors.password.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Város</Label>
                    <input
                      placeholder="Budapest"
                      className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                      {...register('city')}
                    />
                    {errors.city && <p className="text-xs text-red-400">{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Telefon</Label>
                    <input
                      placeholder="+36 30..."
                      className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                      {...register('phone')}
                    />
                    {errors.phone && <p className="text-xs text-red-400">{errors.phone.message}</p>}
                  </div>
                </div>
                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <Link href="/bookly/login">
                    <button type="button" className="w-full h-14 rounded-full border border-zinc-700 text-zinc-300 font-medium text-base">
                      Van már fiókom
                    </button>
                  </Link>
                </div>
              </form>
            </div>
          )}

          {/* Step 2 — white card feel on dark */}
          {step === 2 && (
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
              <div className="space-y-3">
                <button
                  onClick={onStep2}
                  disabled={loading}
                  className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Tovább <ArrowRight className="h-4 w-4" /></>}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-full h-14 rounded-full border border-zinc-700 text-zinc-400 font-medium text-base"
                >
                  Kihagyás
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — success */}
          {step === 3 && (
            <div className="mt-12 flex-1 flex flex-col justify-between">
              <div>
                <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                  KÉSZEN<br />VAGYOK.
                </h2>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
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
                Ugrás a dashboardra <ArrowRight className="h-4 w-4" />
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
            <h1 className="text-white font-black text-[3.25rem] uppercase leading-[1.05] tracking-tighter whitespace-pre-line transition-all">
              {leftText.headline}
            </h1>
            <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">
              {leftText.sub}
            </p>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 Bookly</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-sm">

            {/* Step progress */}
            <div className="flex gap-1.5 mb-10">
              {([1, 2, 3] as const).map(s => (
                <div
                  key={s}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-300',
                    s <= step ? 'bg-zinc-900' : 'bg-zinc-100'
                  )}
                />
              ))}
            </div>

            {/* Step 1 */}
            {step === 1 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">1 / 3</p>
                  <h2 className="text-2xl font-bold tracking-tight">Hozd létre a fiókodat</h2>
                </div>
                <form onSubmit={handleSubmit(onStep1)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Szalon neve</Label>
                    <Input placeholder="Pl. Anna Fodrászat" className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('salonName')} />
                    {errors.salonName && <p className="text-xs text-destructive">{errors.salonName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">A te neved</Label>
                    <Input placeholder="Pl. Kiss Anna" className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('ownerName')} />
                    {errors.ownerName && <p className="text-xs text-destructive">{errors.ownerName.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Email</Label>
                    <Input type="email" placeholder="te@pelda.hu" className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('email')} />
                    {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Jelszó</Label>
                    <Input type="password" className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('password')} />
                    {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-700">Város</Label>
                      <Input placeholder="Budapest" className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('city')} />
                      {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium text-zinc-700">Telefon</Label>
                      <Input placeholder="+36 30..." className="h-11 rounded-xl bg-zinc-50 border-zinc-200" {...register('phone')} />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-2">
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <span className="flex items-center gap-2">Tovább <ArrowRight className="h-4 w-4" /></span>
                    }
                  </Button>
                </form>
                <p className="mt-6 text-center text-sm text-zinc-500">
                  Van már fiókod?{' '}
                  <Link href="/bookly/login" className="font-semibold text-zinc-900 hover:underline no-underline">Bejelentkezés</Link>
                </p>
              </>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">2 / 3</p>
                  <h2 className="text-2xl font-bold tracking-tight">Add hozzá az első munkatársat</h2>
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
                  <Button
                    onClick={onStep2}
                    disabled={loading}
                    className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <span className="flex items-center gap-2">Tovább <ArrowRight className="h-4 w-4" /></span>
                    }
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full h-12 rounded-full border border-zinc-200 text-sm text-zinc-500 hover:text-zinc-900 hover:border-zinc-400 transition-colors"
                  >
                    Kihagyás
                  </button>
                </div>
              </>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <>
                <div className="mb-8">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-1">3 / 3</p>
                  <h2 className="text-2xl font-bold tracking-tight">Készen vagy!</h2>
                  <p className="text-zinc-500 text-sm mt-1">A szalonod sikeresen létrejött.</p>
                </div>
                <div className="space-y-3">
                  {[
                    'Szalon profil létrehozva',
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
                <Button
                  onClick={finish}
                  className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-6"
                >
                  <span className="flex items-center gap-2">Ugrás a dashboardra <ArrowRight className="h-4 w-4" /></span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
