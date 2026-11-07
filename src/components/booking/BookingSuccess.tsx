'use client'

import { useContext, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CalendarPlus, Check, Clock } from 'lucide-react'
import { Button, IconCircle } from '@/components/ui-kit'
import { ACCENT, cardTone, type LiveCard } from '@/components/blocks/public'
import { makeT, type Locale } from '@/lib/i18n'
import { EditableText, PageTexts, Txt } from './EditableText'

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
  locale, confirmed, hasEmail, confirmEmailEnabled, reminderHours, summary, icsHref, onDone, card = 'dark', className = '',
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
  /** a foglaló kártya stílusa (design 21.2) */
  card?: LiveCard
  className?: string
}) {
  const tt = makeT(locale)
  const c = cardTone(card)
  const texts = useContext(PageTexts)
  // design 21.7 „Kész”: pipa a márkaszínben (jóváhagyásra várva óra), cím, a foglalás egy sorban, Naptárba / Kész
  return (
    <div data-edit-id="confirm" className={`flex flex-col items-center px-1 py-6 text-center ${className}`}>
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
        <IconCircle size="lg" icon={confirmed ? Check : Clock} className={confirmed ? ACCENT : ''} tone={confirmed ? undefined : c.dark ? 'onDark' : 'cell'} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} className="w-full min-w-0">
        {/* a köszönő cím: az üzlet saját szövege és színe (a szerkesztőben helyben írható), különben az alap */}
        {confirmed
          ? <EditableText as="div" id="successTitle" single rich value={texts.successTitle ?? tt('public.success.title')} className="mt-4 text-ui-sub font-light [overflow-wrap:anywhere]" style={texts.successColor ? { color: texts.successColor } : undefined} />
          : <div className="mt-4 text-ui-sub font-light [overflow-wrap:anywhere]"><Txt k="public.success.titlePending">{tt('public.success.titlePending')}</Txt></div>}
        <p className={`mt-1 text-ui-meta leading-relaxed ${c.meta}`}>
          {confirmed ? tt('public.success.welcome') : tt('public.success.pendingBody')}
          {hasEmail && confirmEmailEnabled && <> {confirmed ? tt('public.success.subtitle') : tt('public.success.emailLater')}</>}
        </p>
        {summary && <div className={`mt-5 px-4 py-4 text-left text-ui-body [overflow-wrap:anywhere] ${c.row}`}>{summary}</div>}
        {hasEmail && reminderHours.length > 0 && (
          <p className={`mt-3 text-ui-label leading-relaxed ${c.meta}`}>{tt('public.success.reminder', { when: reminderWhen(locale, reminderHours) })}</p>
        )}
        <div className="mt-4 grid w-full grid-cols-2 gap-1.5">
          {icsHref && <Button variant={c.dark ? 'onDark' : 'cell'} icon={CalendarPlus} href={icsHref}><Txt k="email.addToCalendar">{tt('email.addToCalendar')}</Txt></Button>}
          <Button variant={c.dark ? 'onDark' : 'cell'} onClick={onDone} className={icsHref ? '' : 'col-span-2'}><Txt k="public.success.done">{tt('public.success.done')}</Txt></Button>
        </div>
      </motion.div>
    </div>
  )
}
