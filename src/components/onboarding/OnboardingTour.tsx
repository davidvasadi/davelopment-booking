'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, X, Sparkles, Check,
  LayoutDashboard, CalendarDays, CalendarRange, Armchair, Briefcase, Users, Clock, BarChart2, Lightbulb, Settings, Smartphone,
  type LucideIcon,
} from 'lucide-react'
import { TourPreview, type PreviewKey } from './TourPreview'

/**
 * REGISZTRÁCIÓ UTÁNI BEVEZETŐ — teljes képernyős, immerzív végigvezetés.
 * Minden lépésnél Apple-stílusú CSS-animációs előnézet mutatja be a funkciót.
 * Progressz mentve localStorage-ba (folytatja ahol abbahagyta); Súgóból újraindul 0-ról.
 * Bármikor kihagyható.
 *
 * Újrahívás: `window.dispatchEvent(new Event('davelopment:open-onboarding'))`
 */

type Variant = 'restaurant' | 'salon'

type Step = {
  icon: LucideIcon
  title: string
  body: string
  previewKey: PreviewKey
  href?: string
}

const WELCOME: Step = {
  icon: Sparkles,
  title: 'Üdv a rendszeredben',
  body: 'Ez nem csak egy naptár — ez az eszköz, amivel több foglalást, kevesebb lemondást és visszatérő vendégeket építesz. Pár képernyőn átvezetünk, hogy percek alatt kihozd belőle a legtöbbet. Bármikor kihagyhatod, és a Súgóból újraindíthatod.',
  previewKey: 'welcome',
}

const DONE = (where: string): Step => ({
  icon: Check,
  title: 'Készen állsz',
  body: `Már készen állsz. 3 dolog, amivel azonnal többet hozol ki belőle: kapcsold be az emlékeztetőket (kevesebb lemondás), tölts fel borítóképet (jobb első benyomás), és kérj értékelést a vendégeidtől (jobb Google-találhatóság) — mindezt a Tippek oldalon egy kattintással. ${where}`,
  previewKey: 'done',
})

