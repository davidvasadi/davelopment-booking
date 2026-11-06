'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { BrandLogo } from '@/components/BrandLogo'
import { authPillBtn } from '@/components/auth/authStyles'

// FONTOS: a Shell a komponensen KÍVÜL van definiálva — lásd reset-password/page.tsx azonos
// megjegyzését (render-en belüli definíció újramountolná a fát minden rendernél).
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ui-cell flex flex-col items-center justify-center px-5 py-10 font-onest [color-scheme:light]">
      <div className="w-full max-w-md">
        <Link href="/" aria-label="davelopment booking" className="mx-auto mb-8 block w-fit hover:opacity-80 transition-opacity">
          <BrandLogo variant="light" className="h-8" />
        </Link>
        <div className="bg-white border border-ui-divider rounded-[24px] px-6 py-8 sm:px-8 sm:py-9">
          {children}
        </div>
      </div>
    </div>
  )
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    fetch('/api/users/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(r => setStatus(r.ok ? 'success' : 'error')).catch(() => setStatus('error'))
  }, [token])

  return (
    <Shell>
      <div className="flex flex-col items-center text-center space-y-4">
        {status === 'loading' && (
          <>
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-ui-text animate-spin" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-ui-text">Ellenőrzés...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center">
              <Check className="h-7 w-7 text-ui-text" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ui-text">Email megerősítve!</h1>
              <p className="text-ui-muted text-sm mt-1.5">A fiókod aktív — jelentkezz be a folytatáshoz.</p>
            </div>
            <Link href="/login" className={`${authPillBtn} mt-2`}>Bejelentkezés</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center">
              <X className="h-7 w-7 text-ui-bad" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ui-text">Érvénytelen vagy lejárt link</h1>
              <p className="text-ui-muted text-sm mt-1.5">Regisztrálj újra, vagy jelentkezz be, ha már megerősítetted korábban.</p>
            </div>
            <Link href="/register" className={`${authPillBtn} mt-2`}>Vissza a regisztrációhoz</Link>
          </>
        )}
      </div>
    </Shell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-ui-cell" />}>
      <VerifyContent />
    </Suspense>
  )
}
