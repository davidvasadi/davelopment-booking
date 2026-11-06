'use client'

import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, HelpCircle } from 'lucide-react'
import { Switch } from '@/components/ui/toggle-switch'
import { cn } from '@/lib/utils'

export type CustomQuestionType = 'text' | 'yesno' | 'select'
export type CustomQuestionOption = { value: string }
export type CustomQuestion = {
  /** Stabil kliens-oldali (vagy Payload-mentett) azonosító — a React `key` ebből jön, NEM az
   *  objektum-referenciából, mert az minden gépeléskor újra létrejön (`{...q, ...patch}`), ami
   *  korábban minden karakternél újra-mountolta a sort és elvitte a fókuszt. */
  id: string
  label: string
  type: CustomQuestionType
  options: CustomQuestionOption[]
  required: boolean
}

function newQuestionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `q-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const TYPE_LABELS: Record<CustomQuestionType, string> = {
  text: 'Szöveges válasz',
  yesno: 'Igen / Nem',
  select: 'Választható lista',
}

// Gyors javaslatok — kész kérdés-sablonok, hogy ne kelljen mindent nulláról begépelni. Ide
// kerültek a leggyakrabban kért, de a sima foglalási űrlapon (telefon/cím/megjegyzés) nem
// szereplő vendég-adatok is (születésnap, nem, "honnan hallott rólunk"), amiket korábban csak
// import/admin oldalon lehetett rögzíteni — ez adja az élő foglaláson keresztüli bekérés útját.
const PRESET_QUESTIONS: { label: string; type: CustomQuestionType; options?: string[] }[] = [
  { label: 'Születésnapod?', type: 'text' },
  { label: 'Neme', type: 'select', options: ['Nő', 'Férfi', 'Egyéb'] },
  { label: 'Honnan hallottál rólunk?', type: 'select', options: ['Google', 'Facebook/Instagram', 'Ismerős ajánlotta', 'Egyéb'] },
  { label: 'Allergiás vagy valamire?', type: 'text' },
]

const fieldBase =
  'w-full rounded-[12px] bg-white border border-ui-divider text-ui-text focus:outline-none focus:ring-2 transition-colors'

/**
 * Egyedi, foglaláskor feltett kérdések szerkesztője (a `GoodToKnowEditor` mintájára) —
 * kontrollált: a `value` a kérdések tömbje, minden módosítás az `onChange`-en megy.
 */
export function CustomQuestionsEditor({
  value,
  onChange,
}: {
  value: CustomQuestion[]
  onChange: (next: CustomQuestion[]) => void
}) {
  const update = (i: number, patch: Partial<CustomQuestion>) =>
    onChange(value.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  const add = () => onChange([...value, { id: newQuestionId(), label: '', type: 'text', options: [], required: false }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  // Egy sablon nem adható hozzá kétszer (ugyanazzal a felirattal) — ha már szerepel, a chip
  // egyszerűen nem csinál semmit, nem hoz létre duplikátumot.
  const addPreset = (p: (typeof PRESET_QUESTIONS)[number]) => {
    if (value.some((q) => q.label.trim().toLowerCase() === p.label.trim().toLowerCase())) return
    onChange([...value, { id: newQuestionId(), label: p.label, type: p.type, options: (p.options ?? []).map((v) => ({ value: v })), required: false }])
  }

  const presetRow = (
    <div className="space-y-2">
      <p className="text-ui-label font-medium text-ui-muted">Gyors javaslatok</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_QUESTIONS.map((p) => {
          const already = value.some((q) => q.label.trim().toLowerCase() === p.label.trim().toLowerCase())
          return (
            <button
              key={p.label}
              type="button"
              disabled={already}
              onClick={() => addPreset(p)}
              className={cn(
                'inline-flex items-center gap-1 rounded-[10px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                already ? 'cursor-default border-ui-divider bg-ui-cell/60 text-ui-muted' : 'border-ui-divider bg-white text-ui-muted hover:text-ui-text',
              )}
            >
              {already ? null : <Plus className="h-3 w-3" />}
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )

  if (value.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex flex-col items-center gap-3 rounded-ui-inner border border-dashed border-ui-divider bg-white px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-ui-control bg-ui-dark text-ui-yellow">
            <HelpCircle className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-sm font-medium text-ui-text">Még nincs egyedi kérdés</p>
            <p className="mt-0.5 text-xs text-ui-muted">Pl. „Allergiás vagy valamire?" vagy „Milyen alkalomra jössz?"</p>
          </div>
          <button
            type="button"
            onClick={add}
            className="mt-1 inline-flex items-center gap-1.5 rounded-ui-control bg-ui-dark px-4 py-2.5 text-ui-meta font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4 text-ui-yellow" />
            Új kérdés
          </button>
        </div>
        {presetRow}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Reorder.Group as="div" axis="y" values={value} onReorder={onChange} className="space-y-3">
        {value.map((q, i) => (
          <CustomQuestionRow
            key={q.id}
            item={q}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
      </Reorder.Group>

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-ui-control border border-ui-divider bg-white px-4 py-2.5 text-ui-meta font-medium text-ui-muted transition-colors hover:text-ui-text"
      >
        <Plus className="h-4 w-4" />
        Új kérdés
      </button>

      {presetRow}
    </div>
  )
}

function CustomQuestionRow({
  item,
  onChange,
  onRemove,
}: {
  item: CustomQuestion
  onChange: (patch: Partial<CustomQuestion>) => void
  onRemove: () => void
}) {
  const options = item.options ?? []
  const updateOption = (i: number, val: string) =>
    onChange({ options: options.map((o, idx) => (idx === i ? { value: val } : o)) })
  const addOption = () => onChange({ options: [...options, { value: '' }] })
  const removeOption = (i: number) => onChange({ options: options.filter((_, idx) => idx !== i) })
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="space-y-3 rounded-ui-inner border border-ui-divider bg-white p-4"
    >
      <div className="flex items-center gap-2.5">
        <input
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Kérdés szövege (pl. Allergiás vagy valamire?)"
          className={cn(fieldBase, 'h-11 flex-1 min-w-0 px-3.5 text-sm font-semibold')}
        />
        <div className="flex shrink-0 items-center">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex h-8 w-7 cursor-grab items-center justify-center text-ui-muted transition-colors hover:text-ui-text active:cursor-grabbing"
            title="Húzd az átrendezéshez"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <button type="button" onClick={onRemove} title="Törlés" className="p-1.5 text-ui-muted transition-colors hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <p className="text-ui-label font-medium text-ui-muted">Típus</p>
          <select
            value={item.type}
            onChange={(e) => onChange({ type: e.target.value as CustomQuestionType })}
            className={cn(fieldBase, 'h-10 w-auto px-3 text-sm')}
          >
            {(Object.keys(TYPE_LABELS) as CustomQuestionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {item.type !== 'yesno' && (
          <div className="space-y-1">
            <p className="text-ui-label font-medium text-ui-muted">Kötelező</p>
            <label className="flex h-10 items-center gap-2 text-ui-meta text-ui-muted">
              <Switch checked={item.required} onChange={(v) => onChange({ required: v })} size="sm" ariaLabel="Kötelező" />
              {item.required ? 'Igen' : 'Nem'}
            </label>
          </div>
        )}
      </div>

      {item.type === 'select' && (
        <div className="space-y-2 rounded-ui-control border border-dashed border-ui-divider p-3">
          <p className="text-ui-label font-medium text-ui-muted">Választható opciók</p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o.value}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opció ${i + 1}`}
                className={cn(fieldBase, 'h-9 flex-1 min-w-0 px-3 text-sm')}
              />
              <button type="button" onClick={() => removeOption(i)} title="Opció törlése" className="p-1.5 text-ui-muted transition-colors hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-1.5 text-ui-label font-medium text-ui-muted underline underline-offset-2 hover:text-ui-text"
          >
            <Plus className="h-3.5 w-3.5" />
            Opció hozzáadása
          </button>
        </div>
      )}
    </Reorder.Item>
  )
}
