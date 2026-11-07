'use client'

import { useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, Pencil } from 'lucide-react'
import { Button, IconButton, Input, Meta, Pill, Textarea, MarqueeText } from '@/components/ui-kit'
import type { Locale } from '@/lib/i18n'
import { termsTemplate } from './contentTemplates'

export type TermsSection = { title: string; body: string }

/**
 * Profi kiindulási „Foglalási feltételek" sablon. FIGYELEM: ez csak váz —
 * a végleges szöveget a szolgáltatónak ki kell egészítenie és érdemes jogásszal
 * ellenőriztetnie (GDPR, fogyasztói jogok). A „Szolgáltató adatai" blokkot a
 * rendszer a Cégadatokból automatikusan hozzáadja, ide nem kell beírni.
 */
export const TERMS_TEMPLATE: TermsSection[] = [
  {
    title: 'Általános rendelkezések',
    body: 'A jelen feltételek a szolgáltató által biztosított online foglalási rendszeren keresztül leadott foglalásokra vonatkoznak. A foglalás véglegesítésével a vendég elfogadja az alábbi feltételeket.',
  },
  {
    title: 'A foglalás menete',
    body: 'A vendég a foglaló felületen kiválasztja a kívánt időpontot és megadja a szükséges adatokat. A foglalás a visszaigazoló e-mail megérkezésével válik érvényessé.',
  },
  {
    title: 'Lemondás és módosítás',
    body: 'A foglalás díjmentesen lemondható vagy módosítható a megadott időpont előtt legalább 24 órával, a visszaigazoló e-mailben található linken keresztül. Késői lemondás vagy meg nem jelenés esetén a szolgáltató fenntartja a jogot a jövőbeli foglalások korlátozására.',
  },
  {
    title: 'Késés',
    body: 'Kérjük, érkezzen időben. A foglalt időpontot a szolgáltató 15 perc türelmi idő elteltével nem tudja garantálni.',
  },
  {
    title: 'Adatkezelés (GDPR)',
    body: 'A szolgáltató a foglaláshoz megadott személyes adatokat (név, e-mail, telefonszám) kizárólag a foglalás teljesítése és a kapcsolattartás céljából kezeli, a hatályos adatvédelmi jogszabályoknak (GDPR) megfelelően. Az adatokat harmadik félnek nem adja át. Az érintett bármikor kérheti adatai helyesbítését vagy törlését a megadott elérhetőségeken.',
  },
  {
    title: 'Felelősség',
    body: 'A szolgáltató mindent megtesz a foglalások pontos teljesítéséért, de nem vállal felelősséget az előre nem látható, működési körén kívül eső akadályokból eredő esetleges fennakadásokért.',
  },
  {
    title: 'Panaszkezelés',
    body: 'Esetleges panaszát a fent megadott elérhetőségeken jelezheti. A szolgáltató a panaszt kivizsgálja és észszerű határidőn belül válaszol.',
  },
]

/**
 * Szakaszos „Foglalási feltételek" szerkesztő (salon + restaurant közös eleme).
 * Kontrollált: a `value` a szakaszok tömbje, minden módosítás az `onChange`-en megy.
 */
