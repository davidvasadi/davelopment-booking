'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      toast.error('Hiba történt. Próbáld újra.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── MOBILE ─────────────────────────────────────────────────── */}
      <div className="lg:hidden min-h-screen bg-zinc-950 flex flex-col">
        <div className="flex flex-col flex-1 px-7 pt-12 pb-10">
          <span className="text-white font-black text-xl tracking-tight">Bookly</span>

          {sent ? (
            <div className="flex flex-col justify-between flex-1 mt-12">
              <div>
                <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-4">
                  EMAIL<br />ELKÜLDVE.
                </h2>
                <p className="text-zinc-500 text-sm">
                  Ha ez az email regisztrált nálunk, hamarosan megérkezik a link.
                </p>
              </div>
              <Link href="/bookly/login">
                <button className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base">
                  Vissza a bejelentkezéshez
                </button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col justify-between flex-1 mt-12">
              <div>
                <h2 className="text-white font-black text-[2.5rem] uppercase leading-[1.0] tracking-tighter mb-8">
                  ELFELED<br />TED A<br />JELSZÓD?
                </h2>
                <form onSubmit={onSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-zinc-400 text-sm">Email</Label>
                    <input
                      type="email"
                      placeholder="te@pelda.hu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full h-12 rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 px-4 text-sm focus:outline-none focus:border-zinc-500"
                      required
                    />
                  </div>
                  <div className="pt-2 space-y-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 rounded-full bg-white text-zinc-950 font-bold text-base flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Link küldése <ArrowRight className="h-4 w-4" /></>}
                    </button>
                    <Link href="/bookly/login">
                      <button type="button" className="w-full h-14 rounded-full border border-zinc-700 text-zinc-300 font-medium text-base">
                        ← Vissza
                      </button>
                    </Link>
                  </div>
                </form>
              </div>
              <p className="text-zinc-700 text-xs text-center" />
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen">
        <div className="w-[45%] bg-zinc-950 flex flex-col justify-between p-14 select-none">
          <span className="text-white font-black text-xl tracking-tight">Bookly</span>
          <div>
            <h1 className="text-white font-black text-[3.25rem] uppercase leading-[1.05] tracking-tighter">
              ELFELED<br />TED A<br />JELSZÓD?
            </h1>
            <p className="text-zinc-500 mt-5 text-sm leading-relaxed max-w-xs">
              Nem baj. Küldünk egy visszaállítási linket az email-edre.
            </p>
          </div>
          <p className="text-zinc-700 text-xs">© 2026 Bookly</p>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white">
          <div className="w-full max-w-sm">
            <Link
              href="/bookly/login"
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 mb-10 no-underline transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Vissza
            </Link>

            {sent ? (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">Email elküldve</h2>
                <p className="text-zinc-500 text-sm">
                  Ha ez az email regisztrált nálunk, hamarosan megérkezik a link.
                </p>
                <Link href="/bookly/login">
                  <Button className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold">
                    Vissza a bejelentkezéshez
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight">Jelszó visszaállítás</h2>
                  <p className="text-zinc-500 text-sm mt-1">Add meg az email-ed és küldünk egy linket</p>
                </div>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-zinc-700">Email</Label>
                    <Input
                      type="email"
                      placeholder="te@pelda.hu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="h-11 rounded-xl bg-zinc-50 border-zinc-200"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-semibold"
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <span className="flex items-center gap-2">Link küldése <ArrowRight className="h-4 w-4" /></span>
                    }
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
