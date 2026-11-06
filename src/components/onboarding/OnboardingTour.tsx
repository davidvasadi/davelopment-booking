'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { tourSteps } from '@/components/blocks/tour'
import { TourCard } from '@/components/blocks/tour-card'
import { GENIE } from '@/components/ui/popup-modal'
import { SHEET_MOBILE } from '@/lib/motion'

/**
 * REGISZTRÁCIÓ UTÁNI BEVEZETŐ — a /design 19.x kártyája: elmosott oldal fölött középen (mobilon alulról
 * nyíló lap), az előnézetek a design valódi kártyái. Progressz mentve localStorage-ba (folytatja ahol abbahagyta);
 * Súgóból újraindul 0-ról. Bármikor kihagyható.
 *
 * Újrahívás: `window.dispatchEvent(new Event('davelopment:open-onboarding'))`
 */

type Variant = 'restaurant' | 'salon'

// Progressz mentése: látott + aktuális lépés.
function seenKey(variant: Variant, userId?: string) {
  return `davelopment_onboarding_seen_${variant}_${userId ?? 'anon'}`
}
function progressKey(variant: Variant, userId?: string) {
  return `davelopment_onboarding_progress_${variant}_${userId ?? 'anon'}`
}

const REOPEN_EVENT = 'davelopment:open-onboarding'

export function OnboardingTour({ variant, userId, userName, businessName }: { variant: Variant; userId?: string; userName?: string | null; businessName?: string }) {
  const steps = useMemo(() => tourSteps(variant === 'restaurant', { name: userName, business: businessName }), [variant, userName, businessName])
  const base = variant === 'restaurant' ? '/restaurant' : '/dashboard'
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(0)
  const [mounted, setMounted] = useState(false)
  // a beugró ugyanaz, mint minden popupnál (PopupModal): desktopon genie-rugó, mobilon alulról felcsúszó lap
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

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

  const step = steps[index]
  const isLast = index === steps.length - 1

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[96] flex items-end justify-center font-onest sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bevezető"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <div className="absolute inset-0 bg-ui-dark/25 backdrop-blur-sm sm:bg-ui-page/50 sm:backdrop-blur-xl" onClick={close} aria-hidden />
      <motion.div variants={isDesktop ? GENIE : SHEET_MOBILE} initial="hidden" animate="show"
        style={{ transformOrigin: isDesktop ? 'center' : 'bottom center' }} className="relative z-10 w-full will-change-transform sm:w-auto">
        <TourCard
          index={index}
          total={steps.length}
          title={step.title}
          body={step.body}
          to={step.to}
          preview={step.preview}
          dir={dir}
          onOpen={step.to !== undefined ? () => navigateTo(step.to ? `${base}/${step.to}` : base) : undefined}
          onPrev={() => go(-1)}
          onNext={() => (isLast ? close() : go(1))}
          onSkip={close}
          onClose={close}
        />
      </motion.div>
    </motion.div>,
    document.body,
  )
}
