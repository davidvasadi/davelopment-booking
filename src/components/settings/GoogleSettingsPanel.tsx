'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, ChevronDown, Check, ExternalLink } from 'lucide-react'
import { IntegCard, UrlRow, Steps } from './IntegCardKit'
import { GooglePlacePicker } from './GooglePlacePicker'
import { GoogleIcon } from '@/components/auth/GoogleSignInButton'
import { Toggle } from './SettingsToggle'
import { EASE, DUR } from '@/lib/motion'
import type { FeatureModules } from '@/components/onboarding/BookingFeatures'

/**
 * „Google" beállítás-fül — minden Google-vonatkozású beállítás egy helyen (korábban az
 * Értékelések a Foglalási funkciók közé, a Google Cégem/Calendar kártyák pedig az API &
 * Integrációk fülre voltak keverve más, nem Google-specifikus elemek közé).
 *
 * A `google_review_url`/`reviews_on`/`review_delay_hours` a VALÓS `feature_modules` group
 * része (lásd `BookingFeatures.tsx`) — ez a panel csak EZT a 3 mezőt szerkeszti, de a mentéskor
 * a TELJES `feature_modules` objektumot visszaküldi (a többi mezőt érintetlenül, az
 * `initialFeatureModules`-ból), mert a Payload group mező PATCH-nél nem deep-mergel: egy
 * részleges `feature_modules` write lenullázná az itt nem szerkesztett mezőket (emlékeztetők,
 * várólista, ismétlődés) — ugyanaz a buktató, amit a `BookingFeatures.tsx` is dokumentál.
 */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft2">{children}</div>
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-dav-chip border px-3.5 py-2 text-[12.5px] font-semibold transition-all active:scale-[0.97] ${
        on
          ? 'border-transparent bg-ink-dark text-white'
          : 'border-line bg-white text-ink-soft2 hover:border-line-strong'
      }`}
    >
      {children}
    </button>
  )
}

type Reviews = { on: boolean; delay: 'h1' | 'h2' | 'next'; googleUrl: string }

/** Ugyanaz a validáció, mint szerver-oldalon (`/api/review/[token]`) — csak jól formázott
 *  http(s) URL-t fogadunk el, hogy a mentett link biztosan használható legyen átirányításra. */
function isValidUrl(v: string): boolean {
  if (!/^https?:\/\//i.test(v)) return false
  try {
    new URL(v)
    return true
  } catch {
    return false
  }
}

function reviewsFrom(fm: FeatureModules): Reviews {
  return {
    on: fm.reviews_on,
    delay: fm.review_delay_hours === 24 ? 'next' : fm.review_delay_hours === 2 ? 'h2' : 'h1',
    googleUrl: fm.google_review_url ?? '',
  }
}

export function GoogleSettingsPanel({
  variant,
  apiBase,
  bookingUrl,
  businessName,
  businessCity,
  initialFeatureModules,
  onDirtyChange,
  registerApi,
}: {
  variant: 'restaurant' | 'salon'
  /** VALÓS mentés végpont: `/api/salons/${id}` vagy `/api/restaurants/${id}`. */
  apiBase: string
  /** A publikus foglalási URL — a „Google Cégem" kártya „Foglalj most" linkjéhez. */
  bookingUrl: string
  /** Az üzlet neve + városa — a Google-kereső előre-kitöltéséhez (GooglePlacePicker). */
  businessName: string
  businessCity?: string | null
  /** A TELJES `feature_modules` kezdőérték — csak a `reviews_*` mezőket szerkesztjük, a többit
   *  változatlanul visszaküldjük mentéskor (lásd fenti megjegyzés). */
  initialFeatureModules: FeatureModules
  onDirtyChange?: (dirty: boolean) => void
  registerApi?: (api: { save: () => Promise<boolean>; discard: () => void }) => void
}) {
  const baseline = useMemo<Reviews>(() => reviewsFrom(initialFeatureModules), [initialFeatureModules])
  const [reviews, setReviews] = useState<Reviews>(baseline)
  const [googleUrlDraft, setGoogleUrlDraft] = useState(reviews.googleUrl)
  // „Foglalj most” gomb — ez a tulaj saját Google Cégem fiókjában áll be, a mi API-nkon KÍVÜL,
  // ezért nincs mód valós állapot-ellenőrzésre. Ez a kapcsoló ÖNBEVALLÁS: a tulaj maga jelzi,
  // hogy elvégezte a lépéseket — ebből számol a kártya státusz-jelvénye (nem automatikus).
  const [googleBookingConfirmed, setGoogleBookingConfirmed] = useState(!!initialFeatureModules.google_booking_confirmed)
  const [googleHelpOpen, setGoogleHelpOpen] = useState(false)
  const [urlError, setUrlError] = useState(false)
  const [urlErrorKind, setUrlErrorKind] = useState<'required' | 'invalid'>('required')
  const looksLikeGoogleReview = /(g\.page\/r\/|\/local\/writereview|maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/(search|maps)|g\.co\/)/i.test(googleUrlDraft.trim())

  const dirty = JSON.stringify(reviews) !== JSON.stringify(baseline) || googleBookingConfirmed !== !!initialFeatureModules.google_booking_confirmed
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (mutator: (r: Reviews) => Reviews) => setReviews(mutator)

  const reviewsRef = useRef(reviews)
  reviewsRef.current = reviews
  const googleUrlDraftRef = useRef(googleUrlDraft)
  googleUrlDraftRef.current = googleUrlDraft
  const googleBookingConfirmedRef = useRef(googleBookingConfirmed)
  googleBookingConfirmedRef.current = googleBookingConfirmed
  useEffect(() => {
    registerApi?.({
      save: async () => {
        // A látható mezőben lévő, még el nem küldött (blur előtti) szöveget is ellenőrizzük —
        // ne lehessen érvénytelen linket menteni azzal, hogy a Mentés gombra kattintunk anélkül,
        // hogy a mező elhagyná a fókuszt.
        const draft = googleUrlDraftRef.current.trim()
        if (draft !== '' && !isValidUrl(draft)) {
          setUrlErrorKind('invalid')
          setUrlError(true)
          setTimeout(() => setUrlError(false), 600)
          toast.error('A Google értékelés-link formátuma nem érvényes.')
          return false
        }
        try {
          const r = reviewsRef.current
          const res = await fetch(apiBase, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              feature_modules: {
                ...initialFeatureModules,
                reviews_on: r.on,
                google_review_url: r.googleUrl.trim() || null,
                review_delay_hours: r.delay === 'h1' ? 1 : r.delay === 'next' ? 24 : 2,
                google_booking_confirmed: googleBookingConfirmedRef.current,
              },
            }),
          })
          if (!res.ok) throw new Error()
          return true
        } catch {
          toast.error('Hiba történt')
          return false
        }
      },
      discard: () => {
        setReviews(baseline)
        setGoogleUrlDraft(baseline.googleUrl)
        setGoogleBookingConfirmed(!!initialFeatureModules.google_booking_confirmed)
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline])

  const isSalon = variant === 'salon'
  const visitWord = isSalon ? 'kezelés' : 'látogatás'
  const hasUrl = reviews.googleUrl.trim() !== ''

  // Státusz-jelvény a TÉNYLEGESEN MENTETT (`baseline`) állapotból, nem a még-el-nem-mentett
  // draftból — ugyanaz az elv, mint a Számlázás kártyán. Ugyanaz a 3 szín/stílus, mint az
  // alatta lévő `IntegCard`-é (Google Cégem), hogy a két kártya egy nyelvet beszéljen.
  const reviewStatus: { label: string; cls: string } =
    baseline.googleUrl.trim() === ''
      ? { label: 'Beállítható', cls: 'bg-warn-bg text-warn' }
      : baseline.on
        ? { label: 'Aktív', cls: 'bg-ok-bg text-ok' }
        : { label: 'Kikapcsolva', cls: 'bg-[rgba(0,0,0,.06)] text-ink-soft' }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-soft">
        Minden Google-vonatkozású beállítás egy helyen: értékelés-kérés, „Foglalj most" gomb a keresésben/Maps-en, naptár-szinkron.
      </p>

      {/* ── Google-értékelések megjelenítése a foglaló oldalon (Places API, napi frissítés) ── */}
      <GooglePlacePicker businessName={businessName} businessCity={businessCity} />

      {/* ── Értékelések — custom kártya (URL mindig látható, toggle csak URL után aktív).
          A fejléc-ikon/cím/jelvény ugyanazt a nyelvet beszéli, mint a lenti IntegCard
          (Google Cégem), hogy a két kártya egy stílust kövessen ugyanazon az oldalon. ── */}
      <div className="rounded-dav-lg dav-card-glass px-5 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-dav-sm bg-[#FBF9F2] text-ink-soft2">
              <GoogleIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[15px] font-semibold text-ink">Google értékelés</h2>
                <span className={`rounded-dav-sm px-2 py-0.5 text-[11px] font-semibold ${reviewStatus.cls}`}>{reviewStatus.label}</span>
              </div>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                Automatikus értékeléskérés {visitWord} után
              </p>
            </div>
          </div>
          <div title={!hasUrl ? 'Előbb add meg a Google értékelés-linket' : undefined}>
            <Toggle
              checked={reviews.on}
              label="Értékelések be/ki"
              onChange={() => {
                if (!hasUrl) {
                  setUrlErrorKind('required')
                  setUrlError(true)
                  setTimeout(() => setUrlError(false), 600)
                  return
                }
                update((r) => ({ ...r, on: !r.on }))
              }}
            />
          </div>
        </div>

        {/* Google URL mező — MINDIG látható (nem kell toggle a linkhez) */}
        <div className="mt-5 border-t border-line pt-5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <GroupLabel>Google értékelés link</GroupLabel>
            <button
              type="button"
              onClick={() => setGoogleHelpOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              Hogyan találom meg?
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${googleHelpOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
          </div>

          <motion.div
            animate={urlError ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
          >
            <input
              type="url"
              inputMode="url"
              value={googleUrlDraft}
              onChange={(e) => { setGoogleUrlDraft(e.target.value); setUrlError(false) }}
              onFocus={() => setUrlError(false)}
              onBlur={() => {
                const v = googleUrlDraft.trim()
                if (v !== '' && !isValidUrl(v)) {
                  setUrlErrorKind('invalid')
                  setUrlError(true)
                  setTimeout(() => setUrlError(false), 600)
                  return
                }
                if (v !== reviews.googleUrl) {
                  update((r) => ({ ...r, googleUrl: v, on: v ? r.on : false }))
                }
              }}
              placeholder="https://g.page/r/…/review"
              className="h-11 w-full rounded-dav-sm border bg-white px-3.5 text-sm text-ink placeholder:text-ink-soft2/60 outline-none transition-colors"
              style={{
                borderColor: urlError ? 'var(--dav-bad)' : undefined,
                boxShadow: urlError ? '0 0 0 2px color-mix(in srgb, var(--dav-bad) 20%, transparent)' : undefined,
              }}
            />
          </motion.div>

          {urlError && (
            <p className="text-[12px] font-medium text-bad">
              {urlErrorKind === 'invalid'
                ? 'Ez nem érvényes link — http:// vagy https:// -sel kell kezdődnie.'
                : 'Add meg a Google értékelés-linket az aktiváláshoz.'}
            </p>
          )}

          {!urlError && googleUrlDraft.trim() !== '' && (
            looksLikeGoogleReview ? (
              <p className="inline-flex items-center gap-1 text-[12px] font-medium text-ok">
                <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> Ez Google értékelés-linknek tűnik.
              </p>
            ) : (
              <p className="text-[12px] font-medium text-warn">
                Ez nem úgy néz ki, mint egy Google értékelés-link. Nézd meg a „Hogyan találom meg?" lépéseket.
              </p>
            )
          )}

          <AnimatePresence initial={false}>
            {googleHelpOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-1 rounded-dav-chip border border-line bg-paper/50 p-4">
                  <ol className="space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
                    <li><b className="font-semibold text-ink">1.</b> <b className="font-semibold text-ink">Keress rá az üzleted nevére a Google-ban.</b></li>
                    <li><b className="font-semibold text-ink">2.</b> A „Vélemények" résznél kattints a <b className="font-semibold text-ink">„+ Vélemény írása"</b> gombra.</li>
                    <li><b className="font-semibold text-ink">3.</b> Másold ki a böngésző <b className="font-semibold text-ink">címsorából a linket</b>, és illeszd be ide.</li>
                  </ol>
                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-soft2">
                    Még tisztább link: a Cégprofil <b className="font-medium text-ink-soft">„Értékelések kérése"</b> kártyája ad egy rövid{' '}
                    <span className="rounded bg-white px-1 py-0.5 font-mono text-[11px] text-ink">g.page/…/review</span> linket.
                  </p>
                  <a
                    href="https://support.google.com/business/answer/3474122"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-dav-sm bg-ink-dark px-3.5 py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Google súgó: értékelések kérése
                    <ExternalLink className="h-3.5 w-3.5 text-gold" strokeWidth={2} />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-[12px] leading-relaxed text-ink-soft">
            A visszajelzés-email a <b className="font-semibold text-ink-soft">Google csillagozó-oldalára</b> viszi a vendéget.
          </p>
        </div>

        {/* Időzítés chipek — csak ha a toggle ON */}
        <AnimatePresence initial={false}>
          {reviews.on && hasUrl && (
            <motion.div
              key="delay"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DUR.base, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-line pt-5">
                <GroupLabel>Kérés a {visitWord} után</GroupLabel>
                <div className="flex flex-wrap gap-2.5">
                  {([
                    ['h1', '1 órával'],
                    ['h2', '2 órával'],
                    ['next', 'Másnap'],
                  ] as const).map(([k, l]) => (
                    <Chip key={k} on={reviews.delay === k} onClick={() => update((r) => ({ ...r, delay: k }))}>
                      {l}
                    </Chip>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Google Cégem — „Foglalj most” ── */}
      <IntegCard
        icon={MapPin}
        title={'Google Cégem — „Foglalj most”'}
        description={'„Foglalj most" gomb a Google keresési találatokban és Google Maps-en'}
        status={initialFeatureModules.google_booking_confirmed ? 'active' : 'setup'}
      >
        <div className="space-y-4">
          <div>
            <p className="text-[13px] font-medium text-ink mb-1.5">A foglalási link, amit be kell illesztened</p>
            <UrlRow url={bookingUrl} />
          </div>
          <Steps steps={[
            <>Nyisd meg a <a href="https://business.google.com" target="_blank" rel="noopener" className="text-gold underline underline-offset-2">business.google.com</a> oldalt és jelentkezz be a céges Google-fiókoddal</>,
            'Válaszd ki a vállalkozásod a listából',
            <>A bal menüben kattints: <strong>Foglalások</strong> (vagy <em>Booking</em>)<br /><span className="text-[12px] text-ink-soft">Ha nem látod, keresd a „Foglalás gomb" menüpontot</span></>,
            <>Válaszd ki a szolgáltatót: <strong>„Saját webhely link"</strong> vagy <strong>„Egyedi link"</strong>, majd illeszd be a fenti URL-t</>,
            <>Mentsd el — a <strong>„Foglalj most"</strong> gomb néhány órán belül megjelenik a Google listingeden</>,
          ]} />
          <a
            href="https://support.google.com/business/answer/9308244"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Google súgó: Foglalás gomb beállítása
          </a>
          {/* Ezt a lépést a tulaj a SAJÁT Google-fiókjában végzi el — nálunk nincs API/webhook,
              ami ellenőrizné, hogy megtörtént-e. A fenti "Aktív"/"Beállítható" jelvény ezért
              ÖNBEVALLÁS: csak azt mutatja, amit a tulaj maga jelzett, nem egy valós állapot-
              lekérdezést. Ezt itt is kimondjuk, hogy ne tűnjön automatikus ellenőrzésnek. */}
          <div className="flex items-center justify-between gap-3 rounded-[12px] bg-paper px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-ink">Megerősítem, hogy beállítottam</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-soft2">
                Ezt nem tudjuk automatikusan ellenőrizni (a Google saját fiókodban történik) — ez a jelzés csak a te megerősítésed.
              </p>
            </div>
            <Toggle checked={googleBookingConfirmed} onChange={() => setGoogleBookingConfirmed((v) => !v)} label="Foglalj most gomb beállítva" />
          </div>
        </div>
      </IntegCard>
    </div>
  )
}
