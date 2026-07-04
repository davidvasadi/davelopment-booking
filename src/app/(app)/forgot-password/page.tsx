'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2, MailCheck } from 'lucide-react'
import { SchedulioLogo } from '@/components/SchedulioLogo'

const inputBase =
  'w-full h-[50px] rounded-[14px] bg-paper border border-line text-ink placeholder:text-ink-soft2/70 px-4 text-sm outline-none transition-colors focus:ring-2 focus:ring-gold/40 focus:border-gold/50'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const check = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await check.json()
      if (check.status === 429) {
        toast.error(data.error ?? 'Túl sok kísérlet. Próbáld újra 1 perc múlva.')
        return
      }
      if (!data.exists) {
        toast.error('Ezzel az email címmel nincs regisztrált fiók.')
        return
      }
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
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-10 font-onest [color-scheme:light]">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="Schedulio" className="mx-auto mb-8 block w-fit hover:opacity-80 transition-opacity">
          <SchedulioLogo variant="light" className="h-8" />
        </Link>

        <div className="bg-white border border-line rounded-[24px] shadow-dav-card px-6 py-8 sm:px-8 sm:py-9">
          {sent ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-gold/15 flex items-center justify-center">
                <MailCheck className="h-7 w-7 text-ink" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Email elküldve</h1>
              <p className="text-ink-soft text-sm leading-relaxed">
                Ha ez az email regisztrált nálunk, hamarosan megérkezik a link.
              </p>
              <Link
                href="/login"
                className="mt-2 w-full h-12 rounded-dav-pill bg-ink-dark hover:opacity-90 text-white font-semibold text-sm transition-opacity flex items-center justify-center"
              >
                Vissza a bejelentkezéshez
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-bold tracking-tight text-ink">Elfelejtett jelszó</h1>
                <p className="text-ink-soft text-sm mt-1.5 leading-relaxed">
                  Add meg az email-ed és küldünk egy visszaállítási linket.
                </p>
              </div>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[12.5px] font-medium text-ink-soft">Email</Label>
                  <input
                    type="email"
                    placeholder="te@pelda.hu"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
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
                    <>Link küldése <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {!sent && (
          <Link
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center gap-1.5 text-sm text-ink-soft hover:text-ink no-underline transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Vissza a bejelentkezéshez
          </Link>
        )}
      </div>
    </div>
  )
}
