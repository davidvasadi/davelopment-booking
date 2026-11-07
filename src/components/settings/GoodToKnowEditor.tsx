'use client'

import { Button, EmptyState, FIELD, IconButton, Input, Panel, Textarea } from '@/components/ui-kit'

import { useState, useRef, useEffect } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, ChevronDown as Caret, Sparkles, Info } from 'lucide-react'
import { GOOD_TO_KNOW_ICONS, iconByKey } from './goodToKnowIcons'
import { goodToKnowTemplate } from './contentTemplates'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type GoodToKnowItem = { icon: string; title: string; body: string }

/**
 * „Jó tudni" pont-szerkesztő a foglaló oldalhoz (ikon + cím + szöveg). Kontrollált:
 * a `value` a pontok tömbje, minden módosítás az `onChange`-en megy. Az ikon egy
 * popover-rácsból választható, így a kártya letisztult. A stílus a davelopment
 * design-rendszert követi (ink/line/paper/gold), NEM a régi zinc/dark palettát.
 */
export function GoodToKnowEditor({
  value,
  onChange,
  locale = 'hu',
  onLoadTemplate,
}: {
  value: GoodToKnowItem[]
  onChange: (next: GoodToKnowItem[]) => void
  /** A szerkesztési nyelv — a sablon-betöltő ezen a nyelven tölti be a kiindulási pontokat. */
  locale?: Locale
  /** A sablon-betöltő (a forma adja, hogy a megfelelő nyelvű sablont töltse az aktív locale-ra). */
  onLoadTemplate?: () => void
}) {
  const update = (i: number, patch: Partial<GoodToKnowItem>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const add = () => onChange([...value, { icon: 'info', title: '', body: '' }])
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i))

  // Stabil kulcs pozíció (nem objektum-referencia) alapján — `update` minden gépeléskor ÚJ
  // objektumot hoz létre a szerkesztett ponthoz ({...s, ...patch}), egy referencia-alapú kulcs
  // (pl. korábban egy WeakMap) emiatt minden billentyűleütésnél ÚJ kulcsot adott a sornak, ami
  // React-et remountolásra kényszerítette → az input elvesztette a fókuszt minden karakternél.
  const keyFor = (_s: GoodToKnowItem, i: number) => i

  // Üresnek számít a 0-elemű tömb, VAGY ha van pont, de mindegyik cím+szöveg üres — ez utóbbi a
  // más nyelvre váltás esete (a pontok SZÁMA nem nyelvenkénti, csak a tartalma; egy még le nem
  // fordított nyelven ugyanannyi, de üres pontot kapunk vissza a HU-ból, nem 0-elemű tömböt).
  // Ilyenkor a (fordítás nélküli, üres) pontokat NEM mutatjuk, csak a tiszta sablon-ajánlatot.
  const isBlank = value.length === 0 || value.every((s) => !s.title.trim() && !s.body.trim())
  // „Üres pont”: üres listánál egy új pont; le nem fordított nyelven a meglévő (üres) pontok nyílnak meg kitöltésre —
  // egy újabb üres pont hozzáadása ott semmit nem változtatna a látványon (továbbra is minden pont üres lenne)
  const [fillBlank, setFillBlank] = useState(false)
  const addBlank = () => { if (value.length === 0) add(); else setFillBlank(true) }

  if (isBlank && !fillBlank) {
    return (
      // a kit üres állapota (csíkos doboz, kör-ikon, gombok) — mint a többi üres listánál
      <EmptyState icon={Info} title={value.length === 0 ? 'Még nincs „Jó tudni" pont' : 'Erre a nyelvre még nincs lefordítva'}
        action={<span className="flex flex-wrap items-center justify-center gap-2">
          <Button icon={Sparkles} onClick={() => (onLoadTemplate ? onLoadTemplate() : onChange(goodToKnowTemplate(locale)))}>Sablon betöltése</Button>
          <Button variant="glass" icon={Plus} onClick={addBlank}>Üres pont</Button>
        </span>}>
        Pl. parkolás, módosítás, kisállat-barát…
      </EmptyState>
    )
  }

  return (
    <div className="space-y-3">
      <Reorder.Group as="div" axis="y" values={value} onReorder={onChange}>
        {value.map((s, i) => (
          <GoodToKnowRow
            key={keyFor(s, i)}
            item={s}
            onChange={(patch) => update(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
      </Reorder.Group>

      <Button variant="cell" icon={Plus} onClick={add}>Új pont</Button>
    </div>
  )
}

/** Egy „Jó tudni" pont kártyája: ikon-popover + cím egy sorban, alatta a szöveg.
 *  `Reorder.Item`-ként — a húzást csak a bal széli fogópont indítja (`dragListener={false}`). */
function GoodToKnowRow({
  item,
  onChange,
  onRemove,
}: {
  item: GoodToKnowItem
  onChange: (patch: Partial<GoodToKnowItem>) => void
  onRemove: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const ActiveIcon = iconByKey(item.icon)
  const dragControls = useDragControls()

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={dragControls}
      // a kit szerint: nincs keretes doboz — a pontokat szaggatott vonal választja el, a mezők a kit szürke mezői
      className="space-y-2 border-t border-dashed border-ui-divider bg-white py-3 first:border-t-0 first:pt-0"
    >
      <div className="flex items-center gap-2.5">
        {/* Ikonválasztó popover */}
        <div ref={pickerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label="Ikon választása"
            className={cn(FIELD, 'flex h-11 w-auto items-center gap-1.5 pl-3 pr-2')}
          >
            <ActiveIcon className="h-4 w-4" strokeWidth={1.8} />
            <Caret className="h-3.5 w-3.5 text-ui-muted" />
          </button>
          {pickerOpen && (
            <Panel pad="sm" className="ui-pop-in absolute left-0 top-full z-50 mt-2 w-64 origin-top-left">
              <div className="grid grid-cols-5 gap-1">
                {GOOD_TO_KNOW_ICONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      onChange({ icon: key })
                      setPickerOpen(false)
                    }}
                    title={label}
                    className={cn(
                      'flex h-10 w-full items-center justify-center rounded-ui-control transition-colors',
                      item.icon === key
                        ? 'bg-ui-dark text-ui-yellow'
                        : 'text-ui-muted hover:bg-ui-cell hover:text-ui-text',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>

        <Input value={item.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Pont címe (pl. Parkolás)" className="min-w-0 flex-1 font-medium" />

        <div className="flex shrink-0 items-center">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="flex h-8 w-7 cursor-grab items-center justify-center text-ui-muted transition-colors hover:text-ui-text active:cursor-grabbing"
            title="Húzd az átrendezéshez"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          <IconButton icon={Trash2} label="Pont törlése" variant="ghost" size="sm" className="text-ui-bad" onClick={onRemove} />
        </div>
      </div>

      {/* a szöveghez igazodó magasság (nem vágja el, nincs húzó-sarok) */}
      <Textarea value={item.body} onChange={(e) => onChange({ body: e.target.value })} rows={2} placeholder="A pont szövege…" className="min-h-0 [field-sizing:content]" />
    </Reorder.Item>
  )
}
