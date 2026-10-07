'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, Clock } from 'lucide-react'
import { makeT, type Locale } from '@/lib/i18n'

/** „24 órával és 2 nappal” — az emlékeztető-időzítés szövege a visszaigazoló képernyőn. */
const REMINDER_WORDS: Record<string, { h: string; d: string; and: string }> = {
  hu: { h: 'órával', d: 'nappal', and: 'és' },
  en: { h: 'hours', d: 'days', and: 'and' },
  de: { h: 'Stunden', d: 'Tage', and: 'und' },
  es: { h: 'horas', d: 'días', and: 'y' },
  fr: { h: 'heures', d: 'jours', and: 'et' },
  it: { h: 'ore', d: 'giorni', and: 'e' },
}
function reminderWhen(locale: string, hours: number[]): string {
  const w = REMINDER_WORDS[locale] ?? REMINDER_WORDS.en
  const parts = hours.map((h) => (h >= 48 && h % 24 === 0 ? `${h / 24} ${w.d}` : `${h} ${w.h}`))
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${w.and} ${parts[parts.length - 1]}` : (parts[0] ?? '')
}

/**
 * A foglalás utáni visszaigazoló képernyő — KÖZÖS a szalon (`ProfileCard`) és az étterem
 * (`RestaurantCard`) foglalóján. Ikon + cím az automatikus megerősítés szerint, tájékoztatás az
 * e-mailről és az emlékeztetőről, a foglalás egy sorban, két egyforma gomb (naptár + kész).
 * Minden szöveg törik, keskeny telefonon sem lóg ki.
 */
export function BookingSuccess({
  locale, confirmed, hasEmail, confirmEmailEnabled, reminderHours, summary, icsHref, onDone, className = '',
}: {
  locale: Locale
  /** `false` = a tulaj még jóváhagyja (kikapcsolt automatikus megerősítés). */
  confirmed: boolean
  hasEmail: boolean
  confirmEmailEnabled: boolean
  reminderHours: number[]
  /** A foglalás egy sorban (pl. „Festés · Anna · okt. 7. 14:00”). */
  summary?: ReactNode
  /** .ics letöltés — null, ha nincs token. */
  icsHref: string | null
  onDone: () => void
  className?: string
}) {
  const tt = makeT(locale)
  return (
    <div data-edit-id="confirm" className={`flex min-h-[50vh] flex-col items-center justify-center px-1 py-8 text-center ${className}`}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: confirmed ? '#FFD85F' : 'rgba(255,255,255,0.85)' }}
      >
        {confirmed
          ? <Check className="h-8 w-8 text-ink-dark" strokeWidth={2.5} />
          : <Clock className="h-7 w-7 text-ink-dark" strokeWidth={2} />}
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="w-full min-w-0"
      >
        <h2 className="mb-2 text-2xl font-light tracking-[-0.01em] text-white [overflow-wrap:anywhere]">
          {confirmed ? tt('public.success.title') : tt('public.success.titlePending')}
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-white/60">
          {confirmed ? tt('public.success.welcome') : tt('public.success.pendingBody')}
          {hasEmail && confirmEmailEnabled && <> {confirmed ? tt('public.success.subtitle') : tt('public.success.emailLater')}</>}
        </p>
        {summary && (
          <div className="mb-3 rounded-[14px] px-4 py-3 text-[13px] leading-snug text-white/75 [overflow-wrap:anywhere]" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
            {summary}
          </div>
        )}
        {hasEmail && reminderHours.length > 0 && (
          <p className="mb-2 text-[12px] leading-relaxed text-white/50">
            {tt('public.success.reminder', { when: reminderWhen(locale, reminderHours) })}
          </p>
        )}
        <div className="mt-5 flex w-full gap-2">
          {icsHref && (
            <a
              href={icsHref}
              className="flex h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.16]"
              style={{ background: 'rgba(255,255,255,0.10)' }}
            >
              {tt('email.addToCalendar')}
            </a>
          )}
          <button
            type="button"
            onClick={onDone}
            className="flex h-12 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-white px-3 text-[14px] font-semibold text-ink-dark"
          >
            {tt('public.success.done')}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
