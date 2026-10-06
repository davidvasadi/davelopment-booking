'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, MapPin, Search, Star } from 'lucide-react'

type Current = { id: string; name: string | null; rating: number | null; count: number | null; updatedAt?: string | null }
type Result = { id: string; name: string; address: string }

/**
 * Google-értékelések a foglaló oldalon: a tulaj megkeresi és kiválasztja a SAJÁT Google-profilját
 * (név + város), a rendszer onnantól naponta egyszer frissíti az átlagot és a legutóbbi
 * értékeléseket (lásd lib/googleReviews.ts). Ha a platformon nincs beállítva a Google-kulcs,
 * a kártya nem jelenik meg.
 */
export function GooglePlacePicker() {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [current, setCurrent] = useState<Current | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/google/place?current=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { enabled: false, place: null }))
      .then((d) => { setEnabled(!!d.enabled); setCurrent(d.place ?? null) })
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false))
  }, [])

  const search = async () => {
    if (query.trim().length < 3) return toast.error('Írd be az üzlet nevét és a várost.')
    setSearching(true)
    try {
      const res = await fetch(`/api/google/place?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setResults(d.results ?? [])
      if ((d.results ?? []).length === 0) toast.message('Nincs találat — próbáld a pontos névvel és várossal.')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'A keresés nem sikerült')
    } finally {
      setSearching(false)
    }
  }

  const save = async (placeId: string | null) => {
    setSaving(true)
    try {
      const res = await fetch('/api/google/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ placeId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setCurrent(d.place ?? null)
      setResults([])
      setQuery('')
      toast.success(placeId ? 'Google-profil összekapcsolva' : 'Google-profil leválasztva')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'A mentés nem sikerült')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !enabled) return null

  return (
    <div className="rounded-dav-lg dav-card-glass p-5 lg:p-6">
      <div className="flex items-center gap-3.5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-dav-sm bg-gold/15 text-ink-dark">
          <MapPin className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">Google-értékelések a foglaló oldalon</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
            Válaszd ki a Google Térképes profilodat — az átlag és a legutóbbi értékelések naponta frissülnek.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{current.name ?? 'Google-profil'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-soft">
                {current.rating != null
                  ? <><Star className="h-3.5 w-3.5 fill-current text-gold" /> {current.rating.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} · {current.count ?? 0} értékelés</>
                  : 'Még nincs értékelés'}
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              className="h-10 rounded-dav-pill border border-line-strong bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
            >
              Leválasztás
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
                placeholder="Pl. Bella Szalon Budapest"
                className="h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-white px-3.5 text-[16px] text-ink focus:outline-none lg:text-sm"
              />
              <button
                type="button"
                onClick={search}
                disabled={searching}
                className="inline-flex h-11 items-center gap-1.5 rounded-dav-pill bg-ink-dark px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Keresés
              </button>
            </div>
            {results.length > 0 && (
              <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-white">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={saving}
                    onClick={() => save(r.id)}
                    className="flex w-full flex-col items-start px-3.5 py-2.5 text-left transition-colors hover:bg-paper disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-ink">{r.name}</span>
                    <span className="text-[12px] text-ink-soft">{r.address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
