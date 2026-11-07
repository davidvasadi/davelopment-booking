'use client'

import { useState, useRef, useEffect } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Plus, Trash2, GripVertical, ChevronDown as Caret, Sparkles } from 'lucide-react'
import { EVENT_TYPE_ICONS, eventIconByKey, DEFAULT_EVENT_TYPES } from './eventTypeIcons'
import { cn } from '@/lib/utils'
import { Button, EmptyState, FIELD, IconButton, Input, Panel } from '@/components/ui-kit'
import { Switch } from '@/components/ui/toggle-switch'

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
        // a kit üres állapota (mint a „Jó tudni” és a Kérdések)
        <EmptyState icon={Sparkles} title="Még nincs esemény-típus"
          action={<span className="flex flex-wrap items-center justify-center gap-2">
            <Button icon={Sparkles} onClick={() => onChange(DEFAULT_EVENT_TYPES.map((e) => ({ icon: e.icon, label: e.label, enabled: true })))}>Alapkészlet betöltése</Button>
            <Button variant="glass" icon={Plus} onClick={add}>Üres típus</Button>
          </span>}>
          Pl. Születésnap, Évforduló, Céges vacsora…
        </EmptyState>
      ) : (
        <>
          <Reorder.Group as="div" axis="y" values={value} onReorder={onChange}>
            {value.map((s, i) => (
              <EventTypeRow
                key={keyFor(s)}
                item={s}
                onChange={(patch) => update(i, patch)}
                onRemove={() => remove(i)}
              />
            ))}
          </Reorder.Group>

          <Button variant="cell" icon={Plus} onClick={add}>Új típus</Button>
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
        // keretes doboz helyett szaggatott vonal a sorok közt (a kit listái); a kikapcsolt halvány
        'flex items-center gap-2.5 border-t border-dashed border-ui-divider bg-white py-2.5 transition-opacity first:border-t-0 first:pt-0',
        !item.enabled && 'opacity-55',
      )}
    >
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
              {EVENT_TYPE_ICONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { onChange({ icon: key }); setPickerOpen(false) }}
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

      <Input value={item.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Megnevezés (pl. Születésnap)" className="min-w-0 flex-1 font-medium" />

      {/* aktív-kapcsoló: a kit közös kapcsolója */}
      <span title={item.enabled ? 'Aktív — látszik a foglalón' : 'Inaktív — rejtve'}><Switch checked={item.enabled} onChange={(v) => onChange({ enabled: v })} ariaLabel="Aktív" /></span>

      <div className="flex shrink-0 items-center">
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex h-8 w-7 cursor-grab items-center justify-center text-ui-muted transition-colors hover:text-ui-text active:cursor-grabbing"
          title="Húzd az átrendezéshez"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <IconButton icon={Trash2} label="Típus törlése" variant="ghost" size="sm" className="text-ui-bad" onClick={onRemove} />
      </div>
    </Reorder.Item>
  )
}
