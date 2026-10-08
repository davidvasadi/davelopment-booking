/**
 * A foglalóoldal-szerkesztő (admin) és az előnézet (`/{slug}?editor=1` iframe) közti üzenetek.
 * Mindkét fél azonos originről fut, minden üzenetet az origin ellenőrzésével fogadunk.
 *
 * admin → előnézet
 *   - `draft`:  a még nem mentett változások (a PlaceViewData mezőire illeszkedő patch)
 *   - `select`: a kijelölt elem azonosítója (sárga keret), null = nincs kijelölés
 *   - `view`:   a foglalás melyik lépését mutassa az előnézet (mintaadatokkal)
 * előnézet → admin
 *   - `ready`:  az előnézet betöltött, várja az aktuális draftot
 *   - `pick`:   a vendég-nézetben erre az elemre kattintottak (`data-edit-id`)
 *   - `step`:   foglalás-indító gombra kattintottak (`data-edit-step`) → a szerkesztő arra a lépésre vált
 */
export const EDITOR_MSG = 'dav-editor'

export type EditorToPreview =
  | { source: typeof EDITOR_MSG; type: 'draft'; patch: Record<string, unknown> }
  | { source: typeof EDITOR_MSG; type: 'select'; id: string | null }
  | { source: typeof EDITOR_MSG; type: 'view'; view: string }

export type PreviewToEditor =
  | { source: typeof EDITOR_MSG; type: 'ready' }
  | { source: typeof EDITOR_MSG; type: 'pick'; id: string }
  | { source: typeof EDITOR_MSG; type: 'step'; view: string }

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
