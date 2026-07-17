'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, X, Sparkles, Check,
  LayoutDashboard, CalendarDays, Armchair, Briefcase, Users, Clock, BarChart2, Lightbulb, Settings,
  type LucideIcon,
} from 'lucide-react'

/**
 * REGISZTRÁCIÓ UTÁNI BEVEZETŐ — teljes képernyős, immerzív végigvezetés (Crextio × Apple).
 * Nem coach-mark: az app elmosódik egy erős blur mögött, és képernyőnként EGY fogalmat mutat
 * be nagy tipográfiával, pötty-progresszel, slide + spring átmenetekkel. Bármikor kihagyható.
 *
 * Újrahívás: `window.dispatchEvent(new Event('schedulio:open-onboarding'))` (Súgó oldal gombja).
 */

type Variant = 'restaurant' | 'salon'

type Step = { icon: LucideIcon; title: string; body: string }

const WELCOME: Step = {
  icon: Sparkles,
  title: 'Üdv a rendszeredben',
  body: 'Pár képernyőn átvezetünk a legfontosabb részeken, hogy percek alatt otthon érezd magad. Bármikor kihagyhatod, és a Súgóból újraindíthatod.',
}

const DONE = (where: string): Step => ({
  icon: Check,
  title: 'Készen állsz',
  body: `Ennyi az egész! A részletekért bármikor nézd meg a Súgót, vagy indítsd újra ezt a bevezetőt. ${where}`,
})

const STEPS: Record<Variant, Step[]> = {
  restaurant: [
    WELCOME,
    { icon: LayoutDashboard, title: 'Áttekintés', body: 'A kezdőképernyőd: a mai foglalások, a kihasználtság és a legfontosabb számok egy pillantásra.' },
    { icon: CalendarDays, title: 'Foglalások', body: 'A nap vendégei lista- és idővonal-nézetben. Beeső és telefonos foglalást is rögzíthetsz, a napi listát ki is nyomtathatod.' },
    { icon: Armchair, title: 'Asztalok', body: 'Vedd fel az asztalaidat vagy egy egyszerű férőhely-számot — a rendszer ez alapján kezeli a kapacitást és az online foglalásokat.' },
    { icon: Clock, title: 'Nyitvatartás', body: 'Állítsd be, mikor fogadsz vendégeket. Az online foglalás csak a nyitvatartáson belül lehetséges.' },
    { icon: BarChart2, title: 'Statisztikák', body: 'Kövesd a kihasználtságot, a lemondásokat és a beesők arányát — és exportálj CSV-be bármikor.' },
    { icon: Lightbulb, title: 'Tippek', body: 'A foglalási adataidból személyre szabott javaslatokat kapsz több foglaláshoz és jobb vendégélményhez.' },
    DONE('Jó munkát! ✨'),
  ],
  salon: [
    WELCOME,
    { icon: LayoutDashboard, title: 'Áttekintés', body: 'A kezdőképernyőd: a mai időpontok, a bevétel és a legfontosabb számok egy pillantásra.' },
    { icon: CalendarDays, title: 'Időpontok', body: 'A foglalásaidat naptár- és listanézetben látod. Új időpontot kézzel is rögzíthetsz, az online foglalások automatikusan megjelennek.' },
    { icon: Briefcase, title: 'Szolgáltatások', body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online.' },
    { icon: Users, title: 'Munkatársak', body: 'Add hozzá a munkatársaidat, és rendeld hozzájuk a szolgáltatásokat, hogy foglaláskor választhatók legyenek.' },
    { icon: Clock, title: 'Nyitvatartás', body: 'A nyitvatartás és a munkatársak elérhetősége együtt határozza meg a foglalható időpontokat.' },
    { icon: BarChart2, title: 'Statisztikák', body: 'Kövesd a bevételt és a kihasználtságot, és exportálj CSV-be bármikor.' },
    { icon: Lightbulb, title: 'Tippek', body: 'A foglalási adataidból személyre szabott javaslatokat kapsz több foglaláshoz és jobb vendégélményhez.' },
    DONE('Sok sikert! ✨'),
  ],
}

// A kulcs user-specifikus, hogy ugyanabban a böngészőben egy ÚJ fiók is friss túrát kapjon.
function storageKey(variant: Variant, userId?: string) {
  return `schedulio_onboarding_seen_${variant}_${userId ?? 'anon'}`
}

const REOPEN_EVENT = 'schedulio:open-onboarding'

/** Slide + fade a képernyők közt (irány-érzékeny: +1 előre, -1 vissza). */
const SLIDE: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -48 : 48 }),
}