export function TermsSectionsEditor({
  value,
  onChange,
  locale = 'hu',
  onLoadTemplate,
  localeBar,
  missing = 0,
}: {
  value: TermsSection[]
  onChange: (next: TermsSection[]) => void
  /** A szerkesztési nyelv — a „Kiindulási váz" ezen a nyelven tölti be a vázat. */
  locale?: Locale
  /** A sablon-betöltő (a forma adja, hogy a megfelelő nyelvű sablont töltse az aktív locale-ra). */
  onLoadTemplate?: () => void
  /** a nyelv-váltó (design 16.12: a lista fölött) */
  localeBar?: React.ReactNode
  /** hány szakasz hiányzik ezen a nyelven (a magyarhoz képest) — sárga jelzés */
  missing?: number
}) {
  const [open, setOpen] = useState<number | null>(null)
  const update = (i: number, patch: Partial<TermsSection>) => onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const add = () => { onChange([...value, { title: '', body: '' }]); setOpen(value.length) }
  const remove = (i: number) => { onChange(value.filter((_, idx) => idx !== i)); setOpen(null) }
  const loadTemplate = () => (onLoadTemplate ? onLoadTemplate() : onChange(termsTemplate(locale)))

  // A `Reorder.Item`/React `key` stabil azonosítót igényel — a szakaszoknak nincs saját id-jük, ezért objektum-
  // referenciánként generálunk egyet lustán (a szerkesztés a legtöbb sor referenciáját érintetlenül hagyja).
  const keysRef = useRef(new WeakMap<TermsSection, number>())
  const nextKeyRef = useRef(0)
  const keyFor = (s: TermsSection) => {
    let k = keysRef.current.get(s)
    if (k === undefined) { k = nextKeyRef.current++; keysRef.current.set(s, k) }
    return k
  }
  // üres: 0 szakasz, vagy minden szakasz üres (még le nem fordított nyelv — a sorok száma nem nyelvenkénti)
  const isBlank = value.length === 0 || value.every((s) => !s.title.trim() && !s.body.trim())

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        {localeBar ?? <span />}
        <span className="flex items-center gap-1.5">
          {missing > 0 && <Pill size="sm" tone="yellow">{locale.toUpperCase()}: {missing} szakasz hiányzik</Pill>}
          <Button variant="cell" size="sm" onClick={loadTemplate}>Kiindulási váz</Button>
        </span>
      </div>
      {isBlank ? (
        <Meta className="rounded-ui-inner bg-ui-cell/60 px-4 py-6 text-center">{value.length === 0 ? 'Még nincs feltétel — töltsd be a kiindulási vázat, vagy adj hozzá szakaszt.' : 'Erre a nyelvre még nincs lefordítva — töltsd be a vázat, vagy írd át szakaszonként.'}</Meta>
      ) : (
        <Reorder.Group as="div" axis="y" values={value} onReorder={onChange} className="space-y-1">
          {value.map((s, i) => <SectionRow key={keyFor(s)} section={s} open={open === i} onToggle={() => setOpen(open === i ? null : i)} onChange={(patch) => update(i, patch)} onRemove={() => remove(i)} />)}
        </Reorder.Group>
      )}
      <Button variant="glass" size="sm" icon={Plus} className="mt-2" onClick={add}>Szakasz</Button>
      <Meta className="mt-3 text-ui-label">A váz csak kiindulás — egészítsd ki, és érdemes jogásszal ellenőriztetni (GDPR, fogyasztói jogok). A „Szolgáltató adatai” blokkot a rendszer a cégadatokból hozzáadja.</Meta>
    </div>
  )
}

/** Egy szakasz: fogás (átrendezés) + cím + az első sor; kattintva kinyílik a szerkesztés (cím, szöveg, törlés). */
function SectionRow({ section: s, open, onToggle, onChange, onRemove }: { section: TermsSection; open: boolean; onToggle: () => void; onChange: (patch: Partial<TermsSection>) => void; onRemove: () => void }) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item as="div" value={s} dragListener={false} dragControls={dragControls}>
      <div className={`flex items-center gap-3 rounded-ui-inner px-3 py-2.5 ${open ? 'bg-ui-yellow' : 'bg-ui-cell/60'}`}>
        <span onPointerDown={(e) => dragControls.start(e)} title="Húzd az átrendezéshez" className="cursor-grab text-ui-muted active:cursor-grabbing"><GripVertical className="h-4 w-4 shrink-0" /></span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left outline-none">
          <MarqueeText className="text-ui-body text-ui-text">{s.title || 'Cím nélküli szakasz'}</MarqueeText>
          {s.body && <MarqueeText className="text-ui-label text-ui-muted">{s.body}</MarqueeText>}
        </button>
        <IconButton icon={Pencil} label="Szerkesztés" size="sm" variant={open ? 'glass' : 'cell'} onClick={onToggle} />
      </div>
      {open && (
        <div className="space-y-2 px-1 pb-2 pt-2">
          <Input size="sm" value={s.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Szakasz címe (pl. Lemondás)" />
          <Textarea rows={4} value={s.body} onChange={(e) => onChange({ body: e.target.value })} placeholder="A szakasz szövege…" />
          <Button variant="ghost" size="sm" icon={Trash2} className="text-ui-bad" onClick={onRemove}>Szakasz törlése</Button>
        </div>
      )}
    </Reorder.Item>
  )
}
