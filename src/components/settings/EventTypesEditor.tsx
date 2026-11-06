'use client'

import { useState, useRef, useEffect } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, ChevronDown as Caret, Sparkles } from 'lucide-react'
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

  // Stabil kulcs objektum-referenciánként — az `EventTypeItem`-eknek nincs saját id-jük.
  const keysRef = useRef(new WeakMap<EventTypeItem, number>())
  const nextKeyRef = useRef(0)
  const keyFor = (s: EventTypeItem) => {
    let k = keysRef.current.get(s)
    if (k === undefined) { k = nextKeyRef.current++; keysRef.current.set(s, k) }
    return k
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-ui-inner border border-dashed border-ui-divider bg-white px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-ui-control bg-ui-dark text-ui-yellow">
            <Plus className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="text-sm font-medium text-ui-text">Még nincs esemény-típus</p>
            <p className="mt-0.5 text-xs text-ui-muted">Pl. Születésnap, Évforduló, Céges vacsora…</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => onChange(DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label, enabled: true })))}
              className="inline-flex items-center gap-1.5 rounded-ui-control bg-ui-dark px-4 py-2.5 text-ui-meta font-medium text-white transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4 text-ui-yellow" />
              Alapkészlet betöltése
            </button>
            <button
              type="button"
              onClick={add}
              className="inline-flex items-center gap-1.5 rounded-ui-control border border-ui-divider bg-white px-4 py-2.5 text-ui-meta font-medium text-ui-muted transition-colors hover:text-ui-text"
            >
              <Plus className="h-4 w-4" />
              Üres típus
            </button>
          </div>
        </div>
      ) : (
        <>
          <Reorder.Group as="div" axis="y" values={value} onReorder={onChange} className="space-y-3">
            {value.map((s, i) => (
              <EventTypeRow
                key={keyFor(s)}
                item={s}
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
            Új típus
          </button>
        </>
      )}
    </div>
  )
}

/** Egy esemény-típus sora: ikon-popover + megnevezés + aktív-kapcsoló + fogópont/törlés.
 *  `Reorder.Item`-ként — a húzást csak a bal széli fogópont indítja (`dragListener={false}`). */
function EventTypeRow({
  item,
  onChange,
  onRemove,
}: {
  item: EventTypeItem
  onChange: (patch: Partial<EventTypeItem>) => void
  onRemove: () => void
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const ActiveIcon = eventIconByKey(item.icon)
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
      className={cn(
        'flex items-center gap-2.5 rounded-[18px] border bg-white p-3 transition-opacity',
        item.enabled ? 'border-ui-divider' : 'border-ui-divider opacity-55',
      )}
    >
      {/* Ikonválasztó popover */}
      <div ref={pickerRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Ikon választása"
          className="flex h-11 items-center gap-1.5 rounded-ui-control border border-ui-divider bg-white pl-3 pr-2 text-ui-text transition-colors"
        >
          <ActiveIcon className="h-4 w-4" strokeWidth={1.8} />
          <Caret className="h-3.5 w-3.5 text-ui-muted" />
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-ui-inner border border-ui-divider bg-white p-2">
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
                      ? 'bg-ui-dark text-ui-yellow'
                      : 'text-ui-muted hover:bg-ui-cell hover:text-ui-text',
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
        className="h-11 min-w-0 flex-1 rounded-ui-control border border-ui-divider bg-white px-3.5 text-sm font-medium text-ui-text placeholder:font-normal placeholder:text-ui-muted transition-colors focus:outline-none focus:ring-2"
      />

      {/* Aktív-kapcsoló — davelopment etalon: ink sín + arany gomb */}
      <button
        type="button"
        onClick={() => onChange({ enabled: !item.enabled })}
        aria-pressed={item.enabled}
        title={item.enabled ? 'Aktív — látszik a foglalón' : 'Inaktív — rejtve'}
        className={cn(
          'relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors',
          item.enabled ? 'bg-ui-dark' : 'bg-[#DAD5C6]',
        )}
      >
        <span className={cn(
          'absolute top-[3px] h-5 w-5 rounded-full shadow-sm transition-all',
          item.enabled ? 'right-[3px] bg-white' : 'left-[3px] bg-white',
        )} />
      </button>

      <div className="flex shrink-0 items-center">
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex h-8 w-7 cursor-grab items-center justify-center text-ui-muted transition-colors hover:text-ui-text active:cursor-grabbing"
          title="Húzd az átrendezéshez"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <button type="button" onClick={onRemove} title="Törlés" className="p-1.5 text-ui-muted transition-colors hover:text-ui-bad">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </Reorder.Item>
  )
}
