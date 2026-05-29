'use client'

import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { GOOD_TO_KNOW_ICONS, iconByKey } from './goodToKnowIcons'

export type GoodToKnowItem = { icon: string; title: string; body: string }

const inputClass =
  'h-11 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 px-4 text-sm w-full'

/**
 * „Jó tudni" pont-szerkesztő a foglaló oldalhoz (ikon + cím + szöveg). Kontrollált:
 * a `value` a pontok tömbje, minden módosítás az `onChange`-en megy. Csak a host
 * által megadott pontok jelennek meg a landingen (nincs automatikus kártya).
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
      {value.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-white/[0.12] p-6 text-center">
          <p className="text-sm text-zinc-500 dark:text-white/40 mb-3">Még nincs „Jó tudni" pont.</p>
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Első pont hozzáadása
          </button>
        </div>
      )}

      {value.map((s, i) => {
        const ActiveIcon = iconByKey(s.icon)
        return (
          <div key={i} className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white">
                <ActiveIcon className="h-4 w-4" />
              </span>
              <input
                value={s.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="Pont címe (pl. Módosítás)"
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

            {/* Ikonválasztó */}
            <div className="flex flex-wrap gap-1.5">
              {GOOD_TO_KNOW_ICONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => update(i, { icon: key })}
                  title={label}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
                    s.icon === key
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-zinc-200 text-zinc-500 hover:border-zinc-400 dark:border-white/[0.1] dark:text-white/50 dark:hover:border-white/[0.25]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            <textarea
              value={s.body}
              onChange={(e) => update(i, { body: e.target.value })}
              rows={3}
              placeholder="A pont szövege…"
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 dark:bg-white/[0.06] dark:border-white/[0.1] dark:text-white dark:placeholder:text-white/20 py-2.5 px-4 text-sm resize-y leading-relaxed"
            />
          </div>
        )
      })}

      {value.length > 0 && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-zinc-200 dark:border-white/[0.12] text-sm font-semibold text-zinc-600 dark:text-white/70 hover:border-zinc-400 dark:hover:bg-white/[0.04] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Pont hozzáadása
        </button>
      )}
    </div>
  )
}
