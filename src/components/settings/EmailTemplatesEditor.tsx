'use client'

import { useState } from 'react'
import { Eye } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { LocaleEditBar } from './LocaleEditBar'
import { EmailVariablesHelp } from './EmailVariablesHelp'
import type { useLocalizedFields } from './useLocalizedFields'

type Loc = ReturnType<typeof useLocalizedFields>

// Crextio/Apple mező (egységes a formokéval): tiszta fehér + meleg keret + arany fókusz.
const inputClass =
  'h-[50px] w-full rounded-[14px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 transition-colors focus-visible:ring-2 focus-visible:ring-gold/30 focus-visible:border-gold/60'
const labelClass = 'text-[12.5px] font-medium text-ink-soft'

/** A szerkeszthető vendég-emailek — mindegyik tárgya + bevezetője nyelvenként. A `state`
 *  a /api/email-preview vázát választja; a `*_email_*` mezők a `LocalizedValues` kulcsai. */
type SubjectField = 'booking_email_subject' | 'cancel_email_subject' | 'reminder_email_subject' | 'feedback_email_subject'
type IntroField = 'booking_email_intro' | 'cancel_email_intro' | 'reminder_email_intro' | 'feedback_email_intro'
type EmailTypeDef = {
  key: string
  state: string
  label: string
  subjectField: SubjectField
  introField: IntroField
  subjectPh: string
  introPh: string
  hint: string
}

const EMAIL_TYPES: EmailTypeDef[] = [
  {
    key: 'confirm', state: 'confirm', label: 'Visszaigazolás',
    subjectField: 'booking_email_subject', introField: 'booking_email_intro',
    subjectPh: 'Foglalás visszaigazolva — {{name}}',
    introPh: 'Kedves {{name}}!\n\nKöszönjük a foglalást, várunk szeretettel!',
    hint: 'A foglalás rögzítésekor megy ki, .ics naptár-melléklettel.',
  },
  {
    key: 'cancel', state: 'cancel', label: 'Lemondás',
    subjectField: 'cancel_email_subject', introField: 'cancel_email_intro',
    subjectPh: 'Foglalásod lemondva',
    introPh: 'Kedves {{name}}!\n\nA foglalásodat lemondtuk.',
    hint: 'A foglalás lemondásakor megy ki a vendégnek.',
  },
  {
    key: 'reminder', state: 'reminder', label: 'Emlékeztető',
    subjectField: 'reminder_email_subject', introField: 'reminder_email_intro',
    subjectPh: 'Emlékeztető: közeleg a foglalásod',
    introPh: 'Kedves {{name}}!\n\nCsak emlékeztetünk: hamarosan várunk!',
    hint: 'A foglalás előtt megy ki — az időzítést a „Foglalási funkciók" szekcióban állítod.',
  },
  {
    key: 'feedback', state: 'feedback', label: 'Visszajelzés',
    subjectField: 'feedback_email_subject', introField: 'feedback_email_intro',
    subjectPh: 'Milyen volt nálunk?',
    introPh: 'Kedves {{name}}!\n\nReméljük jól érezted magad. Mondd el a véleményed!',
    hint: 'A látogatás után megy ki — a „Foglalási funkciók" szekcióban kapcsolható be.',
  },
]

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
  const subject = loc.current[sel.subjectField]
  const intro = loc.current[sel.introField]

  return (
    <div className="space-y-4">
      {/* Email-típus választó (pill-sor) */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 no-scrollbar" data-lenis-prevent>
        {EMAIL_TYPES.map((et) => (
          <button
            key={et.key}
            type="button"
            onClick={() => setSel(et)}
            className={`shrink-0 rounded-dav-pill px-4 py-2 text-[13px] font-semibold transition-colors ${
              sel.key === et.key ? 'bg-ink-dark text-white' : 'border border-line text-ink-soft2 hover:text-ink'
            }`}
          >
            {et.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-soft">{sel.hint}</p>

      <LocaleEditBar available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />

      <div className="space-y-1.5">
        <Label className={labelClass}>Email tárgya</Label>
        <Input
          className={inputClass}
          value={subject}
          onChange={(e) => loc.setField(sel.subjectField, e.target.value)}
          placeholder={sel.subjectPh}
        />
        <p className="text-xs text-ink-soft">Üresen hagyva az alapértelmezett tárgy megy ki.</p>
      </div>

      <div className="space-y-1.5">
        <Label className={labelClass}>Bevezető szöveg</Label>
        <Textarea
          className={inputClass + ' min-h-28 py-3'}
          value={intro}
          onChange={(e) => loc.setField(sel.introField, e.target.value)}
          placeholder={sel.introPh}
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