const STEPS: Record<Variant, Step[]> = {
  restaurant: [
    WELCOME,
    { icon: LayoutDashboard, title: 'Áttekintés', body: 'A kezdőképernyőd: a mai foglalások, a kihasználtság és a legfontosabb számok egy pillantásra — azonnal látod, hol van még szabad kapacitásod.', previewKey: 'overview', href: '/restaurant' },
    { icon: CalendarDays, title: 'Foglalások', body: 'A nap vendégei három nézetben: lista, idősáv, és egy élő teremtérkép, amin egyetlen pillantással látod, melyik asztal foglalt és melyik szabad — gyorsabb döntés, kevesebb torlódás csúcsidőben. Beeső és telefonos foglalást is rögzíthetsz, a napi listát pedig kinyomtathatod a felszolgálóknak.', previewKey: 'bookings', href: '/restaurant/bookings' },
    { icon: CalendarRange, title: 'Naptár', body: 'Havi nézetben tartod kézben a csapat beosztását — ki mikor dolgozik, ki van szabadságon, és egy napra kattintva a napi borravalót is rögzítheted. Jól időzített beosztással sosem maradsz kevés kézzel egy zsúfolt napon.', previewKey: 'schedule', href: '/restaurant/schedule' },
    { icon: Armchair, title: 'Asztalok', body: 'Vedd fel az asztalaidat vagy egy egyszerű férőhely-számot — a rendszer ez alapján kezeli a kapacitást és az online foglalásokat, hogy se üres szék, se túlfoglalás ne forduljon elő.', previewKey: 'tables', href: '/restaurant/tables' },
    { icon: Users, title: 'Munkatársak', body: 'Minél többen dolgoznak nálad, annál több foglalást tudsz egyszerre elfogadni — a csapat bővítése közvetlen bevétel-kapacitás. Add hozzá az alkalmazottaidat, oszd be a munkaidejüket, és kövesd a borravaló-elosztást.', previewKey: 'staff', href: '/restaurant/staff' },
    { icon: Clock, title: 'Nyitvatartás', body: 'Állítsd be, mikor fogadsz vendégeket. Az online foglalás csak a nyitvatartáson belül lehetséges — egy pontos nyitvatartással sosem utasítasz vissza foglalható időpontot tévedésből.', previewKey: 'hours', href: '/restaurant/availability' },
    { icon: BarChart2, title: 'Statisztikák', body: 'Kövesd a kihasználtságot, a lemondásokat és a beesők arányát — itt látod pontosan, mi hozza a bevételt és hol veszítesz vendéget. Exportálhatod is CSV-be bármikor.', previewKey: 'analytics', href: '/restaurant/analytics' },
    { icon: Lightbulb, title: 'Tippek', body: 'Ide térsz vissza, ha többet akarsz kihozni a foglalásokból — a valós adataidból folyamatosan frissülő, konkrét javaslatokat kapsz több bevételhez és jobb vendégélményhez.', previewKey: 'tips', href: '/restaurant/tips' },
    { icon: Settings, title: 'Beállítások', body: 'A profilod, az e-mailsablonok, a számlázás és a csapat jogosultságai — mindent itt kezelsz. Itt kötöd be a Google-t is: a "Foglalj most" gombot egyenesen a Google keresésbe és Maps-re (ingyen, extra forgalom), és az automatikus értékeléskérést, hogy a jó vélemények tényleg megjelenjenek nálad. Az ajándékutalványt itt kapcsolhatod be, a hírlevél pedig már alapból benne van az előfizetésedben — csak küldened kell egy kampányt.', previewKey: 'settings', href: '/restaurant/settings' },
    { icon: Smartphone, title: 'Telepíthető alkalmazás', body: 'Telefonra és asztali gépre is felrakható appként — App Store nélkül, közvetlenül a böngészőből. Ikon kerül a főképernyőre, és push értesítéssel azonnal tudsz minden új foglalásról, bárhol vagy.', previewKey: 'pwa', href: '/restaurant/settings?tab=notifications' },
    DONE('Jó munkát! ✨'),
  ],
  salon: [
    WELCOME,
    { icon: LayoutDashboard, title: 'Áttekintés', body: 'A kezdőképernyőd: a mai időpontok, a bevétel és a legfontosabb számok egy pillantásra — azonnal látod, hol van még szabad kapacitásod ma.', previewKey: 'overview', href: '/dashboard' },
    { icon: CalendarDays, title: 'Időpontok', body: 'A foglalásaidat naptár- és listanézetben látod. Új időpontot kézzel is rögzíthetsz, az online foglalások automatikusan megjelennek — így egyetlen időpont sem vész el papíron vagy telefonban.', previewKey: 'bookings', href: '/dashboard/bookings' },
    { icon: CalendarRange, title: 'Naptár', body: 'Havi nézetben tartod kézben a csapat beosztását — ki mikor dolgozik, ki van szabadságon. Egy napra kattintva szerkeszted a műszakokat — jól időzített beosztással sosem maradsz szakember nélkül egy zsúfolt napon.', previewKey: 'schedule', href: '/dashboard/schedule' },
    { icon: Briefcase, title: 'Szolgáltatások', body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online. Egy pontos, teljes lista önmagában több foglalást hoz.', previewKey: 'services', href: '/dashboard/services' },
    { icon: Users, title: 'Munkatársak', body: 'Minél több szakember érhető el nálad, annál több időpontot tudsz egyszerre kínálni — a csapat bővítése közvetlen bevétel-kapacitás. Add hozzá a munkatársaidat, és rendeld hozzájuk a szolgáltatásokat, hogy foglaláskor választhatók legyenek.', previewKey: 'staff', href: '/dashboard/staff' },
    { icon: Clock, title: 'Nyitvatartás', body: 'A nyitvatartás és a munkatársak elérhetősége együtt határozza meg a foglalható időpontokat — egy pontos beállítással sosem utasítasz vissza foglalható időpontot tévedésből.', previewKey: 'hours', href: '/dashboard/availability' },
    { icon: BarChart2, title: 'Statisztikák', body: 'Kövesd a bevételt és a kihasználtságot — itt látod pontosan, mely szolgáltatás és mely szakember hozza a legtöbbet. Exportálhatod is CSV-be bármikor.', previewKey: 'analytics', href: '/dashboard/analytics' },
    { icon: Lightbulb, title: 'Tippek', body: 'Ide térsz vissza, ha többet akarsz kihozni a foglalásokból — a valós adataidból folyamatosan frissülő, konkrét javaslatokat kapsz több bevételhez és jobb vendégélményhez.', previewKey: 'tips', href: '/dashboard/tips' },
    { icon: Settings, title: 'Beállítások', body: 'A profilod, az e-mailsablonok, a számlázás és a csapat jogosultságai — mindent itt kezelsz. Itt kötöd be a Google-t is: a "Foglalj most" gombot egyenesen a Google keresésbe és Maps-re (ingyen, extra forgalom), és az automatikus értékeléskérést, hogy a jó vélemények tényleg megjelenjenek nálad. Az ajándékutalványt itt kapcsolhatod be, a hírlevél pedig már alapból benne van az előfizetésedben — csak küldened kell egy kampányt.', previewKey: 'settings', href: '/dashboard/settings' },
    { icon: Smartphone, title: 'Telepíthető alkalmazás', body: 'Telefonra és asztali gépre is felrakható appként — App Store nélkül, közvetlenül a böngészőből. Ikon kerül a főképernyőre, és push értesítéssel azonnal tudsz minden új foglalásról, bárhol vagy.', previewKey: 'pwa', href: '/dashboard/settings?tab=notifications' },
    DONE('Sok sikert! ✨'),
  ],
}

// Progressz mentése: látott + aktuális lépés.
function seenKey(variant: Variant, userId?: string) {
  return `davelopment_onboarding_seen_${variant}_${userId ?? 'anon'}`
}
function progressKey(variant: Variant, userId?: string) {
  return `davelopment_onboarding_progress_${variant}_${userId ?? 'anon'}`
}

const REOPEN_EVENT = 'davelopment:open-onboarding'

const SLIDE: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir >= 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir >= 0 ? -48 : 48 }),
}

