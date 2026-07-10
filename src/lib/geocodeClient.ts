/**
 * Kliens-oldali város-geokódolás a vendég-térképhez (OSM Nominatim).
 *
 * Miért kliensen? A VPS-en a séma-push megbízhatatlan, ezért NEM veszünk fel új
 * DB-táblát cache-nek. A böngésző geokódolja az adott üzlet néhány egyedi városát,
 * és localStorage-ban tárolja — így csak EGYSZER kérdez, utána azonnal van koordináta.
 *
 * Nominatim-illemtan: max ~1 kérés/mp (sorosan, késleltetéssel), a böngésző Referer-e
 * azonosítja az appot, a találat gyorsítótárba kerül (a „nincs találat" is, hogy ne
 * kérdezzünk újra). Csak a hiányzó (cache-eletlen) városokra megy hálózati hívás.
 */

const CACHE_KEY = 'schedulio.geocode.v1'
// [lat, lng] = megtalált; null = geokódolva, de nincs találat (negatív cache).
type Cache = Record<string, [number, number] | null>

const norm = (s: string) => s.trim().toLowerCase()

/** A geokód-cache egységes kulcsa: „város|ISO2". Ugyanezt használja a térkép a kikeresésnél. */
export function cityKey(name: string, iso: string): string {
  return `${norm(name)}|${iso.toUpperCase()}`
}

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') as Cache
  } catch {
    return {}
  }
}
function saveCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c))
  } catch {
    /* kvóta/private mód — cache nélkül is működik, csak újra geokódol */
  }
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Város→koordináta a megadott (név, ISO2) párokra. A talált koordinátákat adja vissza
 * `cityKey(name, iso)` kulcson. A hiányzókat sorosan geokódolja (rate-limit), a többit
 * a localStorage cache-ből azonnal.
 */
export async function geocodeCities(
  pairs: { name: string; iso: string }[],
): Promise<Record<string, [number, number]>> {
  const out: Record<string, [number, number]> = {}
  if (typeof window === 'undefined' || pairs.length === 0) return out

  const cache = loadCache()
  // Dedup a párokra (üzletenként pár egyedi város).
  const uniq = new Map<string, { name: string; iso: string }>()
  for (const p of pairs) {
    if (p.name?.trim() && p.iso?.trim()) uniq.set(cityKey(p.name, p.iso), p)
  }

  const misses: { key: string; name: string; iso: string }[] = []
  for (const [key, p] of uniq) {
    if (key in cache) {
      const v = cache[key]
      if (v) out[key] = v
    } else {
      misses.push({ key, name: p.name, iso: p.iso })
    }
  }

  for (let i = 0; i < misses.length; i++) {
    const m = misses[i]
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1` +
        `&city=${encodeURIComponent(m.name.trim())}&countrycodes=${m.iso.toLowerCase()}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      const data = (await res.json()) as { lat?: string; lon?: string }[]
      const hit = Array.isArray(data) ? data[0] : undefined
      if (hit?.lat && hit?.lon) {
        const ll: [number, number] = [parseFloat(hit.lat), parseFloat(hit.lon)]
        cache[m.key] = ll
        out[m.key] = ll
      } else {
        cache[m.key] = null // negatív cache: nincs találat, ne kérdezzük újra
      }
    } catch {
      /* hálózati hiba — NEM cache-eljük, később újrapróbálható */
    }
    // Nominatim: max 1 kérés/mp. Az utolsó után nem várunk.
    if (i < misses.length - 1) await sleep(1100)
  }

  saveCache(cache)
  return out
}
