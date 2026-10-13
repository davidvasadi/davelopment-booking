'use client'

import { useEffect, useState } from 'react'
import { Eye, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocaleEditBar } from './LocaleEditBar'
import { EmailVariablesHelp } from './EmailVariablesHelp'
import { SubnavPicker } from './SubnavPicker'
import type { useLocalizedFields } from './useLocalizedFields'
import { LOCALE_LABELS, type Locale } from '@/lib/i18n'
import { NewsletterBlockEditor } from '@/components/dashboard/NewsletterBlockEditor'
import type { ComposerBlock } from '@/lib/emailBlocks'

type Loc = ReturnType<typeof useLocalizedFields>

// Crextio/Apple mező (egységes a formokéval): tiszta fehér + meleg keret + arany fókusz.
const inputClass =
  'h-[50px] w-full rounded-dav-chip bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 transition-colors focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60'
const labelClass = 'text-[12.5px] font-medium text-ink-soft'

/** A szerkeszthető vendég-emailek — mindegyik tárgya + bevezetője nyelvenként. A `state`
 *  a /api/email-preview vázát választja; a `*_email_*` mezők a `LocalizedValues` kulcsai.
 *  A `subjectPh`/`introPh` az "Alapszöveg beillesztése" gomb NYELVENKÉNTI mintaszövege — a
 *  gomb a jelenleg szerkesztett `loc.editLocale`-nak megfelelő variánst szúrja be, nem
 *  csak a magyart. */
type SubjectField = 'booking_email_subject' | 'cancel_email_subject' | 'reminder_email_subject' | 'feedback_email_subject' | 'notify_email_subject'
type IntroField = 'booking_email_intro' | 'cancel_email_intro' | 'reminder_email_intro' | 'feedback_email_intro' | 'notify_email_intro'
type LocalizedPreset = Record<Locale, string>
/** Egy sablon-bekezdés típusa+szövege — a "Sablon betöltése" ebből épít valódi, szerkeszthető
 *  blokk-tömböt (nem sima 1-bekezdéses szöveget, hanem tagolt, alcím+törzs felépítést). */