export function OnboardingTour({ variant, userId }: { variant: Variant; userId?: string }) {
  const steps = STEPS[variant]
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Auto-open on first visit; restore progress index.
  useEffect(() => {
    setMounted(true)
    try {
      if (!localStorage.getItem(seenKey(variant, userId))) {
        const saved = localStorage.getItem(progressKey(variant, userId))
        if (saved) {
          const restored = Math.min(parseInt(saved, 10), steps.length - 1)
          setIndex(restored)
        }
        setOpen(true)
      }
    } catch { /* localStorage blocked */ }
  }, [variant, userId, steps.length])

  // Save progress whenever index changes while open.
  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(progressKey(variant, userId), String(index))
    } catch { /* no-op */ }
  }, [open, index, variant, userId])

  // Reopen from Help page — always restarts at 0.
  useEffect(() => {
    const handler = () => { setDir(0); setIndex(0); setOpen(true) }
    window.addEventListener(REOPEN_EVENT, handler)
    return () => window.removeEventListener(REOPEN_EVENT, handler)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    try {
      localStorage.setItem(seenKey(variant, userId), '1')
      localStorage.removeItem(progressKey(variant, userId))
    } catch { /* no-op */ }
  }, [variant, userId])

  const go = useCallback(
    (d: number) => {
      setDir(d)
      setIndex((i) => Math.max(0, Math.min(i + d, steps.length - 1)))
    },
    [steps.length],
  )

  const navigateTo = useCallback(
    (href: string) => {
      close()
      router.push(href)
    },
    [close, router],
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
      {/* Blur-réteg */}
      <div
        className="absolute inset-0 bg-[rgba(244,241,233,0.45)] backdrop-blur-2xl backdrop-saturate-150"
        onClick={close}
      />

      {/* Bezárás */}
      <button
        onClick={close}
        aria-label="Bezárás"
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink-soft shadow-dav-card backdrop-blur transition-colors hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Tartalom */}
      <div className="relative flex h-full flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px] rounded-[32px] border border-[rgba(120,110,70,.08)] bg-white/82 px-6 py-7 text-center shadow-[0_20px_60px_-20px_rgba(80,70,30,.22)]">
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
              {/* Animált előnézet */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.05 }}
              >
                <TourPreview stepKey={step.previewKey} variant={variant} />
              </motion.div>

              <div className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft2">
                {index + 1} / {steps.length}
              </div>
              <h1 className="mt-2.5 text-[28px] font-light leading-[1.1] tracking-[-0.02em] text-ink lg:text-[34px]">
                {step.title}
              </h1>
              <p className="mx-auto mt-3.5 max-w-[360px] text-[15px] leading-relaxed text-ink-soft">
                {step.body}
              </p>

              {/* Navigáló CTA */}
              {step.href && (
                <button
                  type="button"
                  onClick={() => navigateTo(step.href!)}
                  className="mt-4 inline-flex items-center gap-2 rounded-[16px] border border-[rgba(120,110,70,.22)] bg-white/70 px-5 py-2.5 text-[13px] font-semibold text-ink shadow-[0_2px_10px_rgba(80,70,30,0.08)] backdrop-blur-sm transition-all hover:bg-white hover:shadow-[0_4px_18px_rgba(80,70,30,0.13)] active:scale-[0.97]"
                >
                  Megnézem
                  <ArrowRight className="h-3.5 w-3.5 text-[#86826F]" />
                </button>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Pötty-progress */}
          <div className="mt-8 flex items-center justify-center gap-2">
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
          <div className="mt-7 flex items-center justify-center gap-3">
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
