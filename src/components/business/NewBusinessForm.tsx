'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { AuthMobile, AuthScreen } from '@/components/blocks/auth'
import { ImportStep, NEW_BUSINESS_STEPS, NewBusinessStep, ReadyCard, type NewBusinessValues } from '@/components/blocks/onboarding'
import { AuthVideoBg } from '@/components/auth/AuthVideoBg'
import { WizardImportStep } from '@/components/auth/WizardImportStep'
import { useAvailabilityCheck } from '@/components/auth/useAvailabilityCheck'
import { slugify } from '@/lib/slug'

const APP_HOST = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://booking.davelopment.hu').replace(/^https?:\/\//, '').replace(/\/$/, '')

const TITLES = [
  { title: <>Még egy<br />üzlet,<br />egy fiók.</>, sub: 'Ugyanazzal a belépéssel kezeled — külön foglalóoldallal, külön csapattal, a fiókmenüből váltasz.' },
  { title: <>Hozd át<br />az adataid.</>, sub: 'Ha más rendszerből jössz — kihagyható, később is megcsinálhatod.' },
  { title: <>Kész az<br />új üzlet.</>, sub: 'Oszd meg a foglalóoldalát, és jöhetnek a vendégek.' },
]

/**
 * Új szalon / étterem a MÁR BEJELENTKEZETT fiókhoz (design 23.7) — a regisztráció keretében és darabjaiból, belépés és
 * jelszó nélkül, 3 lépésben: 1 üzlet (típus, név a foglalóoldal címével, város, telefon, mi lesz az előfizetéssel) →
 * 2 import (kihagyható) → 3 kész (link, irány az új üzlet). Mobilon a sötét videón, üvegből — mint a regisztráció.
 */
export function NewBusinessForm({ alreadyPaying }: { alreadyPaying: boolean }) {
  const router = useRouter()
  const [kind, setKind] = useState<'salon' | 'restaurant'>('salon')
  const [v, setV] = useState<NewBusinessValues>({ name: '', city: '', phone: '' })
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ redirectTo: string; slug: string } | null>(null)
  const [mounted, setMounted] = useState(false)
  const [desktop, setDesktop] = useState(false)

  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(min-width: 1024px)')
    const up = () => setDesktop(mq.matches)
    up(); mq.addEventListener('change', up)
    return () => mq.removeEventListener('change', up)
  }, [])

  const nameStatus = useAvailabilityCheck('business-name', v.name, v.name.trim().length >= 2)

  async function submit() {
    if (v.name.trim().length < 2) { setError('Adj meg egy nevet (legalább 2 karakter)'); return }
    if (nameStatus === 'taken') { setError('Ez a név már foglalt — válassz másikat'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/business/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: kind, name: v.name.trim(), city: v.city.trim() || undefined, phone: v.phone.trim() || undefined }),
      })
      const data = (await res.json().catch(() => null)) as { redirectTo?: string; slug?: string; error?: string } | null
      if (!res.ok || !data?.redirectTo) throw new Error(data?.error || 'Nem sikerült létrehozni az üzletet')
      toast.success('Üzlet létrehozva')
      setDone({ redirectTo: data.redirectTo, slug: data.slug ?? slugify(v.name) })
      setStep(1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ismeretlen hiba')
    } finally {
      setBusy(false)
    }
  }

  const copy = () => { if (done) void navigator.clipboard?.writeText(`https://${APP_HOST}/${done.slug}`).then(() => toast.success('Link másolva')) }

  if (!mounted) return <div className="min-h-dvh bg-ui-dark" />

  const body = step === 0 ? (
    <NewBusinessStep kind={kind} onKind={(k) => { setKind(k); setError(null) }} values={v} onChange={(p) => { setV((x) => ({ ...x, ...p })); setError(null) }}
      slugUrl={`${APP_HOST}/${slugify(v.name) || '…'}`} slugStatus={nameStatus} paying={alreadyPaying} error={error} busy={busy} onSubmit={() => void submit()} backHref={desktop ? '/dashboard' : undefined} dark={!desktop} />
  ) : step === 1 ? (
    <ImportStep labels={NEW_BUSINESS_STEPS} dark={!desktop}><WizardImportStep isDark={!desktop} onContinue={() => setStep(2)} /></ImportStep>
  ) : (
    <ReadyCard kind={kind} labels={NEW_BUSINESS_STEPS} url={`${APP_HOST}/${done?.slug ?? ''}`} onCopy={copy} href={done?.redirectTo} />
  )
  const t = TITLES[step]

  return desktop
    ? <AuthScreen full media={<AuthVideoBg />} logoHref="/dashboard" title={t.title} sub={t.sub} info={[]}>{body}</AuthScreen>
    : (
      <AuthMobile full media={<AuthVideoBg fullScreen />} logoHref="/dashboard" onBack={step === 0 ? () => router.back() : undefined}>
        {body}
      </AuthMobile>
    )
}
