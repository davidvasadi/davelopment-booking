'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, X, Sparkles, Check } from 'lucide-react'

type Variant = 'restaurant' | 'salon'

// Egy túra-lépés egy nav-menüpontra mutat (data-tour={href}) és elmagyarázza.
type Step = { href: string; title: string; body: string }

const STEPS: Record<Variant, Step[]> = {
  restaurant: [
    {
      href: '/restaurant',
      title: 'Áttekintés',
      body: 'A kezdőképernyőd: a mai foglalások, a kihasználtság és a legfontosabb számok egy pillantásra.',
    },
    {
      href: '/restaurant/bookings',
      title: 'Foglalások',
      body: 'Itt látod a nap vendégeit lista- és idővonal-nézetben. Beeső és telefonos foglalást is rögzíthetsz — akár név nélkül, ha siettek. A napi listát ki is nyomtathatod.',
    },
    {
      href: '/restaurant/tables',
      title: 'Asztalok',
      body: 'Vedd fel az asztalaidat (vagy egyszerű férőhely-számot). A rendszer ez alapján kezeli a kapacitást és az online foglalásokat.',
    },
    {
      href: '/restaurant/availability',
      title: 'Nyitvatartás',
      body: 'Állítsd be, mikor fogadsz vendégeket. Az online foglalás csak a nyitvatartáson belül lehetséges.',
    },
    {
      href: '/restaurant/analytics',
      title: 'Statisztikák',
      body: 'Kövesd a kihasználtságot, a lemondásokat és a beesők arányát — és exportálj CSV-be bármikor.',
    },
    {
      href: '/restaurant/settings',
      title: 'Beállítások',
      body: 'Itt szabod testre az éttermed adatait és az értesítéseket. A tippeket innen bármikor újra előhívhatod. Jó munkát! ✨',
    },
  ],
  salon: [
    {
      href: '/dashboard',
      title: 'Áttekintés',
      body: 'A kezdőképernyőd: a mai időpontok, a bevétel és a legfontosabb számok egy pillantásra.',
    },
    {
      href: '/dashboard/bookings',
      title: 'Foglalások',
      body: 'Itt látod az időpontokat naptár- és listanézetben. Új időpontot kézzel is rögzíthetsz, az online foglalások automatikusan megjelennek.',
    },
    {
      href: '/dashboard/services',
      title: 'Szolgáltatások',
      body: 'Vedd fel a szolgáltatásaidat árral és időtartammal — a vendégeid ezek alapján foglalnak online.',
    },
    {
      href: '/dashboard/staff',
      title: 'Munkatársak',
      body: 'Add hozzá a munkatársaidat, és rendeld hozzájuk a szolgáltatásokat.',
    },
    {
      href: '/dashboard/analytics',
      title: 'Statisztikák',
      body: 'Kövesd a bevételt és a kihasználtságot — és exportálj CSV-be bármikor.',
    },
    {
      href: '/dashboard/settings',
      title: 'Beállítások',
      body: 'Itt szabod testre a szalonod adatait és az értesítéseket. A tippeket innen bármikor újra előhívhatod. Jó munkát! ✨',
    },
  ],
}

// A kulcs user-specifikus, hogy ugyanabban a böngészőben egy ÚJ fiók is friss
// túrát kapjon (különben az első teszt-fiók "már látta" jelölése elnyomná).
function storageKey(variant: Variant, userId?: string) {
  return `schedulio_onboarding_seen_${variant}_${userId ?? 'anon'}`
}

/** A beállítások oldal ezzel hívhatja újra:
 *  `window.dispatchEvent(new Event('schedulio:open-onboarding'))` */
const REOPEN_EVENT = 'schedulio:open-onboarding'

type Rect = { top: number; left: number; width: number; height: number }

/** A blur-réteghez egy LEKEREKÍTETT téglalap-lyukat vág `mask`-kal: a teljes felület
 *  látható (blur érvényesül), kivéve a célelem helyén lévő kerek-sarkú téglalapot
 *  (ott a blur kimaszkolva → a kiemelt elem éles és kerek marad, nem szögletes). */
