'use client'

import { useState } from 'react'
import { LocaleEditBar } from './LocaleEditBar'
import type { useLocalizedFields } from './useLocalizedFields'
import { GUEST_EMAIL_TEMPLATES, templateBlocks, type GuestEmailKind, type TemplateBlock } from '@/lib/guestEmailTemplates'
import { newBlock } from '@/components/dashboard/NewsletterBlockEditor'
import { useBlockInspector } from '@/components/dashboard/useBlockInspector'
import { BlockPalette, LetterBlocks, type InsertKind } from '@/components/blocks/marketing'
import { GuestEmailsPage, ReminderSettingsCard } from '@/components/blocks/settings'
import { Button, EmptyState, Input as KitInput, Note } from '@/components/ui-kit'
import { Mail, Undo2 } from 'lucide-react'
import { useSettingsFormContext } from './settingsFormContext'
import type { ComposerBlock } from '@/lib/emailBlocks'

type Loc = ReturnType<typeof useLocalizedFields>


/** A szerkeszthető vendég-emailek — mindegyik tárgya + bevezetője nyelvenként. A `state`
 *  a /api/email-preview vázát választja; a `*_email_*` mezők a `LocalizedValues` kulcsai.
 *  A `subjectPh`/`introPh` az "Alapszöveg beillesztése" gomb NYELVENKÉNTI mintaszövege — a
 *  gomb a jelenleg szerkesztett `loc.editLocale`-nak megfelelő variánst szúrja be, nem
 *  csak a magyart. */
type SubjectField = 'booking_email_subject' | 'cancel_email_subject' | 'reminder_email_subject' | 'feedback_email_subject' | 'notify_email_subject'
type IntroField = 'booking_email_intro' | 'cancel_email_intro' | 'reminder_email_intro' | 'feedback_email_intro' | 'notify_email_intro'
type EmailTypeDef = {
  key: GuestEmailKind
  state: string
  label: string
  subjectField: SubjectField
  introField: IntroField
  hint: string
}
/** A sablon vázlata → szerkeszthető blokkok: szöveg, a foglalás adatai, gombok (a második világos), apró szürke sor. */
function templateToBlocks(parts: TemplateBlock[]): ComposerBlock[] {
  return parts.map((p): ComposerBlock => {
    const id = nextTemplateId()
    if (p.type === 'booking_details') return { id, type: 'booking_details' }
    if (p.type === 'button') return { id, type: 'button', label: p.label, url: p.url, width: 'auto' }
    if (p.type === 'button_row') return { id, type: 'button_row', items: p.items.map((it) => ({ label: it.label, url: it.url, ...(it.secondary ? { bg: '#EEEEEE', color: '#383838' } : {}) })) }
    if (p.type === 'small') return { id, type: 'text', html: p.html, fontSize: 12, color: '#828282' }
    return { id, type: p.type, html: p.text }
  })
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
    hint: 'A foglalás rögzítésekor megy ki, .ics naptár-melléklettel.',
  },
  {
    key: 'cancel', state: 'cancel', label: 'Lemondás',
    subjectField: 'cancel_email_subject', introField: 'cancel_email_intro',
    hint: 'A foglalás lemondásakor megy ki a vendégnek.',
  },
  {
    key: 'reminder', state: 'reminder', label: 'Emlékeztető',
    subjectField: 'reminder_email_subject', introField: 'reminder_email_intro',
    hint: 'A foglalás előtt megy ki — az időzítést a „Foglalási funkciók" szekcióban állítod.',
  },
  {
    key: 'feedback', state: 'feedback', label: 'Visszajelzés',
    subjectField: 'feedback_email_subject', introField: 'feedback_email_intro',
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
  sender = '',
  logo = null,
}: {
  variant: 'restaurant' | 'salon'
  loc: Loc
  onPreview: (state: string, intro: ComposerBlock[]) => void
  /** a feladó (az üzlet neve) és a logója — a Vendég e-mailek lap levelén */
  sender?: string
  logo?: string | null
}) {
  const ctl = useSettingsFormContext()?.guestEmail
  if (!ctl) return null
  return <GuestEmails variant={variant} loc={loc} onPreview={onPreview} sender={sender} logo={logo} />
}

