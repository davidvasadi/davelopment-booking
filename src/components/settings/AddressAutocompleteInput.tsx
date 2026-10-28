'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Search } from 'lucide-react'

type Suggestion = { placeId: string; mainText: string; secondaryText: string }
type AddressDetails = { postalCode: string; city: string; street: string }

const DEBOUNCE_MS = 350

/**
 * Élő, gépelés-közbeni cím-kereső a Számlázási adatok fölött — ugyanaz a minta, mint a
 * GooglePlacePicker.tsx (Google-profil kiválasztás), csak postai címre szűkítve. Kiválasztáskor
 * a szülő `onSelect`-je tölti ki az irányítószám/város/utca mezőket — a mezők utána is maradnak
 * kézzel szerkeszthetők, ez csak egy gyorsabb kiindulópont, nem kötelező lépés.
 */
export function AddressAutocompleteInput({ onSelect }: { onSelect: (a: AddressDetails) => void }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [open, setOpen] = useState(false)
  const [maintenance, setMaintenance] = useState(false)
  const [enabled, setEnabled] = useState(true)

  const newSessionToken = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
  const sessionTokenRef = useRef<string>('')
  if (!sessionTokenRef.current) sessionTokenRef.current = newSessionToken()

  useEffect(() => {
    fetch('/api/google/address?maintenance=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { search: false, details: false }))
      .then((d) => setMaintenance(!!d.search))
      .catch(() => null)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3 || maintenance) { setSuggestions([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/google/address?autocomplete=1&q=${encodeURIComponent(q)}&session=${encodeURIComponent(sessionTokenRef.current)}`, { credentials: 'include' })
        const d = await res.json()
        if (!res.ok) {
          if (d?.maintenance) setMaintenance(true)
          if (res.status === 503 && !d?.maintenance) setEnabled(false)
          return
        }
        setSuggestions(d.suggestions ?? [])
        setOpen(true)
      } catch {
        /* élő gépelés közben nem zavarjuk toast-tal */
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, maintenance])

  const pick = async (s: Suggestion) => {
    setOpen(false)
    setLoadingDetails(true)
    try {
      const res = await fetch('/api/google/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ placeId: s.placeId, sessionToken: sessionTokenRef.current }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (d?.maintenance) setMaintenance(true)
        return
      }
      onSelect(d.address as AddressDetails)
      setQuery('')
      setSuggestions([])
      sessionTokenRef.current = newSessionToken()
    } finally {
      setLoadingDetails(false)
    }
  }

  if (!enabled) return null

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Cím keresése…"
          disabled={maintenance || loadingDetails}
          className="h-[42px] w-full rounded-[12px] border border-line-strong bg-white pl-10 pr-10 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-soft2/60 focus:border-gold/60 focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
        />
        {(searching || loadingDetails) && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-soft2" />}
      </div>

      {maintenance ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-warn">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          A cím-kitöltés most karbantartás alatt áll — add meg kézzel lent a mezőket.
        </p>
      ) : null}

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1.5 w-full divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-white shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className="flex w-full flex-col items-start px-3.5 py-2.5 text-left transition-colors hover:bg-paper"
            >
              <span className="text-sm font-medium text-ink">{s.mainText}</span>
              {s.secondaryText && <span className="text-[12px] text-ink-soft">{s.secondaryText}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
