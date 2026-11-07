/**
 * A foglalóoldal-szerkesztő (admin) és az előnézet (`/{slug}?editor=1` iframe) közti üzenetek.
 * Mindkét fél azonos originről fut, minden üzenetet az origin ellenőrzésével fogadunk.
 *
 * admin → előnézet
 *   - `draft`:  a még nem mentett változások (a PlaceViewData mezőire illeszkedő patch)
 *   - `select`: a kijelölt elem azonosítója (sárga keret), null = nincs kijelölés; `label`: a neve (a gyors-sáv elején)
 *   - `view`:   a foglalás melyik lépését mutassa az előnézet (mintaadatokkal)
 * előnézet → admin
 *   - `ready`:  az előnézet betöltött, várja az aktuális draftot
 *   - `pick`:   a vendég-nézetben erre az elemre kattintottak (`data-edit-id`)
 *   - `step`:   foglalás-indító gombra kattintottak (`data-edit-step`) → a szerkesztő arra a lépésre vált
 *   - `text`:   helyben írt szöveg (a kijelölt elem, pl. `name`, `desc`) — a szerkesztő a draftba írja
 *   - `close`:  a gyors-sáv X-ére kattintottak → a kijelölés vége
 *   - `action`: a gyors-sáv egy gombja (pl. szín, kötelező, elrejt, sorrend, beállítások, megnyitás) — `value` az értéke
 */
export const EDITOR_MSG = 'dav-editor'

export type EditorToPreview =
  | { source: typeof EDITOR_MSG; type: 'draft'; patch: Record<string, unknown> }
  | { source: typeof EDITOR_MSG; type: 'select'; id: string | null; label?: string | null; tools?: BarTool[] }
  | { source: typeof EDITOR_MSG; type: 'view'; view: string }

export type PreviewToEditor =
  | { source: typeof EDITOR_MSG; type: 'ready' }
  | { source: typeof EDITOR_MSG; type: 'pick'; id: string }
  | { source: typeof EDITOR_MSG; type: 'step'; view: string }
  | { source: typeof EDITOR_MSG; type: 'text'; id: string; value: string }
  | { source: typeof EDITOR_MSG; type: 'close' }
  | { source: typeof EDITOR_MSG; type: 'action'; id: string; action: string; value?: string | null }

/**
 * A kijelölt elem gyors-sávjának eszközei (design 21.6.3) — a szerkesztő dönti el, melyik elemnél mi van, az előnézet
 * kirajzolja, a kattintás `action` üzenetként megy vissza (a formázás helyben, a szövegen történik).
 *  · `format`: félkövér, dőlt, link (a helyben írt szövegen)
 *  · `color`: a szöveg színe — `options`: a választható színek (csak olvashatók), `value` a jelenlegi
 *  · `toggle`: igen/nem pill (pl. Kötelező, Elrejt)
 *  · `icon`: ikon-gomb (fel / le / beállítások)
 *  · `button`: feliratos sárga gomb (pl. „Megnyitás”, „Foglalás megnyitása”)
 *  · `note`: rövid felirat (pl. „Nyitvatartásból”)
 */
export type BarTool =
  | { t: 'format' }
  | { t: 'color'; value: string | null; options: { v: string; css: string; label: string }[] }
  | { t: 'toggle'; action: string; label: string; on: boolean }
  | { t: 'icon'; action: string; label: string; icon: 'up' | 'down' | 'settings' | 'bold' | 'italic'; on?: boolean }
  | { t: 'button'; action: string; label: string }
  | { t: 'note'; label: string }

/** Union-tagonként alkalmazott Omit (a sima Omit egy union közös mezőire szűkítene). */
type WithoutSource<T> = T extends unknown ? Omit<T, 'source'> : never

export function isEditorMessage<T extends { source: string }>(e: MessageEvent): e is MessageEvent<T> {
  return e.origin === window.location.origin && !!e.data && (e.data as { source?: unknown }).source === EDITOR_MSG
}

export function postToEditor(msg: WithoutSource<PreviewToEditor>) {
  window.parent?.postMessage({ source: EDITOR_MSG, ...msg }, window.location.origin)
}

export function postToPreview(frame: HTMLIFrameElement | null, msg: WithoutSource<EditorToPreview>) {
  frame?.contentWindow?.postMessage({ source: EDITOR_MSG, ...msg }, window.location.origin)
}
