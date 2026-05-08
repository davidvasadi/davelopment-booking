'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="text-center space-y-4 max-w-sm">
        {status === 'loading' && <p>Ellenőrzés...</p>}
        {status === 'success' && (
          <>
            <p className="text-xl font-medium">Email megerősítve!</p>
            <a href="/bookly/login" className="text-primary hover:underline block">Bejelentkezés</a>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-destructive">Érvénytelen vagy lejárt link.</p>
            <a href="/bookly/register" className="text-primary hover:underline block">Vissza a regisztrációhoz</a>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return <Suspense><VerifyContent /></Suspense>
}
