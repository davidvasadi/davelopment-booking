'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'

/** Google „G" logó — a hivatalos alak, de egyszínű (currentColor), így a gomb szöveg-
 *  színét veszi fel (sötét hátteren világos, világos hátteren sötét). */
function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.1A6.96 6.96 0 0 1 5.46 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

/**
 * „Bejelentkezés Google-lel" gomb. A `signIn('google')` indítja az Auth.js v5 OAuth
 * flow-t; sikeres belépés után a callback-ban beállítjuk a payload-token cookie-t
 * (lásd src/auth.ts), majd a `callbackUrl`-re irányítunk.
 *
 * Variánsok:
 *  - `dark`:  fekete háttéren (mobil hero)
 *  - `light`: fehér háttéren (desktop form)
 */
/**
 * Klasszikus, széles social-login gomb a Google-bejelentkezéshez. Ikon balra, „Folytatás
 * Google-lel" szöveg középen, teljes szélességű pill — illeszkedik a többi pill-gombhoz.
 * Variánsok:
 *  - `light`: világos hátteren — fehér háttér, finom szegély (mint a screenshotban)
 *  - `dark`:  sötét hátteren — világos szegély a sötét háttéren, fehér szöveg
 */
export function GoogleSignInButton({
  variant = 'light',
  callbackUrl = '/',
  label = 'Folytatás Google-lel',
  className = '',
  onClick,
}: {
  variant?: 'light' | 'dark'
  callbackUrl?: string
  label?: string
  className?: string
  /** Felülbírálja a default `signIn('google')`-t. Pl. a regisztrációs wizardben előbb
   *  el kell mentenünk a cégadatokat egy pending cookie-ba, mielőtt indul az OAuth-flow. */
  onClick?: () => void | Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  // Klasszikus social-pill: teljes szélességű, ikon balra, szöveg középen-balra.
  const base =
    'w-full inline-flex h-12 items-center justify-center gap-3 rounded-full font-semibold text-sm transition-colors disabled:opacity-60'
  const styles =
    variant === 'dark'
      // Sötét hátteren: világos szegély, fehér szöveg (mint a "Van már fiókom" gomb)
      ? 'border border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-900 hover:border-zinc-600'
      // Világos hátteren: fehér háttér, finom szegély, sötét szöveg (klasszikus social-pill)
      : 'border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 shadow-sm'
  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        if (onClick) {
          try { await onClick() } finally { setLoading(false) }
        } else {
          void signIn('google', { callbackUrl })
        }
      }}
      className={`${base} ${styles} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4 shrink-0" />}
      <span>{label}</span>
    </button>
  )
}
