/** A felhasználó saját eszközén (böngészőjében) megjegyzett nézet — a „Nézet és szűrők” lap „Mentés” gombja írja,
 *  az oldal betöltéskor ebből indul. Csak kényelmi beállítás: ha a tárolás nem elérhető (privát mód), alapnézet marad. */
export function readSavedView<T>(key: string): T | null {
  try { const v = localStorage.getItem(`davelopment:view:${key}`); return v ? (JSON.parse(v) as T) : null } catch { return null }
}
export function writeSavedView(key: string, value: unknown) {
  try { localStorage.setItem(`davelopment:view:${key}`, JSON.stringify(value)) } catch { /* privát mód — nem baj */ }
}
