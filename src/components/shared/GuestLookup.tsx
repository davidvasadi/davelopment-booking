'use client'

// Visszatérő vendég felismerése új foglalásnál (szalon + étterem közös): a név / telefon / e-mail
// gépelésére a korábbi vendégekből javaslatot kér (/api/customers/search), és a lista KÖZVETLENÜL
// annak a mezőnek az alatt jelenik meg, amelyikbe épp gépelnek — korábban csak a név alatt volt,
// telefon/e-mail gépelésekor a mező FÖLÖTT, észrevétlenül.

import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { Card, ListRow, Meta } from '@/components/ui-kit'

export type GuestSuggestion = { name: string; email: string | null; phone: string | null; city: string | null; address?: string | null; taxNumber?: string | null }
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
  // a design 6.9 vendég-lépése: cella-kártya, felül a magyarázat, soronként egy korábbi vendég (az első kiemelve)
  return (
    <Card tone="cell" inner pad="xs" className="mt-1.5">
      <Meta className="px-3 pt-1 text-ui-label">Korábbi vendég — kattints a kitöltéshez</Meta>
      {results.map((g, i) => (
        <button
          key={`${g.email ?? g.phone ?? g.name}-${i}`}
          type="button"
          // mousedown: a mező blur-je előtt fusson le (különben a lista eltűnhetne a kattintás előtt)
          onMouseDown={(e) => { e.preventDefault(); onPick(g) }}
          className="block w-full text-left"
        >
          <ListRow filled={i === 0} className={i === 0 ? 'bg-white' : 'hover:bg-white/60'} leading={<UserRound className="h-4 w-4 text-ui-muted" />} title={g.name} meta={[g.phone, g.email].filter(Boolean).join(' · ') || 'nincs elérhetőség'} />
        </button>
      ))}
    </Card>
  )
}
