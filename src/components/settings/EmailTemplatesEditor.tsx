'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LocaleEditBar } from './LocaleEditBar'
import { EmailVariablesHelp } from './EmailVariablesHelp'
import type { useLocalizedFields } from './useLocalizedFields'
import { LOCALE_LABELS, type Locale } from '@/lib/i18n'

type Loc = ReturnType<typeof useLocalizedFields>

// Crextio/Apple mező (egységes a formokéval): tiszta fehér + meleg keret + arany fókusz.
const inputClass =
  'h-[50px] w-full rounded-[14px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 transition-colors focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60'
const labelClass = 'text-[12.5px] font-medium text-ink-soft'

/** A szerkeszthető vendég-emailek — mindegyik tárgya + bevezetője nyelvenként. A `state`
 *  a /api/email-preview vázát választja; a `*_email_*` mezők a `LocalizedValues` kulcsai.
 *  A `subjectPh`/`introPh` az "Alapszöveg beillesztése" gomb NYELVENKÉNTI mintaszövege — a
 *  gomb a jelenleg szerkesztett `loc.editLocale`-nak megfelelő variánst szúrja be, nem
 *  csak a magyart. */
type SubjectField = 'booking_email_subject' | 'cancel_email_subject' | 'reminder_email_subject' | 'feedback_email_subject' | 'notify_email_subject'
type IntroField = 'booking_email_intro' | 'cancel_email_intro' | 'reminder_email_intro' | 'feedback_email_intro' | 'notify_email_intro'
type LocalizedPreset = Record<Locale, string>
type EmailTypeDef = {
  key: string
  state: string
  label: string
  subjectField: SubjectField
  introField: IntroField
  subjectPh: LocalizedPreset
  introPh: LocalizedPreset
  hint: string
}