/* ── Vendég e-mailek (design 16.6): bal a levelek (Be / Ki), közép a szerkeszthető levél, jobb a beállítások ── */
const LETTER_KEYS = ['confirm', 'reminder', 'cancel', 'feedback', 'modification'] as const
type LetterKey = (typeof LETTER_KEYS)[number]
const TAGS: Record<'salon' | 'restaurant', [string, string][]> = {
  salon: [['vendég', '{{name}}'], ['üzlet', '{{business}}'], ['nap', '{{date}}'], ['idő', '{{time}}'], ['szolgáltatás', '{{service}}'], ['munkatárs', '{{staff}}']],
  restaurant: [['vendég', '{{name}}'], ['üzlet', '{{business}}'], ['nap', '{{date}}'], ['idő', '{{time}}'], ['létszám', '{{pax}}']],
}
// a levél gombjai (mint a kiküldött levélben: naptár + útvonalterv; a lemondás alatta apró, aláhúzott link — `CANCEL_LINK`)
const BUTTONS: Record<LetterKey, string[]> = { confirm: ['Naptárba', 'Útvonalterv'], reminder: ['Naptárba', 'Útvonalterv'], cancel: ['Új időpont'], feedback: ['Értékelem'], modification: ['Naptárba', 'Útvonalterv'] }
// a gomb linkje egy kattintással: a foglalás saját linkjei (a kiküldéskor töltődnek ki)
const LINK_PRESETS: [string, string][] = [['Naptárba', '{{calendar_url}}'], ['Útvonalterv', '{{directions_url}}'], ['Lemondás', '{{cancel_url}}'], ['Értékelés', '{{review_url}}'], ['Foglalóoldal', '{{booking_url}}'], ['Feltételek', '{{terms_url}}']]
const CANCEL_LINK: Record<LetterKey, boolean> = { confirm: true, reminder: true, cancel: false, feedback: false, modification: true }

