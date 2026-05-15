'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function ResetPasswordPage() {
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
      setTimeout(() => router.push('/bookly/login'), 2500)
    } catch {
      toast.error('Érvénytelen vagy lejárt link. Kérj új visszaállítót.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <h1 className="text-2xl font-black text-white tracking-tight">Érvénytelen link</h1>
          <p className="text-zinc-500 text-sm">Kérj új jelszó-visszaállítót az elfelejtett jelszó oldalon.</p>
          <Link href="/bookly/forgot-password" className="block w-full h-12 rounded-full bg-white text-zinc-950 font-semibold text-sm flex items-center justify-center">
            Új link kérése
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col px-7 pt-12 pb-10">
        <Link href="/" className="text-white font-black text-xl tracking-tight hover:opacity-70 transition-opacity">Bookly</Link>
        {done ? (
          <div className="flex flex-col justify-center flex-1 space-y-4">
            <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter">JELSZÓ<br />BEÁLLÍTVA.</h2>
            <p className="text-zinc-500 text-sm">Átirányítunk a bejelentkezéshez...</p>
          </div>
        ) : (
          <div className="flex flex-col justify-between flex-1 mt-12">
            <div>
              <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">ÚJ<br />JELSZÓ.</h2>
              <form onSubmit={onSubmit} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Új jelszó</Label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white px-4 pr-11 text-sm focus:outline-none focus:border-zinc-500"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-zinc-400 text-sm">Jelszó megerősítése</Label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white px-4 text-sm focus:outline-none focus:border-zinc-500"
                    required
                  />
                </div>
                <div className="pt-2">
                  <button type="submit" disabled={loading}
                    className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Mentés <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">
        <div className="w-[45%] bg-zinc-950 flex flex-col justify-between p-14 select-none">
          <Link href="/" className="text-white font-black text-xl tracking-tight hover:opacity-70 transition-opacity">Bookly</Link>
          <div>
            <h1 className="text-white font-black text-[3.25rem] uppercase leading-[1.05] tracking-tighter">
              ÚJ<br />JELSZÓ<br />BEÁLLÍTÁSA.
            </h1>
            <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">
              Adj meg egy erős jelszót a fiókod védelméhez.
            </p>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 Bookly</p>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-sm">
            {done ? (
              <div className="space-y-4 text-center">
                <div className="h-14 w-14 rounded-full bg-[#00bb88]/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl text-[#00bb88]">✓</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Jelszó beállítva!</h2>
                <p className="text-zinc-500 text-sm">Átirányítunk a bejelentkezéshez...</p>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Új jelszó</h2>
                  <p className="text-zinc-500 text-sm mt-1">Minimum 6 karakter</p>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Új jelszó</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="h-11 rounded-xl bg-zinc-50 border-zinc-200 pr-11"
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Jelszó megerősítése</Label>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      className="h-11 rounded-xl bg-zinc-50 border-zinc-200"
                      required
                    />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Jelszó mentése</span><ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
