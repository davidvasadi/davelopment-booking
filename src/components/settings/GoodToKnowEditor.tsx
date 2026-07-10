'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronDown as Caret, Sparkles, Info } from 'lucide-react'
import { GOOD_TO_KNOW_ICONS, iconByKey } from './goodToKnowIcons'
import { goodToKnowTemplate } from './contentTemplates'
import type { Locale } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type GoodToKnowItem = { icon: string; title: string; body: string }

/** Közös mező-stílus (Crextio/Apple: tiszta fehér, meleg hajszál-keret, gold fókusz). */
const fieldBase =
  'w-full rounded-[12px] bg-white border border-line-strong text-ink placeholder:text-ink-soft2/60 focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/25 transition-colors'

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
          <Info className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Még nincs „Jó tudni" pont</p>
          <p className="mt-0.5 text-xs text-ink-soft">Pl. parkolás, módosítás, kisállat-barát…</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => (onLoadTemplate ? onLoadTemplate() : onChange(goodToKnowTemplate(locale)))}
            className="inline-flex items-center gap-1.5 rounded-[14px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-4 w-4 text-gold" />
            Sablon betöltése
          </button>
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 rounded-[14px] border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            <Plus className="h-4 w-4" />
            Üres pont
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {value.map((s, i) => (
        <GoodToKnowRow
          key={i}
          item={s}
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
        Új pont
      </button>
    </div>
  )
}

/** Egy „Jó tudni" pont kártyája: ikon-popover + cím egy sorban, alatta a szöveg. */
function GoodToKnowRow({
  item,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  item: GoodToKnowItem
  index: number
  total: number
  onChange: (patch: Partial<GoodToKnowItem>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const ActiveIcon = iconByKey(item.icon)

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  return (
    <div className="space-y-3 rounded-[18px] border border-line bg-white p-4 shadow-dav-card">
      <div className="flex items-center gap-2.5">
        {/* Ikonválasztó popover */}
        <div ref={pickerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label="Ikon választása"
            className="flex h-11 items-center gap-1.5 rounded-[12px] border border-line-strong bg-white pl-3 pr-2 text-ink transition-colors hover:border-ink/25"
          >
            <ActiveIcon className="h-4 w-4" strokeWidth={1.8} />
            <Caret className="h-3.5 w-3.5 text-ink-soft2" />
          </button>
          {pickerOpen && (
            <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-[16px] border border-line bg-white p-2 shadow-dav-card">
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
                      'flex h-10 w-full items-center justify-center rounded-[10px] transition-colors',
                      item.icon === key
                        ? 'bg-ink-dark text-gold'
                        : 'text-ink-soft hover:bg-paper hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Pont címe (pl. Parkolás)"
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

      <textarea
        value={item.body}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={2}
        placeholder="A pont szövege…"
        className={cn(fieldBase, 'resize-y px-3.5 py-2.5 text-sm leading-relaxed')}
      />
    </div>
  )
}
