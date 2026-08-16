'use client'

import { Plus, Trash2, ChevronUp, ChevronDown, HelpCircle } from 'lucide-react'
import { Switch } from '@/components/ui/toggle-switch'
import { cn } from '@/lib/utils'

export type CustomQuestionType = 'text' | 'yesno' | 'select'
export type CustomQuestionOption = { value: string }
export type CustomQuestion = {
  label: string
  type: CustomQuestionType
  options: CustomQuestionOption[]
  required: boolean
}

const TYPE_LABELS: Record<CustomQuestionType, string> = {
  text: 'Szöveges válasz',
  yesno: 'Igen / Nem',
  select: 'Választható lista',
}

const fieldBase =
  'w-full rounded-[12px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/25 transition-colors'

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
  const add = () => onChange([...value, { label: '', type: 'text', options: [], required: false }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= value.length) return
    const next = [...value]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }

  if (value.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line-strong bg-white px-6 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-ink-dark text-gold">
          <HelpCircle className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Még nincs egyedi kérdés</p>
          <p className="mt-0.5 text-xs text-ink-soft">Pl. „Allergiás vagy valamire?" vagy „Milyen alkalomra jössz?"</p>
        </div>
        <button
          type="button"
          onClick={add}
          className="mt-1 inline-flex items-center gap-1.5 rounded-[14px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4 text-gold" />
          Új kérdés
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {value.map((q, i) => (
        <CustomQuestionRow
          key={i}
          item={q}
          index={i}
          total={value.length}
          onChange={(patch) => update(i, patch)}
          onMove={(dir) => move(i, dir)}
          onRemove={() => remove(i)}
        />
      ))}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-[14px] border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-soft shadow-dav-card transition-colors hover:text-ink"
      >
        <Plus className="h-4 w-4" />
        Új kérdés
      </button>
    </div>
  )
}

function CustomQuestionRow({
  item,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  item: CustomQuestion
  index: number
  total: number
  onChange: (patch: Partial<CustomQuestion>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const options = item.options ?? []
  const updateOption = (i: number, val: string) =>
    onChange({ options: options.map((o, idx) => (idx === i ? { value: val } : o)) })
  const addOption = () => onChange({ options: [...options, { value: '' }] })
  const removeOption = (i: number) => onChange({ options: options.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-3 rounded-[18px] border border-line bg-white p-4 shadow-dav-card">
      <div className="flex items-center gap-2.5">
        <input
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Kérdés szövege (pl. Allergiás vagy valamire?)"
          className={cn(fieldBase, 'h-11 flex-1 min-w-0 px-3.5 text-sm font-semibold')}
        />
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Fel" className="p-1.5 text-ink-soft2 transition-colors hover:text-ink disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Le" className="p-1.5 text-ink-soft2 transition-colors hover:text-ink disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} title="Törlés" className="p-1.5 text-ink-soft2 transition-colors hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Típus</p>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Kötelező</p>
            <label className="flex h-10 items-center gap-2 text-[13px] text-ink-soft">
              <Switch checked={item.required} onChange={(v) => onChange({ required: v })} size="sm" ariaLabel="Kötelező" />
              {item.required ? 'Igen' : 'Nem'}
            </label>
          </div>
        )}
      </div>

      {item.type === 'select' && (
        <div className="space-y-2 rounded-[14px] border border-dashed border-line-strong p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">Választható opciók</p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o.value}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opció ${i + 1}`}
                className={cn(fieldBase, 'h-9 flex-1 min-w-0 px-3 text-sm')}
              />
              <button type="button" onClick={() => removeOption(i)} title="Opció törlése" className="p-1.5 text-ink-soft2 transition-colors hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Opció hozzáadása
          </button>
        </div>
      )}
    </div>
  )
}