function holeMaskStyle(hl: Rect): React.CSSProperties {
  const r = 16 // a lyuk sarok-lekerekítése (≈ rounded-2xl)
  const hole = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${hl.width}' height='${hl.height}'%3E%3Crect width='${hl.width}' height='${hl.height}' rx='${r}' ry='${r}' fill='%23000'/%3E%3C/svg%3E")`
  const full = 'linear-gradient(#000 0 0)'
  return {
    WebkitMaskImage: `${full}, ${hole}`,
    WebkitMaskPosition: `0 0, ${hl.left}px ${hl.top}px`,
    WebkitMaskSize: `auto, ${hl.width}px ${hl.height}px`,
    WebkitMaskRepeat: 'no-repeat, no-repeat',
    WebkitMaskComposite: 'destination-out',
    maskImage: `${full}, ${hole}`,
    maskPosition: `0 0, ${hl.left}px ${hl.top}px`,
    maskSize: `auto, ${hl.width}px ${hl.height}px`,
    maskRepeat: 'no-repeat, no-repeat',
    maskComposite: 'exclude',
    // (a `pos` rövidített forma egyes böngészőkben nem áll össze megbízhatóan,
    //  ezért a hosszú, szétbontott mask-* tulajdonságokat használjuk fent.)
  } as React.CSSProperties & Record<string, string>
}

