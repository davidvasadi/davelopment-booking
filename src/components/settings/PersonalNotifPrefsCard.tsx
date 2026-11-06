'use client'

import { useEffect, useState } from 'react'
import { Toggle } from './SettingsToggle'

/** `pending_popup`: új függő foglalásnál azonnal a jóváhagyó popup (különben sáv) · `payment_bar`: „Fizetésre vár” sáv is (különben csak a jel) — design 6.8.1 */
export type CategoryKey = 'bookings' | 'schedule' | 'digest' | 'email_not_opened' | 'bookings_email' | 'schedule_email' | 'pending_popup' | 'payment_bar'

const CATS: { key: CategoryKey; label: string; sub: string }[] = [
  { key: 'bookings',  label: 'Foglalás',          sub: 'Új foglalás, lemondás, módosítás' },
  { key: 'schedule', label: 'Beosztás',           sub: 'Heti beosztás elkészülte és változása' },
  { key: 'digest',   label: 'Napi összefoglaló',  sub: 'Reggeli és esti forgalom-összefoglaló' },
  { key: 'email_not_opened', label: 'Meg nem nyitott email', sub: 'Ha a vendég 24, majd 12 órával a foglalás előtt sem nyitotta meg a visszaigazolást' },
]

const DEFAULT_PREFS: Record<CategoryKey, boolean> = { bookings: true, schedule: true, digest: true, email_not_opened: true, bookings_email: false, schedule_email: false, pending_popup: false, payment_bar: false }
const DEFAULT_ALLOWED: Record<CategoryKey, boolean> = { bookings: true, schedule: true, digest: false, email_not_opened: false, bookings_email: true, schedule_email: true, pending_popup: true, payment_bar: true }

export function useNotifPrefs() {
  const [prefs, setPrefs] = useState<Record<CategoryKey, boolean>>(DEFAULT_PREFS)
  const [allowed, setAllowed] = useState<Record<CategoryKey, boolean>>(DEFAULT_ALLOWED)
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
        className="text-[12px] font-semibold text-ui-muted underline-offset-2 hover:text-ui-text hover:underline disabled:cursor-default disabled:no-underline"
      >
        Mindet bekapcsolom
      </button>
      <span className="">·</span>
      <button
        type="button"
        onClick={() => setAll(visibleKeys, false)}
        disabled={allOff}
        className="text-[12px] font-semibold text-ui-muted underline-offset-2 hover:text-ui-text hover:underline disabled:cursor-default disabled:no-underline"
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
          <div key={cat.key} className="grid grid-cols-[1fr_84px] items-center gap-2 border-b border-ui-divider py-4 last:border-0">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-ui-text">{cat.label}</div>
              <div className="mt-0.5 text-[12px] text-ui-muted">{cat.sub}</div>
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
        <div key={cat.key} className="flex items-center justify-between gap-3 rounded-[13px] border border-ui-divider bg-white px-4 py-3">
          <div>
            <div className="text-[14px] font-semibold text-ui-text">{cat.label}</div>
            <div className="mt-0.5 text-[12px] text-ui-muted">{cat.sub}</div>
          </div>
          <Toggle checked={prefs[cat.key]} onChange={() => toggle(cat.key)} />
        </div>
      ))}
    </div>
  )
}
