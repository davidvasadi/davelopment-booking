/**
 * A publikus foglaló a vendég adatait (név, e-mail, telefon, irányítószám, város, cím) az ő SAJÁT böngészőjében
 * jegyzi meg üzletenként, hogy a következő foglalásnál ne kelljen újra beírnia. Szerver-oldali
 * keresés szándékosan nincs: az bárkinek kiadná mások adatait. Minden hozzáférés try/catch-ben
 * (privát mód, letiltott tárolás).
 */
export type RememberedGuest = { name: string; email: string; phone: string; country: string; city: string; zip?: string; address?: string }

const keyFor = (placeId: string) => `dav_guest_${placeId}`

export function loadGuest(placeId: string): RememberedGuest | null {
  try {
    const raw = window.localStorage.getItem(keyFor(placeId))
    if (!raw) return null
    const g = JSON.parse(raw) as Partial<RememberedGuest>
    if (!g || typeof g.name !== 'string') return null
    return { name: g.name, email: g.email ?? '', phone: g.phone ?? '', country: g.country ?? 'HU', city: g.city ?? '', zip: g.zip ?? '', address: g.address ?? '' }
  } catch {
    return null
  }
}

export function saveGuest(placeId: string, g: RememberedGuest): void {
  try { window.localStorage.setItem(keyFor(placeId), JSON.stringify(g)) } catch { /* nem kritikus */ }
}

export function forgetGuest(placeId: string): void {
  try { window.localStorage.removeItem(keyFor(placeId)) } catch { /* nem kritikus */ }
}
