'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { UtensilsCrossed, Scissors, ChevronLeft, Loader2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { listStagger } from '@/lib/motion'
import { Label } from '@/components/ui/label'
import { BrandLogo } from '@/components/BrandLogo'
import { WizardImportStep } from '@/components/auth/WizardImportStep'
import {
  authInputBase, authInputDark,
  authLabelBase, authLabelDark,
  authPillBtn, authPillBtnLight,
  BRAND_COPYRIGHT,
} from '@/components/auth/authStyles'

type BizType = 'salon' | 'restaurant'

const TYPES: { v: BizType; label: string; sub: string; icon: React.ElementType }[] = [
  { v: 'salon', label: 'Szalon', sub: 'Időpontfoglalás', icon: Scissors },
  { v: 'restaurant', label: 'Étterem', sub: 'Asztalfoglalás', icon: UtensilsCrossed },
]

/**
 * Több-üzlet: új szalon/étterem hozzáadása bejelentkezett felhasználónak.
 * Jelszó/újraregisztráció NÉLKÜL — csak az üzlet adatai.
 */
export function NewBusinessForm({ alreadyPaying }: { alreadyPaying: boolean }) {
  const router = useRouter()
  const [type, setType] = useState<BizType>('salon')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<'form' | 'import'>('form')
  const [redirectTo, setRedirectTo] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      toast.error('Adj meg egy nevet (min. 2 karakter)')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/business/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type,
          name: name.trim(),
          city: city.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      })
      const data = (await res.json().catch(() => null)) as { redirectTo?: string; error?: string } | null
      if (!res.ok || !data?.redirectTo) throw new Error(data?.error || 'Nem sikerült létrehozni az üzletet')
      toast.success('Üzlet létrehozva!')
      setRedirectTo(data.redirectTo)
      setStep('import')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ismeretlen hiba')
      setSubmitting(false)
    }
  }

  const handleImportDone = () => {
    router.push(redirectTo)
    router.refresh()
  }

  const typeCards = (isDark: boolean) => (
    <div className="grid grid-cols-2 gap-3">
      {TYPES.map(({ v, label, sub, icon: Icon }) => {
        const isSelected = type === v
        return (
          <button
            key={v}
            type="button"
            onClick={() => setType(v)}
            className={cn(
              'relative flex flex-col items-start p-4 rounded-2xl border text-left transition-all duration-200',
              isDark
                ? isSelected
                  ? 'border-gold bg-white/[0.06] ring-2 ring-gold'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                : isSelected
                  ? 'border-gold bg-gold/[0.06] ring-2 ring-gold'
                  : 'border-line-strong bg-white hover:border-ink-soft2/50 hover:bg-paper',
            )}
          >
            {isSelected && (
              <div className="absolute top-2.5 right-2.5 h-5 w-5 rounded-full bg-gold flex items-center justify-center">
                <Check className="h-3 w-3 text-ink-dark" />
              </div>
            )}
            <div className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center mb-2.5',
              isDark ? (isSelected ? 'bg-gold' : 'bg-white/10') : (isSelected ? 'bg-gold' : 'bg-paper'),
            )}>
              <Icon
                className={cn(isDark ? (isSelected ? 'text-ink-dark' : 'text-white/70') : (isSelected ? 'text-ink-dark' : 'text-ink-soft'))}
                style={{ width: 18, height: 18 }}
              />
            </div>
            <p className={cn('font-semibold text-sm leading-tight', isDark ? (isSelected ? 'text-white' : 'text-white/80') : 'text-ink')}>{label}</p>
            <p className={cn('text-xs mt-0.5', isDark ? 'text-white/45' : 'text-ink-soft')}>{sub}</p>
          </button>
        )
      })}
    </div>
  )

  const subscriptionNote = (isDark: boolean) => (
    <p className={cn('text-xs leading-relaxed', isDark ? 'text-white/40' : 'text-ink-soft')}>
      {alreadyPaying
        ? 'Aktív előfizetésed van — az új üzlet díja azonnal hozzáadódik a havi számládhoz.'
        : 'Ez az üzlet a fiókod közös próbaidőszaka alá kerül — még nem kell fizetned.'}
    </p>
  )

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden min-h-dvh bg-ink-dark font-onest flex flex-col">
        <div
          className="flex flex-col flex-1 px-7 pb-10"
          style={{ paddingTop: 'calc(3rem + env(safe-area-inset-top))' }}
        >
          {step === 'form' && (
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-white/45 text-sm hover:text-white/80 transition-colors w-fit"
            >
              <ChevronLeft className="h-4 w-4" /> Vissza
            </button>
          )}

          <div className="mt-12">
            {step === 'import' ? (
              <>
                <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-2">
                  ADATOK<br />IMPORTÁ-<br />LÁSA.
                </h2>
                <p className="text-white/45 text-sm mb-8">Opcionális — töltsd be adataidat az új üzletbe.</p>
                <WizardImportStep isDark={true} onContinue={handleImportDone} />
              </>
            ) : (
              <>
                <h2 className="text-white font-light text-[2.5rem] uppercase leading-[1.0] tracking-[-0.02em] mb-8">
                  ÚJ ÜZLET<br />HOZZÁ-<br />ADÁSA.
                </h2>
                <motion.form
                  variants={listStagger.container}
                  initial="hidden"
                  animate="show"
                  onSubmit={submit}
                  className="space-y-4"
                  noValidate
                >
                  <motion.div variants={listStagger.item}>
                    {typeCards(true)}
                  </motion.div>

                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelDark}>{type === 'salon' ? 'Szalon neve' : 'Étterem neve'}</Label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={type === 'salon' ? 'pl. Anna Fodrászat' : 'pl. Kis Bistro'}
                      autoComplete="organization"
                      className={authInputDark}
                      autoFocus
                    />
                  </motion.div>

                  <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={authLabelDark}>Város</Label>
                      <input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Budapest"
                        autoComplete="address-level2"
                        className={authInputDark}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={authLabelDark}>Telefon</Label>
                      <input
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/[^\d+\s\-()+]/g, ''))}
                        placeholder="+36 30..."
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        className={authInputDark}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={listStagger.item} className="pt-1 space-y-3">
                    {subscriptionNote(true)}
                    <button type="submit" disabled={submitting} className={authPillBtnLight}>
                      {submitting
                        ? <Loader2 className="h-5 w-5 animate-spin" />
                        : 'Üzlet létrehozása'}
                    </button>
                  </motion.div>
                </motion.form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex min-h-dvh font-onest">
        {/* Left panel */}
        <div className="w-[45%] bg-ink-dark flex flex-col justify-between p-14 select-none">
          <BrandLogo variant="dark" className="h-8" />
          <div>
            {step === 'import' ? (
              <>
                <h1 className="text-white font-light text-[3.25rem] uppercase leading-[1.05] tracking-[-0.02em]">
                  ADATOK<br />IMPORTÁ-<br />LÁSA.
                </h1>
                <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">
                  Opcionális lépés — importálj meglévő adatokat az újonnan létrehozott üzletbe.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-white font-light text-[3.25rem] uppercase leading-[1.05] tracking-[-0.02em]">
                  ÚJ ÜZLET<br />HOZZÁ-<br />ADÁSA.
                </h1>
                <p className="text-white/45 mt-5 text-sm leading-relaxed max-w-xs">
                  Adj hozzá egy szalont vagy éttermet a meglévő fiókodhoz — nem kell újra bejelentkezned.
                </p>
              </>
            )}
          </div>
          <p className="text-white/30 text-xs">{BRAND_COPYRIGHT}</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex items-center justify-center px-6 py-12 bg-white [color-scheme:light] overflow-y-auto">
          <div className="w-full max-w-sm">
            {step === 'import' ? (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Adatok importálása</h2>
                  <p className="text-ink-soft text-sm mt-1">Töltsd fel a meglévő adataidat — kihagyható.</p>
                </div>
                <WizardImportStep isDark={false} onContinue={handleImportDone} />
              </>
            ) : (
              <>
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-1.5 text-ink-soft text-xs mb-8 hover:text-ink transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" /> Vissza
                </button>

                <div className="mb-8">
                  <h2 className="text-2xl font-light tracking-[-0.01em] text-ink">Új üzlet hozzáadása</h2>
                  <p className="text-ink-soft text-sm mt-1">A meglévő fiókodhoz — jelszó nélkül.</p>
                </div>

                <motion.form
                  variants={listStagger.container}
                  initial="hidden"
                  animate="show"
                  onSubmit={submit}
                  className="space-y-5"
                  noValidate
                >
                  <motion.div variants={listStagger.item}>
                    {typeCards(false)}
                  </motion.div>

                  <motion.div variants={listStagger.item} className="space-y-1.5">
                    <Label className={authLabelBase}>{type === 'salon' ? 'Szalon neve' : 'Étterem neve'}</Label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={type === 'salon' ? 'pl. Anna Fodrászat' : 'pl. Kis Bistro'}
                      autoComplete="organization"
                      className={authInputBase}
                      autoFocus
                    />
                  </motion.div>

                  <motion.div variants={listStagger.item} className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Város</Label>
                      <input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="Budapest"
                        autoComplete="address-level2"
                        className={authInputBase}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={authLabelBase}>Telefon</Label>
                      <input
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/[^\d+\s\-()+]/g, ''))}
                        placeholder="+36 30..."
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        className={authInputBase}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={listStagger.item} className="space-y-3">
                    {subscriptionNote(false)}
                    <button type="submit" disabled={submitting} className={authPillBtn}>
                      {submitting
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : 'Üzlet létrehozása'}
                    </button>
                  </motion.div>
                </motion.form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
