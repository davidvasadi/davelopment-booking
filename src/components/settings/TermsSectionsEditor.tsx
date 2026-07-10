'use client'

import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Info } from 'lucide-react'
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
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

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

      {value.length === 0 && (
        <div className="rounded-[18px] border border-dashed border-line-strong bg-white p-6 text-center">
          <p className="mb-3 text-sm text-ink-soft">Még nincs feltétel hozzáadva.</p>
          <button
            type="button"
            onClick={() => (onLoadTemplate ? onLoadTemplate() : onChange(termsTemplate(locale)))}
            className="inline-flex items-center gap-1.5 rounded-[14px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            Sablon betöltése
          </button>
        </div>
      )}

      {value.map((s, i) => (
        <div key={i} className="space-y-3 rounded-[18px] border border-line bg-white p-4 shadow-dav-card">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-xs font-bold text-ink-soft2">
              {i + 1}
            </span>
            <input
              value={s.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Szakasz címe (pl. Lemondás)"
              className={`${inputClass} font-semibold`}
            />
            <div className="flex shrink-0 items-center">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Fel" className="p-1.5 text-ink-soft2 transition-colors hover:text-ink disabled:opacity-30">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} title="Le" className="p-1.5 text-ink-soft2 transition-colors hover:text-ink disabled:opacity-30">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(i)} title="Törlés" className="p-1.5 text-ink-soft2 transition-colors hover:text-bad">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <textarea
            value={s.body}
            onChange={(e) => update(i, { body: e.target.value })}
            rows={4}
            placeholder="A szakasz szövege…"
            className="w-full resize-y rounded-[12px] border border-line-strong bg-white px-4 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-soft2/60 transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
          />
        </div>
      ))}

      {value.length > 0 && (
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
