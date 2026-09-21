'use client'

import { useRef } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, Sparkles, Info } from 'lucide-react'
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

// Crextio/Apple: tiszta fehér + meleg hajszál-keret + arany fókusz (NINCS krém/zinc fill).
const inputClass =
  'h-11 w-full rounded-[12px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 px-4 text-sm transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25'

/**
 * Szakaszos „Foglalási feltételek" szerkesztő (salon + restaurant közös eleme).
 * Kontrollált: a `value` a szakaszok tömbje, minden módosítás az `onChange`-en megy.
 */
export function TermsSectionsEditor({
  value,
  onChange,
  locale = 'hu',
  onLoadTemplate,
}: {
  value: TermsSection[]
  onChange: (next: TermsSection[]) => void
  /** A szerkesztési nyelv — a „Sablon betöltése" ezen a nyelven tölti be a vázat. */
  locale?: Locale
  /** A sablon-betöltő (a forma adja, hogy a megfelelő nyelvű sablont töltse az aktív locale-ra). */
  onLoadTemplate?: () => void
}) {
  const update = (i: number, patch: Partial<TermsSection>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const add = () => onChange([...value, { title: '', body: '' }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  // A `Reorder.Item`/React `key` stabil azonosítót igényel — a `TermsSection` objektumoknak
  // nincs saját id-jük (a Payload-mezőben sincs), ezért objektum-referenciánként generálunk
  // egyet lustán (a szerkesztés a legtöbb sor referenciáját érintetlenül hagyja).
  const keysRef = useRef(new WeakMap<TermsSection, number>())
  const nextKeyRef = useRef(0)
  const keyFor = (s: TermsSection) => {
    let k = keysRef.current.get(s)
    if (k === undefined) { k = nextKeyRef.current++; keysRef.current.set(s, k) }
    return k
  }

  // Üresnek számít a 0-elemű tömb, VAGY ha van elem, de mindegyik cím+szöveg üres (lásd lent).
  const isBlank = value.length === 0 || value.every((s) => !s.title.trim() && !s.body.trim())

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-[12px] bg-warn-bg border border-warn/25 px-3 py-2.5 text-xs text-warn">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          A sablon csak <strong>kiindulási váz</strong> — egészítsd ki a saját feltételeiddel, és a jogi
          megfelelőség (pl. GDPR, fogyasztói jogok) érdekében érdemes jogásszal ellenőriztetni. A „Szolgáltató
          adatai" blokkot a rendszer a Cégadatokból automatikusan hozzáadja.
        </span>
      </div>

      {/* "Üresnek" számít a 0-elemű tömb ÉS az az eset is, amikor MINDEN sor cím/szövege üres —
          ez utóbbi a más nyelvre váltás: a szakaszok SZÁMA nem nyelvenkénti, csak a tartalma,
          ezért egy még le nem fordított nyelven ugyanannyi, de üres sort kapunk vissza a HU-ból,
          nem 0-elemű tömböt. Ilyenkor a (fordítás nélküli, üres) sorokat NEM mutatjuk — csak a
          tiszta sablon-ajánlatot, különben egy kupac értelmetlen üres mező jelenne meg. */}
      {isBlank ? (
        <div className="rounded-[18px] border border-dashed border-line-strong bg-white p-6 text-center">
          <p className="mb-3 text-sm text-ink-soft">{value.length === 0 ? 'Még nincs feltétel hozzáadva.' : 'Erre a nyelvre még nincs lefordítva.'}</p>
          <button
            type="button"
            onClick={() => (onLoadTemplate ? onLoadTemplate() : onChange(termsTemplate(locale)))}
            className="inline-flex items-center gap-1.5 rounded-[14px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            Sablon betöltése
          </button>
        </div>
      ) : (
        <Reorder.Group as="div" axis="y" values={value} onReorder={onChange} className="space-y-3">
          {value.map((s, i) => (
            <SectionRow
              key={keyFor(s)}
              section={s}
              index={i}
              onChange={(patch) => update(i, patch)}
              onRemove={() => remove(i)}
            />
          ))}
        </Reorder.Group>
      )}

      {!isBlank && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-[14px] border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-soft shadow-dav-card transition-colors hover:text-ink"
        >
          <Plus className="h-4 w-4" />
          Szakasz hozzáadása
        </button>
      )}
    </div>
  )
}

/** Egy szakasz-kártya `Reorder.Item`-ként — a húzást csak a bal széli fogópont indítja
 *  (`dragListener={false}`), hogy a cím/szöveg mező kattintás/kijelölés viselkedése ne sérüljön. */
function SectionRow({
  section: s,
  index,
  onChange,
  onRemove,
}: {
  section: TermsSection
  index: number
  onChange: (patch: Partial<TermsSection>) => void
  onRemove: () => void
}) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item
      as="div"
      value={s}
      dragListener={false}
      dragControls={dragControls}
      className="space-y-3 rounded-[18px] border border-line bg-white p-4 shadow-dav-card"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-bold text-ink-soft2">
          {index + 1}
        </span>
        <input
          value={s.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Szakasz címe (pl. Lemondás)"
          className={`${inputClass} font-semibold`}
        />
        <div className="flex shrink-0 items-center">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex h-8 w-7 cursor-grab items-center justify-center text-ink-soft2 transition-colors hover:text-ink active:cursor-grabbing"
            title="Húzd az átrendezéshez"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <button type="button" onClick={onRemove} title="Törlés" className="p-1.5 text-ink-soft2 transition-colors hover:text-bad">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <textarea
        value={s.body}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={4}
        placeholder="A szakasz szövege…"
        className="w-full resize-y rounded-[12px] border border-line-strong bg-white px-4 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-soft2/60 transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
      />
    </Reorder.Item>
  )
}
