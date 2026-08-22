'use client'

import { useEffect, useState } from 'react'

type CategoryKey = 'bookings' | 'system' | 'staff' | 'schedule' | 'digest' | 'email_not_opened'

const CATS: { key: CategoryKey; label: string; sub: string }[] = [
  { key: 'bookings',  label: 'Foglalás',          sub: 'Új foglalás, lemondás, módosítás' },
  { key: 'system',   label: 'Rendszer',           sub: 'Rendszer-, fiók- és díjértesítők' },
  { key: 'staff',    label: 'Munkatársak',        sub: 'Csapattagokhoz kapcsolódó események' },
  { key: 'schedule', label: 'Beosztás',           sub: 'Heti beosztás elkészülte és változása' },
  { key: 'digest',   label: 'Napi összefoglaló',  sub: 'Reggeli és esti forgalom-összefoglaló' },
  { key: 'email_not_opened', label: 'Meg nem nyitott email', sub: 'Ha a vendég 24, majd 12 órával a foglalás előtt sem nyitotta meg a visszaigazolást' },
]

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={onChange}
      className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors ${checked ? 'bg-ink-dark' : 'bg-[#DAD5C6]'}`}>
      <span className={`absolute top-[3px] h-[21px] w-[21px] rounded-full shadow-sm transition-all ${checked ? 'right-[3px] bg-white' : 'left-[3px] bg-white'}`} />
    </button>
  )
}

function useNotifPrefs() {
  const [prefs, setPrefs] = useState<Record<CategoryKey, boolean>>({ bookings: true, system: true, staff: true, schedule: true, digest: true, email_not_opened: true })
  const [allowed, setAllowed] = useState<Record<CategoryKey, boolean>>({ bookings: true, system: true, staff: true, schedule: true, digest: false, email_not_opened: false })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/user/notif-prefs', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.prefs) setPrefs(d.prefs)
        if (d.allowed) setAllowed(d.allowed)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function toggle(key: CategoryKey) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await fetch('/api/user/notif-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ [key]: next[key] }),
    }).catch(() => setPrefs(prefs))
  }

  /** Az összes LÁTHATÓ (jogosultság szerint engedett) kategóriát egyszerre kapcsolja — egy
   *  összevont PATCH-hívással, nem kategóriánként külön. */
  async function setAll(visibleKeys: CategoryKey[], value: boolean) {
    const patch = Object.fromEntries(visibleKeys.map((k) => [k, value])) as Partial<Record<CategoryKey, boolean>>
    const previous = prefs
    setPrefs((p) => ({ ...p, ...patch }))
    await fetch('/api/user/notif-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch),
    }).catch(() => setPrefs(previous))
  }

  return { prefs, allowed, loaded, toggle, setAll }
}

/**
 * compact=true  → grid sorok (SettingsHub kártyán belülre)
 * compact=false → önálló kártyás megjelenés (NotificationsPage)
 */
export function PersonalNotifPrefsCard({ compact = false }: { compact?: boolean }) {
  const { prefs, allowed, loaded, toggle, setAll } = useNotifPrefs()
  const visible = CATS.filter((c) => allowed[c.key])
  const visibleKeys = visible.map((c) => c.key)
  const allOn = visible.length > 0 && visible.every((c) => prefs[c.key])
  const allOff = visible.length > 0 && visible.every((c) => !prefs[c.key])

  if (!loaded) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`animate-pulse rounded-[13px] bg-black/[0.04] ${compact ? 'h-[57px]' : 'h-[58px]'}`} />
        ))}
      </div>
    )
  }

  if (visible.length === 0) return null

  // Összefogó parancs — csak akkor van értelme, ha legalább 2 kapcsoló van egymás mellett.
  const bulkControls = visible.length > 1 && (
    <div className="mb-2 flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={() => setAll(visibleKeys, true)}
        disabled={allOn}
        className="text-[12px] font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:cursor-default disabled:text-ink-soft2/50 disabled:no-underline"
      >
        Mindet bekapcsolom
      </button>
      <span className="text-ink-soft2/40">·</span>
      <button
        type="button"
        onClick={() => setAll(visibleKeys, false)}
        disabled={allOff}
        className="text-[12px] font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:cursor-default disabled:text-ink-soft2/50 disabled:no-underline"
      >
        Mindet kikapcsolom
      </button>
    </div>
  )

  if (compact) {
    return (
      <>
        {bulkControls}
        {visible.map((cat) => (
          <div key={cat.key} className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-line py-4 last:border-0">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ink">{cat.label}</div>
              <div className="mt-0.5 text-[12px] text-ink-soft">{cat.sub}</div>
            </div>
            <div className="flex justify-center">
              <Toggle checked={prefs[cat.key]} onChange={() => toggle(cat.key)} />
            </div>
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="space-y-2">
      {bulkControls}
      {visible.map((cat) => (
        <div key={cat.key} className="flex items-center justify-between gap-3 rounded-[13px] border border-line bg-white px-4 py-3">
          <div>
            <div className="text-[14px] font-semibold text-ink">{cat.label}</div>
            <div className="mt-0.5 text-[12px] text-ink-soft">{cat.sub}</div>
          </div>
          <Toggle checked={prefs[cat.key]} onChange={() => toggle(cat.key)} />
        </div>
      ))}
    </div>
  )
}
