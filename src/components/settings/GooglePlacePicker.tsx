'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, Field, FieldRow, Input, ListRow, Meta, Note, Pill, StatusPill } from '@/components/ui-kit'

type Current = { id: string; name: string | null; rating: number | null; count: number | null; updatedAt?: string | null }
type Suggestion = { placeId: string; mainText: string; secondaryText: string }
/** `search` = a gépelés-közbeni élő találatok (Autocomplete) havi biztonsági kerete; `details` =
 *  a kiválasztás utáni csillag/vélemény-lekérés (Place Details) kerete — külön számít, lásd
 *  googleReviews.ts. */
type Maintenance = { search: boolean; details: boolean }

const DEBOUNCE_MS = 350

/**
 * Google-értékelések a foglaló oldalon: a tulaj megkeresi és kiválasztja a SAJÁT Google-profilját
 * (név + város), a rendszer onnantól naponta egyszer frissíti az átlagot és a legutóbbi
 * értékeléseket (lásd lib/googleReviews.ts). Ha a platformon nincs beállítva a Google-kulcs,
 * a kártya nem jelenik meg.
 *
 * A keresés ÉLŐ, gépelés-közbeni (Place Autocomplete New) — nincs külön "Keresés" gomb, amint a
 * tulaj ír valamit a mezőbe (debounce-olva), alatta megjelennek a találatok. A mező a cégnévvel/
 * várossal előre ki van töltve, de ettől még NEM indul automatikusan hívás megnyitáskor — csak a
 * tényleges gépelés/szerkesztés indítja (ez a mező `onChange`-éhez kötött effektus, nem egy
 * külön "első automatikus keresés").
 *
 * Session token: a gépelés közbeni Autocomplete-hívások ÉS a kiválasztás utáni Place Details-
 * hívás UGYANAZT a (kliens-generált) tokent viszik — ez a Google saját, session-alapú
 * díjszabásában ingyenessé teszi a köztes gépelés-tippeket, amint a session egy Details-hívással
 * zárul (nálunk ez MINDIG megtörténik csatlakoztatáskor).
 */
