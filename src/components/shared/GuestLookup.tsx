'use client'

// Visszatérő vendég felismerése új foglalásnál (szalon + étterem közös): a név / telefon / e-mail
// gépelésére a korábbi vendégekből javaslatot kér (/api/customers/search), és a lista KÖZVETLENÜL
// annak a mezőnek az alatt jelenik meg, amelyikbe épp gépelnek — korábban csak a név alatt volt,
// telefon/e-mail gépelésekor a mező FÖLÖTT, észrevétlenül.

import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'

export type GuestSuggestion = { name: string; email: string | null; phone: string | null; city: string | null }
export type GuestLookupField = 'name' | 'phone' | 'email'

export function useGuestLookup(enabled: boolean) {
  const [field, setField] = useState<GuestLookupField | null>(null)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GuestSuggestion[]>([])

  useEffect(() => {
    if (!enabled) { setResults([]); return }
    const query = q.trim()
    if (query.length < 2) { setResults([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(query)}`, { credentials: 'include', signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: GuestSuggestion[] }) => setResults(d.results ?? []))
        .catch(() => {})
    }, 220)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q, enabled])

  return {
    field,
    results,
    /** Gépelés egy mezőbe — ez a mező kapja a javaslatlistát. */
    type: (f: GuestLookupField, value: string) => { setField(f); setQ(value) },
    clear: () => { setResults([]); setQ(''); setField(null) },
  }
}

/** Javaslatlista — a `field` mező alá kerül, ha épp abba gépelnek. */
export function GuestSuggestList({
  show,
  results,
  onPick,
}: {
  show: boolean
  results: GuestSuggestion[]
  onPick: (g: GuestSuggestion) => void
}) {
  if (!show || results.length === 0) return null
  return (
    <div className="overflow-hidden rounded-[12px] border border-zinc-200 bg-white shadow-[0_12px_30px_-18px_rgba(40,35,15,.45)]">
      <div className="bg-zinc-50 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Korábbi vendég — kattints a kitöltéshez</div>
      {results.map((g, i) => (
        <button
          key={`${g.email ?? g.phone ?? g.name}-${i}`}
          type="button"
          // mousedown: a mező blur-je előtt fusson le (különben a lista eltűnhetne a kattintás előtt)
          onMouseDown={(e) => { e.preventDefault(); onPick(g) }}
          className="flex w-full items-center gap-3 border-t border-zinc-100 px-3.5 py-2 text-left transition-colors hover:bg-zinc-50"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <UserRound className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-900">{g.name}</span>
            <span className="block truncate text-[12px] text-zinc-500">{[g.phone, g.email].filter(Boolean).join(' · ') || 'nincs elérhetőség'}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