const EMAIL_TYPES: EmailTypeDef[] = [
  {
    key: 'confirm', state: 'confirm', label: 'Visszaigazolás',
    subjectField: 'booking_email_subject', introField: 'booking_email_intro',
    subjectPh: {
      hu: 'Foglalás visszaigazolva — {{name}}',
      en: 'Booking confirmed — {{name}}',
      de: 'Buchung bestätigt — {{name}}',
      es: 'Reserva confirmada — {{name}}',
      it: 'Prenotazione confermata — {{name}}',
      fr: 'Réservation confirmée — {{name}}',
    },
    introPh: {
      hu: 'Kedves {{name}}!\n\nKöszönjük a foglalást, várunk szeretettel!',
      en: 'Dear {{name}},\n\nThank you for your booking, we look forward to seeing you!',
      de: 'Liebe/r {{name}},\n\nvielen Dank für deine Buchung, wir freuen uns auf dich!',
      es: 'Hola {{name}},\n\n¡Gracias por tu reserva, te esperamos con gusto!',
      it: 'Gentile {{name}},\n\ngrazie per la prenotazione, ti aspettiamo con piacere!',
      fr: 'Cher/Chère {{name}},\n\nmerci pour votre réservation, nous avons hâte de vous accueillir !',
    },
    hint: 'A foglalás rögzítésekor megy ki, .ics naptár-melléklettel.',
  },
  {
    key: 'cancel', state: 'cancel', label: 'Lemondás',
    subjectField: 'cancel_email_subject', introField: 'cancel_email_intro',
    subjectPh: {
      hu: 'Foglalásod lemondva',
      en: 'Your booking has been cancelled',
      de: 'Deine Buchung wurde storniert',
      es: 'Tu reserva ha sido cancelada',
      it: 'La tua prenotazione è stata annullata',
      fr: 'Votre réservation a été annulée',
    },
    introPh: {
      hu: 'Kedves {{name}}!\n\nA foglalásodat lemondtuk.',
      en: 'Dear {{name}},\n\nYour booking has been cancelled.',
      de: 'Liebe/r {{name}},\n\ndeine Buchung wurde storniert.',
      es: 'Hola {{name}},\n\ntu reserva ha sido cancelada.',
      it: 'Gentile {{name}},\n\nla tua prenotazione è stata annullata.',
      fr: 'Cher/Chère {{name}},\n\nvotre réservation a été annulée.',
    },
    hint: 'A foglalás lemondásakor megy ki a vendégnek.',
  },
  {
    key: 'reminder', state: 'reminder', label: 'Emlékeztető',
    subjectField: 'reminder_email_subject', introField: 'reminder_email_intro',
    subjectPh: {
      hu: 'Emlékeztető: közeleg a foglalásod',
      en: 'Reminder: your booking is coming up',
      de: 'Erinnerung: dein Termin steht bevor',
      es: 'Recordatorio: tu reserva se acerca',
      it: 'Promemoria: la tua prenotazione si avvicina',
      fr: 'Rappel : votre réservation approche',
    },
    introPh: {
      hu: 'Kedves {{name}}!\n\nCsak emlékeztetünk: hamarosan várunk!',
      en: 'Dear {{name}},\n\nJust a quick reminder: we look forward to seeing you soon!',
      de: 'Liebe/r {{name}},\n\nnur zur Erinnerung: wir freuen uns bald auf dich!',
      es: 'Hola {{name}},\n\nsolo un recordatorio: ¡te esperamos pronto!',
      it: 'Gentile {{name}},\n\nsolo un promemoria: ti aspettiamo presto!',
      fr: 'Cher/Chère {{name}},\n\nun petit rappel : nous avons hâte de vous voir bientôt !',
    },
    hint: 'A foglalás előtt megy ki — az időzítést a „Foglalási funkciók" szekcióban állítod.',
  },
  {
    key: 'feedback', state: 'feedback', label: 'Visszajelzés',
    subjectField: 'feedback_email_subject', introField: 'feedback_email_intro',
    subjectPh: {
      hu: 'Milyen volt nálunk?',
      en: 'How was your visit?',
      de: 'Wie war dein Besuch bei uns?',
      es: '¿Qué tal tu visita?',
      it: 'Com\'è andata la tua visita?',
      fr: 'Comment s\'est passée votre visite ?',
    },
    introPh: {
      hu: 'Kedves {{name}}!\n\nReméljük jól érezted magad. Mondd el a véleményed!',
      en: 'Dear {{name}},\n\nWe hope you had a great time. Let us know what you think!',
      de: 'Liebe/r {{name}},\n\nwir hoffen, es hat dir gefallen. Lass uns gerne dein Feedback da!',
      es: 'Hola {{name}},\n\nesperamos que lo hayas pasado genial. ¡Cuéntanos qué te pareció!',
      it: 'Gentile {{name}},\n\nsperiamo tu ti sia trovato bene. Facci sapere cosa ne pensi!',
      fr: 'Cher/Chère {{name}},\n\nnous espérons que vous avez passé un bon moment. Dites-nous ce que vous en pensez !',
    },
    hint: 'A látogatás után megy ki — a „Foglalási funkciók" szekcióban kapcsolható be.',
  },
  {
    key: 'notify', state: 'notify', label: 'Értesítő',
    subjectField: 'notify_email_subject', introField: 'notify_email_intro',
    subjectPh: {
      hu: 'Új foglalás: {{name}} — {{date}} {{time}}',
      en: 'New booking: {{name}} — {{date}} {{time}}',
      de: 'Neue Buchung: {{name}} — {{date}} {{time}}',
      es: 'Nueva reserva: {{name}} — {{date}} {{time}}',
      it: 'Nuova prenotazione: {{name}} — {{date}} {{time}}',
      fr: 'Nouvelle réservation : {{name}} — {{date}} {{time}}',
    },
    introPh: {
      hu: 'Új foglalás érkezett. Kérlek ellenőrizd és készülj fel!',
      en: 'A new booking has arrived. Please check the details and get ready!',
      de: 'Eine neue Buchung ist eingegangen. Bitte prüfe die Details und bereite dich vor!',
      es: 'Ha llegado una nueva reserva. Revisa los detalles y prepárate.',
      it: 'È arrivata una nuova prenotazione. Controlla i dettagli e preparati!',
      fr: 'Une nouvelle réservation est arrivée. Merci de vérifier les détails et de vous préparer !',
    },
    hint: 'A tulajdonosnak (+ szakembernek) megy ki minden új foglalásnál — nekik, nem a vendégnek, ezért ez a sablon nem nyelvfüggő, mindig magyarul megy ki. Az alapértelmezett tárgy és szöveg akkor is küld, ha üresen hagyod.',
  },
]