export function GooglePlacePicker({ businessName, businessCity }: { businessName: string; businessCity?: string | null }) {
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [current, setCurrent] = useState<Current | null>(null)
  const [query, setQuery] = useState(() => [businessName, businessCity].filter(Boolean).join(' '))
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchedOnce, setSearchedOnce] = useState(false)
  const [saving, setSaving] = useState(false)
  const [maintenance, setMaintenance] = useState<Maintenance>({ search: false, details: false })
  const invalid = !searching && searchedOnce && suggestions.length === 0

  const newSessionToken = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
  const sessionTokenRef = useRef<string>('')
  if (!sessionTokenRef.current) sessionTokenRef.current = newSessionToken()

  useEffect(() => {
    fetch('/api/google/place?current=1', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { enabled: false, place: null }))
      .then((d) => {
        setEnabled(!!d.enabled)
        setCurrent(d.place ?? null)
        setMaintenance({ search: !!d.searchMaintenance, details: !!d.detailsMaintenance })
      })
      .catch(() => setEnabled(false))
      .finally(() => setLoading(false))
  }, [])

  // Élő, debounce-olt keresés — a mező ÉRTÉKÉNEK változására fut (a kezdő, előre kitöltött
  // szövegre is egyszer, hogy ne kelljen a tulajnak muszáj hozzányúlnia a mezőhöz), de NEM egy
  // külön "automatikus első keresés" ág — ugyanaz az egy mechanizmus kezeli mindkettőt.
  useEffect(() => {
    if (loading || !enabled || current || maintenance.search) return
    const q = query.trim()
    if (q.length < 3) { setSuggestions([]); setSearchedOnce(false); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/google/place?autocomplete=1&q=${encodeURIComponent(q)}&session=${encodeURIComponent(sessionTokenRef.current)}`, { credentials: 'include' })
        const d = await res.json()
        if (!res.ok) {
          if (d?.maintenance) setMaintenance((m) => ({ ...m, search: true }))
          return
        }
        const found: Suggestion[] = d.suggestions ?? []
        setSuggestions(found)
        setSearchedOnce(true)
      } catch {
        /* élő gépelés közben nem zavarjuk toast-tal egy-egy hálózati hibánál — a user úgyis tovább ír */
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, loading, enabled, current, maintenance.search])

  const save = async (placeId: string | null) => {
    if (placeId && maintenance.details) return
    setSaving(true)
    try {
      const res = await fetch('/api/google/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ placeId, sessionToken: placeId ? sessionTokenRef.current : undefined }),
      })
      const d = await res.json()
      if (!res.ok) {
        if (d?.maintenance) setMaintenance((m) => ({ ...m, details: true }))
        throw new Error(d.error)
      }
      setCurrent(d.place ?? null)
      setSuggestions([])
      setQuery('')
      sessionTokenRef.current = newSessionToken() // egy token csak egyszer zárható le egy Details-hívással
      toast.success(placeId ? 'Google-profil összekapcsolva' : 'Google-profil leválasztva')
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'A mentés nem sikerült')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Meta className="py-3">Betöltés…</Meta>
  if (!enabled) return <Note className="mt-1">A Google-profil összekötése most nem érhető el.</Note>

  const updated = current?.updatedAt ? new Date(current.updatedAt) : null
  return (
    <>
      {current ? (
        <>
          <Field label="Az üzleted a Google-on" className="mt-1"><Input value={current.name ?? 'Google-profil'} readOnly /></Field>
          <FieldRow label={current.rating != null ? `★ ${current.rating.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} · ${current.count ?? 0} értékelés` : 'Még nincs értékelés'}
            hint={updated ? `frissítve ${updated.toDateString() === new Date().toDateString() ? 'ma' : updated.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })} ${updated.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}` : undefined}>
            <span className="flex items-center gap-1.5"><StatusPill status="ok">Összekötve</StatusPill><Button variant="cell" size="sm" loading={saving} onClick={() => void save(null)}>Leválasztás</Button></span>
          </FieldRow>
        </>
      ) : (
        <>
          <Field label="Az üzleted a Google-on" className="mt-1"
            hint={searching ? 'Keresés…' : 'Előre kitöltöttük az üzleted adataival — írd át, ha nem a sajátod van a találatok közt.'}
            error={!maintenance.search && invalid ? `Nincs találat erre: „${query}”. Lehet, hogy a Google-on másképp szerepel a neve vagy a városa.` : undefined}>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pl. Bella Szalon Budapest" disabled={maintenance.search} />
          </Field>
          {!maintenance.search && suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {suggestions.map((sg) => (
                <button key={sg.placeId} type="button" disabled={saving} onClick={() => void save(sg.placeId)} className="block w-full text-left ui-press disabled:opacity-50">
                  <ListRow filled title={sg.mainText} meta={sg.secondaryText} trailing={<Pill tone="dark" size="sm">Kiválasztom</Pill>} />
                </button>
              ))}
            </div>
          )}
          {maintenance.search && <Note warn className="mt-2">A keresés most karbantartás alatt áll — elérte a havi biztonsági keretét. A hónap fordulásával automatikusan visszatér.</Note>}
          {maintenance.details && !maintenance.search && <Note warn className="mt-2">A kiválasztás utáni csillag- és vélemény-lekérés most karbantartás alatt áll — ha most kötöd össze, az átlag a hónap fordulása után töltődik be.</Note>}
        </>
      )}
      <Note tip className="mt-1">Az átlagot, a darabszámot és a legutóbbi 5 értékelést a Google-től kérjük le — naponta legfeljebb egyszer, amikor valaki megnyitja a foglalóoldalad. A foglalóoldalon ezek látszanak.</Note>
    </>
  )
}
