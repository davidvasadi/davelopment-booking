'use client'

import { Plus, Trash2, ChevronUp, ChevronDown, Sparkles, Info } from 'lucide-react'

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

const inputClass =
  'h-11 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 px-4 text-sm w-full'

/**
 * Szakaszos „Foglalási feltételek" szerkesztő (salon + restaurant közös eleme).
 * Kontrollált: a `value` a szakaszok tömbje, minden módosítás az `onChange`-en megy.
 */
export function TermsSectionsEditor({
  value,
  onChange,
}: {
  value: TermsSection[]
  onChange: (next: TermsSection[]) => void
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
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-200">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          A sablon csak <strong>kiindulási váz</strong> — egészítsd ki a saját feltételeiddel, és a jogi
          megfelelőség (pl. GDPR, fogyasztói jogok) érdekében érdemes jogásszal ellenőriztetni. A „Szolgáltató
          adatai" blokkot a rendszer a Cégadatokból automatikusan hozzáadja.
        </span>
      </div>

      {value.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.12] p-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-white/40 mb-3">Még nincs feltétel hozzáadva.</p>
          <button
            type="button"
            onClick={() => onChange(TERMS_TEMPLATE)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-4 w-4" />
            Sablon betöltése
          </button>
        </div>
      )}

      {value.map((s, i) => (
        <div key={i} className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/[0.08] text-xs font-bold text-zinc-500 dark:text-white/50">
              {i + 1}
            </span>
            <input
              value={s.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder="Szakasz címe (pl. Lemondás)"
              className={`${inputClass} font-semibold`}
            />
            <div className="flex shrink-0 items-center">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Fel" className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30 transition-colors">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} title="Le" className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30 transition-colors">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => remove(i)} title="Törlés" className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <textarea
            value={s.body}
            onChange={(e) => update(i, { body: e.target.value })}
            rows={4}
            placeholder="A szakasz szövege…"
            className="w-full rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 py-2.5 px-4 text-sm resize-y leading-relaxed"
          />
        </div>
      ))}

      {value.length > 0 && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-zinc-200 dark:border-white/[0.12] text-sm font-semibold text-zinc-600 dark:text-white/70 hover:border-zinc-400 dark:hover:bg-white/[0.04] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Szakasz hozzáadása
        </button>
      )}
    </div>
  )
}
