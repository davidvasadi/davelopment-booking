'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'
import { authPillBtn } from '@/components/auth/authStyles'

// FONTOS: a Shell a komponensen KÍVÜL van definiálva — lásd reset-password/page.tsx azonos
// megjegyzését (render-en belüli definíció újramountolná a fát minden rendernél).
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-5 py-10 font-onest [color-scheme:light]">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="davelopment booking" className="mx-auto mb-8 block w-fit hover:opacity-80 transition-opacity">
          <BrandLogo variant="light" className="h-8" />
        </Link>
        <div className="bg-white border border-line rounded-[24px] shadow-dav-card px-6 py-8 sm:px-8 sm:py-9">
          {children}
        </div>
      </div>
    </div>
  )
}

function CheckEmailInner() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  return (
    <Shell>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-gold/15 flex items-center justify-center">
          <Mail className="h-6 w-6 text-ink" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Ellenőrizd az emailed!</h1>
          <p className="text-ink-soft text-sm mt-1.5 leading-relaxed">
            Küldtünk egy megerősítő linket{email ? <> a <span className="font-medium text-ink">{email}</span> címre</> : ' az email-címedre'}.
            Kattints rá, hogy aktiváld a fiókod.
          </p>
        </div>
        <p className="text-ink-soft2 text-xs">Nem érkezett meg? Nézd meg a spam mappát is.</p>
        <Link href="/login" className={`${authPillBtn} mt-2`}>
          Bejelentkezés
        </Link>
      </div>
    </Shell>
  )
}

export default function CheckEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper" />}>
      <CheckEmailInner />
    </Suspense>
  )
}
