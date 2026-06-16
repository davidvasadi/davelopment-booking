'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronDown as Caret } from 'lucide-react'
import { GOOD_TO_KNOW_ICONS, iconByKey } from './goodToKnowIcons'
import { cn } from '@/lib/utils'

export type GoodToKnowItem = { icon: string; title: string; body: string }

/**
 * „Jó tudni" pont-szerkesztő a foglaló oldalhoz (ikon + cím + szöveg). Kontrollált:
 * a `value` a pontok tömbje, minden módosítás az `onChange`-en megy. Az ikon egy
 * popover-rácsból választható (nem 16 gomb egymás mellett), így a kártya letisztult.
 */
export function GoodToKnowEditor({
  value,
  onChange,
}: {
  value: GoodToKnowItem[]
  onChange: (next: GoodToKnowItem[]) => void
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

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <button
          type="button"
          onClick={add}
          className="w-full rounded-2xl border border-dashed border-zinc-300 dark:border-white/[0.12] p-8 flex flex-col items-center gap-2 text-center hover:border-zinc-400 dark:hover:border-white/[0.2] hover:bg-zinc-50/60 dark:hover:bg-white/[0.02] transition-colors"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black">
            <Plus className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-zinc-700 dark:text-white/70">Első „Jó tudni" pont hozzáadása</span>
          <span className="text-xs text-zinc-400 dark:text-white/30">Pl. parkolás, módosítás, kisállat-barát…</span>
        </button>
      ) : (
        <>
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
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-zinc-200 dark:border-white/[0.12] text-sm font-semibold text-zinc-600 dark:text-white/70 hover:border-zinc-400 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Új pont
          </button>
        </>
      )}
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
    <div className="rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        {/* Ikonválasztó popover */}
        <div ref={pickerRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            aria-label="Ikon választása"
            className="flex h-10 items-center gap-1 rounded-xl bg-zinc-950 dark:bg-white pl-2.5 pr-1.5 text-white dark:text-black hover:opacity-90 transition-opacity"
          >
            <ActiveIcon className="h-4 w-4" />
            <Caret className="h-3.5 w-3.5 opacity-60" />
          </button>
          {pickerOpen && (
            <div className="absolute top-full left-0 mt-2 z-50 w-60 rounded-xl border border-zinc-100 dark:border-white/[0.08] bg-white dark:bg-zinc-950 shadow-lg p-2">
              <div className="grid grid-cols-5 gap-1">
                {GOOD_TO_KNOW_ICONS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { onChange({ icon: key }); setPickerOpen(false) }}
                    title={label}
                    className={cn(
                      'flex h-10 w-full items-center justify-center rounded-lg transition-colors',
                      item.icon === key
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                        : 'text-zinc-500 dark:text-white/50 hover:bg-zinc-100 dark:hover:bg-white/[0.08]',
                    )}
                  >
                    <Icon className="h-4 w-4" />
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
          className="flex-1 min-w-0 h-10 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 px-3 text-sm font-semibold focus:outline-none focus:border-zinc-400"
        />

        <div className="flex shrink-0 items-center">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Fel" className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30 transition-colors">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Le" className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white disabled:opacity-30 transition-colors">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" onClick={onRemove} title="Törlés" className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <textarea
        value={item.body}
        onChange={(e) => onChange({ body: e.target.value })}
        rows={2}
        placeholder="A pont szövege…"
        className="w-full rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 py-2.5 px-3.5 text-sm resize-y leading-relaxed focus:outline-none focus:border-zinc-400"
      />
    </div>
  )
}
