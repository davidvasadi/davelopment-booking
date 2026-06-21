'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

// A ScrollTrigger plugin regisztrációja itt is (a SmoothScroll-tól függetlenül is biztos).
gsap.registerPlugin(ScrollTrigger, useGSAP)

export { gsap, ScrollTrigger, useGSAP }

/** Igaz, ha a felhasználó csökkentett mozgást kér — ilyenkor a cinematic scrollt kihagyjuk. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
