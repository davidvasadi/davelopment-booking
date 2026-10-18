'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { AlertTriangle, Loader2, MapPin, Star } from 'lucide-react'

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
  // Nincs találat → a mező megrezeg + piros keretet kap, ugyanaz a minta, mint az értékelés-link
  // mezőnél (GoogleSettingsPanel.tsx) — a user számára azonnal, vizuálisan jelezze a hibát, nem
  // csak egy alatta lévő szövegsor.
  const [shake, setShake] = useState(false)
  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600) }
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
        if (found.length === 0) triggerShake()
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
            <p className="text-[12px] text-ink-soft2">
              Előre kitöltöttük az üzleted adataival — írd át, ha nem a sajátod van a találatok közt;
              a lista gépelés közben, automatikusan frissül.
            </p>
            <motion.div
              className="relative"
              animate={shake ? { x: [0, -8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
            >
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShake(false) }}
                onFocus={() => setShake(false)}
                placeholder="Pl. Bella Szalon Budapest"
                disabled={maintenance.search}
                className="h-11 w-full rounded-[12px] border border-line-strong bg-white px-3.5 pr-10 text-[16px] text-ink outline-none transition-colors disabled:opacity-60 lg:text-sm"
                style={{
                  borderColor: invalid ? 'var(--dav-bad)' : undefined,
                  boxShadow: invalid ? '0 0 0 2px color-mix(in srgb, var(--dav-bad) 20%, transparent)' : undefined,
                }}
              />
              {searching && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-soft2" />}
            </motion.div>

            {/* Karbantartás-jelzés MINDIG a mező alatt — állandó, nem egy eltűnő toast. */}
            {maintenance.search && (
              <p className="flex items-start gap-1.5 rounded-dav-chip border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-[12px] font-medium text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Ez a funkció jelenleg karbantartás alatt áll — elérte a havi biztonsági keretét.
                A hónap fordulásával automatikusan visszatér, addig nem lehet rajta keresni.
              </p>
            )}

            {!maintenance.search && suggestions.length > 0 && (
              <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-white">
                {suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    disabled={saving}
                    onClick={() => save(s.placeId)}
                    className="flex w-full flex-col items-start px-3.5 py-2.5 text-left transition-colors hover:bg-paper disabled:opacity-50"
                  >
                    <span className="text-sm font-medium text-ink">{s.mainText}</span>
                    <span className="text-[12px] text-ink-soft">{s.secondaryText}</span>
                  </button>
                ))}
              </div>
            )}
            {!maintenance.search && invalid && (
              <p className="text-[12px] font-medium text-bad">
                Nincs találat erre: „{query}". Lehet, hogy a Google-n másképp szerepel az üzleted neve
                vagy a városa — próbáld meg pontosítani a mező szövegét.
              </p>
            )}
            {maintenance.details && !maintenance.search && (
              <p className="flex items-start gap-1.5 rounded-dav-chip border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-[12px] font-medium text-warn">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                A keresés megy, de a kiválasztás utáni csillag/vélemény-lekérés most karbantartás
                alatt áll — ha most csatlakoztatsz egy profilt, az átlag/vélemény csak a hónap
                fordulása után töltődik be.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
