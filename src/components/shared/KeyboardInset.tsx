'use client'

import { useEffect } from 'react'

/**
 * Mobilon a teljes képernyős, nem görgethető űrlapoknál (bejelentkezés, regisztráció): amíg egy mező fókuszban van,
 * a <html> `data-typing` jelzést kap — az űrlap ilyenkor a képernyő felső részébe kerül, ahol a billentyűzet nem éri el.
 *
 * NEM a billentyűzet magasságát mérjük: iPhone-on a `visualViewport` késve / darabokban jelez, és a Safari a nyitáskor
 * maga is görget — a mért feltolás vagy késett, vagy túllőtt és visszaugrott. A jelzés a koppintás pillanatában
 * (focusin, a Safari görgetése előtt) vált, így egy lépés, ugrás nélkül. Skill: ios-safari-mobile.
 */
const isField = (el: Element | null) => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')

export function KeyboardInset() {
  useEffect(() => {
    if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) return // csak érintőképernyőn
    const root = document.documentElement
    const on = (e: FocusEvent) => { if (isField(e.target as Element)) root.setAttribute('data-typing', '') }
    const off = () => { window.setTimeout(() => { if (!isField(document.activeElement)) root.removeAttribute('data-typing') }, 80) }
    document.addEventListener('focusin', on)
    document.addEventListener('focusout', off)
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); root.removeAttribute('data-typing') }
  }, [])
  return null
}
