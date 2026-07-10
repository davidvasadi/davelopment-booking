'use client'

/**
 * Közös kapcsoló-vizuál — a szín EGY helyen, hogy app-szerte egységesen módosítható legyen
 * (ne kelljen sok fájlt átírni). SZÁNDÉKOSAN NINCS gold/sárga az aktív állapotban: aktív =
 * ink-dark sín + FEHÉR gomb, inaktív = halvány sín + fehér gomb.
 *
 * - `Switch`: csupasz kapcsoló (csak sín + gomb), kompakt lista-sorokhoz.
 * - `ToggleSwitch`: címke + leírás + kapcsoló egy sorban (beállítás-blokkokhoz).
 */

// A kapcsoló-paletta — ITT módosítsd, és minden Switch/ToggleSwitch együtt változik.
const TRACK_ON = 'bg-ink-dark'
const TRACK_OFF = 'bg-line-strong'
const KNOB = 'bg-white'

type SwitchProps = {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  ariaLabel?: string
}

export function Switch({ checked, onChange, disabled, size = 'md', ariaLabel }: SwitchProps) {
  const d = size === 'sm'
    ? { track: 'h-[22px] w-[38px]', knob: 'h-4 w-4', top: 'top-[3px]', on: 'left-[19px]', off: 'left-[3px]' }
    : { track: 'h-6 w-11', knob: 'h-5 w-5', top: 'top-0.5', on: 'left-[23px]', off: 'left-[3px]' }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
      className={`relative shrink-0 rounded-full transition-colors disabled:opacity-50 ${d.track} ${checked ? TRACK_ON : TRACK_OFF}`}
    >
      <span className={`absolute ${d.top} ${d.knob} rounded-full ${KNOB} shadow-sm transition-all ${checked ? d.on : d.off}`} />
    </button>
  )
}

type ToggleSwitchProps = {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function ToggleSwitch({ checked, onChange, label, description, disabled }: ToggleSwitchProps) {
  return (
    <div className="flex w-full items-center justify-between gap-4 text-left">
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-soft">{description}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={label} />
    </div>
  )
}
