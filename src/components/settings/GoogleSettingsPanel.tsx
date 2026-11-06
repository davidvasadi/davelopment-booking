'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { GooglePlacePicker } from './GooglePlacePicker'
import { GoogleSettings, type ReviewsSummary, type ReviewsValue } from '@/components/blocks/settings'
import type { FeatureModules } from '@/lib/featureModules'

/**
 * Beállítások › Értékelések (design 16.15) és › Google Cégprofil (16.15.1) — a design `GoogleSettings` blokkja élő adattal.
 *
 * Az értékelés-kérés mezői (`reviews_on`, `review_delay_hours`, `review_target`, a három link) és a „Foglalj most”
 * önbevallás a VALÓS `feature_modules` group része — mentéskor a TELJES `feature_modules` objektumot küldjük vissza (a
 * többi mezőt érintetlenül, az `initialFeatureModules`-ból), mert a Payload group mező PATCH-nél nem deep-mergel: egy
 * részleges write lenullázná az itt nem szerkesztett mezőket (emlékeztetők, várólista, ismétlődés).
 */

/** Ugyanaz a validáció, mint szerver-oldalon (`/api/review/[token]`) — csak jól formázott http(s) URL. */
function isValidUrl(v: string): boolean {
  if (!/^https?:\/\//i.test(v)) return false
  try { new URL(v); return true } catch { return false }
}
const GOOGLE_RE = /(g\.page\/r\/|\/local\/writereview|maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/(search|maps)|g\.co\/)/i

function reviewsFrom(fm: FeatureModules): ReviewsValue {
  return {
    on: fm.reviews_on,
    delay: fm.review_delay_hours === 24 ? 24 : fm.review_delay_hours === 2 ? 2 : 1,
    target: fm.review_target ?? 'google',
    googleUrl: fm.google_review_url ?? '',
    tripadvisorUrl: fm.tripadvisor_review_url ?? '',
    facebookUrl: fm.facebook_review_url ?? '',
  }
}

export function GoogleSettingsPanel({ variant, apiBase, bookingUrl, businessId, businessName, businessCity, initialFeatureModules, onDirtyChange, registerApi, part = 'all' }: {
  /** a Beállításokban két külön téma: Értékelések (16.15) és Google Cégprofil (16.15.1) */
  part?: 'all' | 'reviews' | 'profile'
  variant: 'restaurant' | 'salon'
  /** VALÓS mentés végpont: `/api/salons/${id}` vagy `/api/restaurants/${id}`. */
  apiBase: string
  /** A publikus foglalási URL — a Cégprofil „Időpont foglalása” linkje. */
  bookingUrl: string
  /** az összesítőhöz (`/api/reviews/summary`) */
  businessId: string
  /** Az üzlet neve + városa — a Google-kereső előre-kitöltéséhez (GooglePlacePicker). */
  businessName: string
  businessCity?: string | null
  /** A TELJES `feature_modules` kezdőérték (lásd fent). */
  initialFeatureModules: FeatureModules
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}) {
  const baseline = useMemo<ReviewsValue>(() => reviewsFrom(initialFeatureModules), [initialFeatureModules])
  const [reviews, setReviews] = useState<ReviewsValue>(baseline)
  // „Foglalj most” — a tulaj saját Google-fiókjában áll be, a mi API-nkon kívül: ÖNBEVALLÁS, nem ellenőrzött állapot
  const [confirmed, setConfirmed] = useState(!!initialFeatureModules.google_booking_confirmed)
  const [showErrors, setShowErrors] = useState(false)
  const [summary, setSummary] = useState<ReviewsSummary | null>(null)
  useEffect(() => {
    if (part === 'profile' || !businessId) return
    fetch(`/api/reviews/summary?kind=${variant}&businessId=${encodeURIComponent(businessId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && !j.error) setSummary(j) }).catch(() => {})
  }, [part, businessId, variant])

  const dirty = JSON.stringify(reviews) !== JSON.stringify(baseline) || confirmed !== !!initialFeatureModules.google_booking_confirmed
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  // a linkek hibaüzenetei: a formátum mentéskor (és utána élőben) — a Google-linknél gépelés közben egy figyelmeztetés is
  const urlErrors = (r: ReviewsValue) => {
    const e: Partial<Record<'google' | 'tripadvisor' | 'facebook', string>> = {}
    const bad = 'Ez nem érvényes link — http:// vagy https:// -sel kell kezdődnie.'
    if (r.googleUrl.trim() && !isValidUrl(r.googleUrl.trim())) e.google = bad
    if (r.tripadvisorUrl.trim() && !isValidUrl(r.tripadvisorUrl.trim())) e.tripadvisor = bad
    if (r.facebookUrl.trim() && !isValidUrl(r.facebookUrl.trim())) e.facebook = bad
    if (r.on && !r.googleUrl.trim() && !(r.target === 'tripadvisor' && r.tripadvisorUrl.trim()) && !(r.target === 'facebook' && r.facebookUrl.trim())) e.google = 'Add meg, hova menjen az elégedett vendég — legalább a Google értékelés-linket.'
    return e
  }
  const errors = urlErrors(reviews)
  const shown = showErrors ? errors : {}
  if (!shown.google && reviews.googleUrl.trim() && isValidUrl(reviews.googleUrl.trim()) && !GOOGLE_RE.test(reviews.googleUrl)) shown.google = 'Ez nem úgy néz ki, mint egy Google értékelés-link (g.page/…/review).'

  const ref = useRef({ reviews, confirmed })
  ref.current = { reviews, confirmed }
  useEffect(() => {
    registerApi?.({
      save: async () => {
        const { reviews: r, confirmed: c } = ref.current
        if (Object.keys(urlErrors(r)).length) { setShowErrors(true); toast.error('Nézd át a linkeket'); return false }
        try {
          const res = await fetch(apiBase, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({
              feature_modules: {
                ...initialFeatureModules,
                reviews_on: r.on,
                review_delay_hours: r.delay,
                review_target: r.target,
                google_review_url: r.googleUrl.trim() || null,
                tripadvisor_review_url: r.tripadvisorUrl.trim() || null,
                facebook_review_url: r.facebookUrl.trim() || null,
                google_booking_confirmed: c,
              },
            }),
          })
          if (!res.ok) throw new Error()
          setShowErrors(false)
          return true
        } catch { toast.error('Hiba történt'); return false }
      },
      discard: () => { setReviews(baseline); setConfirmed(!!initialFeatureModules.google_booking_confirmed); setShowErrors(false) },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline])

  return (
    <GoogleSettings part={part} restaurant={variant === 'restaurant'} save={false}
      reviews={reviews} onReviews={setReviews} urlErrors={shown} summary={summary}
      profile={<GooglePlacePicker businessName={businessName} businessCity={businessCity} />}
      booking={{
        url: bookingUrl, confirmed, onConfirm: setConfirmed,
        onCopy: () => { void navigator.clipboard?.writeText(bookingUrl).then(() => toast.success('Link másolva')).catch(() => toast.error('A másolás nem sikerült')) },
      }} />
  )
}
