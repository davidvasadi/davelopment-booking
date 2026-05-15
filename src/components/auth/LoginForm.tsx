'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type FormData = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/bookly/dashboard'
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })
      if (!res.ok) throw new Error((await res.json()).message ?? 'Hibás adatok')
      const json = await res.json()
      const role = json?.user?.role
      if (role === 'admin') {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
        throw new Error('Admin fiókok a Backstage-en keresztül léphetnek be')
      }
      const safeTo = from.startsWith('/bookly/') ? from : '/bookly/dashboard'
      router.push(safeTo)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bejelentkezés sikertelen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col">
        {!showForm ? (
          /* Splash screen */
          <div className="flex flex-col justify-between flex-1 px-7 pt-12 pb-10">
            <span className="relative inline-block w-fit leading-none">
              <Link href="/" className="text-white font-black text-xl tracking-tight hover:opacity-70 transition-opacity">Bookly</Link>
              <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="absolute -bottom-3 right-0 translate-x-1/2 text-[10px] text-zinc-500 font-normal leading-none whitespace-nowrap hover:text-zinc-300 transition-colors">by [davelopment]®</a>
            </span>
            <h1 className="text-white font-black text-[3rem] uppercase leading-[1.0] tracking-tighter">
              KEZELD <br />OKOSAN<br />A SZALONOD.
            </h1>
            <div className="space-y-4">
              <button
                onClick={() => setShowForm(true)}
                className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base"
              >
                Bejelentkezés
              </button>
              <Link href="/bookly/register" className="block">
                <button className="w-full h-14 rounded-full border border-zinc-700 text-zinc-300 font-medium text-base">
                  Regisztráció
                </button>
              </Link>
              <p className="text-zinc-600 text-xs text-center pt-1">
                A folytatással elfogadod az{' '}
                <span className="text-zinc-500 underline">ÁSZF</span>-et
              </p>
            </div>
          </div>
        ) : (
          /* Login form on dark bg */
          <div className="flex flex-col justify-between flex-1 px-7 pt-12 pb-10">
            <button
              onClick={() => setShowForm(false)}
              className="text-zinc-500 text-sm text-left w-fit"
            >
              ← Vissza
            </button>
            <div>
              <h2 className="text-white font-black text-3xl uppercase tracking-tighter mb-8">
                ÜDVÖZLÜNK<br />VISSZA.
              </h2>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Email</Label>
                  <input
                    type="email"
                    placeholder="te@pelda.hu"
                    className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none transition-colors ${errors.email ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-zinc-500'}`}
                    {...register('email')}
                  />
                  {errors.email && <p className="text-xs text-red-400">Érvényes email szükséges</p>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-400 text-sm">Jelszó</Label>
                    <Link href="/bookly/forgot-password" className="text-xs text-zinc-500 no-underline">
                      Elfelejtetted?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      className={`w-full h-12 rounded-xl bg-zinc-900 border text-white placeholder:text-zinc-600 px-4 pr-11 text-sm focus:outline-none transition-colors ${errors.password ? 'border-red-500 focus:border-red-400' : 'border-zinc-800 focus:border-zinc-500'}`}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-400">Minimum 6 karakter</p>}
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Bejelentkezés <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            </div>
            <p className="text-zinc-600 text-xs text-center" />
          </div>
        )}
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">
        {/* Left panel */}
        <div className="w-[45%] bg-zinc-950 flex flex-col justify-between p-14 select-none">
<span className="relative inline-block w-fit leading-none">
  <Link href="/" className="text-white font-black text-xl tracking-tight hover:opacity-70 transition-opacity">Bookly</Link>
  <a href="https://davelopment.hu" target="_blank" rel="noopener noreferrer" className="absolute -bottom-3 right-0 translate-x-1/2 text-[10px] text-zinc-500 font-normal leading-none whitespace-nowrap hover:text-zinc-300 transition-colors">
    by [davelopment]®
  </a>
</span>    <div>
            <h1 className="text-white font-black text-[3.25rem] uppercase leading-[1.05] tracking-tighter">
              KEZELD<br />OKOSAN <br />A SZALONOD.
            </h1>
            <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">
              Modern időpontfoglaló kis vállalkozásoknak. Egyszerű beállítás, azonnali eredmény.
            </p>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 Bookly</p>
        </div>

        {/* Right form panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-16 bg-white">
          <div className="w-full max-w-sm">
            <div className="mb-10">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Üdv újra!</h2>
              <p className="text-zinc-500 text-sm mt-1">Jelentkezz be a fiókodba</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Email</Label>
                <Input
                  type="email"
                  placeholder="te@pelda.hu"
                  className={`h-11 rounded-xl bg-zinc-50 ${errors.email ? 'border-red-500 focus-visible:ring-red-200' : 'border-zinc-200'}`}
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-red-500">Érvényes email szükséges</p>}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-zinc-700">Jelszó</Label>
                  <Link href="/bookly/forgot-password" className="text-xs text-zinc-400 hover:text-zinc-900 no-underline">
                    Elfelejtetted?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className={`h-11 rounded-xl bg-zinc-50 pr-10 ${errors.password ? 'border-red-500 focus-visible:ring-red-200' : 'border-zinc-200'}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500">Minimum 6 karakter</p>}
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold mt-2"
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <span className="flex items-center gap-2">Bejelentkezés <ArrowRight className="h-4 w-4" /></span>
                }
              </Button>
            </form>
            <p className="mt-8 text-center text-sm text-zinc-500">
              Nincs még fiókod?{' '}
              <Link href="/bookly/register" className="font-semibold text-zinc-900 hover:underline no-underline">
                Regisztráció
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
