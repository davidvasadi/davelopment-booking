'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Loader2, AlertCircle, Users } from 'lucide-react'

type Phase = 'loading' | 'ready' | 'submitting' | 'done' | 'already' | 'invalid' | 'error' | 'needsAuth' | 'mismatch'

const ROLE_LABEL: Record<string, string> = { owner: 'Tulajdonos', manager: 'Vezető', staff: 'Dolgozó' }

export default function TeamAcceptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('loading')
  const [info, setInfo] = useState<{ email?: string; role?: string; businessName?: string; type?: 'salon' | 'restaurant' }>({})
  const [errorMsg, setErrorMsg] = useState('')
  // Inline regisztráció a needsAuth állapotban (ha a meghívottnak még nincs fiókja).
  const [regName, setRegName] = useState('')
  const [regExists, setRegExists] = useState(false)
  const [regBusy, setRegBusy] = useState(false)
  const [regError, setRegError] = useState('')
  const [logoutBusy, setLogoutBusy] = useState(false)

  const homeFor = (t?: 'salon' | 'restaurant') => (t === 'restaurant' ? '/restaurant' : '/dashboard')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/team/accept/${token}`)
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok || data.found === false) return setPhase('invalid')
        if (data.already) return setPhase('already')
        setInfo({ email: data.email, role: data.role, businessName: data.businessName, type: data.type })
        setPhase('ready')
      } catch {
        if (alive) setPhase('error')
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  const accept = async () => {
    setPhase('submitting')
    try {
      const res = await fetch(`/api/team/accept/${token}`, { method: 'POST', credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || data.needsAuth) return setPhase('needsAuth')
      if (res.status === 403 || data.emailMismatch) {
        setErrorMsg(data.error ?? '')
        return setPhase('mismatch')
      }
      if (res.status === 409 || data.already) return setPhase('already')
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Hiba történt')
        return setPhase('ready')
      }
      setPhase('done')
      setTimeout(() => router.push(homeFor(info.type)), 1200)
    } catch {
      setPhase('ready')
    }
  }

  // Más fiókkal vagy bejelentkezve: kijelentkezés → újrapróba. Így a meghívott emailhez
  // regisztráció (needsAuth) vagy bejelentkezés következik — nem ragad be a „nem jó fiók".
  const logoutAndContinue = async () => {
    setLogoutBusy(true)
    try {
      await fetch('/api/auth/signout-payload', { method: 'POST', credentials: 'include' }).catch(() => {})
      await accept()
    } finally {
      setLogoutBusy(false)
    }
  }

  // Meghívott, akinek még nincs fiókja: fiók létrehozása jelszó nélkül (a meghívó-link igazolja az e-mailt), a route
  // be is léptet → meghívó elfogadása. Ha az e-mailhez már van fiók: kódos belépés, onnan vissza ide.
  const loginHref = `/login?email=${encodeURIComponent(info.email ?? '')}&from=${encodeURIComponent(`/team/accept/${token}`)}`
  const register = async () => {
    if (!info.email) { setRegError('Hiányzó email.'); return }
    setRegBusy(true); setRegError('')
    try {
      const cRes = await fetch('/api/team/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ token, name: regName.trim() || info.email }),
      })
      if (cRes.status === 409) { setRegExists(true); return }
      if (!cRes.ok) {
        const j = await cRes.json().catch(() => ({}))
        throw new Error(j?.error || 'A fiók létrehozása sikertelen.')
      }
      const aRes = await fetch(`/api/team/accept/${token}`, { method: 'POST', credentials: 'include' })
      if (!aRes.ok) {
        const j = await aRes.json().catch(() => ({}))
        throw new Error(j?.error || 'A meghívó elfogadása sikertelen.')
      }
      setPhase('done')
      setTimeout(() => router.push(homeFor(info.type)), 1000)
    } catch (e) {
      setRegError(e instanceof Error ? e.message : 'Hiba történt')
    } finally {
      setRegBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md w-full">
        {phase === 'loading' && <Loader2 className="h-8 w-8 animate-spin text-zinc-300 dark:text-white/30 mx-auto" />}

        {phase === 'ready' && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-zinc-900/5 dark:bg-white/10 items-center justify-center mb-6">
              <Users className="h-8 w-8 text-zinc-900 dark:text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Csapat-meghívó</h1>
            <p className="text-zinc-500 dark:text-white/50 mb-2">
              Meghívtak a(z) <b className="text-zinc-900 dark:text-white">{info.businessName || 'üzlet'}</b> csapatába
              {info.role ? <> <b className="text-zinc-900 dark:text-white">{ROLE_LABEL[info.role] ?? info.role}</b> szerepkörben</> : null}.
            </p>
            {info.email && <p className="text-xs text-zinc-400 mb-8">Meghívott email: {info.email}</p>}
            {errorMsg && <p className="text-sm text-red-500 mb-4">{errorMsg}</p>}
            <button
              onClick={accept}
              className="inline-flex h-12 px-8 rounded-full bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 font-semibold text-sm transition items-center gap-2"
            >
              Meghívó elfogadása
            </button>
          </>
        )}

        {phase === 'submitting' && <Loader2 className="h-8 w-8 animate-spin text-zinc-300 dark:text-white/30 mx-auto" />}

        {(phase === 'done' || phase === 'already') && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-[#00bb88]/10 items-center justify-center mb-6">
              <Check className="h-8 w-8 text-[#00bb88]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">
              {phase === 'done' ? 'Csatlakoztál a csapathoz' : 'A meghívót már elfogadták'}
            </h1>
            <p className="text-zinc-500 dark:text-white/50">Most már a csapat tagja vagy.</p>
          </>
        )}

        {phase === 'needsAuth' && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-zinc-900/5 dark:bg-white/10 items-center justify-center mb-6">
              <Users className="h-8 w-8 text-zinc-900 dark:text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Hozd létre a fiókod</h1>
            <p className="text-zinc-500 dark:text-white/50 mb-6">
              Csatlakozz a(z) <b className="text-zinc-900 dark:text-white">{info.businessName || 'üzlet'}</b> csapatához. Jelszó nem kell — később minden belépésnél egy kódot küldünk erre a címre.
            </p>
            <div className="space-y-3 text-left">
              <input
                type="email"
                value={info.email ?? ''}
                readOnly
                className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-white/5 px-4 text-[16px] lg:text-sm text-zinc-500 dark:text-white/50"
              />
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Teljes neved"
                autoComplete="name"
                className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 text-[16px] lg:text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-400"
              />
            </div>
            {regError && <p className="mt-3 text-sm text-red-500">{regError}</p>}
            {regExists && (
              <p className="mt-3 text-sm text-zinc-500 dark:text-white/50">
                Ehhez az e-mailhez már van fiókod —{' '}
                <Link href={loginHref} className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">lépj be kóddal</Link>, és utána elfogadhatod a meghívót.
              </p>
            )}
            <button
              onClick={register}
              disabled={regBusy}
              className="mt-5 inline-flex h-12 w-full px-8 rounded-full bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 font-semibold text-sm transition items-center justify-center gap-2 disabled:opacity-60"
            >
              {regBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fiók létrehozása és csatlakozás'}
            </button>
            <p className="mt-4 text-sm text-zinc-400">
              Van már fiókod?{' '}
              <Link href={loginHref} className="font-semibold text-zinc-700 dark:text-white/80 hover:underline">
                Bejelentkezés
              </Link>
            </p>
          </>
        )}

        {phase === 'mismatch' && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-red-500/10 items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Másik fiókkal vagy bejelentkezve</h1>
            <p className="text-zinc-500 dark:text-white/50 mb-6">
              A meghívó a(z) <b className="text-zinc-900 dark:text-white">{info.email}</b> címre szól. Jelentkezz ki a mostani fiókodból, és folytasd ezzel az emaillel.
            </p>
            <button
              onClick={logoutAndContinue}
              disabled={logoutBusy}
              className="inline-flex h-12 w-full px-8 rounded-full bg-zinc-900 dark:bg-white hover:opacity-90 text-white dark:text-zinc-900 font-semibold text-sm transition items-center justify-center gap-2 disabled:opacity-60"
            >
              {logoutBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kijelentkezés és folytatás'}
            </button>
            <p className="mt-4 text-sm text-zinc-400">
              Van már fiókod ezzel az emaillel?{' '}
              <Link href={loginHref} className="font-semibold text-zinc-700 dark:text-white/80 hover:underline">
                Bejelentkezés
              </Link>
            </p>
          </>
        )}

        {(phase === 'invalid' || phase === 'error') && (
          <>
            <div className="inline-flex h-16 w-16 rounded-full bg-red-500/10 items-center justify-center mb-6">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-2">Érvénytelen meghívó</h1>
            <p className="text-zinc-500 dark:text-white/50">A meghívó nem található vagy már felhasználták.</p>
          </>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-white/70 transition-colors">
            Vissza a főoldalra
          </Link>
        </div>
      </div>
    </main>
  )
}