export function OnboardingTour({ variant, userId }: { variant: Variant; userId?: string }) {
  const steps = STEPS[variant]
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      if (!localStorage.getItem(storageKey(variant, userId))) setOpen(true)
    } catch {
      /* localStorage tiltva — nem indítjuk automatikusan */
    }
  }, [variant, userId])

  useEffect(() => {
    const handler = () => {
      setDir(0)
      setIndex(0)
      setOpen(true)
    }
    window.addEventListener(REOPEN_EVENT, handler)
    return () => window.removeEventListener(REOPEN_EVENT, handler)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(storageKey(variant, userId), '1')
    } catch {
      /* no-op */
    }
  }, [variant, userId])

  const go = useCallback(
    (d: number) => {
      setDir(d)
      setIndex((i) => Math.max(0, Math.min(i + d, steps.length - 1)))
    },
    [steps.length],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, go])

  if (!mounted || !open || typeof document === 'undefined') return null

  const isFirst = index === 0
  const isLast = index === steps.length - 1
  const step = steps[index]
  const Icon = step.icon

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[80] font-onest"
      role="dialog"
      aria-modal="true"
      aria-label="Bevezető"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* ── Blur-réteg: az app elmosódik mögötte, halvány krém-fátyollal. (Ez a lényeg.) ── */}
      <div
        className="absolute inset-0 bg-[rgba(244,241,233,0.45)] backdrop-blur-2xl backdrop-saturate-150"
        onClick={close}
      />

      {/* ── Bezárás ── */}
      <button
        onClick={close}
        aria-label="Bezárás"
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink-soft shadow-dav-card backdrop-blur transition-colors hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>

      {/* ── Tartalom (középre, immerzív) ── */}
      <div className="relative flex h-full flex-col items-center justify-center px-6">
        <div className="w-full max-w-[440px] text-center">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={index}
              custom={dir}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.9 }}
            >
              {/* Ikon — rugalmas pop */}
              <motion.span
                className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-ink-dark text-gold shadow-[0_18px_40px_-18px_rgba(40,35,15,.5)]"
                initial={{ scale: 0.72, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.05 }}
              >
                <Icon className="h-9 w-9" strokeWidth={1.6} />
              </motion.span>

              <div className="mt-7 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft2">
                {index + 1} / {steps.length}
              </div>
              <h1 className="mt-3 text-[30px] font-light leading-[1.1] tracking-[-0.02em] text-ink lg:text-[38px]">
                {step.title}
              </h1>
              <p className="mx-auto mt-4 max-w-[380px] text-[15px] leading-relaxed text-ink-soft">{step.body}</p>
            </motion.div>
          </AnimatePresence>

          {/* Pötty-progress — az aktív gold pirulává nyúlik (spring). */}
          <div className="mt-9 flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <motion.span
                key={i}
                className="h-1.5 rounded-full"
                animate={{
                  width: i === index ? 22 : 6,
                  backgroundColor: i === index ? '#F1CE45' : 'rgba(120,110,70,0.25)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            ))}
          </div>

          {/* Vezérlők */}
          <div className="mt-8 flex items-center justify-center gap-3">
            {!isFirst && (
              <button
                onClick={() => go(-1)}
                className="flex h-11 items-center gap-1.5 rounded-[18px] px-4 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-white/60 hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                Vissza
              </button>
            )}
            <button
              onClick={() => (isLast ? close() : go(1))}
              className="flex h-11 items-center gap-2 rounded-[18px] bg-ink-dark px-6 text-[13px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            >
              {isLast ? (
                <>
                  <Check className="h-4 w-4 text-gold" />
                  Kezdjük!
                </>
              ) : (
                <>
                  Tovább
                  <ArrowRight className="h-4 w-4 text-gold" />
                </>
              )}
            </button>
          </div>

          {!isLast && (
            <button
              onClick={close}
              className="mt-5 text-[12.5px] font-medium text-ink-soft2 transition-colors hover:text-ink"
            >
              Kihagyom
            </button>
          )}
        </div>
      </div>
    </motion.div>,
    document.body,
  )
}
