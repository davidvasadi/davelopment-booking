'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronDown as Caret, Sparkles } from 'lucide-react'
import { EVENT_TYPE_ICONS, eventIconByKey, DEFAULT_EVENT_TYPES } from './eventTypeIcons'
import { cn } from '@/lib/utils'

export type EventTypeItem = { icon: string; label: string; enabled: boolean }

/**
 * Esemény-típus (alkalom) szerkesztő az étterem-beállításokhoz — a vendég ezekből választ
 * a foglalónál. Ikon-popover + megnevezés + aktív-kapcsoló, hozzáadás/törlés/átrendezés.
 * A „Jó tudni" szerkesztő davelopment mintáját követi (kontrollált: value → onChange).
 */
export function EventTypesEditor({
  value,
  onChange,
}: {
  value: EventTypeItem[]
  onChange: (next: EventTypeItem[]) => void
}) {
  const update = (i: number, patch: Partial<EventTypeItem>) =>
    onChange(value.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const add = () => onChange([...value, { icon: 'party', label: '', enabled: true }])
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
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-line-strong bg-white px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-ink-dark text-gold">
            <Plus className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Még nincs esemény-típus</p>
            <p className="mt-0.5 text-xs text-ink-soft">Pl. Születésnap, Évforduló, Céges vacsora…</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label, enabled: true })))}
              className="inline-flex items-center gap-1.5 rounded-[14px] bg-ink-dark px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4 text-gold" />
              Alapkészlet betöltése
            </button>
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-[14px] border border-line bg-white px-4 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              <Plus className="h-4 w-4" />
              Üres típus
            </button>
          </div>
        </div>
      ) : (
        <>
          {value.map((s, i) => (
            <EventTypeRow
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
            Új típus
          </button>
        </>
      )}
    </div>
  )
}

/** Egy esemény-típus sora: ikon-popover + megnevezés + aktív-kapcsoló + rendezés/törlés. */
function EventTypeRow({
  item,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  item: EventTypeItem
  index: number
  total: number
  onChange: (patch: Partial<EventTypeItem>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const ActiveIcon = eventIconByKey(item.icon)

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [pickerOpen])

  return (
    <div className={cn(
      'flex items-center gap-2.5 rounded-[18px] border bg-white p-3 shadow-dav-card transition-opacity',
      item.enabled ? 'border-line' : 'border-line opacity-55',
    )}>
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
              {EVENT_TYPE_ICONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { onChange({ icon: key }); setPickerOpen(false) }}
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
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Megnevezés (pl. Születésnap)"
        className="h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-white px-3.5 text-sm font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft2/60 transition-colors focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
      />

      {/* Aktív-kapcsoló — davelopment etalon: ink sín + arany gomb */}
      <button
        type="button"
        onClick={() => onChange({ enabled: !item.enabled })}
        aria-pressed={item.enabled}
        title={item.enabled ? 'Aktív — látszik a foglalón' : 'Inaktív — rejtve'}
        className={cn(
          'relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors',
          item.enabled ? 'bg-ink-dark' : 'bg-[#DAD5C6]',
        )}
      >
        <span className={cn(
          'absolute top-[3px] h-5 w-5 rounded-full shadow-sm transition-all',
          item.enabled ? 'right-[3px] bg-gold' : 'left-[3px] bg-white',
        )} />
      </button>

      <div className="flex shrink-0 items-center">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Fel" className="p-1.5 text-ink-soft2 transition-colors hover:text-ink disabled:opacity-30">
          <ChevronUp className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Le" className="p-1.5 text-ink-soft2 transition-colors hover:text-ink disabled:opacity-30">
          <ChevronDown className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRemove} title="Törlés" className="p-1.5 text-ink-soft2 transition-colors hover:text-bad">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