function GuestEmails({ variant, loc, onPreview, sender, logo }: { variant: 'restaurant' | 'salon'; loc: Loc; onPreview: (state: string, intro: ComposerBlock[]) => void; sender: string; logo: string | null }) {
  const ctl = useSettingsFormContext()!.guestEmail!
  const [sel, setSel] = useState<LetterKey>('confirm')
  const [device, setDevice] = useState(0)
  const [focusId, setFocusId] = useState<string | null>(null)
  const et = EMAIL_TYPES.find((t) => t.key === sel) ?? null
  const r = ctl.reminder
  const hours = ([['48', r.t48], ['24', r.t24], ['3', r.t3]] as const).filter(([, on]) => on).map(([h]) => h)
  const when: Record<LetterKey, string> = {
    confirm: 'Azonnal, foglaláskor',
    reminder: hours.length ? `${hours.join(' és ')} órával előtte` : 'nincs időpont kiválasztva',
    cancel: 'Lemondáskor',
    feedback: ctl.feedbackDelayHours ? `${ctl.feedbackDelayHours} órával a látogatás után` : 'A látogatás után, értékelés-kérés',
    modification: 'Módosításkor',
  }
  const title: Record<LetterKey, string> = { confirm: 'Visszaigazolás', reminder: 'Emlékeztető', cancel: 'Lemondás', feedback: 'Visszajelzés', modification: 'Értesítő' }
  const intro = et ? loc.current[et.introField] : []
  const setIntro = (b: ComposerBlock[]) => { if (et) loc.setField(et.introField, b) }
  // a kijelölt blokk szerkesztése — ugyanaz, mint a Marketing kampány-szerkesztőjében
  const inspector = useBlockInspector({ blocks: intro, setBlocks: setIntro, focusId, logo, bizName: sender, linkPresets: LINK_PRESETS })
  const full = intro.some((b) => b.type === 'booking_details')
  // a kész sablon (szalon / étterem, a szerkesztett nyelven) — lib/guestEmailTemplates
  const tpl = et ? GUEST_EMAIL_TEMPLATES[et.key][variant][loc.editLocale] : null
  const subjectPh = tpl?.subject ?? ''
  // a beszúrható adat a kijelölt szöveg-blokk kurzorához (a levélben), különben a tárgy végére
  const insertTag = (token: string) => {
    const sel = window.getSelection()
    const host = sel?.anchorNode instanceof Node ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode as Element : sel.anchorNode.parentElement)?.closest('[contenteditable]') : null
    if (host) { document.execCommand('insertText', false, token); host.dispatchEvent(new Event('input', { bubbles: true })); return }
    if (et) loc.setField(et.subjectField, `${loc.current[et.subjectField] ?? ''} ${token}`.trim())
  }
  const add = (k: InsertKind) => {
    const b = newBlock(k === 'gallery' ? 'columns' : k === 'logo' ? 'image' : k === 'title' ? 'title' : (k as never))
    const i = focusId ? intro.findIndex((x) => x.id === focusId) : -1
    setIntro(i < 0 ? [...intro, b] : [...intro.slice(0, i + 1), b, ...intro.slice(i + 1)]); setFocusId(b.id)
  }
  const move = (id: string, dir: -1 | 1) => { const i = intro.findIndex((b) => b.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= intro.length) return; const n = [...intro]; [n[i], n[j]] = [n[j], n[i]]; setIntro(n) }
  // a foglalás adatai kötelező — nem törölhető
  const remove = (id: string) => setIntro(intro.filter((b) => b.id !== id || b.type === 'booking_details'))
  const loadTemplate = () => { if (!et) return; loc.setField(et.subjectField, subjectPh); loc.setField(et.introField, templateToBlocks(templateBlocks(et.key, variant, loc.editLocale))) }

  const letter = et ? (
    <div className="mt-3 px-1">
      <LetterBlocks key={`${sel}-${loc.editLocale}`} blocks={intro} restaurant={variant === 'restaurant'} edit={{ selectedId: focusId, onSelect: setFocusId, onChange: setIntro, onMove: move, onRemove: remove }} />
      {/* üres levél: most az alap (rendszer) levél megy ki — a sablonnal lesz szerkeszthető, minden része blokk */}
      {!intro.length && (
        <EmptyState icon={Mail} title="Még nincs saját levél" className="mx-3 my-2"
          action={<Button variant="yellow" icon={Undo2} onClick={loadTemplate}>Sablon betöltése</Button>}>
          Most az alap levél megy ki (az Előnézet megmutatja). Töltsd be a sablont: a szöveg, a foglalás adatai, a gombok és a lemondás-sor mind szerkeszthető blokk lesz.
        </EmptyState>
      )}
      {/* régi, saját szövegű levél: a lenti részeket még a rendszer teszi hozzá */}
      {intro.length > 0 && !full && <Note className="mx-5 mt-2">Az alábbi adatokat és gombokat a rendszer teszi a levélbe. Töltsd be a sablont, hogy ezek is szerkeszthetők legyenek.</Note>}
    </div>
  ) : (
    <p className="px-6 pt-4 text-ui-meta text-ui-muted max-lg:px-0">Ennek a levélnek a szövege a rendszeré (a módosítás adataival) — itt csak ki- és bekapcsolod.</p>
  )

  return (
    <>
    {inspector.linkModal}
    <GuestEmailsPage
      letters={LETTER_KEYS.map((k) => ({ key: k, title: title[k], when: when[k], on: ctl.on[k] }))}
      selected={sel} onSelect={(k) => { setSel(k as LetterKey); setFocusId(null) }}
      subject={et ? <KitInput size="sm" value={loc.current[et.subjectField] ?? ''} onChange={(e) => loc.setField(et.subjectField, e.target.value)} placeholder={subjectPh} aria-label="Tárgy" /> : title[sel]}
      letter={letter}
      palette={et ? <BlockPalette onAdd={add} /> : undefined}
      paletteRow={et ? <BlockPalette row onAdd={add} /> : undefined}
      // saját blokkos levélnél (a sablonból: van „foglalás adatai” blokk) a régi fix részek nem kellenek — ott vannak a levélben
      details={full || !intro.length ? null : variant === 'salon' ? { line: 'Hétfő, Nov. 10. · 13:30', meta: 'Viktória · 60 perc · minta' } : { line: 'Péntek, Nov. 14. · 19:00', meta: '4 fő · terasz · minta' }}
      buttons={full || !intro.length ? [] : BUTTONS[sel]} cancelLink={!full && intro.length > 0 && CANCEL_LINK[sel]}
      biz={{ name: sender, initials: sender.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), logo, footer: sender }}
      device={device} onDevice={setDevice}
      // bal oszlop (a levelek alatt): a levél beállításai; jobb oszlop, mint a Marketingnél: a kijelölt blokk szerkesztése,
      // a beszúrható adatok, a sablon, az előnézet és a mentés
      side={
        <ReminderSettingsCard part="settings" title={title[sel]} on={ctl.on[sel]} onToggle={(on) => ctl.setOn(sel, on)}
          times={sel === 'reminder' ? [['t48', '2 nappal', r.t48], ['t24', '24 órával', r.t24], ['t3', '3 órával', r.t3]] : null}
          onTime={(k) => ctl.setReminder({ [k]: !r[k as 't48' | 't24' | 't3'] })}
          channels={null}
          language={<LocaleEditBar tone="glass" available={loc.available} active={loc.editLocale} onSelect={loc.selectLocale} loading={loc.loading} />}
          sender={sender} />
      }
      settings={
        <ReminderSettingsCard part="editor" className="self-start" block={et ? { name: inspector.name, body: inspector.inspector } : undefined}
          tags={et ? TAGS[variant].map(([l]) => l) : []} onTag={(l) => { const t = TAGS[variant].find(([x]) => x === l); if (t) insertTag(t[1]) }}
          onTemplate={et ? loadTemplate : undefined} onPreview={et ? () => onPreview(et.state, intro) : undefined}
          onSave={ctl.save} saveBusy={ctl.saving} saveDisabled={!ctl.dirty} />
      }
    />
    </>
  )
}
