'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { listStagger } from '@/lib/motion'
import { BrandLogo } from '@/components/BrandLogo'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { authInputBase, authLabelBase, authPillBtn, authInputDark, authLabelDark, authPillBtnLight, authGhostBtnDark, authDividerDark, authErrorText, authErrorTextDark, authDivider, BRAND_COPYRIGHT } from '@/components/auth/authStyles'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
type FormData = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/dashboard'
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // Csak az aktív eszköz form-ját rendereljük (mobil VAGY desktop), különben két azonos
  // name-ű input kerülne a DOM-ba, és a react-hook-form a rossz (rejtett) mezőt olvasná
  // → üres adat → néma "hibás adatok" visszadobás. mounted: SSR-hidratációs eltérés ellen.
  const [mounted, setMounted] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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
        await fetch('/api/auth/signout-payload', { method: 'POST', credentials: 'include' })
        throw new Error('Admin fiókok a Backstage-en keresztül léphetnek be')
      }
      const home = role === 'restaurant_owner' ? '/restaurant' : '/dashboard'
      const hasFrom = searchParams.get('from')
      const safeTo = hasFrom && from.startsWith('/') && !from.startsWith('//') ? from : home
      router.push(safeTo)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bejelentkezés sikertelen')
    } finally {
      setLoading(false)
    }
  }

  // Mount előtt egy semleges sötét hátteret adunk (megegyezik mindkét layout alap-bg-jével),
  // hogy ne legyen villanás és ne renderelődjön egyik form sem a kliens-detektálás előtt.
  if (!mounted) {
    return <div className="min-h-screen bg-ink-dark" />
  }

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      {!isDesktop && (
      <div className="min-h-screen bg-ink-dark font-onest flex flex-col">
        {!showForm ? (
          /* Splash screen */
          <div className="flex flex-col justify-between flex-1 px-7 pt-12 pb-10">
            <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
              <BrandLogo variant="dark" className="h-8" />
            </Link>
            <h1 className="text-white font-light text-[3.25rem] uppercase leading-[1.0] tracking-[-0.02em]">
              KEZELD <br />OKOSAN<br />A SZALONOD.
            </h1>
            <div className="space-y-4">
              <button
                onClick={() => setShowForm(true)}
                className={authPillBtnLight}
              >
                Bejelentkezés
              </button>
              <Link href="/register" className="block">
                <button className={authGhostBtnDark}>
                  Regisztráció
                </button>
              </Link>
              {/* VAGY elválasztó + Google ikon a splash-en is, hogy egy érintéssel beléphessen. */}
              <div className={`${authDividerDark} pt-1`}>
                <span className="h-px flex-1 bg-white/10" />vagy<span className="h-px flex-1 bg-white/10" />
              </div>
              <GoogleSignInButton variant="dark" callbackUrl="/" label="Bejelentkezés Google-lel" />
              <p className="text-white/40 text-xs text-center pt-1">
                A folytatással elfogadod az{' '}
                <span className="text-white/55 underline">ÁSZF</span>-et
              </p>
            </div>
          </div>
        ) : (
          /* Login form on dark bg */
          <div className="flex flex-col justify-between flex-1 px-7 pt-12 pb-10">
            <button
              onClick={() => setShowForm(false)}
              className="text-white/50 text-sm text-left w-fit hover:text-white/80 transition-colors"
            >
              ← Vissza
            </button>
            <motion.div variants={listStagger.container} initial="hidden" animate="show">
              <motion.h2 variants={listStagger.item} className="text-white font-light text-[2.25rem] uppercase tracking-[-0.02em] leading-[1.05] mb-8">
                ÜDVÖZLÜNK<br />VISSZA.
              </motion.h2>
              <motion.form variants={listStagger.item} onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <Label className={authLabelDark}>Email</Label>
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="te@pelda.hu"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'login-m-email-err' : undefined}
                    className={cn(authInputDark, errors.email && 'ring-2 ring-red-400 border-red-400')}
                    {...register('email')}
                  />
                  {errors.email && <p id="login-m-email-err" role="alert" className={authErrorTextDark}>Érvényes email szükséges</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className={authLabelDark}>Jelszó</Label>
                    <Link href="/forgot-password" className="text-xs text-white/50 no-underline hover:text-white/80 transition-colors">
                      Elfelejtetted?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      aria-invalid={!!errors.password}
                      aria-describedby={errors.password ? 'login-m-pw-err' : undefined}
                      className={cn(authInputDark, 'pr-11', errors.password && 'ring-2 ring-red-400 border-red-400')}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p id="login-m-pw-err" role="alert" className={authErrorTextDark}>Minimum 6 karakter</p>}
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className={authPillBtnLight}
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Bejelentkezés <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </motion.form>
              {/* Google-bejelentkezés a form ALATT — VAGY elválasztó + széles social-pill. */}
              <motion.div variants={listStagger.item} className={`${authDividerDark} mt-6`}>
                <span className="h-px flex-1 bg-white/10" />vagy<span className="h-px flex-1 bg-white/10" />
              </motion.div>
              <motion.div variants={listStagger.item} className="mt-3">
                <GoogleSignInButton variant="dark" callbackUrl="/" label="Bejelentkezés Google-lel" />
              </motion.div>
            </motion.div>
            <p className="text-white/40 text-xs text-center" />
          </div>
        )}
      </div>
      )}

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      {isDesktop && (
      <div className="flex min-h-screen font-onest">
        {/* Left panel */}
        <div className="w-[45%] bg-ink-dark flex flex-col justify-between p-14 select-none">
          <Link href="/" aria-label="davelopment booking" className="w-fit hover:opacity-80 transition-opacity">
            <BrandLogo variant="dark" className="h-8" />
          </Link>
          <div>
            <h1 className="text-white font-light text-[3.5rem] uppercase leading-[1.05] tracking-[-0.02em]">
              KEZELD<br />OKOSAN <br />A SZALONOD.
            </h1>
            <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">
              Modern időpontfoglaló kis vállalkozásoknak. Egyszerű beállítás, azonnali eredmény.
            </p>
          </div>
          <p className="text-white/30 text-xs">{BRAND_COPYRIGHT}</p>
        </div>

        {/* Right form panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-16 bg-white [color-scheme:light]">
          <motion.div variants={listStagger.container} initial="hidden" animate="show" className="w-full max-w-sm">
            <motion.div variants={listStagger.item} className="mb-8">
              <h2 className="text-[26px] font-light tracking-[-0.01em] text-ink">Üdv újra!</h2>
              <p className="text-ink-soft text-sm mt-1">Jelentkezz be a fiókodba</p>
            </motion.div>
            <motion.form variants={listStagger.item} onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label className={authLabelBase}>Email</Label>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="te@pelda.hu"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-d-email-err' : undefined}
                  className={cn(authInputBase, errors.email && 'ring-2 ring-bad/40 border-bad/60')}
                  {...register('email')}
                />
                {errors.email && <p id="login-d-email-err" role="alert" className={authErrorText}>Érvényes email szükséges</p>}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className={authLabelBase}>Jelszó</Label>
                  <Link href="/forgot-password" className="text-xs text-ink-soft hover:text-ink no-underline transition-colors">
                    Elfelejtetted?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'login-d-pw-err' : undefined}
                    className={cn(authInputBase, 'pr-11', errors.password && 'ring-2 ring-bad/40 border-bad/60')}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p id="login-d-pw-err" role="alert" className={authErrorText}>Minimum 6 karakter</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className={cn(authPillBtn, 'mt-2')}
              >
                {loading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <>Bejelentkezés <ArrowRight className="h-4 w-4" /></>
                }
              </button>
            </motion.form>
            {/* Google-bejelentkezés a form ALATT — VAGY elválasztó + széles social-pill. */}
            <motion.div variants={listStagger.item} className={`${authDivider} mt-6`}>
              <span className="h-px flex-1 bg-line" />vagy<span className="h-px flex-1 bg-line" />
            </motion.div>
            <motion.div variants={listStagger.item} className="mt-3">
              <GoogleSignInButton variant="light" callbackUrl="/" label="Bejelentkezés Google-lel" />
            </motion.div>
            <motion.p variants={listStagger.item} className="mt-8 text-center text-sm text-ink-soft">
              Nincs még fiókod?{' '}
              <Link href="/register" className="font-semibold text-ink hover:underline no-underline">
                Regisztráció
              </Link>
            </motion.p>
          </motion.div>
        </div>
      </div>
      )}
    </>
  )
}
