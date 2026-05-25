'use client'

type ToggleSwitchProps = {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function ToggleSwitch({ checked, onChange, label, description, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-50"
    >
      <span className="flex-1">
        <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-zinc-400 dark:text-white/30">{description}</span>
        )}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-white/[0.15]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  )
}