export function OnboardingTour({ variant, userId }: { variant: Variant; userId?: string }) {
  const steps = STEPS[variant]
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<Rect | null>(null)
  const rafRef = useRef<number | null>(null)

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

  // A jelenlegi lépés célelemének kimérése. Ha nincs a DOM-ban (pl. mobilon a
  // "több" menüben), a következő látható lépésre ugrunk.
  const measure = useCallback(() => {
    const step = steps[index]
    if (!step) return
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-tour="${step.href}"]`),
    ).filter((el) => el.offsetParent !== null) // csak a látható (desktop VAGY mobil) példány
    const el = els[0]
    if (!el) {
      setRect(null)
      return
    }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [index, steps])

  useEffect(() => {
    if (!open) return
    measure()
    // A nav (különösen friss regisztráció utáni kliens-navigációnál) néhány
    // tizedmásodperccel később renderel — ezért pár alkalommal újramérünk, amíg
    // a célelem előkerül. Így nem ragad "üres" (rect nélküli) állapotban.
    const retries = [60, 160, 320, 600].map((ms) => setTimeout(measure, ms))
    const onChange = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onChange)
    window.addEventListener('scroll', onChange, true)
    return () => {
      retries.forEach(clearTimeout)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('scroll', onChange, true)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [open, measure])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, steps.length - 1))
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close, steps.length])

  if (!mounted || !open || typeof document === 'undefined') return null

  const isFirst = index === 0
  const isLast = index === steps.length - 1
  const step = steps[index]

  // Spotlight: a célelem köré egy padding-elt lekerekített téglalap, amit a blur
  // rétegen kimaszkolunk. Ha nincs cél (rect == null), középre tett kártya, blur mindenütt.
  const PAD = 8
  const hl = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null

  // A buborék pozíciója: desktop oldalsávnál jobbra, mobil alsó sávnál fölé.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768
  const isMobileNav = hl ? hl.top > vh / 2 : false // alsó sávban a cél a képernyő alján van

  const BUBBLE_W = 348
  let bubbleStyle: React.CSSProperties
  // A csőr (kis háromszög) pozíciója a buborék szélén, hogy a célra mutasson.
  let arrow: { side: 'left' | 'bottom'; offset: number } | null = null

  if (!hl) {
    bubbleStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  } else if (isMobileNav) {
    // A buborék a kiemelt elem fölé, vízszintesen az elemhez igazítva (viewportba szorítva).
    const centerX = hl.left + hl.width / 2
    const left = Math.min(Math.max(12, centerX - BUBBLE_W / 2), vw - BUBBLE_W - 12)
    bubbleStyle = { bottom: vh - hl.top + 14, left }
    arrow = { side: 'bottom', offset: centerX - left } // a csőr a buborék aljáról a cél közepére
  } else {
    // Desktop: a buborék az oldalsáv elemtől jobbra, függőlegesen az elemhez igazítva.
    const centerY = hl.top + hl.height / 2
    const top = Math.min(Math.max(12, centerY - 120), vh - 300)
    bubbleStyle = { top, left: hl.left + hl.width + 18 }
    arrow = { side: 'left', offset: centerY - top } // a csőr a buborék bal oldaláról a cél közepére
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[80]"
      role="dialog"
      aria-modal="true"
      aria-label="Bevezető körbevezetés"
    >
      {/* Sötétítő réteg kattintható háttérként. Ha van kiemelt elem, ezt a kerek
          „lyuk" (lentebb, box-shadow spread) takarja le — itt csak a cél nélküli
          (középre tett kártya) esetben sötétít, blurral. */}
      {!hl && (
        <div
          className="absolute inset-0 bg-zinc-950/55 backdrop-blur-md transition-all duration-300"
          onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
        />
      )}

      {/* Kiemelő keret + sötétítés + blur, KEREK lyukkal:
          1) box-shadow spread sötétíti a környezetet, a „lyuk" éles és kerek;
          2) egy külön backdrop-blur réteget a célelem körül lekerekített téglalap
             maszkkal kivágunk, így a háttér homályos, de a kiemelt elem éles+kerek. */}
      {hl && (
        <>
          <div
            className="absolute inset-0 backdrop-blur-md"
            style={holeMaskStyle(hl)}
            onClick={() => (isLast ? close() : setIndex((i) => i + 1))}
          />
          <div
            className="absolute rounded-2xl pointer-events-none transition-all duration-300 ease-out"
            style={{
              top: hl.top,
              left: hl.left,
              width: hl.width,
              height: hl.height,
              boxShadow:
                '0 0 0 9999px rgba(9,9,11,0.55), 0 0 0 1px rgba(255,255,255,0.25), 0 8px 30px 2px rgba(0,0,0,0.30)',
            }}
          />
        </>
      )}

      {/* Magyarázó buborék */}
      <div
        className="absolute rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-zinc-900 shadow-2xl shadow-black/40 p-5 animate-in fade-in zoom-in-95 duration-200"
        style={{ ...bubbleStyle, width: `min(${BUBBLE_W}px, calc(100vw - 24px))` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Csőr — a kiemelt elemre mutat */}
        {arrow?.side === 'left' && (
          <span
            className="absolute h-3 w-3 rotate-45 bg-white dark:bg-zinc-900 border-l border-b border-zinc-200 dark:border-white/[0.08]"
            style={{ left: -6, top: Math.max(14, Math.min(arrow.offset - 6, 999)) }}
          />
        )}
        {arrow?.side === 'bottom' && (
          <span
            className="absolute h-3 w-3 rotate-45 bg-white dark:bg-zinc-900 border-r border-b border-zinc-200 dark:border-white/[0.08]"
            style={{ bottom: -6, left: Math.max(14, Math.min(arrow.offset - 6, BUBBLE_W - 22)) }}
          />
        )}

        <button
          onClick={close}
          aria-label="Bezárás"
          className="absolute top-3.5 right-3.5 h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.06] dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <span className="flex items-center justify-center h-8 w-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-[11px] font-bold text-zinc-400 dark:text-white/40 uppercase tracking-[0.12em]">
            {index + 1}. lépés · {steps.length}-ből
          </span>
        </div>

        <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white mb-1.5">
          {step.title}
        </h2>
        <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-white/55">{step.body}</p>

        {/* Haladás-csík (folyamatos), alatta a léptető pöttyök */}
        <div className="mt-4 mb-4">
          <div className="h-1 w-full rounded-full bg-zinc-200/80 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-zinc-900 dark:bg-white transition-all duration-300 ease-out"
              style={{ width: `${((index + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {isFirst ? (
            <button
              onClick={close}
              className="text-xs font-semibold text-zinc-400 dark:text-white/40 hover:text-zinc-700 dark:hover:text-white/70 transition-colors"
            >
              Kihagyás
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              className="flex items-center gap-1 h-9 pl-2 pr-3 rounded-xl text-xs font-semibold text-zinc-500 dark:text-white/50 hover:text-zinc-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Vissza
            </button>
          )}

          {isLast ? (
            <button
              onClick={close}
              className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Check className="h-3.5 w-3.5" />
              Kezdjük!
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => Math.min(i + 1, steps.length - 1))}
              className="flex items-center gap-1.5 h-9 px-5 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-black text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all"
            >
              Tovább
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
