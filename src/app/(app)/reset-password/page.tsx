'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { ArrowRight, Loader2, Eye, EyeOff, Check } from 'lucide-react'
import Link from 'next/link'
import { SchedulioLogo } from '@/components/SchedulioLogo'

const inputBase =
  'w-full h-[50px] rounded-[14px] bg-paper border border-line text-ink placeholder:text-ink-soft2/70 px-4 text-sm outline-none transition-colors focus:ring-2 focus:ring-gold/40 focus:border-gold/50'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <ResetPasswordInner />
    </Suspense>
  )
}

function ResetPasswordInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { toast.error('Minimum 6 karakter'); return }
    if (password !== confirm) { toast.error('A két jelszó nem egyezik'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) throw new Error()
      setDone(true)
      setTimeout(() => router.push('/login'), 2500)
    } catch {
      toast.error('Érvénytelen vagy lejárt link. Kérj új visszaállítót.')
    } finally {
      setLoading(false)
    }
  }

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-10 font-onest [color-scheme:light]">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="Schedulio" className="mx-auto mb-8 block w-fit hover:opacity-80 transition-opacity">
          <SchedulioLogo variant="light" className="h-8" />
        </Link>
        <div className="bg-white border border-line rounded-[24px] shadow-dav-card px-6 py-8 sm:px-8 sm:py-9">
          {children}
        </div>
      </div>
    </div>
  )

  if (!token) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight text-ink">Érvénytelen link</h1>
          <p className="text-ink-soft text-sm leading-relaxed">
            Kérj új jelszó-visszaállítót az elfelejtett jelszó oldalon.
          </p>
          <Link
            href="/forgot-password"
            className="mt-2 w-full h-12 rounded-dav-pill bg-ink-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity flex items-center justify-center"
          >
            Új link kérése
          </Link>
        </div>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-gold/15 flex items-center justify-center">
            <Check className="h-7 w-7 text-ink" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Jelszó beállítva</h1>
          <p className="text-ink-soft text-sm">Átirányítunk a bejelentkezéshez...</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Új jelszó</h1>
        <p className="text-ink-soft text-sm mt-1.5">Adj meg egy erős jelszót (minimum 6 karakter).</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-[12.5px] font-medium text-ink-soft">Új jelszó</Label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`${inputBase} pr-11`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft2 hover:text-ink transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12.5px] font-medium text-ink-soft">Jelszó megerősítése</Label>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className={inputBase}
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-dav-pill bg-ink-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>Jelszó mentése <ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>
    </Shell>
  )
}