/** Az "Értesítő" (`notify`) mindig a tulajnak/a szakembernek megy ki, sose a vendégnek — ezért
 *  ennél nincs értelme nyelvi fülnek, mindig magyarul megy ki. */
const SINGLE_LANGUAGE_KEYS = new Set(['notify'])

/**
 * Az összes szerkeszthető vendég-email tartalom-szerkesztője (közös salon + restaurant).
 * Felül email-típus váltó, alatta az adott típus tárgya + bevezetője a nyelvváltóval. A HU a
 * baseline, a többi nyelv a `useLocalizedFields` hookon át (ugyanaz a `?locale=` mentés-út).
 */
export function EmailTemplatesEditor({
  variant,
  loc,
  onPreview,
}: {
  variant: 'restaurant' | 'salon'
  loc: Loc
  onPreview: (state: string, intro: string) => void
}) {
  const [sel, setSel] = useState<EmailTypeDef>(EMAIL_TYPES[0])
  const isSingleLanguage = SINGLE_LANGUAGE_KEYS.has(sel.key)
  const subject = loc.current[sel.subjectField]
  const intro = loc.current[sel.introField]
  const subjectPh = sel.subjectPh[isSingleLanguage ? 'hu' : loc.editLocale]
  const introPh = sel.introPh[isSingleLanguage ? 'hu' : loc.editLocale]

  return (
    <div className="space-y-4">
      {/* Email-típus választó (pill-sor) */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 no-scrollbar" data-lenis-prevent>
        {EMAIL_TYPES.map((et) => (
          <button
            key={et.key}
            type="button"
            onClick={() => {
              setSel(et)
              if (SINGLE_LANGUAGE_KEYS.has(et.key) && loc.editLocale !== 'hu') loc.selectLocale('hu')
            }}
            className={`shrink-0 rounded-dav-pill px-4 py-2 text-[13px] font-semibold transition-colors ${
              sel.key === et.key ? 'bg-ink-dark text-white' : 'border border-line text-ink-soft2 hover:text-ink'
            }`}
          >
            {et.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-soft">{sel.hint}</p>

      {!isSingleLanguage && (
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            loc.setField(sel.subjectField, subjectPh)
            loc.setField(sel.introField, introPh)
          }}
          className="shrink-0 text-[11.5px] font-semibold text-ink-soft2 underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
        >
          {isSingleLanguage ? 'Sablon betöltése' : `Sablon betöltése (${LOCALE_LABELS[loc.editLocale]})`}
        </button>
      </div>

      <div className="space-y-1.5">
        <Label className={labelClass}>Email tárgya</Label>
        <Input
          className={inputClass}
          value={subject}
          onChange={(e) => loc.setField(sel.subjectField, e.target.value)}
          placeholder={subjectPh}
        />
        <p className="text-xs text-ink-soft">Üresen hagyva az alapértelmezett tárgy megy ki.</p>
      </div>

      <div className="space-y-1.5">
        <Label className={labelClass}>Bevezető szöveg</Label>
        <Textarea
          className={inputClass + ' min-h-28 py-3'}
          value={intro}
          onChange={(e) => loc.setField(sel.introField, e.target.value)}
          placeholder={introPh}
        />
        <p className="text-xs text-ink-soft">Az email tetejére kerül, a foglalás részletei elé.</p>
      </div>

      <EmailVariablesHelp type={variant} />

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onPreview(sel.state, intro)}
          className="inline-flex items-center gap-2 rounded-[13px] border-[1.5px] border-line-strong px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper"
        >
          <Eye className="h-4 w-4" />
          {sel.label} előnézet
        </button>
      </div>
    </div>
  )
}
