'use client'

import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, MorphSVGPlugin, useGSAP)

export { gsap, ScrollTrigger, MorphSVGPlugin, useGSAP }

/** Igaz, ha a felhasználó csökkentett mozgást kér — ilyenkor a cinematic scrollt kihagyjuk. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
