'use client'

import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, HelpCircle } from 'lucide-react'
import { Switch } from '@/components/ui/toggle-switch'
import { Button, EmptyState, IconButton, Input, Meta, Pill, Select } from '@/components/ui-kit'

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
      <Meta>Gyors javaslatok</Meta>
      <div className="flex flex-wrap gap-1.5">
        {PRESET_QUESTIONS.map((p) => {
          const already = value.some((q) => q.label.trim().toLowerCase() === p.label.trim().toLowerCase())
          return (
            <button key={p.label} type="button" disabled={already} onClick={() => addPreset(p)} className="ui-press rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ui-dark/20 disabled:cursor-default">
              {/* a kit pillje: a már felvett javaslat halvány, pipa nélkül */}
              <Pill tone="cell" icon={already ? undefined : Plus} className={already ? 'opacity-50' : ''}>{p.label}</Pill>
            </button>
          )
        })}
      </div>
    </div>
  )

  if (value.length === 0) {
    return (
      <div className="space-y-3">
        {/* a kit üres állapota (mint a „Jó tudni”-nál) */}
        <EmptyState icon={HelpCircle} title="Még nincs egyedi kérdés" action={<Button icon={Plus} onClick={add}>Új kérdés</Button>}>
          Pl. „Allergiás vagy valamire?" vagy „Milyen alkalomra jössz?"
        </EmptyState>
        {presetRow}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Reorder.Group as="div" axis="y" values={value} onReorder={onChange}>
        {value.map((q, i) => (
          <CustomQuestionRow
            key={q.id}
            item={q}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
      </Reorder.Group>

      <Button variant="cell" icon={Plus} onClick={add}>Új kérdés</Button>

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
      // a kit szerint: keretes doboz helyett szaggatott vonal a kérdések közt, a mezők a kit szürke mezői
      className="space-y-3 border-t border-dashed border-ui-divider bg-white py-3 first:border-t-0 first:pt-0"
    >
      <div className="flex items-center gap-2.5">
        <Input value={item.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Kérdés szövege (pl. Allergiás vagy valamire?)" className="min-w-0 flex-1 font-medium" />
        <div className="flex shrink-0 items-center">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex h-8 w-7 cursor-grab items-center justify-center text-ui-muted transition-colors hover:text-ui-text active:cursor-grabbing"
            title="Húzd az átrendezéshez"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <IconButton icon={Trash2} label="Kérdés törlése" variant="ghost" size="sm" className="text-ui-bad" onClick={onRemove} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Meta>Típus</Meta>
          <Select size="sm" value={item.type} onChange={(e) => onChange({ type: e.target.value as CustomQuestionType })} className="w-auto">
            {(Object.keys(TYPE_LABELS) as CustomQuestionType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>

        {item.type !== 'yesno' && (
          <div className="space-y-1">
            <Meta>Kötelező</Meta>
            <label className="flex h-9 items-center gap-2 text-ui-meta text-ui-muted">
              <Switch checked={item.required} onChange={(v) => onChange({ required: v })} size="sm" ariaLabel="Kötelező" />
              {item.required ? 'Igen' : 'Nem'}
            </label>
          </div>
        )}
      </div>

      {item.type === 'select' && (
        <div className="space-y-2">
          <Meta>Választható opciók</Meta>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input size="sm" value={o.value} onChange={(e) => updateOption(i, e.target.value)} placeholder={`Opció ${i + 1}`} className="min-w-0 flex-1" />
              <IconButton icon={Trash2} label="Opció törlése" variant="ghost" size="sm" className="text-ui-bad" onClick={() => removeOption(i)} />
            </div>
          ))}
          <Button variant="cell" size="sm" icon={Plus} onClick={addOption}>Opció hozzáadása</Button>
        </div>
      )}
    </Reorder.Item>
  )
}
