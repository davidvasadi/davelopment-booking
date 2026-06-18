'use client'

import { useState, useEffect } from 'react'
import { LANG_COOKIE, normalizeLocale, type Locale } from './index'

/** A `schedulio_lang` cookie kiolvasása a böngészőből. */
function readLocaleCookie(): Locale {
  if (typeof document === 'undefined') return 'hu'
  const m = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]*)`))
  return normalizeLocale(m ? decodeURIComponent(m[1]) : null)
}

/**
 * Kliens-oldali locale a `schedulio_lang` cookie-ból. Hydration-biztos: az első renderen
 * 'hu' (a szerverrel egyező default), majd useEffect után a tényleges érték.
 */
export function useClientLocale(): Locale {
  const [locale, setLocale] = useState<Locale>('hu')
  useEffect(() => {
    setLocale(readLocaleCookie())
  }, [])
  return locale
}
