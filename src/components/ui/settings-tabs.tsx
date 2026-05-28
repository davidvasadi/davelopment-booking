'use client'

/**
 * Fülezett beállítás-keret (salon + restaurant settings közös eleme). A fül
 * tartalmát a szülő rendereli (csak az aktív fülét); a fülváltást a szülő
 * kezeli, hogy a mentetlen-változás védelmet (ConfirmDialog) be tudja iktatni.
 */
export type SettingsTab = {
  id: string
  label: string
  /** Igaz, ha ezen a fülön van mentetlen változás (kis pont jelzi). */
  dirty?: boolean
}

export function SettingsTabsNav({
  tabs,
  active,
  onSelect,
}: {
  tabs: SettingsTab[]
  active: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 dark:bg-white/[0.06] no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            active === t.id
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/[0.12] dark:text-white'
              : 'text-zinc-500 hover:text-zinc-800 dark:text-white/40 dark:hover:text-white/70'
          }`}
        >
          {t.label}
          {t.dirty && (
            <span
              title="Mentetlen változás"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )}
        </button>
      ))}
    </div>
  )
}