type TemplatePara = { type: 'subtitle' | 'text'; text: string }
type LocalizedTemplate = Record<Locale, TemplatePara[]>
type EmailTypeDef = {
  key: string
  state: string
  label: string
  subjectField: SubjectField
  introField: IntroField
  subjectPh: LocalizedPreset
  introPh: LocalizedTemplate
  hint: string
}
function templateToBlocks(paras: TemplatePara[]): ComposerBlock[] {
  return paras.map((p) => ({ id: nextTemplateId(), type: p.type, html: p.text }))
}
let templateIdCounter = 0
function nextTemplateId(): string {
  templateIdCounter += 1
  return `tpl-${Date.now()}-${templateIdCounter}`
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
      hu: [
        { type: 'subtitle', text: 'Már alig várjuk, hogy találkozzunk!' },
        { type: 'text', text: 'Örülünk, hogy nálunk foglaltál, {{name}}! Lent megtalálod a foglalásod minden részletét, és a naptáradba is könnyen felveheted a mellékelt .ics fájllal. Ha bármi közbejönne, a lemondás linkje ezen az emailen keresztül bármikor elérhető — és a foglalás előtt emlékeztetőt is küldünk, hogy semmi ne csússzon el.' },
      ],
      en: [
        { type: 'subtitle', text: "We can't wait to see you!" },
        { type: 'text', text: "Thanks for booking with us, {{name}}! You'll find all the details of your booking below, and you can add it straight to your calendar with the attached .ics file. If anything changes, the cancellation link is always available in this email — and we'll also send a reminder before your visit so nothing slips through." },
      ],
      de: [
        { type: 'subtitle', text: 'Wir freuen uns schon sehr auf dich!' },
        { type: 'text', text: 'Danke für deine Buchung, {{name}}! Unten findest du alle Details zu deinem Termin, den du mit der beigefügten .ics-Datei direkt in deinen Kalender übernehmen kannst. Falls sich etwas ändert, findest du den Stornierungslink jederzeit in dieser E-Mail — und vor deinem Termin schicken wir dir außerdem eine Erinnerung.' },
      ],
      es: [
        { type: 'subtitle', text: '¡Estamos deseando verte!' },
        { type: 'text', text: '¡Gracias por reservar con nosotros, {{name}}! Abajo encontrarás todos los detalles de tu reserva, y puedes añadirla directamente a tu calendario con el archivo .ics adjunto. Si algo cambia, el enlace de cancelación está siempre disponible en este correo — y también te enviaremos un recordatorio antes de tu visita.' },
      ],
      it: [
        { type: 'subtitle', text: 'Non vediamo l\'ora di rivederti!' },
        { type: 'text', text: 'Grazie per aver prenotato da noi, {{name}}! Qui sotto trovi tutti i dettagli della tua prenotazione, che puoi aggiungere subito al calendario con il file .ics allegato. Se qualcosa dovesse cambiare, il link per annullare è sempre disponibile in questa email — e prima della tua visita ti invieremo anche un promemoria.' },
      ],
      fr: [
        { type: 'subtitle', text: 'Nous avons hâte de vous accueillir !' },
        { type: 'text', text: 'Merci pour votre réservation, {{name}} ! Vous trouverez ci-dessous tous les détails de votre réservation, que vous pouvez ajouter directement à votre agenda grâce au fichier .ics joint. Si quoi que ce soit change, le lien d\'annulation reste toujours accessible dans cet e-mail — et nous vous enverrons également un rappel avant votre venue.' },
      ],
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
      hu: [
        { type: 'subtitle', text: 'Sajnáljuk, hogy most nem találkozunk.' },
        { type: 'text', text: 'A lenti foglalásodat, {{name}}, sikeresen lemondtuk — semmilyen további teendőd nincs. Ha csak az időpont nem volt megfelelő, szívesen segítünk másikat találni: nézz vissza hozzánk, amikor kényelmes!' },
      ],
      en: [
        { type: 'subtitle', text: "We're sorry we won't see you this time." },
        { type: 'text', text: "Your booking below, {{name}}, has been successfully cancelled — no further action is needed. If it was just the timing that didn't work, we'd be happy to help you find a new slot: come back and book whenever it suits you!" },
      ],
      de: [
        { type: 'subtitle', text: 'Schade, dass wir uns diesmal nicht sehen.' },
        { type: 'text', text: 'Deine untenstehende Buchung, {{name}}, wurde erfolgreich storniert — du musst nichts weiter tun. Falls es nur der Zeitpunkt war, der nicht gepasst hat, helfen wir dir gerne, einen neuen Termin zu finden: buch einfach wieder, wann es dir passt!' },
      ],
      es: [
        { type: 'subtitle', text: 'Sentimos no verte esta vez.' },
        { type: 'text', text: 'Tu reserva de abajo, {{name}}, se ha cancelado correctamente — no necesitas hacer nada más. Si solo era la hora la que no encajaba, con gusto te ayudamos a encontrar otro momento: ¡vuelve a reservar cuando te venga bien!' },
      ],
      it: [
        { type: 'subtitle', text: 'Ci dispiace non vederti questa volta.' },
        { type: 'text', text: 'La tua prenotazione qui sotto, {{name}}, è stata annullata con successo — non devi fare altro. Se era solo l\'orario a non andare bene, siamo felici di aiutarti a trovarne un altro: torna a prenotare quando preferisci!' },
      ],
      fr: [
        { type: 'subtitle', text: "Nous sommes désolés de ne pas vous voir cette fois-ci." },
        { type: 'text', text: "Votre réservation ci-dessous, {{name}}, a bien été annulée — vous n'avez rien d'autre à faire. Si seul le créneau ne convenait pas, nous serons ravis de vous aider à en trouver un autre : revenez réserver quand cela vous arrangera !" },
      ],
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
      hu: [
        { type: 'subtitle', text: 'Már csak egy kis idő van hátra!' },
        { type: 'text', text: 'Csak szerettünk volna emlékeztetni, {{name}}, hogy hamarosan itt a foglalásod időpontja. Ha közben bármi változna, a lemondás linkje ezen az emailen keresztül elérhető — de reméljük, hamarosan találkozunk!' },
      ],
      en: [
        { type: 'subtitle', text: 'Not long to go now!' },
        { type: 'text', text: "Just a quick reminder, {{name}}, that your booking is coming up soon. If anything changes in the meantime, the cancellation link is available in this email — but we hope to see you very soon!" },
      ],
      de: [
        { type: 'subtitle', text: 'Es dauert nicht mehr lange!' },
        { type: 'text', text: 'Nur eine kurze Erinnerung, {{name}}: dein Termin steht bald an. Falls sich in der Zwischenzeit etwas ändert, findest du den Stornierungslink in dieser E-Mail — aber wir hoffen, dich bald zu sehen!' },
      ],
      es: [
        { type: 'subtitle', text: '¡Ya queda poco!' },
        { type: 'text', text: 'Solo un pequeño recordatorio, {{name}}: tu reserva se acerca. Si algo cambia mientras tanto, el enlace de cancelación está disponible en este correo — ¡pero esperamos verte muy pronto!' },
      ],
      it: [
        { type: 'subtitle', text: 'Manca sempre meno!' },
        { type: 'text', text: 'Solo un breve promemoria, {{name}}: la tua prenotazione si avvicina. Se qualcosa dovesse cambiare nel frattempo, il link per annullare è disponibile in questa email — ma speriamo di vederti molto presto!' },
      ],
      fr: [
        { type: 'subtitle', text: 'Ça approche à grands pas !' },
        { type: 'text', text: "Un petit rappel, {{name}} : votre réservation approche. Si quoi que ce soit change d'ici là, le lien d'annulation est disponible dans cet e-mail — mais nous espérons vous voir très bientôt !" },
      ],
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
      hu: [
        { type: 'subtitle', text: 'Köszönjük, hogy nálunk jártál!' },
        { type: 'text', text: 'Reméljük, jól érezted magad, {{name}}! A véleményed sokat számít nekünk — segít abban, hogy még jobbak legyünk, és másoknak is megmutatja, milyen nálunk. Ha van egy perced, oszd meg velünk!' },
      ],
      en: [
        { type: 'subtitle', text: 'Thanks for visiting us!' },
        { type: 'text', text: "We hope you had a great time, {{name}}! Your feedback means a lot to us — it helps us improve and shows others what it's like to visit us. If you have a minute, we'd love to hear from you!" },
      ],
      de: [
        { type: 'subtitle', text: 'Danke für deinen Besuch!' },
        { type: 'text', text: 'Wir hoffen, es hat dir gefallen, {{name}}! Dein Feedback bedeutet uns viel — es hilft uns, besser zu werden, und zeigt anderen, wie es bei uns ist. Wenn du eine Minute Zeit hast, freuen wir uns über deine Meinung!' },
      ],
      es: [
        { type: 'subtitle', text: '¡Gracias por visitarnos!' },
        { type: 'text', text: 'Esperamos que lo hayas pasado genial, {{name}}. Tu opinión significa mucho para nosotros — nos ayuda a mejorar y muestra a otros cómo es venir a vernos. ¡Si tienes un minuto, nos encantaría saber qué te pareció!' },
      ],
      it: [
        { type: 'subtitle', text: 'Grazie per essere venuto/a da noi!' },
        { type: 'text', text: 'Speriamo tu ti sia trovato/a bene, {{name}}! La tua opinione conta molto per noi — ci aiuta a migliorare e mostra agli altri com\'è venire da noi. Se hai un minuto, ci farebbe piacere sapere cosa ne pensi!' },
      ],
      fr: [
        { type: 'subtitle', text: 'Merci pour votre visite !' },
        { type: 'text', text: 'Nous espérons que vous avez passé un bon moment, {{name}} ! Votre avis compte beaucoup pour nous — il nous aide à nous améliorer et montre à d\'autres à quoi ressemble une visite chez nous. Si vous avez une minute, nous serions ravis de vous lire !' },
      ],
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
      hu: [
        { type: 'subtitle', text: 'Új foglalás érkezett — érdemes átnézni.' },
        { type: 'text', text: 'Az alábbiakban találod a foglalás részleteit. Ha szükséges, a naptáradban bármikor módosíthatod vagy visszaigazolhatod — érdemes időben ránézni, hogy minden készen álljon.' },
      ],
      en: [{ type: 'subtitle', text: '' }, { type: 'text', text: '' }],
      de: [{ type: 'subtitle', text: '' }, { type: 'text', text: '' }],
      es: [{ type: 'subtitle', text: '' }, { type: 'text', text: '' }],
      it: [{ type: 'subtitle', text: '' }, { type: 'text', text: '' }],
      fr: [{ type: 'subtitle', text: '' }, { type: 'text', text: '' }],
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
  scope = 'all',
}: {
  variant: 'restaurant' | 'salon'
  loc: Loc
  onPreview: (state: string, intro: ComposerBlock[]) => void
  /** `guest` = csak a vendégnek menő levelek (Vendég e-mailek), `owner` = csak a tulajnak szóló
   *  Értesítő (Értesítések), `all` = mind (régi, önálló form). */
  scope?: 'all' | 'guest' | 'owner'
}) {
  const types = scope === 'all' ? EMAIL_TYPES : EMAIL_TYPES.filter((et) => SINGLE_LANGUAGE_KEYS.has(et.key) === (scope === 'owner'))
  const [sel, setSel] = useState<EmailTypeDef>(types[0])
  const isSingleLanguage = SINGLE_LANGUAGE_KEYS.has(sel.key)
  // Csak-magyar sablonnal nyílt (Értesítések) → a szerkesztési nyelv is HU legyen.
  useEffect(() => {
    if (isSingleLanguage && loc.editLocale !== 'hu') loc.selectLocale('hu')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSingleLanguage])
  const subject = loc.current[sel.subjectField]
  const intro = loc.current[sel.introField]
  const subjectPh = sel.subjectPh[isSingleLanguage ? 'hu' : loc.editLocale]
  const introPh = sel.introPh[isSingleLanguage ? 'hu' : loc.editLocale]

  const selectType = (key: string) => {
    const et = types.find((t) => t.key === key)
    if (!et) return
    setSel(et)
    if (SINGLE_LANGUAGE_KEYS.has(et.key) && loc.editLocale !== 'hu') loc.selectLocale('hu')
  }

  return (
    <div className="space-y-4">
      {/* Email-típus választó — egyetlen típusnál nincs mit váltani. Mobilon a globális
          fejlécbe portálozott ikon-gomb (sheet-tel), desktopon a megszokott pill-sor (lg:flex,
          lásd SubnavPicker). */}
      {types.length > 1 && (
      <>
        <SubnavPicker
          items={types.map((et) => ({ id: et.key, label: et.label }))}
          activeId={sel.key}
          onSelect={selectType}
          title="Email-sablon"
          icon={Mail}
        />
        <div className="-mx-1 hidden gap-1.5 overflow-x-auto px-1 no-scrollbar lg:flex" data-lenis-prevent>
          {types.map((et) => (
            <button
              key={et.key}
              type="button"
              onClick={() => selectType(et.key)}
              className={`shrink-0 rounded-dav-pill px-4 py-2 text-[13px] font-semibold transition-colors ${
                sel.key === et.key ? 'bg-ink-dark text-white' : 'border border-line text-ink-soft2 hover:text-ink'
              }`}
            >
              {et.label}
            </button>
          ))}
        </div>
      </>
      )}
      <p className="text-xs text-ink-soft">{sel.hint}</p>

      {!isSingleLanguage && (
        <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            loc.setField(sel.subjectField, subjectPh)
            loc.setField(sel.introField, templateToBlocks(introPh))
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
        <Label className={labelClass}>Bevezető tartalom</Label>
        <div className="rounded-dav-chip border border-line-strong bg-white p-3">
          <NewsletterBlockEditor blocks={intro} onChange={(next) => loc.setField(sel.introField, next)} railMode="flow" />
        </div>
        <p className="text-xs text-ink-soft">Az email tetejére kerül, a foglalás részletei elé — ugyanaz a szerkesztő, mint a marketing hírlevélnél.</p>
      </div>

      <EmailVariablesHelp type={variant} />

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={() => onPreview(sel.state, intro)}
          className="inline-flex items-center gap-2 rounded-dav-sm border-[1.5px] border-line-strong px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper"
        >
          <Eye className="h-4 w-4" />
          {sel.label} előnézet
        </button>
      </div>
    </div>
  )
}
